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
    expect(s?.ownerChain).toEqual([{ id: 'foo-1', kind: 'Foo', name: 'my-foo', apiVersion: 'example.com/v1', crdLetter: 'a' }]);
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
    expect(s?.ownerChain).toEqual([{ id: 'rs-1', kind: 'ReplicaSet', name: 'app-rs', apiVersion: 'apps/v1' }]);
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

describe('projectPodSchematic events summary', () => {
  const pod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1' },
    spec: { containers: [] },
  };
  const otherPod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-2', name: 'other', namespace: 'ns1' },
    spec: { containers: [] },
  };

  it('counts Events resolved by involvedObject.uid, separating Warning from the total', () => {
    const normalEvt: RawObject = {
      apiVersion: 'v1',
      kind: 'Event',
      metadata: { uid: 'evt-1', name: 'app.a', namespace: 'ns1' },
      type: 'Normal',
      involvedObject: { kind: 'Pod', name: 'app', namespace: 'ns1', uid: 'pod-1' },
    };
    const warnEvt: RawObject = {
      apiVersion: 'v1',
      kind: 'Event',
      metadata: { uid: 'evt-2', name: 'app.b', namespace: 'ns1' },
      type: 'Warning',
      involvedObject: { kind: 'Pod', name: 'app', namespace: 'ns1', uid: 'pod-1' },
    };
    const otherPodEvt: RawObject = {
      apiVersion: 'v1',
      kind: 'Event',
      metadata: { uid: 'evt-3', name: 'other.a', namespace: 'ns1' },
      type: 'Warning',
      involvedObject: { kind: 'Pod', name: 'other', namespace: 'ns1', uid: 'pod-2' },
    };
    const graph = buildGraph([pod, otherPod, normalEvt, warnEvt, otherPodEvt]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.events).toEqual({ total: 2, warnings: 1 });
  });

  it('falls back to kind/name/namespace when involvedObject has no uid', () => {
    const noUidEvt: RawObject = {
      apiVersion: 'v1',
      kind: 'Event',
      metadata: { uid: 'evt-4', name: 'app.c', namespace: 'ns1' },
      type: 'Normal',
      involvedObject: { kind: 'Pod', name: 'app', namespace: 'ns1' },
    };
    const graph = buildGraph([pod, noUidEvt]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.events).toEqual({ total: 1, warnings: 0 });
  });

  it('reports zero when the Pod has no associated Events', () => {
    const graph = buildGraph([pod]);
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.events).toEqual({ total: 0, warnings: 0 });
  });
});

