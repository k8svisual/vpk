import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectPortUsage } from './ports';
import type { RawObject } from '../types';

const clusterIpSvc: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 'svc-1', name: 'web', namespace: 'default' },
  spec: { type: 'ClusterIP', ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }] },
};
const nodePortSvc: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 'svc-2', name: 'np', namespace: 'default' },
  spec: { type: 'NodePort', ports: [{ port: 443, nodePort: 30443, protocol: 'TCP' }] },
};
// A LoadBalancer Service commonly gets a nodePort allocated implicitly too — that's the host-level fact this
// row should surface as `source: 'NodePort'`, not the generic `'LoadBalancer'` (see projectPortUsage's own
// comment on this recoloring).
const lbSvcWithNodePort: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 'svc-3', name: 'lb-with-nodeport', namespace: 'default' },
  spec: { type: 'LoadBalancer', ports: [{ port: 80, nodePort: 31000, protocol: 'TCP' }] },
};
// A LoadBalancer Service with NO nodePort allocated (some cloud providers don't allocate one) stays typed as
// the generic 'LoadBalancer' — nothing host-level to surface.
const lbSvcNoNodePort: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 'svc-4', name: 'lb-bare', namespace: 'default' },
  spec: { type: 'LoadBalancer', ports: [{ port: 81, protocol: 'TCP' }] },
};
const pod: RawObject = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: 'pod-1', name: 'app-0', namespace: 'default' },
  spec: {
    containers: [
      { name: 'app', ports: [{ containerPort: 8080, protocol: 'TCP' }] },
      { name: 'metrics', ports: [{ containerPort: 9090, hostPort: 9090, protocol: 'TCP' }] },
    ],
  },
};

describe('projectPortUsage', () => {
  const usages = projectPortUsage(buildGraph([clusterIpSvc, nodePortSvc, lbSvcWithNodePort, lbSvcNoNodePort, pod]));

  it('emits one row per declared port across services and pod containers', () => {
    // 4 service ports + 2 container ports
    expect(usages).toHaveLength(6);
  });

  it('types Service ports by the Service type', () => {
    expect(usages.find((u) => u.resourceName === 'web')?.source).toBe('ClusterIP');
    expect(usages.find((u) => u.resourceName === 'np')?.source).toBe('NodePort');
    expect(usages.find((u) => u.resourceName === 'lb-bare')?.source).toBe('LoadBalancer');
  });

  it('recolors a LoadBalancer port that actually allocated a nodePort as the host-level NodePort source', () => {
    expect(usages.find((u) => u.resourceName === 'lb-with-nodeport')?.source).toBe('NodePort');
  });

  it('carries targetPort/nodePort for service ports', () => {
    const web = usages.find((u) => u.resourceName === 'web')!;
    expect(web.targetPort).toBe(8080);
    const np = usages.find((u) => u.resourceName === 'np')!;
    expect(np.nodePort).toBe(30443);
  });

  it('distinguishes a plain containerPort from a host-bound port (hostPort)', () => {
    const container = usages.filter((u) => u.resourceKind === 'Pod');
    expect(container.find((u) => u.port === 8080)?.source).toBe('containerPort');
    const host = container.find((u) => u.port === 9090)!;
    expect(host.source).toBe('hostPort');
    expect(host.hostPort).toBe(9090);
    expect(host.containerName).toBe('metrics');
  });

  it('sorts by port number', () => {
    expect(usages.map((u) => u.port)).toEqual([...usages.map((u) => u.port)].sort((a, b) => a - b));
  });
});
