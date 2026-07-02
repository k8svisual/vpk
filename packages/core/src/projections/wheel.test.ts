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

describe('projectClusterWheel', () => {
  it('places nodes evenly around a ring and clusters their pods nearby', () => {
    const graph = buildGraph([node('a'), node('b'), node('c'), pod('p1', 'a'), pod('p2', 'a'), pod('p3', 'b')]);
    const wheel = projectClusterWheel(graph);

    expect(wheel.nodes).toHaveLength(3);
    for (const n of wheel.nodes) {
      const dist = Math.hypot(n.x, n.z);
      expect(dist).toBeCloseTo(wheel.ringRadius, 5);
    }
    expect(wheel.nodes.find((n) => n.name === 'a')?.podCount).toBe(2);
    expect(wheel.pods).toHaveLength(3);
    // pods cluster near their node's ring radius, not at the exact center
    for (const p of wheel.pods) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(wheel.ringRadius * 0.5);
  });

  it('rolls unready nodes to error (red) color', () => {
    const graph = buildGraph([node('bad', false)]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.nodes[0]?.color).toBe('#c0392b');
    expect(wheel.nodes[0]?.health).toBe('error');
  });

  it('caps large tiers and reports the true total instead of silently truncating', () => {
    const many: RawObject[] = Array.from({ length: 150 }, (_, i) => ({
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { uid: `secret-${i}`, name: `s${i}`, namespace: 'ns' },
    }));
    const graph = buildGraph([node('a'), ...many]);
    const wheel = projectClusterWheel(graph);
    expect(wheel.config.totalCount).toBe(150);
    expect(wheel.config.items.length).toBeLessThan(150);
    expect(wheel.config.items.length).toBeGreaterThan(0);
  });

  it('handles an empty cluster (no nodes) without dividing by zero', () => {
    const wheel = projectClusterWheel(buildGraph([]));
    expect(wheel.nodes).toEqual([]);
    expect(Number.isFinite(wheel.ringRadius)).toBe(true);
  });
});
