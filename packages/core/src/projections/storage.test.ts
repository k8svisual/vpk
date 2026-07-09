import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectStorageHierarchy } from './storage';
import type { RawObject } from '../types';

const fastSc: RawObject = {
  apiVersion: 'storage.k8s.io/v1',
  kind: 'StorageClass',
  metadata: { uid: 'sc1', name: 'fast-ssd' },
  provisioner: 'kubernetes.io/aws-ebs',
};
const emptySc: RawObject = {
  apiVersion: 'storage.k8s.io/v1',
  kind: 'StorageClass',
  metadata: { uid: 'sc2', name: 'unused-class' },
  provisioner: 'kubernetes.io/gce-pd',
};
const pvc: RawObject = {
  apiVersion: 'v1',
  kind: 'PersistentVolumeClaim',
  metadata: { uid: 'pvc1', name: 'data-claim', namespace: 'ns1' },
  spec: { storageClassName: 'fast-ssd', resources: { requests: { storage: '5Gi' } } },
};
const boundPv: RawObject = {
  apiVersion: 'v1',
  kind: 'PersistentVolume',
  metadata: { uid: 'pv1', name: 'pv-001' },
  spec: {
    storageClassName: 'fast-ssd',
    capacity: { storage: '10Gi' },
    claimRef: { namespace: 'ns1', name: 'data-claim', uid: 'pvc1' },
  },
  status: { phase: 'Bound' },
};
const orphanPv: RawObject = {
  apiVersion: 'v1',
  kind: 'PersistentVolume',
  metadata: { uid: 'pv2', name: 'pv-legacy' },
  spec: { capacity: { storage: '1Gi' } },
  status: { phase: 'Available' },
};
const pod: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod1', name: 'app-0', namespace: 'ns1' },
  spec: { volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'data-claim' } }] },
};
const csiDriver: RawObject = {
  apiVersion: 'storage.k8s.io/v1',
  kind: 'CSIDriver',
  metadata: { uid: 'csi1', name: 'kubernetes.io/aws-ebs' },
};
const volumeAttachment: RawObject = {
  apiVersion: 'storage.k8s.io/v1',
  kind: 'VolumeAttachment',
  metadata: { uid: 'va1', name: 'va-pv-001' },
  spec: { attacher: 'kubernetes.io/aws-ebs', source: { persistentVolumeName: 'pv-001' } },
};

describe('projectStorageHierarchy', () => {
  const graph = buildGraph([fastSc, emptySc, pvc, boundPv, orphanPv, pod, csiDriver, volumeAttachment]);
  const groups = projectStorageHierarchy(graph);

  it('groups a bound PV under its StorageClass with the resolved PVC', () => {
    const fast = groups.find((g) => g.name === 'fast-ssd');
    expect(fast?.pvs).toHaveLength(1);
    expect(fast?.totalCapacityBytes).toBe(10 * 1024 ** 3);
    expect(fast?.pvs[0]?.pvcId).toBe('pvc1');
    expect(fast?.pvs[0]?.phase).toBe('Bound');
  });

  it('keeps an empty StorageClass as "None used" instead of dropping it', () => {
    const unused = groups.find((g) => g.name === 'unused-class');
    expect(unused).toBeDefined();
    expect(unused?.pvs).toEqual([]);
    expect(unused?.totalCapacityBytes).toBe(0);
  });

  it('buckets a PV with no storageClassName into the synthetic "" group', () => {
    const none = groups.find((g) => g.name === '');
    expect(none?.pvs).toHaveLength(1);
    expect(none?.pvs[0]?.pv.name).toBe('pv-legacy');
    expect(none?.pvs[0]?.pvcId).toBeUndefined();
  });

  it("resolves the StorageClass's CSIDriver by provisioner name", () => {
    const fast = groups.find((g) => g.name === 'fast-ssd');
    expect(fast?.csiDriverId).toBe('csi1');
    expect(fast?.csiDriverName).toBe('kubernetes.io/aws-ebs');
  });

  it('lists Pods mounting the PV via its resolved PVC', () => {
    const fast = groups.find((g) => g.name === 'fast-ssd');
    expect(fast?.pvs[0]?.pods).toEqual([{ id: 'pod1', name: 'app-0', namespace: 'ns1' }]);
  });

  it("resolves the PV's VolumeAttachment and that VolumeAttachment's own CSIDriver, as sibling branches off the PV", () => {
    const fast = groups.find((g) => g.name === 'fast-ssd');
    expect(fast?.pvs[0]?.volumeAttachmentId).toBe('va1');
    expect(fast?.pvs[0]?.volumeAttachmentCsiDriverId).toBe('csi1');
  });

  it('leaves volumeAttachment/pods unset when nothing references the PV (adaptive, not fabricated)', () => {
    const none = groups.find((g) => g.name === '');
    expect(none?.pvs[0]?.pods).toEqual([]);
    expect(none?.pvs[0]?.volumeAttachmentId).toBeUndefined();
  });
});
