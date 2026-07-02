import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectOwnerRef } from './ownerRef';
import type { RawObject } from '../types';

/** Linear owner chain a0 ← a1 ← … ← a{depth-1} (a0 is the root owner). */
function chain(depth: number): RawObject[] {
  const objs: RawObject[] = [];
  for (let i = 0; i < depth; i++) {
    const meta: RawObject['metadata'] = { uid: `a${i}`, name: `a${i}`, namespace: 'ns' };
    if (i > 0) meta.ownerReferences = [{ uid: `a${i - 1}`, kind: 'X', name: `a${i - 1}`, controller: true }];
    objs.push({ apiVersion: 'v1', kind: 'X', metadata: meta });
  }
  return objs;
}

describe('projectOwnerRef', () => {
  it('follows chains deeper than 5 levels (legacy cap removed)', () => {
    const view = projectOwnerRef(buildGraph(chain(7)), { resourceId: 'a6' });
    expect(view.nodes).toHaveLength(7);
    expect(view.edges).toHaveLength(6);
  });

  it('is cycle-safe', () => {
    const a: RawObject = { apiVersion: 'v1', kind: 'X', metadata: { uid: 'a', name: 'a', namespace: 'ns', ownerReferences: [{ uid: 'b' }] } };
    const b: RawObject = { apiVersion: 'v1', kind: 'X', metadata: { uid: 'b', name: 'b', namespace: 'ns', ownerReferences: [{ uid: 'a' }] } };
    const view = projectOwnerRef(buildGraph([a, b]), { resourceId: 'a' });
    expect(view.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('namespace focus returns the chains in that namespace', () => {
    const view = projectOwnerRef(buildGraph(chain(3)), { namespace: 'ns' });
    expect(view.nodes).toHaveLength(3);
  });

  it('namespace focus excludes standalone (ownerless) resources', () => {
    const cm: RawObject = { apiVersion: 'v1', kind: 'ConfigMap', metadata: { uid: 'cm', name: 'cfg', namespace: 'ns' } };
    const view = projectOwnerRef(buildGraph([...chain(3), cm]), { namespace: 'ns' });
    expect(view.nodes).toHaveLength(3); // the chain, not the standalone ConfigMap
    expect(view.nodes.some((n) => n.id === 'cm')).toBe(false);
  });

  it('returns empty for an unknown focus', () => {
    expect(projectOwnerRef(buildGraph(chain(3)), { resourceId: 'nope' }).nodes).toHaveLength(0);
  });
});
