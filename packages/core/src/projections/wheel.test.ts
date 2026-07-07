import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectClusterWheel } from './wheel';
import type { RawObject } from '../types';

function node(name: string, ready = true): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Node',
    metadata: { uid: `node-${name}`, name },
    status: { conditions: [{ type: 'Ready', status: ready ? 'True' : 'False' }] },
  };
}
function pod(name: string, nodeName: string, phase = 'Running'): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: `pod-${name}`, name, namespace: 'ns' },
    spec: { nodeName },
    status: { phase },
  };
}

function daemonSetPod(name: string, nodeName: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: `pod-${name}`, name, namespace: 'ns', ownerReferences: [{ kind: 'DaemonSet', name: 'ds', uid: 'ds-1' }] },
    spec: { nodeName },
    status: { phase: 'Running' },
  };
}

describe('projectClusterWheel geometry', () => {
  it('places nodes exactly on the outer perimeter and their pods inside it', () => {
    const graph = buildGraph([node('a'), node('b'), node('c'), pod('p1', 'a'), pod('p2', 'a'), pod('p3', 'b')]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.nodes).toHaveLength(3);
    for (const n of wheel.nodes) expect(Math.hypot(n.x, n.z)).toBeCloseTo(wheel.outerRadius, 5);
    expect(wheel.nodes.find((n) => n.name === 'a')?.podCount).toBe(2);
    expect(wheel.pods).toHaveLength(3);
    // pods sit strictly inside the node ring (pie-wedge interior), not on or outside it
    for (const p of wheel.pods) expect(Math.hypot(p.x, p.z)).toBeLessThan(wheel.outerRadius);
  });

  it('sizes the outer diameter from the BUSIEST node, not the node count', () => {
    const busy = Array.from({ length: 25 }, (_, i) => pod(`busy-${i}`, 'a'));
    const graphSmall = buildGraph([node('a'), node('b'), pod('p1', 'a')]);
    const graphBusy = buildGraph([node('a'), node('b'), ...busy]);
    expect(projectClusterWheel(graphBusy).outerRadius).toBeGreaterThan(projectClusterWheel(graphSmall).outerRadius);
  });

  it('reports health separately from color now that color encodes node role', () => {
    const graph = buildGraph([node('bad', false)]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.nodes[0]?.health).toBe('error');
    expect(wheel.nodes[0]?.healthColor).toBe('#da8c84');
    expect(wheel.nodes[0]?.role).toBe('worker');
  });

  it('colors master and worker nodes distinctly by role', () => {
    const master: RawObject = {
      apiVersion: 'v1',
      kind: 'Node',
      metadata: { uid: 'node-master', name: 'master', labels: { 'node-role.kubernetes.io/master': '' } },
      status: { conditions: [{ type: 'Ready', status: 'True' }] },
    };
    const graph = buildGraph([master, node('worker')]);
    const wheel = projectClusterWheel(graph);
    const masterNode = wheel.nodes.find((n) => n.name === 'master')!;
    const workerNode = wheel.nodes.find((n) => n.name === 'worker')!;
    expect(masterNode.role).toBe('master');
    expect(workerNode.role).toBe('worker');
    expect(masterNode.color).not.toBe(workerNode.color);
  });

  it('colors a DaemonSet-owned pod grey even though it is Running (not green)', () => {
    const graph = buildGraph([node('a'), pod('regular', 'a'), daemonSetPod('ds', 'a')]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.pods.find((p) => p.name === 'regular')?.color).toBe('#2e9e4f');
    expect(wheel.pods.find((p) => p.name === 'ds')?.color).toBe('#8c8c8c');
  });

  it('reports status/daemonSet as fields independent of color, for the 3D filter panel', () => {
    const graph = buildGraph([node('a'), pod('regular', 'a', 'Failed'), daemonSetPod('ds', 'a')]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.pods.find((p) => p.name === 'regular')).toMatchObject({ status: 'failed', daemonSet: false });
    expect(wheel.pods.find((p) => p.name === 'ds')).toMatchObject({ status: 'running', daemonSet: true });
  });

  it('always groups DaemonSet pods in the innermost row, even when added after regular pods fill row 0', () => {
    const regulars = Array.from({ length: 15 }, (_, i) => pod(`r${i}`, 'a'));
    const graph = buildGraph([node('a'), ...regulars, daemonSetPod('ds', 'a')]);
    const wheel = projectClusterWheel(graph);
    const dsPod = wheel.pods.find((p) => p.name === 'ds')!;
    const dsRadius = Math.hypot(dsPod.x, dsPod.z);
    for (const p of wheel.pods) {
      if (p.name === 'ds') continue;
      expect(dsRadius).toBeLessThanOrEqual(Math.hypot(p.x, p.z) + 1e-9);
    }
  });

  it('keeps a minimum arc-length gap between pods sharing a row, even with many nodes (a small per-node wedge)', () => {
    // A large node count shrinks each node's wedge; a fixed pods-per-row would pack pods closer together at
    // small radii than large ones (arc length = radius * angle). Row capacity must derive from the actual
    // radius so pods never overlap regardless of wedge size.
    const manyNodes = Array.from({ length: 40 }, (_, i) => node(`n${i}`));
    const busyPods = Array.from({ length: 30 }, (_, i) => pod(`p${i}`, 'n0'));
    const graph = buildGraph([...manyNodes, ...busyPods]);
    const wheel = projectClusterWheel(graph);

    const byRadius = new Map<number, { x: number; z: number }[]>();
    for (const p of wheel.pods) {
      const r = Math.round(Math.hypot(p.x, p.z) * 1e6) / 1e6;
      const list = byRadius.get(r) ?? [];
      list.push(p);
      byRadius.set(r, list);
    }

    expect(byRadius.size).toBeGreaterThan(0);
    for (const [radius, ptsAtRow] of byRadius) {
      if (ptsAtRow.length < 2) continue;
      const angles = ptsAtRow.map((p) => Math.atan2(p.z, p.x)).sort((a, b) => a - b);
      for (let i = 1; i < angles.length; i++) {
        const arc = radius * (angles[i]! - angles[i - 1]!);
        expect(arc).toBeGreaterThanOrEqual(0.3 - 1e-6);
      }
    }
  });

  it('handles an empty cluster (no nodes) without dividing by zero', () => {
    const wheel = projectClusterWheel(buildGraph([]));
    expect(wheel.nodes).toEqual([]);
    expect(Number.isFinite(wheel.outerRadius)).toBe(true);
  });
});

