import { describe, it, expect } from 'vitest';
import { resourceId, CLUSTER_SCOPE } from './identity';

describe('resourceId', () => {
  it('uses metadata.uid when present', () => {
    expect(resourceId({ apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'abc-123', name: 'p' } })).toBe(
      'abc-123',
    );
  });

  it('falls back to the composed key for namespaced resources without uid', () => {
    expect(
      resourceId({ apiVersion: 'v1', kind: 'Pod', metadata: { namespace: 'prod', name: 'web-0' } }),
    ).toBe('v1|Pod|prod|web-0');
  });

  it('uses the cluster-scope marker when there is no namespace', () => {
    expect(resourceId({ apiVersion: 'v1', kind: 'Node', metadata: { name: 'node-1' } })).toBe(
      `v1|Node|${CLUSTER_SCOPE}|node-1`,
    );
  });

  it('is deterministic for the same input', () => {
    const obj = { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { namespace: 'ns', name: 'd' } };
    expect(resourceId(obj)).toBe(resourceId(obj));
  });
});
