import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute, basename } from 'node:path';
import { readdirSync, writeFileSync } from 'node:fs';
import {
  buildGraph,
  projectOwnerRef,
  projectSecuritySubjects,
  projectContainerImages,
  type ResourceGraph,
  type OwnerRefFocus,
} from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { renderOwnerRefSvg } from './render/ownerRefSvg';
import { captureCore } from './capture/cliSource';
import { listResources } from './resources';
import { listNetworkServices, listNetworkNodes } from './network';
import { listStorageGroups } from './storage';
import { getSchematic } from './schematic';

// P3 slice server: snapshot manager (list/load/capture) + ownerRef SVG + definitions.
const here = dirname(fileURLToPath(import.meta.url));
const defaultSnapshot = process.env.VPK_SNAPSHOT ?? join(here, '../test/fixtures/minikube.snapshot.json');
const snapDir = process.env.VPK_SNAPSHOT_DIR ?? dirname(defaultSnapshot);
const cli = (process.env.VPK_CLI ?? 'kubectl').split(' ').filter(Boolean);

let graph: ResourceGraph = buildGraph(loadSnapshotFile(defaultSnapshot));
let currentPath = defaultSnapshot;

function setSnapshot(path: string): void {
  graph = buildGraph(loadSnapshotFile(path));
  currentPath = path;
}
function resolve(path: string): string {
  return isAbsolute(path) ? path : join(snapDir, path);
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
  let files: string[] = [];
  try {
    files = readdirSync(snapDir).filter((f) => f.endsWith('.json'));
  } catch {
    files = [];
  }
  return { dir: snapDir, current: basename(currentPath), files };
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
  const { name } = (req.body ?? {}) as { name?: string };
  try {
    const { items, manifest } = await captureCore({ cli });
    const safe = (name || `capture-${manifest.captured}`).replace(/[^a-z0-9_.-]/gi, '_');
    const file = join(snapDir, `${safe}.json`);
    writeFileSync(file, JSON.stringify({ ...manifest, items }));
    setSnapshot(file);
    return { ok: true, snapshot: basename(file), nodes: graph.nodes.size, items: items.length };
  } catch (e: unknown) {
    reply.code(500);
    return { error: String(e) };
  }
});

app.get('/resources', async () => listResources(graph));

app.get('/network', async (req) => {
  const q = req.query as { ns?: string };
  return listNetworkServices(graph, q.ns || undefined);
});

app.get('/network/nodes', async () => listNetworkNodes(graph));

app.get('/security', async () => projectSecuritySubjects(graph));

app.get('/storage', async () => listStorageGroups(graph));

app.get('/container-images', async () => projectContainerImages(graph));

app.get('/schematic', async (req, reply) => {
  const q = req.query as { id?: string };
  const dto = q.id ? getSchematic(graph, q.id) : undefined;
  if (!dto) {
    reply.code(404);
    return { error: 'not found (not a Pod id in this snapshot)' };
  }
  return dto;
});

app.get('/ownerref', async (req, reply) => {
  const q = req.query as { ns?: string; id?: string };
  const focus: OwnerRefFocus = q.id ? { resourceId: q.id } : { namespace: q.ns ?? 'kube-system' };
  reply.header('content-type', 'image/svg+xml');
  return renderOwnerRefSvg(projectOwnerRef(graph, focus));
});

app.get('/definition', async (req, reply) => {
  const q = req.query as { id?: string };
  const resource = q.id ? graph.nodes.get(q.id) : undefined;
  if (!resource) {
    reply.code(404);
    return { error: 'not found' };
  }
  return resource.raw;
});

const port = Number(process.env.PORT ?? 4200);
app
  .listen({ port, host: '127.0.0.1' })
  .then(() => console.log(`vpk server → http://127.0.0.1:${port}  (${graph.nodes.size} nodes, snapshots in ${snapDir})`))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
