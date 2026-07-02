import { describe, it, expect } from 'vitest';
import { renderSchematicSvg } from './schematicSvg';
import type { SchematicDto } from '../schematic';

const base: SchematicDto = {
  podId: 'pod-1',
  podName: 'coredns-abc',
  namespace: 'kube-system',
  phase: 'Running',
  conditions: [{ type: 'Ready', status: 'True' }],
  containers: [{ name: 'coredns', ready: true, stateLabel: 'Running', restartCount: 2 }],
  initContainers: [],
  ownerChain: [
    { id: 'dep-1', kind: 'Deployment', name: 'coredns' },
    { id: 'rs-1', kind: 'ReplicaSet', name: 'coredns-abc123' },
  ],
  config: { configMaps: [{ id: 'cm-1', name: 'coredns' }], secrets: [] },
  network: { services: [{ id: 'svc-1', name: 'kube-dns' }] },
  storage: { pvcs: [] },
  security: { serviceAccount: { id: 'sa-1', name: 'coredns' } },
};

describe('renderSchematicSvg', () => {
  it('renders valid SVG with data-resource-id on the pod, owner chain, and every group item', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('data-resource-id="pod-1"');
    expect(svg).toContain('data-resource-id="dep-1"');
    expect(svg).toContain('data-resource-id="rs-1"');
    expect(svg).toContain('data-resource-id="cm-1"');
    expect(svg).toContain('data-resource-id="svc-1"');
    expect(svg).toContain('data-resource-id="sa-1"');
  });

  it('omits the Storage group box entirely when there are no PVCs (adaptive)', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).not.toContain('Storage');
  });

  it('draws a dashed Creates edge between owner-chain links and a solid References edge to each group', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toContain('sch-creates');
    expect(svg).toContain('sch-refs');
  });

  it('aggregates a group into a single count row when it has more than the threshold of items', () => {
    const many: SchematicDto = {
      ...base,
      config: { configMaps: Array.from({ length: 8 }, (_, i) => ({ id: `cm-${i}`, name: `cm-${i}` })), secrets: [] },
    };
    const svg = renderSchematicSvg(many);
    expect(svg).toContain('ConfigMap (8)');
    expect(svg).not.toContain('data-resource-id="cm-0"');
  });

  it('renders a Pod with no owner chain and no groups (fully adaptive, still valid SVG)', () => {
    const bare: SchematicDto = {
      podId: 'pod-2',
      podName: 'standalone',
      phase: 'Pending',
      conditions: [],
      containers: [],
      initContainers: [],
      ownerChain: [],
      config: { configMaps: [], secrets: [] },
      network: { services: [] },
      storage: { pvcs: [] },
      security: {},
    };
    const svg = renderSchematicSvg(bare);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('data-resource-id="pod-2"');
  });
});
