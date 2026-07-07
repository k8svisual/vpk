import type { ResourceGraph } from '@vpk/core';
import { statSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import os from 'node:os';

export interface Stats {
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    totalMemBytes: number;
    freeMemBytes: number;
    processMemoryBytes: number;
    uptimeSeconds: number;
  };
  application: {
    port: number;
    snapshotDir: string;
    currentSnapshot: string;
    redactSecrets: boolean;
    disablePullingSecrets: boolean;
    nodes: number;
    edges: number;
    deduped: number;
  };
  snapshotFile: {
    path: string;
    sizeBytes: number | null;
    manifest: unknown;
    kindCounts: Record<string, number>;
  };
}

/** Powers the Stats panel's three sections. Reads the current snapshot file straight off disk (rather than
 *  threading its manifest through the graph) since `manifest` is metadata ABOUT the capture, not a resource in
 *  it — the graph never keeps it, so anyone wanting it has to go back to the file, same as this does. */
export function computeStats(params: {
  graph: ResourceGraph;
  port: number;
  snapshotDir: string;
  currentPath: string;
  redactSecrets: boolean;
  disablePullingSecrets: boolean;
}): Stats {
  const { graph, port, snapshotDir, currentPath, redactSecrets, disablePullingSecrets } = params;

  const kindCounts: Record<string, number> = {};
  for (const r of graph.nodes.values()) kindCounts[r.kind] = (kindCounts[r.kind] ?? 0) + 1;

  let sizeBytes: number | null = null;
  let manifest: unknown = null;
  try {
    sizeBytes = statSync(currentPath).size;
    const parsed = JSON.parse(readFileSync(currentPath, 'utf8')) as { manifest?: unknown };
    manifest = parsed.manifest ?? null;
  } catch {
    // best-effort — a hand-authored or legacy-format snapshot may have no manifest, or the file may have moved
  }

  return {
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      totalMemBytes: os.totalmem(),
      freeMemBytes: os.freemem(),
      processMemoryBytes: process.memoryUsage().rss,
      uptimeSeconds: process.uptime(),
    },
    application: {
      port,
      snapshotDir,
      currentSnapshot: basename(currentPath),
      redactSecrets,
      disablePullingSecrets,
      nodes: graph.nodes.size,
      edges: graph.edges.length,
      deduped: graph.deduped,
    },
    snapshotFile: {
      path: currentPath,
      sizeBytes,
      manifest,
      kindCounts,
    },
  };
}
