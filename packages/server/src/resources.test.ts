import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph } from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { listResources } from './resources';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '../test/fixtures/minikube.snapshot.json');

describe('listResources', () => {
  it('flattens every graph node to a row, dropping raw payloads', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    const rows = listResources(graph);

    expect(rows.length).toBe(graph.nodes.size);
    expect(rows.some((r) => r.kind === 'Pod')).toBe(true);
    for (const row of rows) {
      expect(row.id).toBeTruthy();
      expect(row.kind).toBeTruthy();
      expect(row.labels).toBeTruthy();
      expect(row.annotations).toBeTruthy();
      expect('raw' in row).toBe(false);
    }
  });
});
