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

  it('includes the Node the Pod runs on and an empty crds list when no CRD is involved', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    const coredns = [...graph.nodes.values()].find((r) => r.kind === 'Pod' && r.name.startsWith('coredns-'));
    const dto = getSchematic(graph, coredns!.id);
    expect(dto?.node?.name).toBe('minikube');
    expect(dto?.crds).toEqual([]);
  });

  it('includes an empty policies DTO (lean {id,name} shape) when no NetworkPolicy/ResourceQuota/LimitRange/RoleBinding applies', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    const coredns = [...graph.nodes.values()].find((r) => r.kind === 'Pod' && r.name.startsWith('coredns-'));
    const dto = getSchematic(graph, coredns!.id);
    expect(dto?.policies).toEqual({ networkPolicies: [], resourceQuotas: [], limitRanges: [], roleBindings: [] });
  });

  it('includes an empty volumeAttachments list (lean {id,name} shape) when the Pod has no PVC at all', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    const coredns = [...graph.nodes.values()].find((r) => r.kind === 'Pod' && r.name.startsWith('coredns-'));
    const dto = getSchematic(graph, coredns!.id);
    expect(dto?.storage.volumeAttachments).toEqual([]);
  });
});
