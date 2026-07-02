import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildGraph } from '../graph';
import { projectPodSchematic } from './schematic';
import type { RawObject } from '../types';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../server/test/fixtures/minikube.snapshot.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { items: RawObject[] };

describe('projectPodSchematic (real minikube fixture)', () => {
  const graph = buildGraph(fixture.items);
  const coredns = [...graph.nodes.values()].find((r) => r.kind === 'Pod' && r.name === 'coredns-668d6bf9bc-9x645');

  it('resolves phase, containers, and the owner chain to root (Deployment -> ReplicaSet)', () => {
    const s = projectPodSchematic(graph, coredns!.id);
    expect(s?.phase).toBe('Running');
    expect(s?.containers).toHaveLength(1);
    expect(s?.containers[0]?.name).toBe('coredns');
    expect(s?.containers[0]?.ready).toBe(true);
    expect(s?.ownerChain.map((o) => o.kind)).toEqual(['Deployment', 'ReplicaSet']);
  });

  it('resolves the ConfigMap volume and finds the Service that targets this pod via Endpoints', () => {
    const s = projectPodSchematic(graph, coredns!.id);
    expect(s?.config.configMaps.map((c) => c.name)).toContain('coredns');
    expect(s?.network.services.map((sv) => sv.name)).toContain('kube-dns');
  });

  it('leaves Storage empty (adaptive: coredns has no PVC) instead of a fabricated entry', () => {
    const s = projectPodSchematic(graph, coredns!.id);
    expect(s?.storage.pvcs).toEqual([]);
  });

  it('returns undefined for a non-Pod id', () => {
    const deployment = [...graph.nodes.values()].find((r) => r.kind === 'Deployment');
    expect(projectPodSchematic(graph, deployment!.id)).toBeUndefined();
  });
});
