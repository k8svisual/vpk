import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute, basename, relative } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import {
  buildGraph,
  projectOwnerRef,
  projectSecuritySubjects,
  projectRbacSubject,
  whoCan,
  rbacVocabulary,
  type WhoCanResourceRef,
  projectContainerImages,
  projectClusterNodeField,
  projectClusterWheel,
  type ResourceGraph,
  type OwnerRefFocus,
} from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { renderOwnerRefSvg } from './render/ownerRefSvg';
import { renderRbacSvg } from './render/rbacSvg';
import { captureCore } from './capture/cliSource';
import { listResources } from './resources';
import { listNetworkServices, listNetworkNodes } from './network';
import { listStorageGroups } from './storage';
import { getSchematic } from './schematic';
import { renderSchematicSvg } from './render/schematicSvg';
import { redactSecret } from './redact';
import { loadSettings, saveSettings, type Settings } from './settings';
import { computeStats } from './stats';
import { listenWithRetry } from './portRetry';
import { listSnapshotFiles } from './listSnapshotFiles';

// P3 slice server: snapshot manager (list/load/capture) + ownerRef SVG + definitions.
const here = dirname(fileURLToPath(import.meta.url));
const defaultSnapshot = process.env.VPK_SNAPSHOT ?? join(here, '../test/fixtures/minikube.snapshot.json');
const cli = (process.env.VPK_CLI ?? 'kubectl').split(' ').filter(Boolean);
const configPath = process.env.VPK_CONFIG_FILE ?? join(here, '../../../vpkconfig.json');
const requestedPort = Number(process.env.PORT ?? 4200);
// Discovery file for the Vite dev server (which proxies to us but can't know our port ahead of time if the
// requested one was taken) — written once we've actually bound, read by vite.config.ts at its own startup.
const portFilePath = process.env.VPK_PORT_FILE ?? join(here, '../../../.vpk-port');
const MAX_PORT_ATTEMPTS = 20;
let actualPort = requestedPort;

let settings: Settings = loadSettings(configPath, process.env.VPK_SNAPSHOT_DIR ?? dirname(defaultSnapshot));

let graph: ResourceGraph = buildGraph(loadSnapshotFile(defaultSnapshot));
let currentPath = defaultSnapshot;

function setSnapshot(path: string): void {
  graph = buildGraph(loadSnapshotFile(path));
  currentPath = path;
}
function resolve(path: string): string {
  return isAbsolute(path) ? path : join(settings.snapshotDir, path);
}

const app = Fastify();

app.get('/health', async () => ({
  ok: true,
  snapshot: currentPath,
  nodes: graph.nodes.size,
  edges: graph.edges.length,
  deduped: graph.deduped,
}));

app.get('/snapshots', async () => {
  const files = listSnapshotFiles(settings.snapshotDir);
  // Relative to snapshotDir (not just the basename) so a nested entry like "capture-a/vpk.snapshot.json"
  // actually matches one of `files` for the dropdown to show it selected — two different capture
  // subdirectories can easily share the same file name.
  return { dir: settings.snapshotDir, current: relative(settings.snapshotDir, currentPath), files };
});

app.get('/settings', async () => settings);

app.post('/settings', async (req, reply) => {
  const body = (req.body ?? {}) as Partial<Settings>;
  const nextSnapshotDir = typeof body.snapshotDir === 'string' && body.snapshotDir ? body.snapshotDir : settings.snapshotDir;
  if (!existsSync(nextSnapshotDir)) {
    reply.code(400);
    return { error: `snapshot directory does not exist: ${nextSnapshotDir}` };
  }
  settings = {
    snapshotDir: nextSnapshotDir,
    redactSecrets: typeof body.redactSecrets === 'boolean' ? body.redactSecrets : settings.redactSecrets,
    disablePullingSecrets: typeof body.disablePullingSecrets === 'boolean' ? body.disablePullingSecrets : settings.disablePullingSecrets,
  };
  saveSettings(configPath, settings);
  return settings;
});

app.post('/load', async (req, reply) => {
  const { path } = (req.body ?? {}) as { path?: string };
  if (!path) {
    reply.code(400);
    return { error: 'path required' };
  }
  try {
    setSnapshot(resolve(path));
    return { ok: true, snapshot: basename(currentPath), nodes: graph.nodes.size };
  } catch (e: unknown) {
    reply.code(400);
    return { error: String(e) };
  }
});

app.post('/capture', async (req, reply) => {
  // keepSecretData/keepConfigMapData are per-capture choices from the "Capture from cluster" confirm modal's
  // checkboxes — they default to the persisted Settings toggle (Secrets only; there's no equivalent persisted
  // setting for ConfigMaps) rather than requiring the client to always send them explicitly.
  const { name, keepSecretData, keepConfigMapData } = (req.body ?? {}) as {
    name?: string;
    keepSecretData?: boolean;
    keepConfigMapData?: boolean;
  };
  try {
    const { items, manifest } = await captureCore({
      cli,
      keepSecretData: keepSecretData ?? !settings.disablePullingSecrets,
      keepConfigMapData: keepConfigMapData ?? true,
    });
    const safe = (name || `capture-${manifest.captured}`).replace(/[^a-z0-9_.-]/gi, '_');
    const file = join(settings.snapshotDir, `${safe}.json`);
    writeFileSync(file, JSON.stringify({ ...manifest, items }));
    setSnapshot(file);
    return { ok: true, snapshot: basename(file), nodes: graph.nodes.size, items: items.length };
  } catch (e: unknown) {
    reply.code(500);
    return { error: String(e) };
  }
});

app.get('/resources', async () => listResources(graph));

/** Distinct, sorted namespace names present in the loaded snapshot — for namespace-select dropdowns (the
 *  OwnerRef view's, currently) without pulling the full (potentially huge) /resources list just to derive it. */
