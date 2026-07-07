import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { paneForResource, projectControlPlane } from './controlPlane';
import type { RawObject } from '../types';

function node(name: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Node',
    metadata: { uid: `node-${name}`, name },
    status: { conditions: [{ type: 'Ready', status: 'True' }] },
  };
}
function pod(name: string, nodeName: string, images: string[]): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: `pod-${name}`, name, namespace: 'ns' },
    spec: { nodeName, containers: images.map((image, i) => ({ name: `c${i}`, image })) },
    status: { phase: 'Running' },
  };
}
function obj(kind: string, apiVersion: string, name: string): RawObject {
  return { apiVersion, kind, metadata: { uid: `${kind}-${name}`, name } };
}

describe('paneForResource', () => {
  it('places apps/batch/autoscaling kinds in Workload', () => {
    expect(paneForResource('Deployment', 'apps/v1')).toBe('Workload');
    expect(paneForResource('CronJob', 'batch/v1')).toBe('Workload');
    expect(paneForResource('HorizontalPodAutoscaler', 'autoscaling/v2')).toBe('Workload');
    expect(paneForResource('PodDisruptionBudget', 'policy/v1')).toBe('Workload');
  });

  it('places RBAC kinds in RBAC, not Authorization/Authentication', () => {
    expect(paneForResource('Role', 'rbac.authorization.k8s.io/v1')).toBe('RBAC');
    expect(paneForResource('ClusterRoleBinding', 'rbac.authorization.k8s.io/v1')).toBe('RBAC');
  });

  it('places ConfigMap/Secret in Config', () => {
    expect(paneForResource('ConfigMap', 'v1')).toBe('Config');
    expect(paneForResource('Secret', 'v1')).toBe('Config');
  });

  it('places ServiceAccount and OpenShift oauth/user kinds in Authentication', () => {
    expect(paneForResource('ServiceAccount', 'v1')).toBe('Authentication');
    expect(paneForResource('OAuthAccessToken', 'oauth.openshift.io/v1')).toBe('Authentication');
    expect(paneForResource('User', 'user.openshift.io/v1')).toBe('Authentication');
  });

  it('places CRD/OLM kinds in Extend', () => {
    expect(paneForResource('CustomResourceDefinition', 'apiextensions.k8s.io/v1')).toBe('Extend');
    expect(paneForResource('ClusterServiceVersion', 'operators.coreos.com/v1alpha1')).toBe('Extend');
  });

  it('places bare-core and other *.k8s.io/*.openshift.io kinds in Cluster', () => {
    expect(paneForResource('Namespace', 'v1')).toBe('Cluster');
    expect(paneForResource('PriorityClass', 'scheduling.k8s.io/v1')).toBe('Cluster');
    expect(paneForResource('ClusterVersion', 'config.openshift.io/v1')).toBe('Cluster');
  });

  it('falls back to ThirdParty for an unrecognized non-k8s.io/non-openshift.io group', () => {
    expect(paneForResource('CephCluster', 'ceph.rook.io/v1')).toBe('ThirdParty');
    expect(paneForResource('AWX', 'awx.ansible.com/v1beta1')).toBe('ThirdParty');
  });

  it('excludes EVERY kind the wheel already renders as its own dedicated tier/item — never double-shown', () => {
    // Exhaustive: every `r.kind === '...'` check in wheel.ts, one entry each. If a future wheel tier adds a
    // new Kind, it must be added here too, or that Kind would silently show up in BOTH the wheel and a pane.
    for (const [kind, apiVersion] of [
      ['Node', 'v1'], // node ring
      ['Pod', 'v1'], // pod wedges
      ['Service', 'v1'], // Network tier
      ['Endpoints', 'v1'], // Endpoints tier
      ['EndpointSlice', 'discovery.k8s.io/v1'], // Endpoints tier (EndpointSlice variant)
      ['Ingress', 'networking.k8s.io/v1'], // Ingress tier
      ['HTTPRoute', 'gateway.networking.k8s.io/v1'], // Ingress tier (Gateway API variant)
      ['Route', 'route.openshift.io/v1'], // Ingress tier (OpenShift variant)
      ['PersistentVolumeClaim', 'v1'], // Storage tier
      ['PersistentVolume', 'v1'], // PersistentVolumes tier
      ['StorageClass', 'storage.k8s.io/v1'], // StorageClasses tier
      ['VolumeAttachment', 'storage.k8s.io/v1'], // VolumeAttachments tier
      ['CSIDriver', 'storage.k8s.io/v1'], // CSI ring
      ['CSINode', 'storage.k8s.io/v1'], // CSI node-driver chains
    ] as const) {
      expect(paneForResource(kind, apiVersion)).toBeNull();
    }
  });

  it('excludes ComponentStatus (consumed by the Control Plane components instead of its own pane sphere)', () => {
    expect(paneForResource('ComponentStatus', 'v1')).toBeNull();
  });
});

