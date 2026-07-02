import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectClusterNodeField } from './scene';
import type { RawObject } from '../types';

const healthyNode: RawObject = {
  apiVersion: 'v1',
  kind: 'Node',
  metadata: { uid: 'n1', name: 'node-a' },
  status: {
    capacity: { cpu: '4', memory: '8Gi', pods: '110' },
    conditions: [{ type: 'MemoryPressure', status: 'False' }, { type: 'Ready', status: 'True' }],
  },
};
const notReadyNode: RawObject = {
  apiVersion: 'v1',
  kind: 'Node',
  metadata: { uid: 'n2', name: 'node-b' },
  status: { capacity: { cpu: '2', memory: '4Gi' }, conditions: [{ type: 'Ready', status: 'False' }] },
};
const pressureNode: RawObject = {
  apiVersion: 'v1',
  kind: 'Node',
  metadata: { uid: 'n3', name: 'node-c' },
  status: {
    capacity: { cpu: '8', memory: '16Gi' },
    conditions: [{ type: 'Ready', status: 'True' }, { type: 'DiskPressure', status: 'True' }],
  },
};
const pod: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'p1', name: 'app', namespace: 'ns' },
  spec: { nodeName: 'node-a' },
};

describe('projectClusterNodeField', () => {
  const graph = buildGraph([healthyNode, notReadyNode, pressureNode, pod]);
  const nodes = projectClusterNodeField(graph);

  it('parses capacity and counts scheduled pods per node', () => {
    const a = nodes.find((n) => n.name === 'node-a');
    expect(a?.cpuCapacity).toBe(4);
    expect(a?.memCapacityBytes).toBe(8 * 1024 ** 3);
    expect(a?.podCount).toBe(1);
  });

  it('rolls up Ready=False to error', () => {
    expect(nodes.find((n) => n.name === 'node-b')?.health).toBe('error');
  });

  it('rolls up a pressure condition to warn (not error)', () => {
    expect(nodes.find((n) => n.name === 'node-c')?.health).toBe('warn');
  });

  it('rolls up a fully healthy node to ok', () => {
    expect(nodes.find((n) => n.name === 'node-a')?.health).toBe('ok');
  });
});
