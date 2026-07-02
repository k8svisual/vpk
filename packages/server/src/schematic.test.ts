import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph } from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { getSchematic } from './schematic';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '../test/fixtures/minikube.snapshot.json');

describe('getSchematic', () => {
  it('produces a lean DTO with no raw payload for a real Pod', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    const coredns = [...graph.nodes.values()].find((r) => r.kind === 'Pod' && r.name.startsWith('coredns-'));
    const dto = getSchematic(graph, coredns!.id);
    expect(dto?.podName).toBe(coredns!.name);
    expect('raw' in (dto ?? {})).toBe(false);
    expect(dto?.ownerChain.length).toBeGreaterThan(0);
  });

  it('returns undefined for a non-Pod or unknown id', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    expect(getSchematic(graph, 'not-a-real-id')).toBeUndefined();
  });
});