describe('projectClusterWheel resource metrics (Resource CPU & Memory filter)', () => {
  function nodeWithCapacity(name: string): RawObject {
    return {
      apiVersion: 'v1',
      kind: 'Node',
      metadata: { uid: `node-${name}`, name },
      status: {
        conditions: [{ type: 'Ready', status: 'True' }],
        capacity: { cpu: '4', memory: '16Gi', 'ephemeral-storage': '100Gi' },
      },
    };
  }
  function podWithResources(name: string, nodeName: string, containers: { cpu?: string; memory?: string }[]): RawObject {
    return {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: `pod-${name}`, name, namespace: 'ns' },
      spec: {
        nodeName,
        containers: containers.map((c) => ({ resources: { requests: { cpu: c.cpu, memory: c.memory } } })),
      },
      status: { phase: 'Running' },
    };
  }

  it('parses Node capacity (cpu, memory, ephemeral-storage) onto WheelNode', () => {
    const wheel = projectClusterWheel(buildGraph([nodeWithCapacity('a')]));
    const n = wheel.nodes[0]!;
    expect(n.cpuCapacity).toBe(4);
    expect(n.memCapacityBytes).toBe(16 * 1024 ** 3);
    expect(n.ephemeralStorageCapacityBytes).toBe(100 * 1024 ** 3);
  });

  it('sums container requests (including millicore CPU) onto WheelPod', () => {
    const graph = buildGraph([
      nodeWithCapacity('a'),
      podWithResources('multi', 'a', [
        { cpu: '500m', memory: '256Mi' },
        { cpu: '250m', memory: '128Mi' },
      ]),
    ]);
    const wheel = projectClusterWheel(graph);
    const p = wheel.pods[0]!;
    expect(p.cpuRequested).toBeCloseTo(0.75);
    expect(p.memRequestedBytes).toBe(384 * 1024 ** 2);
  });

  it('leaves cpuRequested/memRequestedBytes undefined when no container specifies either', () => {
    const graph = buildGraph([nodeWithCapacity('a'), pod('bare', 'a')]);
    const wheel = projectClusterWheel(graph);
    const p = wheel.pods[0]!;
    expect(p.cpuRequested).toBeUndefined();
    expect(p.memRequestedBytes).toBeUndefined();
  });
});

