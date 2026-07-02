import { describe, it, expect } from 'vitest';
import { normalize } from './normalize';
import type { RawObject } from './types';

describe('normalize', () => {
  it('strips metadata.managedFields without mutating the input', () => {
    const obj: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { uid: 'u1', name: 'p', namespace: 'ns', managedFields: [{ manager: 'kubelet' }] },
    };
    const { nodes } = normalize([obj]);
    expect(nodes.get('u1')?.raw.metadata?.managedFields).toBeUndefined();
    expect(obj.metadata?.managedFields).toBeDefined();
  });

  it('assigns identity and indexes by uid', () => {
    const { nodes, byUid } = normalize([
      { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'u1', name: 'p', namespace: 'ns' } },
    ]);
    expect(byUid.get('u1')).toBe('u1');
    expect(nodes.get('u1')?.name).toBe('p');
  });

  it('dedupes objects that share an identity and reports the count', () => {
    const dup: RawObject = { apiVersion: 'v1', kind: 'Namespace', metadata: { uid: 'n1', name: 'ns' } };
    const { nodes, deduped } = normalize([dup, { ...dup }]);
    expect(nodes.size).toBe(1);
    expect(deduped).toBe(1);
  });

  it('defaults labels/annotations to empty objects', () => {
    const { nodes } = normalize([{ apiVersion: 'v1', kind: 'Node', metadata: { name: 'n1' } }]);
    const r = [...nodes.values()][0];
    expect(r?.labels).toEqual({});
    expect(r?.annotations).toEqual({});
  });
});
