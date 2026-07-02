import { describe, it, expect } from 'vitest';
import { buildGraph } from '@vpk/core';
import type { RawObject } from '@vpk/core';
import { listStorageGroups } from './storage';

const sc: RawObject = {
  apiVersion: 'storage.k8s.io/v1',
  kind: 'StorageClass',
  metadata: { uid: 'sc1', name: 'fast-ssd' },
  provisioner: 'kubernetes.io/aws-ebs',
};
const pv: RawObject = {
  apiVersion: 'v1',
  kind: 'PersistentVolume',
  metadata: { uid: 'pv1', name: 'pv-001' },
  spec: { storageClassName: 'fast-ssd', capacity: { storage: '10Gi' } },
  status: { phase: 'Available' },
};

describe('listStorageGroups', () => {
  it('produces lean DTOs with no raw payload', () => {
    const graph = buildGraph([sc, pv]);
    const groups = listStorageGroups(graph);
    const fast = groups.find((g) => g.name === 'fast-ssd');
    expect(fast?.pvs).toHaveLength(1);
    expect(fast?.totalCapacityBytes).toBe(10 * 1024 ** 3);
    for (const g of groups) {
      expect('raw' in g).toBe(false);
      for (const p of g.pvs) expect('raw' in p).toBe(false);
    }
  });
});
