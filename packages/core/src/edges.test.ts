import { describe, it, expect } from 'vitest';
import { buildGraph } from './graph';
import type { RawObject } from './types';

const dep: RawObject = { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { uid: 'd1', name: 'app', namespace: 'ns' } };
const rs: RawObject = {
  apiVersion: 'apps/v1',
  kind: 'ReplicaSet',
  metadata: { uid: 'r1', name: 'app-rs', namespace: 'ns', ownerReferences: [{ uid: 'd1', kind: 'Deployment', name: 'app', controller: true }] },
};
const pod: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'p1', name: 'app-pod', namespace: 'ns', ownerReferences: [{ uid: 'r1', kind: 'ReplicaSet', name: 'app-rs', controller: true }] },
};

describe('extractOwnerEdges (via buildGraph)', () => {
  it('creates owner edges parent → child', () => {
    const owner = buildGraph([dep, rs, pod]).edges.filter((e) => e.type === 'ownerReference');
    expect(owner).toHaveLength(2);
    expect(owner.some((e) => e.from === 'd1' && e.to === 'r1')).toBe(true);
    expect(owner.some((e) => e.from === 'r1' && e.to === 'p1')).toBe(true);
  });

  it('handles multiple owners on one child', () => {
    const child: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'c1', name: 'c', namespace: 'ns', ownerReferences: [{ uid: 'd1' }, { uid: 'r1' }] } };
    const toChild = buildGraph([dep, rs, child]).edges.filter((e) => e.to === 'c1');
    expect(toChild.map((e) => e.from).sort()).toEqual(['d1', 'r1']);
  });

  it('synthesizes a placeholder node for a missing owner', () => {
    const orphan: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'o1', name: 'o', namespace: 'ns', ownerReferences: [{ uid: 'gone', kind: 'ReplicaSet', name: 'ghost' }] } };
    const g = buildGraph([orphan]);
    const edge = g.edges.find((e) => e.to === 'o1');
    expect(edge).toBeDefined();
    const parent = edge ? g.nodes.get(edge.from) : undefined;
    expect(parent?.placeholder).toBe(true);
    expect(parent?.name).toBe('ghost');
  });
});