describe('projectControlPlane', () => {
  it('gives every node exactly one kubelet and one kube-proxy, positioned at the node’s own x/z', () => {
    const graph = buildGraph([node('a'), node('b')]);
    const nodes = [
      { id: 'node-a' as never, name: 'a', x: 1, z: 2 },
      { id: 'node-b' as never, name: 'b', x: -1, z: -2 },
    ];
    const cp = projectControlPlane(graph, nodes, 5);
    expect(cp.kubelets).toHaveLength(2);
    expect(cp.kubeProxies).toHaveLength(2);
    const kubeletA = cp.kubelets.find((k) => k.nodeId === 'node-a');
    expect(kubeletA?.x).toBe(1);
    expect(kubeletA?.z).toBe(2);
  });

  it('always produces exactly 4 control plane components in a fixed order', () => {
    const graph = buildGraph([node('a')]);
    const cp = projectControlPlane(graph, [{ id: 'node-a' as never, name: 'a', x: 0, z: 0 }], 5);
    expect(cp.components.map((c) => c.title)).toEqual(['API Server', 'Scheduler', 'Controller Manager', 'etcd']);
  });

  it('API Server never has a resourceId, even when ComponentStatus objects exist', () => {
    const graph = buildGraph([
      node('a'),
      obj('ComponentStatus', 'v1', 'etcd-0'),
      obj('ComponentStatus', 'v1', 'scheduler'),
      obj('ComponentStatus', 'v1', 'controller-manager'),
    ]);
    const cp = projectControlPlane(graph, [{ id: 'node-a' as never, name: 'a', x: 0, z: 0 }], 5);
    const apiServer = cp.components.find((c) => c.title === 'API Server')!;
    const etcd = cp.components.find((c) => c.title === 'etcd')!;
    const scheduler = cp.components.find((c) => c.title === 'Scheduler')!;
    const controllerManager = cp.components.find((c) => c.title === 'Controller Manager')!;
    expect(apiServer.resourceId).toBeUndefined();
    expect(etcd.resourceId).toBeDefined();
    expect(scheduler.resourceId).toBeDefined();
    expect(controllerManager.resourceId).toBeDefined();
  });

  it('leaves control plane components undefined-backed when no ComponentStatus objects exist at all', () => {
    const graph = buildGraph([node('a')]);
    const cp = projectControlPlane(graph, [{ id: 'node-a' as never, name: 'a', x: 0, z: 0 }], 5);
    for (const c of cp.components) expect(c.resourceId).toBeUndefined();
  });

  it('aggregates the image registry stack by REGISTRY, not by full image, sorted by use-count descending', () => {
    const graph = buildGraph([
      node('a'),
      pod('p1', 'a', ['docker.io/library/nginx:1.27', 'gcr.io/proj/thing:v1']),
      pod('p2', 'a', ['docker.io/library/nginx:1.28']),
      pod('p3', 'a', ['docker.io/library/redis:7']),
    ]);
    const cp = projectControlPlane(graph, [{ id: 'node-a' as never, name: 'a', x: 0, z: 0 }], 5);
    expect(cp.imageRegistries[0]).toMatchObject({ title: 'docker.io', count: 3 });
    expect(cp.imageRegistries[1]).toMatchObject({ title: 'gcr.io', count: 1 });
    // Stack grows downward, most-used on top.
    expect(cp.imageRegistries[0]!.y).toBeGreaterThan(cp.imageRegistries[1]!.y);
  });

  it('groups resource-plane items by Kind with a real instance count, one sphere per Kind not per instance', () => {
    const graph = buildGraph([
      node('a'),
      obj('Deployment', 'apps/v1', 'd1'),
      obj('Deployment', 'apps/v1', 'd2'),
      obj('Deployment', 'apps/v1', 'd3'),
      obj('Job', 'batch/v1', 'j1'),
    ]);
    const cp = projectControlPlane(graph, [{ id: 'node-a' as never, name: 'a', x: 0, z: 0 }], 5);
    const workload = cp.planes.find((p) => p.name === 'Workload')!;
    expect(workload.items).toHaveLength(2); // one sphere for Deployment, one for Job — not 4
    const deployment = workload.items.find((i) => i.kind === 'Deployment')!;
    expect(deployment.count).toBe(3);
  });

  it('omits a plane entirely when it has no matching kinds present', () => {
    const graph = buildGraph([node('a')]);
    const cp = projectControlPlane(graph, [{ id: 'node-a' as never, name: 'a', x: 0, z: 0 }], 5);
    expect(cp.planes).toEqual([]);
  });
});
