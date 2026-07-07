import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph } from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { computeStats } from './stats';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '../test/fixtures/minikube.snapshot.json');

describe('computeStats', () => {
  const graph = buildGraph(loadSnapshotFile(fixture));
  const stats = computeStats({
    graph,
    port: 4200,
    snapshotDir: dirname(fixture),
    currentPath: fixture,
    redactSecrets: true,
    disablePullingSecrets: false,
  });

  it('reports system info without crashing', () => {
    expect(stats.system.platform).toBe(process.platform);
    expect(stats.system.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports the application settings and graph counts it was given', () => {
    expect(stats.application.port).toBe(4200);
    expect(stats.application.currentSnapshot).toBe('minikube.snapshot.json');
    expect(stats.application.redactSecrets).toBe(true);
    expect(stats.application.nodes).toBe(graph.nodes.size);
    expect(stats.application.edges).toBe(graph.edges.length);
  });

  it('counts resources per kind, summing back to the total', () => {
    const total = Object.values(stats.snapshotFile.kindCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(graph.nodes.size);
    expect(stats.snapshotFile.kindCounts.Pod).toBeGreaterThan(0);
  });

  it('reports a real file size for a snapshot that exists on disk', () => {
    expect(stats.snapshotFile.sizeBytes).toBeGreaterThan(0);
  });

  it('degrades to null/no manifest for a snapshot path that does not exist, rather than throwing', () => {
    const missing = computeStats({
      graph,
      port: 4200,
      snapshotDir: '/nowhere',
      currentPath: '/nowhere/missing.json',
      redactSecrets: false,
      disablePullingSecrets: true,
    });
    expect(missing.snapshotFile.sizeBytes).toBeNull();
    expect(missing.snapshotFile.manifest).toBeNull();
  });
});