describe('projectPodSchematic container detail (Container schematic fields)', () => {
  const cm: RawObject = { apiVersion: 'v1', kind: 'ConfigMap', metadata: { uid: 'cm-1', name: 'app-config', namespace: 'ns1' } };
  const secret: RawObject = { apiVersion: 'v1', kind: 'Secret', metadata: { uid: 'sec-1', name: 'db-creds', namespace: 'ns1' } };
  const pod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1' },
    spec: {
      initContainers: [{ name: 'migrate', image: 'myapp/migrate:v1', volumeMounts: [{ name: 'data', mountPath: '/var/data' }] }],
      containers: [
        {
          name: 'app',
          image: 'myapp/web:v1',
          ports: [{ containerPort: 8080, protocol: 'TCP' }],
          resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } },
          livenessProbe: { httpGet: { path: '/healthz', port: 8080 } },
          readinessProbe: { httpGet: { path: '/ready', port: 8080 } },
          envFrom: [{ configMapRef: { name: 'app-config' } }],
          env: [{ valueFrom: { secretKeyRef: { name: 'db-creds' } } }],
          volumeMounts: [{ name: 'data', mountPath: '/var/data' }],
        },
        { name: 'sidecar', image: 'fluent/bit:2', volumeMounts: [{ name: 'data', mountPath: '/var/log', readOnly: true }] },
      ],
      ephemeralContainers: [{ name: 'debugger', image: 'busybox:1.36', targetContainerName: 'app' }],
      volumes: [
        { name: 'data', persistentVolumeClaim: { claimName: 'data-claim' } },
        { name: 'cfg', configMap: { name: 'app-config' } },
        { name: 'scratch', emptyDir: {} },
      ],
    },
  };
  const pvc: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { uid: 'pvc-1', name: 'data-claim', namespace: 'ns1' },
    spec: {},
  };

  const graph = buildGraph([cm, secret, pvc, pod]);

  it('splits containers into init / app / ephemeral sections with the right kind tag', () => {
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.initContainers.map((c) => c.name)).toEqual(['migrate']);
    expect(s?.containers.map((c) => c.name)).toEqual(['app', 'sidecar']);
    expect(s?.ephemeralContainers.map((c) => c.name)).toEqual(['debugger']);
    expect(s?.initContainers[0]?.kind).toBe('init');
    expect(s?.containers[0]?.kind).toBe('app');
    expect(s?.ephemeralContainers[0]?.kind).toBe('ephemeral');
  });

  it('captures ports, resources, and probe presence on an app container', () => {
    const app = projectPodSchematic(graph, 'pod-1')?.containers.find((c) => c.name === 'app');
    expect(app?.ports).toEqual([{ containerPort: 8080, protocol: 'TCP', name: undefined }]);
    expect(app?.resources).toEqual({ cpuRequest: '250m', cpuLimit: '500m', memRequest: '256Mi', memLimit: '512Mi' });
    expect(app?.probes).toEqual({ liveness: true, readiness: true, startup: false });
  });

  it('attributes env/envFrom config to the specific container that consumes it', () => {
    const app = projectPodSchematic(graph, 'pod-1')?.containers.find((c) => c.name === 'app');
    expect(app?.configRefs).toEqual({ configMaps: ['app-config'], secrets: ['db-creds'] });
    const sidecar = projectPodSchematic(graph, 'pod-1')?.containers.find((c) => c.name === 'sidecar');
    expect(sidecar?.configRefs).toEqual({ configMaps: [], secrets: [] });
  });

  it('carries targetContainerName on the ephemeral container and no ports/probes', () => {
    const dbg = projectPodSchematic(graph, 'pod-1')?.ephemeralContainers[0];
    expect(dbg?.targetContainerName).toBe('app');
    expect(dbg?.ports).toEqual([]);
    expect(dbg?.probes).toEqual({ liveness: false, readiness: false, startup: false });
  });

  it('projects volumes with their type and a resolved, clickable backingRef where one exists', () => {
    const s = projectPodSchematic(graph, 'pod-1');
    expect(s?.volumes.map((v) => ({ name: v.name, type: v.type }))).toEqual([
      { name: 'data', type: 'persistentVolumeClaim' },
      { name: 'cfg', type: 'configMap' },
      { name: 'scratch', type: 'emptyDir' },
    ]);
    const data = s?.volumes.find((v) => v.name === 'data');
    expect(data?.backingRef).toEqual({ id: 'pvc-1', name: 'data-claim', kind: 'PersistentVolumeClaim' });
    const scratch = s?.volumes.find((v) => v.name === 'scratch');
    expect(scratch?.backingRef).toBeUndefined();
  });
});

describe('projectPodSchematic volume storage-implementation chain', () => {
  const sc: RawObject = {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: { uid: 'sc-1', name: 'fast-ssd' },
    provisioner: 'ebs.csi.aws.com',
  };
  const csiDriver: RawObject = {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'CSIDriver',
    metadata: { uid: 'csid-1', name: 'ebs.csi.aws.com' },
  };
  const pvSc: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: { uid: 'pv-sc', name: 'pv-sc-only' },
    spec: { storageClassName: 'fast-ssd' },
  };
  const pvcSc: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { uid: 'pvc-sc', name: 'claim-sc', namespace: 'ns1' },
    spec: { volumeName: 'pv-sc-only' },
  };
  const pvCsi: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: { uid: 'pv-csi', name: 'pv-csi-attached' },
    spec: { storageClassName: 'fast-ssd', csi: { driver: 'ebs.csi.aws.com' } },
  };
  const pvcCsi: RawObject = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { uid: 'pvc-csi', name: 'claim-csi', namespace: 'ns1' },
    spec: { volumeName: 'pv-csi-attached' },
  };
  const va: RawObject = {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'VolumeAttachment',
    metadata: { uid: 'va-1', name: 'csi-attach-1' },
    spec: { attacher: 'ebs.csi.aws.com', source: { persistentVolumeName: 'pv-csi-attached' } },
  };
  const cm: RawObject = { apiVersion: 'v1', kind: 'ConfigMap', metadata: { uid: 'cm-1', name: 'app-config', namespace: 'ns1' } };
  const pod: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1' },
    spec: {
      nodeName: 'worker-1',
      containers: [{ name: 'app' }],
      volumes: [
        { name: 'sc-vol', persistentVolumeClaim: { claimName: 'claim-sc' } },
        { name: 'csi-vol', persistentVolumeClaim: { claimName: 'claim-csi' } },
        { name: 'cfg-vol', configMap: { name: 'app-config' } },
      ],
    },
  };
  const node: RawObject = { apiVersion: 'v1', kind: 'Node', metadata: { uid: 'node-1', name: 'worker-1' } };

  const graph = buildGraph([sc, csiDriver, pvSc, pvcSc, pvCsi, pvcCsi, va, cm, node, pod]);

  it('resolves a StorageClass-only volume as pvc-pv-sc with its PV and StorageClass', () => {
    const v = projectPodSchematic(graph, 'pod-1')?.volumes.find((x) => x.name === 'sc-vol');
    expect(v?.implementation).toBe('pvc-pv-sc');
    expect(v?.pv?.name).toBe('pv-sc-only');
    expect(v?.storageClass).toEqual({ id: 'sc-1', name: 'fast-ssd', kind: 'StorageClass' });
    expect(v?.volumeAttachment).toBeUndefined();
  });

  it('resolves a CSI-attached volume as pvc-pv-va-csi with its VolumeAttachment and CSIDriver', () => {
    const v = projectPodSchematic(graph, 'pod-1')?.volumes.find((x) => x.name === 'csi-vol');
    expect(v?.implementation).toBe('pvc-pv-va-csi');
    expect(v?.pv?.name).toBe('pv-csi-attached');
    expect(v?.volumeAttachment).toEqual({ id: 'va-1', name: 'csi-attach-1', kind: 'VolumeAttachment' });
    expect(v?.csiDriver).toEqual({ id: 'csid-1', name: 'ebs.csi.aws.com', kind: 'CSIDriver' });
  });

  it('marks a configMap volume as local (no PV chain)', () => {
    const v = projectPodSchematic(graph, 'pod-1')?.volumes.find((x) => x.name === 'cfg-vol');
    expect(v?.implementation).toBe('local');
    expect(v?.backingRef).toEqual({ id: 'cm-1', name: 'app-config', kind: 'ConfigMap' });
    expect(v?.pv).toBeUndefined();
  });
});