app.get('/namespaces', async () => {
  const namespaces = new Set<string>();
  for (const r of graph.nodes.values()) if (r.namespace) namespaces.add(r.namespace);
  return [...namespaces].sort();
});

app.get('/network', async (req) => {
  const q = req.query as { ns?: string };
  return listNetworkServices(graph, q.ns || undefined);
});

app.get('/network/nodes', async () => listNetworkNodes(graph));

app.get('/security', async () => projectSecuritySubjects(graph));

app.get('/storage', async () => listStorageGroups(graph));

app.get('/container-images', async () => projectContainerImages(graph));

app.get('/scene/nodes', async () => projectClusterNodeField(graph));

app.get('/scene/wheel', async () => projectClusterWheel(graph));

app.get('/schematic', async (req, reply) => {
  const q = req.query as { id?: string };
  const dto = q.id ? getSchematic(graph, q.id) : undefined;
  if (!dto) {
    reply.code(404);
    return { error: 'not found (not a Pod id in this snapshot)' };
  }
  return dto;
});

app.get('/schematic.svg', async (req, reply) => {
  const q = req.query as { id?: string };
  const dto = q.id ? getSchematic(graph, q.id) : undefined;
  if (!dto) {
    reply.code(404);
    return { error: 'not found (not a Pod id in this snapshot)' };
  }
  reply.header('content-type', 'image/svg+xml');
  return renderSchematicSvg(dto);
});

// One subject's RBAC schematic. Addressable two ways: by explicit subject identity (kind/name/ns — how the
// standalone RBAC view's subject picker asks), or by a ServiceAccount's resource id (`saId` — how the Pod
// Schematic's "RBAC" link asks, since that diagram only knows the SA icon it drew).
app.get('/rbac.svg', async (req, reply) => {
  const q = req.query as { kind?: string; name?: string; ns?: string; saId?: string };
  let kind = q.kind;
  let name = q.name;
  let ns = q.ns || undefined;
  if (q.saId) {
    const sa = graph.nodes.get(q.saId);
    if (sa) {
      kind = sa.kind;
      name = sa.name;
      ns = sa.namespace;
    }
  }
  const view = kind && name ? projectRbacSubject(graph, kind, name, ns) : undefined;
  if (!view) {
    reply.code(404);
    return { error: 'no RBAC bindings found for this subject in this snapshot' };
  }
  reply.header('content-type', 'image/svg+xml');
  return renderRbacSvg(view);
});

// Vocab for the "Who can" query builder's verb/resource autocomplete.
app.get('/who-can/vocab', async () => rbacVocabulary(graph));

// "Who can <verbs> on <resources> in <namespace>?" — verbs/resources are comma-separated; each resource is
// `group:resource` (empty group segment = core, e.g. `:pods`). mode: any (default) | all.
app.get('/who-can', async (req) => {
  const q = req.query as { verbs?: string; resources?: string; ns?: string; mode?: string };
  const verbs = (q.verbs ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const resources: WhoCanResourceRef[] = (q.resources ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      const i = tok.indexOf(':');
      return i < 0 ? { apiGroup: '', resource: tok } : { apiGroup: tok.slice(0, i), resource: tok.slice(i + 1) };
    });
  return whoCan(graph, { verbs, resources, namespace: q.ns || undefined, mode: q.mode === 'all' ? 'all' : 'any' });
});

app.get('/ownerref', async (req, reply) => {
  const q = req.query as { ns?: string; id?: string };
  const focus: OwnerRefFocus = q.id ? { resourceId: q.id } : { namespace: q.ns ?? 'kube-system' };
  reply.header('content-type', 'image/svg+xml');
  return renderOwnerRefSvg(projectOwnerRef(graph, focus), q.id);
});

app.get('/definition', async (req, reply) => {
  const q = req.query as { id?: string };
  const resource = q.id ? graph.nodes.get(q.id) : undefined;
  if (!resource) {
    reply.code(404);
    return { error: 'not found' };
  }
  return settings.redactSecrets ? redactSecret(resource.raw) : resource.raw;
});

app.get('/stats', async () =>
  computeStats({
    graph,
    port: actualPort,
    snapshotDir: settings.snapshotDir,
    currentPath,
    redactSecrets: settings.redactSecrets,
    disablePullingSecrets: settings.disablePullingSecrets,
  }),
);

// Confirmed client-side (a modal) before this ever fires — responds first, THEN exits, so the browser's
// fetch actually resolves instead of racing a closed connection.
app.post('/shutdown', async () => {
  setTimeout(() => process.exit(0), 200);
  return { ok: true };
});

// Binds starting at `requestedPort`, trying the next port up on EADDRINUSE rather than crashing — a locally
// running second instance, or anything else already on the default port, shouldn't block VpK from starting at
// all. Writes the port it actually bound to `portFilePath` so the Vite dev server (which can't know our port
// ahead of time if the requested one was taken) can discover where to proxy API calls.
listenWithRetry(
  requestedPort,
  (p) => app.listen({ port: p, host: '127.0.0.1' }).then(() => undefined),
  { maxAttempts: MAX_PORT_ATTEMPTS, onRetry: (busy, next) => console.log(`vpk server: port ${busy} is already in use, trying ${next}...`) },
)
  .then((boundPort) => {
    actualPort = boundPort;
    writeFileSync(portFilePath, String(actualPort));
    console.log(`vpk server → http://127.0.0.1:${actualPort}  (${graph.nodes.size} nodes, snapshots in ${settings.snapshotDir})`);
    if (actualPort !== requestedPort) {
      console.log(`vpk server: requested port ${requestedPort} was busy — the web dev server will find me at ${actualPort} automatically`);
    }
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
