import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildGraph } from '../graph';
import { projectNetworkServicesToPods, projectNetworkNodeIps } from './network';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../server/test/fixtures/minikube.snapshot.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { items: unknown[] };

describe('projectNetworkServicesToPods', () => {
  const graph = buildGraph(fixture.items as never);

  it('joins the kube-dns Service to its CoreDNS pods via Endpoints targetRef', () => {
    const cards = projectNetworkServicesToPods(graph, 'kube-system');
    const kubeDns = cards.find((c) => c.service.name === 'kube-dns');
    expect(kubeDns).toBeDefined();
    expect(kubeDns?.clusterIp).toBe('10.96.0.10');
    expect(kubeDns?.pods.length).toBe(2);
    expect(kubeDns?.pods.every((p) => p.pod.kind === 'Pod')).toBe(true);
    expect(kubeDns?.pods.every((p) => p.ready)).toBe(true);
    expect(kubeDns?.pods[0]?.nodeIp).toBeDefined();
  });

  it('returns a Service with no backing pods as an empty-pods card (not dropped)', () => {
    const cards = projectNetworkServicesToPods(graph, 'default');
    const kubernetes = cards.find((c) => c.service.name === 'kubernetes');
    expect(kubernetes).toBeDefined();
    expect(kubernetes?.pods).toEqual([]);
  });

  it('filters by namespace and sorts by service name', () => {
    const all = projectNetworkServicesToPods(graph);
    expect(all.length).toBeGreaterThanOrEqual(2);
    const names = all.map((c) => c.service.name);
    expect([...names].sort()).toEqual(names);
  });
});

describe('projectNetworkServicesToPods with EndpointSlice-only backing', () => {
  it('joins a Service to its pods via EndpointSlice targetRef when no legacy Endpoints object exists', () => {
    const svc = { apiVersion: 'v1', kind: 'Service', metadata: { uid: 'svc-1', name: 'web', namespace: 'ns' }, spec: { clusterIP: '10.0.0.1' } };
    const podA = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'pod-a', name: 'a', namespace: 'ns' }, spec: { nodeName: 'node-a' } };
    const slice = {
      apiVersion: 'discovery.k8s.io/v1',
      kind: 'EndpointSlice',
      metadata: { uid: 'eps-1', name: 'web-abcde', namespace: 'ns', labels: { 'kubernetes.io/service-name': 'web' } },
      endpoints: [{ addresses: ['10.244.0.5'], targetRef: { kind: 'Pod', uid: 'pod-a' }, conditions: { ready: true }, nodeName: 'node-a' }],
    };
    const graph = buildGraph([svc, podA, slice] as never);
    const cards = projectNetworkServicesToPods(graph);
    const web = cards.find((c) => c.service.name === 'web');
    expect(web?.pods).toHaveLength(1);
    expect(web?.pods[0]?.pod.name).toBe('a');
    expect(web?.pods[0]?.podIp).toBe('10.244.0.5');
    expect(web?.pods[0]?.ready).toBe(true);
  });
});

describe('projectNetworkNodeIps', () => {
  const graph = buildGraph(fixture.items as never);

  it('lists all 8 pods scheduled to the minikube node, with the node internalIp + podCIDR', () => {
    const [minikube] = projectNetworkNodeIps(graph);
    expect(minikube?.node.name).toBe('minikube');
    expect(minikube?.internalIp).toBe('192.168.49.2');
    expect(minikube?.podCidr).toBe('10.244.0.0/24');
    expect(minikube?.pods).toHaveLength(8);
  });

  it('distinguishes pod-network IPs from host-network IPs', () => {
    const [minikube] = projectNetworkNodeIps(graph);
    const coredns = minikube?.pods.find((p) => p.pod.name === 'coredns-668d6bf9bc-9x645');
    const etcd = minikube?.pods.find((p) => p.pod.name === 'etcd-minikube');
    expect(coredns?.podIp).toBe('10.244.0.2'); // pod-network (podCIDR)
    expect(etcd?.podIp).toBe('192.168.49.2'); // host-network
  });
});
