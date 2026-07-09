import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectVolumeUsage } from './storageCounts';
import type { RawObject } from '../types';

const node: RawObject = { apiVersion: 'v1', kind: 'Node', metadata: { uid: 'node-a', name: 'worker-a' } };
const ns: RawObject = { apiVersion: 'v1', kind: 'Namespace', metadata: { uid: 'ns-1', name: 'default' } };
const pod: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod-1', name: 'app-0', namespace: 'default' },
  spec: {
    nodeName: 'worker-a',
    volumes: [
      { name: 'cfg', configMap: { name: 'app-config' } },
      { name: 'data', persistentVolumeClaim: { claimName: 'app-data' } },
      { name: 'creds', secret: { secretName: 'app-secret' } },
    ],
  },
};
const podNoNode: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod-2', name: 'pending-pod', namespace: 'default' },
  spec: { volumes: [{ name: 'scratch', emptyDir: {} }] },
};

describe('projectVolumeUsage', () => {
  const graph = buildGraph([node, ns, pod, podNoNode]);
  const usages = projectVolumeUsage(graph);

  it('emits one row per pod.spec.volumes[] entry, classified by whichever key besides name is set', () => {
    const byPod1 = usages.filter((u) => u.podId === 'pod-1');
    expect(byPod1.map((u) => u.volumeType).sort()).toEqual(['configMap', 'persistentVolumeClaim', 'secret']);
  });

  it('resolves namespace and node ids alongside their plain names', () => {
    const cfg = usages.find((u) => u.volumeName === 'cfg')!;
    expect(cfg.namespace).toBe('default');
    expect(cfg.namespaceId).toBe('ns-1');
    expect(cfg.nodeName).toBe('worker-a');
    expect(cfg.nodeId).toBe('node-a');
  });

  it('leaves nodeName/nodeId unset for an unscheduled pod, rather than fabricating a node', () => {
    const scratch = usages.find((u) => u.volumeName === 'scratch')!;
    expect(scratch.nodeName).toBeUndefined();
    expect(scratch.nodeId).toBeUndefined();
    expect(scratch.volumeType).toBe('emptyDir');
  });

  it('produces exactly one row per volume, not per pod', () => {
    expect(usages).toHaveLength(4);
  });
});
