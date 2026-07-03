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

  it('rolls unready nodes to error (red) color', () => {
    const graph = buildGraph([node('bad', false)]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.nodes[0]?.color).toBe('#c0392b');
    expect(wheel.nodes[0]?.health).toBe('error');
  });

  it('handles an empty cluster (no nodes) without dividing by zero', () => {
    const wheel = projectClusterWheel(buildGraph([]));
    expect(wheel.nodes).toEqual([]);
    expect(Number.isFinite(wheel.outerRadius)).toBe(true);
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
});
