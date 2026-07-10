import { describe, it, expect } from 'vitest';
import { buildGraph } from './graph';
import { podResourceRequests } from './podResources';
import type { RawObject } from './types';

function pod(containers: { name: string; cpu?: string; memory?: string }[], initContainers?: { name: string; cpu?: string; memory?: string }[]): RawObject {
  const toContainer = (c: { name: string; cpu?: string; memory?: string }) => ({
    name: c.name,
    resources: c.cpu || c.memory ? { requests: { cpu: c.cpu, memory: c.memory } } : undefined,
  });
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: 'p1', name: 'p1', namespace: 'default' },
    spec: {
      containers: containers.map(toContainer),
      initContainers: initContainers?.map(toContainer),
    },
  };
}

describe('podResourceRequests', () => {
  it('sums CPU and Memory requests across containers', () => {
    const graph = buildGraph([pod([{ name: 'a', cpu: '250m', memory: '128Mi' }, { name: 'b', cpu: '500m', memory: '256Mi' }])]);
    const p = [...graph.nodes.values()][0]!;
    const r = podResourceRequests(p);
    expect(r.cpuCores).toBeCloseTo(0.75);
    expect(r.memBytes).toBe(128 * 1024 * 1024 + 256 * 1024 * 1024);
    expect(r.hasRequests).toBe(true);
  });

  it('reports hasRequests=false when no container declares CPU or Memory', () => {
    const graph = buildGraph([pod([{ name: 'a' }])]);
    const p = [...graph.nodes.values()][0]!;
    const r = podResourceRequests(p);
    expect(r.cpuCores).toBeUndefined();
    expect(r.memBytes).toBeUndefined();
    expect(r.hasRequests).toBe(false);
  });

  it('excludes initContainers from the total', () => {
    const graph = buildGraph([pod([{ name: 'a' }], [{ name: 'init', cpu: '1', memory: '1Gi' }])]);
    const p = [...graph.nodes.values()][0]!;
    const r = podResourceRequests(p);
    expect(r.hasRequests).toBe(false);
  });

  it('only counts the resource type that was actually requested (CPU set, Memory not)', () => {
    const graph = buildGraph([pod([{ name: 'a', cpu: '100m' }])]);
    const p = [...graph.nodes.values()][0]!;
    const r = podResourceRequests(p);
    expect(r.cpuCores).toBeCloseTo(0.1);
    expect(r.memBytes).toBeUndefined();
    expect(r.hasRequests).toBe(true);
  });
});