describe('projectClusterWheel pod linkage', () => {
  const svc: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-1', name: 'web', namespace: 'ns' } };
  const endpoints: RawObject = {
    apiVersion: 'v1',
    kind: 'Endpoints',
    metadata: { uid: 'eps-1', name: 'web', namespace: 'ns' },
    subsets: [{ addresses: [{ targetRef: { kind: 'Pod', uid: 'pod-p1' } }] }],
  };
  const pvc: RawObject = { apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata: { uid: 'pvc-1', name: 'data', namespace: 'ns' } };
  const podWithVolume: RawObject = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'pod-p1', name: 'p1', namespace: 'ns' },
    spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'data' } }] },
    status: { phase: 'Running' },
  };

  it('draws a real edge from the pod to the Service that backs it and the PVC it mounts', () => {
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.network.items.map((i) => i.name)).toEqual(['web']);
    expect(wheel.podToNetwork).toEqual([{ podId: 'pod-p1', itemId: 'svc-1' }]);
    expect(wheel.storage.items.map((i) => i.name)).toEqual(['data']);
    expect(wheel.podToStorage).toEqual([{ podId: 'pod-p1', itemId: 'pvc-1' }]);
  });

  it('positions the linked tier item near its referencing pod, not on a generic fixed ring', () => {
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume]);
    const wheel = projectClusterWheel(graph);
    const p1 = wheel.pods.find((p) => p.id === 'pod-p1')!;
    const svcItem = wheel.network.items[0]!;
    expect(svcItem.x).toBeCloseTo(p1.x, 5);
    expect(svcItem.z).toBeCloseTo(p1.z, 5);
  });

  it('only creates a Network/Storage tier item for resources actually referenced by a pod', () => {
    const unusedSvc: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-2', name: 'unused', namespace: 'ns' } };
    const graph = buildGraph([node('a'), svc, endpoints, unusedSvc, pvc, podWithVolume]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.network.items.map((i) => i.name)).not.toContain('unused');
  });

  it('anchors a Service above the earliest-created (the "first") referencing pod, not a centroid', () => {
    const early: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-early', name: 'early', namespace: 'ns', creationTimestamp: '2020-01-01T00:00:00Z' },
      spec: { nodeName: 'a' },
      status: { phase: 'Running' },
    };
    const late: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-late', name: 'late', namespace: 'ns', creationTimestamp: '2022-01-01T00:00:00Z' },
      spec: { nodeName: 'a' },
      status: { phase: 'Running' },
    };
    const eps: RawObject = {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { uid: 'eps-shared', name: 'shared', namespace: 'ns' },
      subsets: [{ addresses: [{ targetRef: { kind: 'Pod', uid: 'pod-early' } }, { targetRef: { kind: 'Pod', uid: 'pod-late' } }] }],
    };
    const sharedSvc: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-shared', name: 'shared', namespace: 'ns' } };
    const graph = buildGraph([node('a'), sharedSvc, eps, early, late]);
    const wheel = projectClusterWheel(graph);

    const earlyPod = wheel.pods.find((p) => p.name === 'early')!;
    const svcItem = wheel.network.items.find((i) => i.name === 'shared')!;
    expect(svcItem.x).toBeCloseTo(earlyPod.x, 5);
    expect(svcItem.z).toBeCloseTo(earlyPod.z, 5);
  });

  it('keeps a minimum distance between Network/Storage tier items even when their anchors coincide', () => {
    // Two Services each backed by a distinct single pod that happen to render at the exact same spot would
    // otherwise land on top of each other — the tier must deconflict, not just anchor.
    const podA: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'pod-a', name: 'a', namespace: 'ns' }, spec: { nodeName: 'a' } };
    const podB: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'pod-b', name: 'b', namespace: 'ns' }, spec: { nodeName: 'a' } };
    const epsA: RawObject = {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { uid: 'eps-a', name: 'svc-a', namespace: 'ns' },
      subsets: [{ addresses: [{ targetRef: { kind: 'Pod', uid: 'pod-a' } }] }],
    };
    const epsB: RawObject = {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { uid: 'eps-b', name: 'svc-b', namespace: 'ns' },
      subsets: [{ addresses: [{ targetRef: { kind: 'Pod', uid: 'pod-b' } }] }],
    };
    const svcA: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-a', name: 'svc-a', namespace: 'ns' } };
    const svcB: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-b', name: 'svc-b', namespace: 'ns' } };
    const graph = buildGraph([node('a'), svcA, svcB, epsA, epsB, podA, podB]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.network.items).toHaveLength(2);
    const [x1, x2] = wheel.network.items.map((i) => i.x) as [number, number];
    const [z1, z2] = wheel.network.items.map((i) => i.z) as [number, number];
    expect(Math.hypot(x1 - x2, z1 - z2)).toBeGreaterThanOrEqual(0.5 - 1e-9);
  });

  it('builds an Endpoints/EndpointSlice tier one hop above each Service, both matched correctly', () => {
    const epSlice: RawObject = {
      apiVersion: 'discovery.k8s.io/v1',
      kind: 'EndpointSlice',
      metadata: { uid: 'eps-slice-1', name: 'web-abcde', namespace: 'ns', labels: { 'kubernetes.io/service-name': 'web' } },
    };
    const graph = buildGraph([node('a'), svc, endpoints, epSlice, pvc, podWithVolume]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.endpoints.items.map((i) => i.name).sort()).toEqual(['web', 'web-abcde']);
    expect(wheel.serviceToEndpoints).toContainEqual({ fromId: 'svc-1', toId: 'eps-1' });
    expect(wheel.serviceToEndpoints).toContainEqual({ fromId: 'svc-1', toId: 'eps-slice-1' });
  });

  it('positions the Service tier 25% closer to the pod plane than before (y=3.75, not 5)', () => {
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.network.items[0]!.y).toBe(3.75);
  });

  it('builds an Ingress/HTTPRoute tier above the Endpoints tier, matched by referenced Service name', () => {
    const ingress: RawObject = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { uid: 'ing-1', name: 'web-ingress', namespace: 'ns' },
      spec: { rules: [{ http: { paths: [{ backend: { service: { name: 'web' } } }] } }] },
    };
    const route: RawObject = {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: { uid: 'route-1', name: 'web-route', namespace: 'ns' },
      spec: { rules: [{ backendRefs: [{ name: 'web', kind: 'Service' }] }] },
    };
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume, ingress, route]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.ingress.items.map((i) => i.name).sort()).toEqual(['web-ingress', 'web-route']);
    expect(wheel.ingress.items.every((i) => i.y > wheel.endpoints.items[0]!.y)).toBe(true);
    expect(wheel.serviceToIngress).toContainEqual({ fromId: 'svc-1', toId: 'ing-1' });
    expect(wheel.serviceToIngress).toContainEqual({ fromId: 'svc-1', toId: 'route-1' });
  });

  it('matches an Ingress via its defaultBackend too, and colors Ingress/HTTPRoute with the shared filter swatch', () => {
    const defaultBackendIngress: RawObject = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { uid: 'ing-2', name: 'catch-all', namespace: 'ns' },
      spec: { defaultBackend: { service: { name: 'web' } } },
    };
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume, defaultBackendIngress]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.serviceToIngress).toContainEqual({ fromId: 'svc-1', toId: 'ing-2' });
    expect(wheel.ingress.items[0]!.color).toBe('#d9c94a');
  });

  it('ignores an HTTPRoute backendRef that explicitly targets a non-Service kind', () => {
    const route: RawObject = {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: { uid: 'route-2', name: 'to-other-kind', namespace: 'ns' },
      spec: { rules: [{ backendRefs: [{ name: 'web', kind: 'ServiceImport' }] }] },
    };
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume, route]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.ingress.items).toHaveLength(0);
  });

  it('does not duplicate an Ingress that lists the same backend Service more than once', () => {
    const ingress: RawObject = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { uid: 'ing-3', name: 'multi-path', namespace: 'ns' },
      spec: {
        rules: [
          { http: { paths: [{ backend: { service: { name: 'web' } } }, { backend: { service: { name: 'web' } } }] } },
        ],
      },
    };
    const graph = buildGraph([node('a'), svc, endpoints, pvc, podWithVolume, ingress]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.ingress.items).toHaveLength(1);
  });

  it('matches an OpenShift Route via spec.to and spec.alternateBackends, same as Ingress/HTTPRoute', () => {
    const canarySvc: RawObject = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-canary', name: 'canary', namespace: 'ns' } };
    const canaryPod: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-canary', name: 'canary', namespace: 'ns' },
      spec: { nodeName: 'a' },
      status: { phase: 'Running' },
    };
    const canaryEndpoints: RawObject = {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { uid: 'eps-canary', name: 'canary', namespace: 'ns' },
      subsets: [{ addresses: [{ targetRef: { kind: 'Pod', uid: 'pod-canary' } }] }],
    };
    const route: RawObject = {
      apiVersion: 'route.openshift.io/v1',
      kind: 'Route',
      metadata: { uid: 'route-os-1', name: 'web-route', namespace: 'ns' },
      spec: {
        to: { kind: 'Service', name: 'web' },
        alternateBackends: [{ kind: 'Service', name: 'canary' }],
      },
    };
    const graph = buildGraph([node('a'), svc, canarySvc, endpoints, canaryEndpoints, pvc, podWithVolume, canaryPod, route]);
    const wheel = projectClusterWheel(graph);

    // One tier item even though it routes to two Services — not a duplicate per Service it targets.
    expect(wheel.ingress.items.map((i) => i.name)).toEqual(['web-route']);
    expect(wheel.serviceToIngress).toContainEqual({ fromId: 'svc-1', toId: 'route-os-1' });
    expect(wheel.serviceToIngress).toContainEqual({ fromId: 'svc-canary', toId: 'route-os-1' });
  });

  it('builds the PVC -> PV -> StorageClass chain, positioned close to the pod ring', () => {
    const pvcBound: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-bound', name: 'data-bound', namespace: 'ns' },
      spec: { volumeName: 'pv-1' },
    };
    const podWithBoundVolume: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-bound', name: 'bound', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'data-bound' } }] },
      status: { phase: 'Running' },
    };
    const pv: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: { uid: 'pv-1', name: 'pv-1' },
      spec: { storageClassName: 'fast-ssd' },
    };
    const sc: RawObject = { apiVersion: 'storage.k8s.io/v1', kind: 'StorageClass', metadata: { uid: 'sc-1', name: 'fast-ssd' } };
    const graph = buildGraph([node('a'), pvcBound, pv, sc, podWithBoundVolume]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.persistentVolumes.items.map((i) => i.name)).toEqual(['pv-1']);
    expect(wheel.storageToPv).toEqual([{ fromId: 'pvc-bound', toId: 'pv-1' }]);
    expect(wheel.storageClasses.items.map((i) => i.name)).toEqual(['fast-ssd']);
    expect(wheel.pvToStorageClass).toEqual([{ fromId: 'pv-1', toId: 'sc-1' }]);

    // PVC now sits close to the pod ring (not the old far-below placement).
    const bpod = wheel.pods.find((p) => p.name === 'bound')!;
    const pvcItem = wheel.storage.items.find((i) => i.name === 'data-bound')!;
    expect(Math.abs(pvcItem.y - bpod.y)).toBeLessThan(2);
  });

  it('groups multiple PVs that share one StorageClass onto a single StorageClass item', () => {
    const pvcA: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-a', name: 'claim-a', namespace: 'ns' },
      spec: { volumeName: 'pv-a' },
    };
    const pvcB: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-b', name: 'claim-b', namespace: 'ns' },
      spec: { volumeName: 'pv-b' },
    };
    const podA: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-sa', name: 'sa', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'claim-a' } }] },
    };
    const podB: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-sb', name: 'sb', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'claim-b' } }] },
    };
    const pvA: RawObject = { apiVersion: 'v1', kind: 'PersistentVolume', metadata: { uid: 'pv-a', name: 'pv-a' }, spec: { storageClassName: 'shared' } };
    const pvB: RawObject = { apiVersion: 'v1', kind: 'PersistentVolume', metadata: { uid: 'pv-b', name: 'pv-b' }, spec: { storageClassName: 'shared' } };
    const sharedSc: RawObject = { apiVersion: 'storage.k8s.io/v1', kind: 'StorageClass', metadata: { uid: 'sc-shared', name: 'shared' } };
    const graph = buildGraph([node('a'), pvcA, pvcB, pvA, pvB, sharedSc, podA, podB]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.storageClasses.items).toHaveLength(1);
    expect(wheel.pvToStorageClass).toContainEqual({ fromId: 'pv-a', toId: 'sc-shared' });
    expect(wheel.pvToStorageClass).toContainEqual({ fromId: 'pv-b', toId: 'sc-shared' });
  });

  it('branches VolumeAttachment off the PV as a sibling of StorageClass, not chained off it', () => {
    const pvcBound: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-bound', name: 'data-bound', namespace: 'ns' },
      spec: { volumeName: 'pv-1' },
    };
    const podWithBoundVolume: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-bound', name: 'bound', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'data-bound' } }] },
      status: { phase: 'Running' },
    };
    const pv: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: { uid: 'pv-1', name: 'pv-1' },
      spec: { storageClassName: 'fast-ssd' },
    };
    const sc: RawObject = { apiVersion: 'storage.k8s.io/v1', kind: 'StorageClass', metadata: { uid: 'sc-1', name: 'fast-ssd' } };
    const va: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'VolumeAttachment',
      metadata: { uid: 'va-1', name: 'csi-va-1' },
      spec: { attacher: 'csi.example.com', nodeName: 'a', source: { persistentVolumeName: 'pv-1' } },
    };
    const graph = buildGraph([node('a'), pvcBound, pv, sc, va, podWithBoundVolume]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.volumeAttachments.items.map((i) => i.name)).toEqual(['csi-va-1']);
    expect(wheel.pvToVolumeAttachment).toEqual([{ fromId: 'pv-1', toId: 'va-1' }]);
    // StorageClass still resolves independently — VolumeAttachment is a sibling branch, not a replacement.
    expect(wheel.storageClasses.items.map((i) => i.name)).toEqual(['fast-ssd']);

    // Sibling tiers never share a Y-level, so they can't land on the exact same spot even when both anchor
    // to the same PV.
    const scItem = wheel.storageClasses.items[0]!;
    const vaItem = wheel.volumeAttachments.items[0]!;
    expect(scItem.y).not.toBe(vaItem.y);
  });

  it('links a StorageClass to its CSIDriver by provisioner name, on the same plane', () => {
    const sc: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      metadata: { uid: 'sc-csi', name: 'ceph-rbd' },
      provisioner: 'openshift-storage.rbd.csi.ceph.com',
    };
    const driver: RawObject = {
      apiVersion: 'storage.k8s.io/v1beta1',
      kind: 'CSIDriver',
      metadata: { uid: 'driver-1', name: 'openshift-storage.rbd.csi.ceph.com' },
    };
    // A built-in non-CSI provisioner should match nothing, not crash.
    const scNoProvisioner: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      metadata: { uid: 'sc-none', name: 'no-csi' },
      provisioner: 'kubernetes.io/no-provisioner',
    };
    const pv: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: { uid: 'pv-csi', name: 'pv-csi' },
      spec: { storageClassName: 'ceph-rbd' },
    };
    const pvc: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-csi', name: 'claim-csi', namespace: 'ns' },
      spec: { volumeName: 'pv-csi' },
    };
    const p: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-csi', name: 'csi', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'claim-csi' } }] },
    };
    const graph = buildGraph([node('a'), sc, scNoProvisioner, driver, pv, pvc, p]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.csiDrivers.items.map((i) => i.name)).toEqual(['openshift-storage.rbd.csi.ceph.com']);
    expect(wheel.storageClassToCsiDriver).toEqual([{ fromId: 'sc-csi', toId: 'driver-1' }]);
    const scItem = wheel.storageClasses.items.find((i) => i.id === 'sc-csi')!;
    const driverItem = wheel.csiDrivers.items[0]!;
    // Pushed further below the ring than the StorageClass's own plane (not the same Y) — the newer
    // VolumeAttachment link needs a visibly angled connector, not a nearly-flat one.
    expect(driverItem.y).toBeLessThan(scItem.y);
    // ...but positioned out at the CSI ring's own radius (NOT anchored near the StorageClass's own, much
    // smaller, radius) — a CSIDriver is cluster-wide, not owned by any one StorageClass's position.
    expect(Math.hypot(driverItem.x, driverItem.z)).toBeCloseTo(wheel.csiRingRadius, 5);
    // Its angle around the wheel still comes from the StorageClass, so it sits directly under the ring point
    // closest to it, not at an arbitrary angle.
    expect(Math.atan2(driverItem.z, driverItem.x)).toBeCloseTo(Math.atan2(scItem.z, scItem.x), 5);
  });

  it('links a VolumeAttachment to its CSIDriver by attacher name, independent of its StorageClass', () => {
    const sc: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      metadata: { uid: 'sc-csi', name: 'ceph-rbd' },
      provisioner: 'openshift-storage.rbd.csi.ceph.com',
    };
    const driver: RawObject = {
      apiVersion: 'storage.k8s.io/v1beta1',
      kind: 'CSIDriver',
      metadata: { uid: 'driver-1', name: 'openshift-storage.rbd.csi.ceph.com' },
    };
    const pv: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: { uid: 'pv-csi', name: 'pv-csi' },
      spec: { storageClassName: 'ceph-rbd' },
    };
    const pvc: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-csi', name: 'claim-csi', namespace: 'ns' },
      spec: { volumeName: 'pv-csi' },
    };
    const p: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-csi', name: 'csi', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'claim-csi' } }] },
    };
    const va: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'VolumeAttachment',
      metadata: { uid: 'va-csi', name: 'csi-va-csi' },
      spec: { attacher: 'openshift-storage.rbd.csi.ceph.com', nodeName: 'a', source: { persistentVolumeName: 'pv-csi' } },
    };
    const graph = buildGraph([node('a'), sc, driver, pv, pvc, p, va]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.volumeAttachmentToCsiDriver).toEqual([{ fromId: 'va-csi', toId: 'driver-1' }]);
    // The driver sits clearly BELOW VolumeAttachment (not just closer to it) so their connecting line reads
    // as a real angled connector rather than a nearly-flat one — see CSI_DRIVER_Y's own comment for why
    // "further from the ring" has to mean past VolumeAttachment's own plane, not just toward it.
    const driverItem = wheel.csiDrivers.items[0]!;
    const vaItem = wheel.volumeAttachments.items[0]!;
    expect(driverItem.y).toBeLessThan(vaItem.y);
  });

  it('drops a VolumeAttachment->CSIDriver edge silently when the attacher names no known CSIDriver', () => {
    const pv: RawObject = { apiVersion: 'v1', kind: 'PersistentVolume', metadata: { uid: 'pv-orphan', name: 'pv-orphan' } };
    const pvc: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { uid: 'pvc-orphan', name: 'claim-orphan', namespace: 'ns' },
      spec: { volumeName: 'pv-orphan' },
    };
    const p: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'pod-orphan', name: 'orphan', namespace: 'ns' },
      spec: { nodeName: 'a', volumes: [{ name: 'v', persistentVolumeClaim: { claimName: 'claim-orphan' } }] },
    };
    const va: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'VolumeAttachment',
      metadata: { uid: 'va-orphan', name: 'csi-va-orphan' },
      spec: { attacher: 'no-such-driver.example.com', nodeName: 'a', source: { persistentVolumeName: 'pv-orphan' } },
    };
    const graph = buildGraph([node('a'), pv, pvc, p, va]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.volumeAttachments.items.map((i) => i.name)).toEqual(['csi-va-orphan']);
    expect(wheel.volumeAttachmentToCsiDriver).toEqual([]);
  });

  it('stacks CSINode driver dots below the CSI ring, straight under the node, with a minimum gap', () => {
    const csiNode: RawObject = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'CSINode',
      metadata: { uid: 'csinode-a', name: 'a' },
      spec: {
        drivers: [
          { name: 'driver-one', nodeID: 'a' },
          { name: 'driver-two', nodeID: 'a' },
          { name: 'driver-three', nodeID: 'a' },
        ],
      },
    };
    const graph = buildGraph([node('a'), csiNode]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.csiNodeDrivers).toHaveLength(3);
    expect(wheel.csiNodeDrivers.every((d) => d.id === 'csinode-a')).toBe(true);
    expect(wheel.csiNodeDrivers.every((d) => d.nodeId === wheel.nodes[0]?.id)).toBe(true);
    // Every dot — including the first, nearest the node — sits BELOW the ring (y=-0.3), not squeezed above it.
    for (const d of wheel.csiNodeDrivers) expect(d.y).toBeLessThan(-0.3);
    // Consecutive dots keep at least a fixed minimum vertical gap, regardless of how many drivers a node has.
    const ys = wheel.csiNodeDrivers.map((d) => d.y).sort((a, b) => b - a);
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1]! - ys[i]!).toBeGreaterThanOrEqual(0.18 - 1e-9);
    // A plain straight drop from the node's own center — not routed out to touch the ring.
    const n = wheel.nodes[0]!;
    for (const d of wheel.csiNodeDrivers) {
      expect(d.x).toBeCloseTo(n.x, 5);
      expect(d.z).toBeCloseTo(n.z, 5);
    }
  });

  it('gives every node a local-storage cylinder, clickable back to the Node itself', () => {
    const graph = buildGraph([node('a'), node('b')]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.localStorage).toHaveLength(2);
    for (const ls of wheel.localStorage) {
      const n = wheel.nodes.find((nd) => nd.id === ls.id);
      expect(n).toBeDefined(); // id resolves back to a real Node, not a synthetic id
      expect(ls.y).toBeLessThan(0);
      // Offset further out than the node it belongs to, not stacked directly on it.
      expect(Math.hypot(ls.x, ls.z)).toBeGreaterThan(Math.hypot(n!.x, n!.z));
    }
  });
});