describe('projectPodSchematic network endpoints/endpointSlices', () => {
  const mk = (slices: RawObject[], ep?: RawObject) => {
    const pod: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1' }, spec: { containers: [] } };
    const svc: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-1', name: 'web', namespace: 'ns1' } };
    const endpoints: RawObject = ep ?? {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { uid: 'ep-1', name: 'web', namespace: 'ns1' },
      subsets: [{ addresses: [{ targetRef: { uid: 'pod-1' } }] }],
    };
    return buildGraph([pod, svc, endpoints, ...slices]);
  };
  const slice = (uid: string, name: string): RawObject => ({
    apiVersion: 'discovery.k8s.io/v1',
    kind: 'EndpointSlice',
    metadata: { uid, name, namespace: 'ns1', labels: { 'kubernetes.io/service-name': 'web' } },
  });

  it('includes the Service and its Endpoints object, kind=Endpoints when no slices exist', () => {
    const n = projectPodSchematic(mk([]), 'pod-1')?.network;
    expect(n?.services.map((s) => s.name)).toEqual(['web']);
    expect(n?.endpoints.map((e) => ({ name: e.name, kind: e.kind }))).toEqual([{ name: 'web', kind: 'Endpoints' }]);
    expect(n?.endpointKind).toBe('Endpoints');
  });

  it('merges Endpoints + EndpointSlices into one list and shows the EndpointSlice icon when both exist', () => {
    const n = projectPodSchematic(mk([slice('es-1', 'web-abc'), slice('es-2', 'web-def')]), 'pod-1')?.network;
    expect(n?.endpoints.map((e) => e.kind).sort()).toEqual(['EndpointSlice', 'EndpointSlice', 'Endpoints']);
    expect(n?.endpoints.map((e) => e.name)).toContain('web-abc');
    expect(n?.endpoints.map((e) => e.name)).toContain('web-def');
    expect(n?.endpointKind).toBe('EndpointSlice');
  });
})

describe('projectPodSchematic service targetPorts', () => {
  it('records each Service\'s targetPorts (defaulting to port when omitted)', () => {
    const pod: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'pod-1', name: 'app', namespace: 'ns1' }, spec: { containers: [] } };
    const svc: RawObject = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { uid: 'svc-1', name: 'web', namespace: 'ns1' },
      spec: { ports: [{ port: 80, targetPort: 8080 }, { port: 443, targetPort: 'https' }, { port: 9090 }] },
    };
    const endpoints: RawObject = {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { uid: 'ep-1', name: 'web', namespace: 'ns1' },
      subsets: [{ addresses: [{ targetRef: { uid: 'pod-1' } }] }],
    };
    const svcRef = projectPodSchematic(buildGraph([pod, svc, endpoints]), 'pod-1')?.network.services[0];
    expect(svcRef?.name).toBe('web');
    expect(svcRef?.targetPorts).toEqual([8080, 'https', 9090]); // 3rd defaults targetPort -> port (9090)
  });
});
