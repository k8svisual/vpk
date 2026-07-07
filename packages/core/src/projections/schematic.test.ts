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

  it('resolves the Node the Pod is scheduled on (cluster-scoped, no namespace)', () => {
    const s = projectPodSchematic(graph, coredns!.id);
    expect(s?.node?.name).toBe('minikube');
    expect(s?.node?.kind).toBe('Node');
  });

  it('finds no CRDs when the owner chain is all built-in kinds', () => {
    const s = projectPodSchematic(graph, coredns!.id);
    expect(s?.crds).toEqual([]);
    expect(s?.ownerChain.every((o) => o.crdLetter === undefined)).toBe(true);
  });
});

describe('projectPodSchematic custom-resource (CRD) linkage', () => {
  const crd: RawObject = {
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: { uid: 'crd-1', name: 'foos.example.com' },
    spec: { group: 'example.com', names: { kind: 'Foo', plural: 'foos' } },
  };
  const foo: RawObject = {
    apiVersion: 'example.com/v1',
    kind: 'Foo',
    metadata: { uid: 'foo-1', name: 'my-foo', namespace: 'ns1' },
  };
  const pod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      uid: 'pod-2',
      name: 'app',
      namespace: 'ns1',
      ownerReferences: [{ apiVersion: 'example.com/v1', kind: 'Foo', name: 'my-foo', uid: 'foo-1', controller: true }],
    },
    spec: { containers: [] },
  };

  it('badges a custom-resource owner with a letter and lists its CustomResourceDefinition in crds', () => {
    const graph = buildGraph([crd, foo, pod]);
    const s = projectPodSchematic(graph, 'pod-2');
    expect(s?.ownerChain).toEqual([{ id: 'foo-1', kind: 'Foo', name: 'my-foo', crdLetter: 'a' }]);
    expect(s?.crds).toEqual([{ letter: 'a', id: 'crd-1', name: 'foos.example.com' }]);
  });

  it('does not badge a built-in-kind owner even when a CRD happens to exist elsewhere in the graph', () => {
    const rs: RawObject = {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: { uid: 'rs-1', name: 'app-rs', namespace: 'ns1' },
    };
    const plainPod: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        uid: 'pod-3',
        name: 'app2',
        namespace: 'ns1',
        ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: 'app-rs', uid: 'rs-1', controller: true }],
      },
      spec: { containers: [] },
    };
    const graph = buildGraph([crd, rs, plainPod]);
    const s = projectPodSchematic(graph, 'pod-3');
    expect(s?.ownerChain).toEqual([{ id: 'rs-1', kind: 'ReplicaSet', name: 'app-rs' }]);
    expect(s?.crds).toEqual([]);
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

  it('links the pv to its VolumeAttachment (via spec.source.persistentVolumeName), as a sibling of storageClass', () => {
    const va: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'VolumeAttachment',
      metadata: { uid: 'va-1', name: 'csi-va-1' },
      spec: { attacher: 'ebs.csi.aws.com', nodeName: 'node-a', source: { persistentVolumeName: 'pv-001' } },
    };
    const graph = buildGraph([sc, pv, pvc, pod, va]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.storage.volumeAttachments.map((r) => r.name)).toEqual(['csi-va-1']);
    expect(s?.storage.volumeAttachments[0]?.id).toBe('va-1');
    // StorageClass still resolves independently — VolumeAttachment doesn't replace it.
    expect(s?.storage.storageClasses.map((r) => r.name)).toEqual(['fast-ssd']);
  });

  it('leaves volumeAttachments empty when no VolumeAttachment references the pv (adaptive, not fabricated)', () => {
    const graph = buildGraph([sc, pv, pvc, pod]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.storage.volumeAttachments).toEqual([]);
  });
});

describe('projectPodSchematic namespace policies (NetworkPolicy/ResourceQuota/LimitRange/RoleBinding)', () => {
  const pod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1', labels: { app: 'demo' } },
    spec: { containers: [], serviceAccountName: 'app-sa' },
  };
  const otherNsPod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-2', name: 'other', namespace: 'ns2', labels: { app: 'demo' } },
    spec: { containers: [] },
  };

  it('matches a NetworkPolicy whose podSelector.matchLabels matches the Pod, ignores one that does not', () => {
    const matching: RawObject = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { uid: 'np-1', name: 'allow-demo', namespace: 'ns1' },
      spec: { podSelector: { matchLabels: { app: 'demo' } } },
    };
    const nonMatching: RawObject = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { uid: 'np-2', name: 'allow-other', namespace: 'ns1' },
      spec: { podSelector: { matchLabels: { app: 'other' } } },
    };
    const graph = buildGraph([pod, matching, nonMatching]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.policies.networkPolicies.map((r) => r.name)).toEqual(['allow-demo']);
  });

  it('treats an empty/missing podSelector as matching every Pod in the namespace', () => {
    const selectsAll: RawObject = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { uid: 'np-3', name: 'default-deny', namespace: 'ns1' },
      spec: { podSelector: {} },
    };
    const graph = buildGraph([pod, selectsAll]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.policies.networkPolicies.map((r) => r.name)).toEqual(['default-deny']);
  });

  it('lists every ResourceQuota and LimitRange in the Pod namespace (namespace-wide, no per-Pod selector)', () => {
    const rq: RawObject = {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: { uid: 'rq-1', name: 'compute-quota', namespace: 'ns1' },
    };
    const lr: RawObject = {
      apiVersion: 'v1',
      kind: 'LimitRange',
      metadata: { uid: 'lr-1', name: 'default-limits', namespace: 'ns1' },
    };
    const graph = buildGraph([pod, rq, lr, otherNsPod]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.policies.resourceQuotas.map((r) => r.name)).toEqual(['compute-quota']);
    expect(s?.policies.limitRanges.map((r) => r.name)).toEqual(['default-limits']);
    const otherS = projectPodSchematic(graph, 'pod-2');
    expect(otherS?.policies.resourceQuotas).toEqual([]);
    expect(otherS?.policies.limitRanges).toEqual([]);
  });

  it('matches a RoleBinding whose subjects name the Pod\'s ServiceAccount, ignores one for a different SA', () => {
    const bound: RawObject = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { uid: 'rb-1', name: 'app-sa-binding', namespace: 'ns1' },
      subjects: [{ kind: 'ServiceAccount', name: 'app-sa', namespace: 'ns1' }],
      roleRef: { kind: 'Role', name: 'app-role' },
    };
    const unrelated: RawObject = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { uid: 'rb-2', name: 'other-sa-binding', namespace: 'ns1' },
      subjects: [{ kind: 'ServiceAccount', name: 'other-sa', namespace: 'ns1' }],
      roleRef: { kind: 'Role', name: 'other-role' },
    };
    const graph = buildGraph([pod, bound, unrelated]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.policies.roleBindings.map((r) => r.name)).toEqual(['app-sa-binding']);
  });

  it('returns empty policy arrays when nothing in the namespace applies', () => {
    const graph = buildGraph([pod]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.policies).toEqual({ networkPolicies: [], resourceQuotas: [], limitRanges: [], roleBindings: [] });
  });
});
