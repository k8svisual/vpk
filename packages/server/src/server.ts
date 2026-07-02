import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph, projectOwnerRef, type ResourceGraph, type OwnerRefFocus } from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { renderOwnerRefSvg } from './render/ownerRefSvg';

// Minimal P3 vertical-slice server: load one snapshot, serve the ownerRef SVG + resource definitions.
// (Per-session state, socket.io bus, and the capture path come later in P3.)
const here = dirname(fileURLToPath(import.meta.url));
const snapshotPath =
  process.env.VPK_SNAPSHOT ?? join(here, '../test/fixtures/minikube.snapshot.json');

const graph: ResourceGraph = buildGraph(loadSnapshotFile(snapshotPath));

const app = Fastify();

app.get('/health', async () => ({
  ok: true,
  snapshot: snapshotPath,
  nodes: graph.nodes.size,
  edges: graph.edges.length,
  deduped: graph.deduped,
}));

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
  .then(() =>
    console.log(`vpk server → http://127.0.0.1:${port}  (${graph.nodes.size} nodes, ${graph.edges.length} edges)`),
  )
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
