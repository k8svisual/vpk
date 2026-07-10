import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectPodsOnNode } from './podsOnNode';
import type { RawObject } from '../types';

const node: RawObject = { apiVersion: 'v1', kind: 'Node', metadata: { uid: 'n1', name: 'node-a' } };

function pod(name: string, opts: { cpu?: string; memory?: string; daemonSet?: boolean } = {}): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      uid: name,
      name,
      namespace: 'default',
      ownerReferences: opts.daemonSet ? [{ apiVersion: 'apps/v1', kind: 'DaemonSet', name: 'ds', uid: 'ds-1', controller: true }] : undefined,
    },
    spec: {
      nodeName: 'node-a',
      containers: [{ name: 'app', resources: opts.cpu || opts.memory ? { requests: { cpu: opts.cpu, memory: opts.memory } } : undefined }],
    },
    status: { phase: 'Running' },
  };
}

describe('projectPodsOnNode', () => {
  it('reports requested CPU/Memory and hasRequests per pod', () => {
    const graph = buildGraph([node, pod('with-requests', { cpu: '500m', memory: '512Mi' }), pod('no-requests')]);
    const rows = projectPodsOnNode(graph, 'node-a');
    const withReq = rows.find((r) => r.name === 'with-requests')!;
    const noReq = rows.find((r) => r.name === 'no-requests')!;
    expect(withReq.cpuCores).toBeCloseTo(0.5);
    expect(withReq.memBytes).toBe(512 * 1024 * 1024);
    expect(withReq.hasRequests).toBe(true);
    expect(noReq.cpuCores).toBeUndefined();
    expect(noReq.hasRequests).toBe(false);
  });

  it('includes DaemonSet-owned pods, same as before, alongside their request totals', () => {
    const graph = buildGraph([node, pod('ds-pod', { daemonSet: true, cpu: '100m' })]);
    const rows = projectPodsOnNode(graph, 'node-a');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.daemonSet).toBe(true);
    expect(rows[0]?.cpuCores).toBeCloseTo(0.1);
  });
});
