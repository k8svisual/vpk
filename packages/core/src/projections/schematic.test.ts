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
    expect(s?.storage.pvs).toEqual([]);
    expect(s?.storage.storageClasses).toEqual([]);
  });

  it('returns undefined for a non-Pod id', () => {
    const deployment = [...graph.nodes.values()].find((r) => r.kind === 'Deployment');
    expect(projectPodSchematic(graph, deployment!.id)).toBeUndefined();
  });
});

describe('projectPodSchematic storage chain (synthetic pvc -> pv -> sc)', () => {
  const sc: RawObject = {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: { uid: 'sc-1', name: 'fast-ssd' },
    provisioner: 'kubernetes.io/aws-ebs',
  };
  const pv: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: { uid: 'pv-1', name: 'pv-001' },
    spec: { storageClassName: 'fast-ssd', capacity: { storage: '10Gi' } },
  };
  const pvc: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { uid: 'pvc-1', name: 'data-claim', namespace: 'ns1' },
    spec: { volumeName: 'pv-001' },
  };
  const pod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1' },
    spec: { containers: [], volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'data-claim' } }] },
  };

  it('resolves the full pvc -> pv -> storageClass chain', () => {
    const graph = buildGraph([sc, pv, pvc, pod]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.storage.pvcs.map((r) => r.name)).toEqual(['data-claim']);
    expect(s?.storage.pvs.map((r) => r.name)).toEqual(['pv-001']);
    expect(s?.storage.storageClasses.map((r) => r.name)).toEqual(['fast-ssd']);
    expect(s?.storage.storageClasses[0]?.id).toBe('sc-1');
  });
});
