import { describe, it, expect } from 'vitest';
import { buildGraph } from './graph';
import { nodeRole, nodeRoleColor, podStatusColor } from './podStatus';
import type { RawObject } from './types';

describe('nodeRole', () => {
  it('detects a control-plane node even when it also carries the worker label', () => {
    const graph = buildGraph([
      {
        apiVersion: 'v1',
        kind: 'Node',
        metadata: {
          uid: 'n1',
          name: 'master1',
          labels: { 'node-role.kubernetes.io/master': '', 'node-role.kubernetes.io/worker': '' },
        },
      },
    ]);
    const node = [...graph.nodes.values()][0]!;
    expect(nodeRole(node)).toBe('master');
    expect(nodeRoleColor('master')).not.toBe(nodeRoleColor('worker'));
  });

  it('defaults to worker when no master/control-plane label is present', () => {
    const graph = buildGraph([{ apiVersion: 'v1', kind: 'Node', metadata: { uid: 'n2', name: 'worker1', labels: {} } }]);
    expect(nodeRole([...graph.nodes.values()][0]!)).toBe('worker');
  });
});

describe('podStatusColor', () => {
  const kinds: [string, string][] = [
    ['Running', '#2e8b57'],
    ['Pending', '#d4a017'],
    ['Failed', '#c0392b'],
    ['Succeeded', '#3a7bd5'],
  ];

  it.each(kinds)('colors a %s pod correctly', (phase, expectedColor) => {
    const graph = buildGraph([
      { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'p1', name: 'p', namespace: 'ns' }, status: { phase } },
    ]);
    expect(podStatusColor([...graph.nodes.values()][0]!)).toBe(expectedColor);
  });

  it('colors a DaemonSet-owned pod grey regardless of its phase', () => {
    const raw: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'p2', name: 'ds-pod', namespace: 'ns', ownerReferences: [{ kind: 'DaemonSet', name: 'x', uid: 'ds1' }] },
      status: { phase: 'Running' },
    };
    const graph = buildGraph([raw]);
    expect(podStatusColor([...graph.nodes.values()].find((r) => r.kind === 'Pod')!)).toBe('#9a9a9a');
  });
});
