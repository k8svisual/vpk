import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectServiceNetwork, projectNetworkTopology, projectNetworkLayers } from './networkDiagrams';
import type { RawObject } from '../types';

const nodeA: RawObject = {
  apiVersion: 'v1',
  kind: 'Node',
  metadata: { uid: 'node-a', name: 'worker-a' },
  spec: { podCIDR: '10.244.1.0/24' },
  status: { addresses: [{ type: 'InternalIP', address: '192.168.1.21' }] },
};
const nodeB: RawObject = {
  apiVersion: 'v1',
  kind: 'Node',
  metadata: { uid: 'node-b', name: 'worker-b' },
  // No spec.podCIDR — forces the derived-range path.
  status: { addresses: [{ type: 'InternalIP', address: '192.168.1.22' }] },
};
const web1: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod-1', name: 'web-1', namespace: 'default' },
  spec: { nodeName: 'worker-a' },
  status: { podIP: '10.244.1.12' },
};
const web2: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod-2', name: 'web-2', namespace: 'default' },
  spec: { nodeName: 'worker-b' },
  status: { podIP: '10.244.2.18' },
};
const svc: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 'svc-web', name: 'web-svc', namespace: 'default' },
  spec: { clusterIP: '10.96.20.15', type: 'ClusterIP', selector: { app: 'web' }, ports: [{ port: 80, protocol: 'TCP' }] },
};
const endpoints: RawObject = {
  apiVersion: 'v1',
  kind: 'Endpoints',
  metadata: { uid: 'ep-web', name: 'web-svc', namespace: 'default' },
  subsets: [
    {
      addresses: [
        { ip: '10.244.1.12', nodeName: 'worker-a', targetRef: { kind: 'Pod', uid: 'pod-1' } },
        { ip: '10.244.2.18', nodeName: 'worker-b', targetRef: { kind: 'Pod', uid: 'pod-2' } },
      ],
    },
  ],
};
const route: RawObject = {
  apiVersion: 'route.openshift.io/v1',
  kind: 'Route',
  metadata: { uid: 'route-web', name: 'web-route', namespace: 'default' },
  spec: { host: 'web.example.com', to: { kind: 'Service', name: 'web-svc' } },
};

describe('projectServiceNetwork', () => {
  const graph = buildGraph([nodeA, nodeB, web1, web2, svc, endpoints, route]);
  const view = projectServiceNetwork(graph, 'svc-web')!;

  it('resolves the service identity, ClusterIP, type, and selector', () => {
    expect(view.service.clusterIp).toBe('10.96.20.15');
    expect(view.service.type).toBe('ClusterIP');
    expect(view.selector).toEqual({ app: 'web' });
  });

  it('resolves backing pods from Endpoints with their pod/node IPs', () => {
    expect(view.pods.map((p) => p.name).sort()).toEqual(['web-1', 'web-2']);
    const w1 = view.pods.find((p) => p.name === 'web-1')!;
    expect(w1.podIp).toBe('10.244.1.12');
    expect(w1.nodeName).toBe('worker-a');
    expect(w1.nodeIp).toBe('192.168.1.21');
  });

  it('regroups the same pods by the node they run on', () => {
    expect(view.nodes.map((n) => `${n.name}:${n.pods.length}`)).toEqual(['worker-a:1', 'worker-b:1']);
    expect(view.nodes[0]?.ip).toBe('192.168.1.21');
  });

  it('finds the OpenShift Route pointing at the service (north-south entry) with its host', () => {
    expect(view.ingresses).toEqual([{ id: 'route-web', name: 'web-route', kind: 'Route', host: 'web.example.com' }]);
  });

  it('returns undefined for a non-Service id', () => {
    expect(projectServiceNetwork(graph, 'pod-1')).toBeUndefined();
  });
});

describe('projectNetworkTopology', () => {
  const graph = buildGraph([nodeA, nodeB, web1, web2]);
  const topo = projectNetworkTopology(graph);

  it('uses the declared spec.podCIDR when present', () => {
    const a = topo.nodes.find((n) => n.name === 'worker-a')!;
    expect(a.podCidr).toBe('10.244.1.0/24');
    expect(a.derivedRanges).toEqual([]);
  });

  it('derives an approximate /24 range from actual pod IPs when podCIDR is absent', () => {
    const b = topo.nodes.find((n) => n.name === 'worker-b')!;
    expect(b.podCidr).toBeUndefined();
    expect(b.derivedRanges).toEqual(['10.244.2.0/24']);
  });

  it('labels the overlay generically (never fabricated as a real snapshot value)', () => {
    expect(topo.overlayLabel).toContain('CNI-dependent');
  });
});

describe('projectNetworkLayers', () => {
  const graph = buildGraph([nodeA, nodeB, web1, web2, svc, endpoints]);
  const layers = projectNetworkLayers(graph);

  it('produces the conceptual layers in top-down order (incl. the north-south edge layer)', () => {
    expect(layers.map((l) => l.title)).toEqual([
      'Application Layer',
      'Ingress & Gateway (North-South)',
      'Service Mesh (L7, East-West)',
      'Service Discovery Layer',
      'Node Data Plane',
      'CNI Network Layer',
      'Physical / Cloud Network',
    ]);
  });

  it('enriches entries with real counts and counts only pods that actually have an IP', () => {
    const app = layers.find((l) => l.title === 'Application Layer')!;
    expect(app.entries.find((e) => e.label === 'Pod')?.count).toBe(2);
    const cni = layers.find((l) => l.title === 'CNI Network Layer')!;
    expect(cni.entries.find((e) => e.label === 'Pod IPs')?.count).toBe(2);
  });

  it('leaves generic mechanism entries countless (count === undefined)', () => {
    const dataPlane = layers.find((l) => l.title === 'Node Data Plane')!;
    expect(dataPlane.entries.find((e) => e.label.includes('eBPF'))?.count).toBeUndefined();
  });
});
