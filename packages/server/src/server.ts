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
  projectVolumeUsage,
  projectServiceNetwork,
  projectNetworkTopology,
  projectNetworkLayers,
  inferNetworkPlane,
  inferNetworkEdge,
  projectPortUsage,
  projectEvents,
  projectClusterNodeField,
  projectClusterWheel,
  type ResourceGraph,
  type OwnerRefFocus,
  type RawObject,
} from '@vpk/core';
import { DEMO_TEMPLATES, extractPlaceholders, fillTemplate, resolvePattern } from '@vpk/demo-data';
import {
  appendGenerated,
  clearWorkingSet,
  finishToSnapshot,
  getStagedCount,
  getStagedNames,
  listWorkingSet,
  runRbacBundle,
  runConfigSecretBundle,
  runConfigSecretRefsBundle,
  runStorageCsiBundle,
  runCsiNodeSync,
  runPvcPvBundle,
  runServiceBundle,
  runNamespaceBundle,
  runDaemonSetBundle,
  runDeploymentBundle,
  runPodsPerNodeBundle,
  runWorkloadsBundle,
  runServiceAccountBundle,
  runEventsBundle,
  runGatewayBundle,
  runNetworkPolicyBundle,
  runQuotaLimitBundle,
  runSystemPodsBundle,
} from './demoData';
import { loadSnapshotFile } from './snapshotFile';
import { renderOwnerRefSvg } from './render/ownerRefSvg';
import { renderRbacSvg } from './render/rbacSvg';
import { captureCore } from './capture/cliSource';
import { listResources } from './resources';
import { listNetworkServices, listNetworkNodes } from './network';
import { listStorageGroups } from './storage';
import { getSchematic } from './schematic';
import { renderSchematicSvg } from './render/schematicSvg';
import { renderServiceFlowSvg, renderIngressPathSvg, renderServiceNodesSvg, renderTopologySvg } from './render/networkSvg';
import { redactSecret } from './redact';
import { loadSettings, saveSettings, type Settings } from './settings';
import { demoSettingsAppPath, demoSettingsSnapshotDirPath, saveDemoSettings, loadDemoSettings, type DemoDataSettings } from './demoSettings';
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
  // setting for ConfigMaps) rather than requiring the client to always send them explicitly. `cli`, if given,
  // is a per-capture override of the kubectl-compatible command (e.g. "oc" for OpenShift, or "kubectl
  // --context foo") — split into an argv array the same way the server's own VPK_CLI env var is, falling back
  // to that default (the module-level `cli` array below) when omitted or blank.
  const { name, keepSecretData, keepConfigMapData, cli: cliOverride } = (req.body ?? {}) as {
    name?: string;
    keepSecretData?: boolean;
    keepConfigMapData?: boolean;
    cli?: string;
  };
  try {
    const { items, manifest } = await captureCore({
      cli: cliOverride?.trim() ? cliOverride.trim().split(/\s+/) : cli,
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

// Cluster-wide "ports in use" — flat list; the view aggregates/filters client-side.
app.get('/network/ports', async () => projectPortUsage(graph));

// Conceptual network layers listing (top-right reference block), enriched with real per-layer counts.
app.get('/network/layers', async () => projectNetworkLayers(graph));

// Cluster topology (Node CIDR / overlay) diagram, with the inferred network-plane summary header.
app.get('/network/topology.svg', async (_req, reply) => {
  reply.header('content-type', 'image/svg+xml');
  return renderTopologySvg(projectNetworkTopology(graph), inferNetworkPlane(graph));
});

// The three Service-scoped diagrams, all driven by one Service id: flow (Client→Service→Pods), ingress
// (north-south entry path), nodes (Service × the Nodes its pods land on).
app.get('/network/diagram.svg', async (req, reply) => {
  const q = req.query as { id?: string; type?: string };
  const view = q.id ? projectServiceNetwork(graph, q.id) : undefined;
  if (!view) {
    reply.code(404);
    return { error: 'not found (not a Service id in this snapshot)' };
  }
  reply.header('content-type', 'image/svg+xml');
  if (q.type === 'ingress') return renderIngressPathSvg(view, inferNetworkEdge(graph));
  if (q.type === 'nodes') return renderServiceNodesSvg(view, inferNetworkPlane(graph));
  return renderServiceFlowSvg(view);
});

// The real EndpointSlice objects backing a Service — the Ingress Path diagram fetches this to show a modal
// when a Service has more than one (Kubernetes splits into multiple past a slice's endpoint cap, or per
// address family for dual-stack Services).
app.get('/network/endpointslices', async (req, reply) => {
  const q = req.query as { id?: string };
  const view = q.id ? projectServiceNetwork(graph, q.id) : undefined;
  if (!view) {
    reply.code(404);
    return { error: 'not found (not a Service id in this snapshot)' };
  }
  return view.endpointSlices;
});

app.get('/security', async () => projectSecuritySubjects(graph));

app.get('/storage', async () => listStorageGroups(graph));

app.get('/storage-counts', async () => projectVolumeUsage(graph));

// Cluster-wide Events — flat list, newest-first; the view aggregates/filters client-side (same pattern as
// /network/ports).
app.get('/events', async () => projectEvents(graph));

app.get('/container-images', async () => projectContainerImages(graph));

// Both projections below run synchronously over the FULL graph (no await inside) — on a large snapshot that
// can take long enough to block the single-threaded event loop, which looks to the client like the request
// (and every other request queued behind it) just hangs with no error. Logged so a slow/stuck 3D view shows
// up here as a duration instead of silence.
app.get('/scene/nodes', async () => {
  const start = performance.now();
  const result = projectClusterNodeField(graph);
  console.log(`[scene/nodes] ${graph.nodes.size} resources -> ${result.length} field nodes in ${(performance.now() - start).toFixed(0)}ms`);
  return result;
});

app.get('/scene/wheel', async () => {
  const start = performance.now();
  const result = projectClusterWheel(graph);
  console.log(`[scene/wheel GET] ${graph.nodes.size} resources in ${(performance.now() - start).toFixed(0)}ms`);
  return result;
});

// POST (not GET+query) since the Field view's "view in Wheel" button can hand over hundreds of Node resource
// ids — comfortably past a safe URL/header length as a query string, no problem as a JSON body.
app.post('/scene/wheel', async (req) => {
  const { nodeIds } = (req.body ?? {}) as { nodeIds?: string[] };
  const start = performance.now();
  const result = projectClusterWheel(graph, nodeIds && nodeIds.length > 0 ? new Set(nodeIds) : undefined);
  console.log(
    `[scene/wheel POST] ${graph.nodes.size} resources, nodeIds=${nodeIds?.length ?? 'all'} in ${(performance.now() - start).toFixed(0)}ms`,
  );
  return result;
});

app.get('/demo/templates', async () => DEMO_TEMPLATES);

// Every distinct {{placeholder}} name in one Kind's template — the Demo Data screen builds its generation
// form from this, one field per name, rather than hand-coding a form per Kind.
app.get('/demo/templates/:kind/placeholders', async (req, reply) => {
  const { kind } = req.params as { kind: string };
  const template = DEMO_TEMPLATES[kind];
  if (!template) {
    reply.code(404);
    return { error: `no template for kind "${kind}"` };
  }
  return extractPlaceholders(template);
});

// What's currently staged in <snapshotDir>/demo-wip, one count per Kind — always read fresh from disk (see
// demoData.ts) so this reflects the working directory's real state, not some in-memory snapshot of it.
app.get('/demo/working', async () => listWorkingSet(settings.snapshotDir));

interface GenerateBody {
  kind?: string;
  count?: number;
  values?: Record<string, string>;
  /** Node-only: the first `masterCount` of this call's `count` get role=master, the rest role=worker — set
   *  directly rather than through `values.role`'s pattern, since "M out of N" isn't expressible as a
   *  resolvePattern token (that's ranges/randoms/guids over a single field, not a categorical split). Omit to
   *  fall back to `values.role`'s pattern as before (untouched for every other Kind). */
  masterCount?: number;
}

/** Shared by /demo/generate and /demo/validate — resolves every placeholder for `count` items using that
 *  item's GLOBAL index (continuing from `alreadyStaged`), applying the Node masterCount split when given.
 *  Throws (caller catches) on a malformed pattern or an out-of-range masterCount. */
function buildGeneratedItems(
  template: RawObject,
  kind: string,
  count: number,
  values: Record<string, string> | undefined,
  masterCount: number | undefined,
  alreadyStaged: number,
  namespaces: string[],
): RawObject[] {
  if (kind === 'Node' && masterCount !== undefined && (masterCount < 0 || masterCount > count)) {
    throw new Error(`masterCount must be between 0 and count (${count})`);
  }
  const items: RawObject[] = [];
  for (let i = 1; i <= count; i++) {
    const globalIndex = alreadyStaged + i;
    const filled: Record<string, string> = {};
    for (const [key, pattern] of Object.entries(values ?? {})) {
      if (kind === 'Node' && key === 'role' && masterCount !== undefined) continue; // set explicitly below
      filled[key] = resolvePattern(pattern, globalIndex, namespaces);
    }
    if (kind === 'Node' && masterCount !== undefined) filled.role = i <= masterCount ? 'master' : 'worker';
    items.push(fillTemplate(template, filled));
  }
  return items;
}

// Fills a Kind's template `count` times — each placeholder's pattern (from `values`) is resolved per item via
// resolvePattern (supporting {n}, {guid}, {image}, {namespace}, and {from-to}/{from-to,step}/{from-to,Random}
// ranges — multiple sequential ranges in one pattern odometer/carry together, e.g. an IP's
// "10.0.{0-255}.{0-255}") using that item's GLOBAL index (continuing from however many of this Kind are
// ALREADY staged — see getStagedCount — so e.g. generating 500 Nodes across five calls of 100 still produces
// 500 unique names/IPs instead of 5 colliding batches of 1-100), then appends the results to that Kind's
// staged List file. {namespace} round-robins through whatever Namespaces are currently staged — generate
// those first (see /demo/bundles/namespaces) if any pattern uses it. For Node, `masterCount` (out of this
// call's `count`) sets role=master/worker directly instead of via values.role's pattern.
app.post('/demo/generate', async (req, reply) => {
  const { kind, count, values, masterCount } = (req.body ?? {}) as GenerateBody;
  const template = kind ? DEMO_TEMPLATES[kind] : undefined;
  if (!kind || !template) {
    reply.code(400);
    return { error: `no template for kind "${kind}"` };
  }
  if (!count || count < 1) {
    reply.code(400);
    return { error: 'count must be at least 1' };
  }
  try {
    const alreadyStaged = getStagedCount(settings.snapshotDir, kind);
    const namespaces = getStagedNames(settings.snapshotDir, 'Namespace');
    const items = buildGeneratedItems(template, kind, count, values, masterCount, alreadyStaged, namespaces);
    const total = appendGenerated(settings.snapshotDir, kind, (template.apiVersion as string) ?? 'v1', items);
    return { ok: true, kind, added: count, total };
  } catch (e: unknown) {
    reply.code(400);
    return { error: String(e) };
  }
});

// Dry run of /demo/generate — resolves every pattern and validates masterCount (if given) WITHOUT staging
// anything, so a mistake (a malformed range token, masterCount > count, ...) surfaces before committing to a
// possibly-large count. Returns the first and last item it would have produced as a sanity-check preview.
app.post('/demo/validate', async (req, reply) => {
  const { kind, count, values, masterCount } = (req.body ?? {}) as GenerateBody;
  const template = kind ? DEMO_TEMPLATES[kind] : undefined;
  if (!kind || !template) {
    reply.code(400);
    return { error: `no template for kind "${kind}"` };
  }
  if (!count || count < 1) {
    reply.code(400);
    return { error: 'count must be at least 1' };
  }
  try {
    const alreadyStaged = getStagedCount(settings.snapshotDir, kind);
    const namespaces = getStagedNames(settings.snapshotDir, 'Namespace');
    const items = buildGeneratedItems(template, kind, count, values, masterCount, alreadyStaged, namespaces);
    const sample = items.length > 1 ? [items[0], items[items.length - 1]] : items;
    return { ok: true, count, sample };
  } catch (e: unknown) {
    reply.code(400);
    return { error: String(e) };
  }
});

// Discards staged data — one Kind (?kind=X) or the whole working set.
app.delete('/demo/working', async (req) => {
  const q = req.query as { kind?: string };
  clearWorkingSet(settings.snapshotDir, q.kind || undefined);
  return { ok: true };
});

// Whatever's saved at each of the two Demo Data settings locations (see demoSettings.ts) — null for either
// that's never been saved to yet, so the client can grey out a "Load" button with nothing behind it.
app.get('/demo/settings', async () => ({
  app: loadDemoSettings(demoSettingsAppPath(configPath)),
  snapshot: loadDemoSettings(demoSettingsSnapshotDirPath(settings.snapshotDir)),
}));

// Persists the client's current Demo Data screen configuration (bundle fields, per-Kind form values, Node
// master/worker split — an opaque blob as far as the server's concerned) to BOTH the app directory and the
// current snapshot directory's root, so it's recoverable however you get back to this screen later.
app.post('/demo/settings/save', async (req) => {
  const body = (req.body ?? {}) as DemoDataSettings;
  const appPath = demoSettingsAppPath(configPath);
  const snapshotPath = demoSettingsSnapshotDirPath(settings.snapshotDir);
  saveDemoSettings([appPath, snapshotPath], body);
  return { ok: true, paths: [appPath, snapshotPath] };
});

app.get('/demo/settings/load', async (req, reply) => {
  const { location } = (req.query as { location?: string }) ?? {};
  const path = location === 'snapshot' ? demoSettingsSnapshotDirPath(settings.snapshotDir) : demoSettingsAppPath(configPath);
  const loaded = loadDemoSettings(path);
  if (!loaded) {
    reply.code(404);
    return { error: 'no settings saved there yet' };
  }
  return loaded;
});

// Merges every staged Kind into a real snapshot file (see demoData.ts's finishToSnapshot) — non-destructive,
// the working set is left in place until explicitly cleared.
app.post('/demo/finish', async (req, reply) => {
  const { name, simulatePodChurn, podChurnPercent } = (req.body ?? {}) as {
    name?: string;
    simulatePodChurn?: boolean;
    podChurnPercent?: number;
  };
  if (!name) {
    reply.code(400);
    return { error: 'name required' };
  }
  const result = finishToSnapshot(settings.snapshotDir, name, {}, { simulatePodChurn: !!simulatePodChurn, podChurnPercent: podChurnPercent ?? 10 });
  if (result.count === 0) {
    reply.code(400);
    return { error: 'nothing staged — generate some demo data first' };
  }
  return { ok: true, file: relative(settings.snapshotDir, result.file), count: result.count, warnings: result.warnings };
});

// Cross-Kind "bundle" generators (see @vpk/demo-data's bundles.ts) — each stages several related Kinds at
// once, some reading whatever's already staged (Nodes for CSINode, Pods for PVC/Service) rather than a
// user-entered pattern. Unlike /demo/generate, these are meant to be re-run idempotently-ish: RBAC/Config-
// Secret/Storage-CSI are a fixed pool (re-running just re-appends the same fixed set — call /demo/working
// + clear first if you don't want duplicates), CSINode sync REPLACES to match the current Node set exactly.

app.post('/demo/bundles/rbac', async (req) => {
  const { namespace } = (req.body ?? {}) as { namespace?: string };
  return { ok: true, totals: runRbacBundle(settings.snapshotDir, namespace || 'default') };
});

// 5 ConfigMaps + 5 Secrets in EVERY currently-staged Namespace, created only as needed — see
// demoData.ts's runConfigSecretBundle.
app.post('/demo/bundles/config-secrets', async () => {
  const totals = runConfigSecretBundle(settings.snapshotDir);
  if (!totals.ConfigMap) {
    const warning = getStagedNames(settings.snapshotDir, 'Namespace').length
      ? 'every currently-staged Namespace already has its ConfigMap/Secret pool'
      : 'no Namespaces staged yet — generate some Namespaces first';
    return { ok: true, totals, warning };
  }
  return { ok: true, totals };
});

// At least one ConfigMap ref + one Secret ref (via envFrom) on every currently-staged Pod that doesn't
// already have one — see demoData.ts's runConfigSecretRefsBundle. Also stages the ConfigMap/Secret pool in
// any Namespace that needs it for those new references to resolve.
app.post('/demo/bundles/config-secret-refs', async () => {
  const totals = runConfigSecretRefsBundle(settings.snapshotDir);
  if (Object.keys(totals).length === 0) {
    const warning = getStagedCount(settings.snapshotDir, 'Pod') > 0
      ? 'every currently-staged Pod already references a ConfigMap + Secret'
      : 'no Pods staged yet — generate some Pods first';
    return { ok: true, totals, warning };
  }
  return { ok: true, totals };
});

app.post('/demo/bundles/storage-csi', async () => {
  return { ok: true, totals: runStorageCsiBundle(settings.snapshotDir) };
});

app.post('/demo/bundles/csi-node-sync', async () => {
  const total = runCsiNodeSync(settings.snapshotDir);
  if (total === 0) return { ok: true, total, warning: 'no Nodes staged yet — generate some Nodes first' };
  return { ok: true, total };
});

app.post('/demo/bundles/pvc-pv', async (req, reply) => {
  const { percent } = (req.body ?? {}) as { percent?: number };
  if (!percent || percent <= 0 || percent > 100) {
    reply.code(400);
    return { error: 'percent must be between 1 and 100' };
  }
  const totals = runPvcPvBundle(settings.snapshotDir, percent);
  if (!totals.PersistentVolumeClaim) return { ok: true, totals, warning: 'no Pods staged yet — generate some Pods first' };
  return { ok: true, totals };
});

app.post('/demo/bundles/services', async (req, reply) => {
  const { podPercent, sharedPercent } = (req.body ?? {}) as { podPercent?: number; sharedPercent?: number };
  if (!podPercent || podPercent <= 0 || podPercent > 100 || sharedPercent === undefined || sharedPercent < 0 || sharedPercent > 100) {
    reply.code(400);
    return { error: 'podPercent must be 1-100 and sharedPercent must be 0-100' };
  }
  const totals = runServiceBundle(settings.snapshotDir, podPercent, sharedPercent);
  if (!totals.Service) return { ok: true, totals, warning: 'no Pods staged yet — generate some Pods first' };
  return { ok: true, totals };
});

// Required system namespaces (default/kube-system/kube-public/kube-node-lease), skipping any already staged,
// plus `additionalCount` freshly-named ones (demo-ns-N) — see bundles.ts's buildNamespaceBundle.
app.post('/demo/bundles/namespaces', async (req, reply) => {
  const { additionalCount } = (req.body ?? {}) as { additionalCount?: number };
  if (additionalCount === undefined || additionalCount < 0) {
    reply.code(400);
    return { error: 'additionalCount must be 0 or more' };
  }
  return { ok: true, totals: runNamespaceBundle(settings.snapshotDir, additionalCount) };
});

// 8-13 DaemonSets per currently-staged Node, randomly assigned, each with one owned Pod scheduled to it.
app.post('/demo/bundles/daemonsets', async () => {
  const totals = runDaemonSetBundle(settings.snapshotDir);
  if (!totals.DaemonSet) return { ok: true, totals, warning: 'no Nodes staged yet — generate some Nodes first' };
  return { ok: true, totals };
});

// Deployment -> ReplicaSet (1-5 replicas, randomly picked) -> Pod ownership for every currently un-owned Pod.
app.post('/demo/bundles/deployments', async () => {
  const totals = runDeploymentBundle(settings.snapshotDir);
  if (!totals.Deployment) return { ok: true, totals, warning: 'no un-owned Pods staged — generate some Pods first' };
  return { ok: true, totals };
});

// Pods per currently-staged Node, count resolved from `podsPerNodePattern` (e.g. "{100-150,Random}"), split
// randomly into Running/Succeeded, plus `failedCount` Failed and `warningCount` Pending ("Warning") Pods
// scattered across Worker Nodes only — see bundles.ts's buildPodsPerNode.
app.post('/demo/bundles/pods-per-node', async (req, reply) => {
  const { podsPerNodePattern, failedCount, warningCount } = (req.body ?? {}) as {
    podsPerNodePattern?: string;
    failedCount?: number;
    warningCount?: number;
  };
  if (!podsPerNodePattern || failedCount === undefined || failedCount < 0 || warningCount === undefined || warningCount < 0) {
    reply.code(400);
    return { error: 'podsPerNodePattern is required and failedCount/warningCount must be 0 or more' };
  }
  const totals = runPodsPerNodeBundle(settings.snapshotDir, podsPerNodePattern, failedCount, warningCount);
  if (!totals.Pod) return { ok: true, totals, warning: 'no Nodes staged yet — generate some Nodes first' };
  return { ok: true, totals };
});

// CronJobs, Jobs, and StatefulSets, each a percent of the currently-staged total Pod count — see
// bundles.ts's buildWorkloadsBundle. StatefulSets get real per-replica PVC+PV.
app.post('/demo/bundles/workloads', async (req, reply) => {
  const { cronJobPercent, statefulSetPercent, jobPercent } = (req.body ?? {}) as {
    cronJobPercent?: number;
    statefulSetPercent?: number;
    jobPercent?: number;
  };
  const percents = [cronJobPercent, statefulSetPercent, jobPercent];
  if (percents.some((p) => p === undefined || p < 0 || p > 100)) {
    reply.code(400);
    return { error: 'cronJobPercent, statefulSetPercent, and jobPercent must each be 0-100' };
  }
  const totals = runWorkloadsBundle(settings.snapshotDir, cronJobPercent as number, statefulSetPercent as number, jobPercent as number);
  if (Object.keys(totals).length === 0) return { ok: true, totals, warning: 'no Pods staged yet — generate some Pods first' };
  return { ok: true, totals };
});

// One ServiceAccount per currently-staged Namespace, created only as needed (skips Namespaces that already
// have one) — see bundles.ts's buildServiceAccountBundle.
app.post('/demo/bundles/service-accounts', async () => {
  const totals = runServiceAccountBundle(settings.snapshotDir);
  if (!totals.ServiceAccount) return { ok: true, totals, warning: 'no Namespaces staged yet — generate some Namespaces first' };
  return { ok: true, totals };
});

// Warning Events for Failed/Pending ("Warning") Pods; optionally the standard 5-step launch sequence for
// every staged Pod too — see bundles.ts's buildEventsForPods.
app.post('/demo/bundles/events', async (req, reply) => {
  const { includeStandardLaunchEvents } = (req.body ?? {}) as { includeStandardLaunchEvents?: boolean };
  if (typeof includeStandardLaunchEvents !== 'boolean') {
    reply.code(400);
    return { error: 'includeStandardLaunchEvents must be a boolean' };
  }
  const totals = runEventsBundle(settings.snapshotDir, includeStandardLaunchEvents);
  if (!totals.Event) return { ok: true, totals, warning: 'no Pods staged yet — generate some Pods first' };
  return { ok: true, totals };
});

// One Gateway + one GatewayClass per `podsPerGateway` staged Pods, plus an HTTPRoute for `httpRoutePercent`%
// of Pods that already have a Service — see bundles.ts's buildGatewayBundle.
app.post('/demo/bundles/gateway', async (req, reply) => {
  const { podsPerGateway, httpRoutePercent } = (req.body ?? {}) as { podsPerGateway?: number; httpRoutePercent?: number };
  if (!podsPerGateway || podsPerGateway < 1 || httpRoutePercent === undefined || httpRoutePercent < 0 || httpRoutePercent > 100) {
    reply.code(400);
    return { error: 'podsPerGateway must be 1 or more and httpRoutePercent must be 0-100' };
  }
  const totals = runGatewayBundle(settings.snapshotDir, podsPerGateway, httpRoutePercent);
  if (!totals.Gateway) return { ok: true, totals, warning: 'no Pods staged yet — generate some Pods first' };
  return { ok: true, totals };
});

// A default-deny-ingress NetworkPolicy for `percent`% of currently-staged Namespaces — see bundles.ts's
// buildNetworkPolicyBundle.
app.post('/demo/bundles/network-policies', async (req, reply) => {
  const { percent } = (req.body ?? {}) as { percent?: number };
  if (percent === undefined || percent < 0 || percent > 100) {
    reply.code(400);
    return { error: 'percent must be 0-100' };
  }
  const totals = runNetworkPolicyBundle(settings.snapshotDir, percent);
  if (!totals.NetworkPolicy) return { ok: true, totals, warning: 'no Namespaces staged yet — generate some Namespaces first' };
  return { ok: true, totals };
});

// One ResourceQuota + one LimitRange for every non-system Namespace that doesn't already have one — see
// bundles.ts's buildQuotaLimitBundle.
app.post('/demo/bundles/quota-limits', async () => {
  const totals = runQuotaLimitBundle(settings.snapshotDir);
  if (!totals.ResourceQuota) return { ok: true, totals, warning: 'no non-system Namespaces staged yet — generate some Namespaces first' };
  return { ok: true, totals };
});

// The 5 required system Pods (kube-apiserver, kube-controller-manager, kube-scheduler, coredns, kube-proxy)
// in kube-system, created only as needed — see bundles.ts's buildSystemPodsBundle.
app.post('/demo/bundles/system-pods', async () => {
  const totals = runSystemPodsBundle(settings.snapshotDir);
  if (!totals.Pod) return { ok: true, totals, warning: 'all 5 system Pods already staged' };
  return { ok: true, totals };
});

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
