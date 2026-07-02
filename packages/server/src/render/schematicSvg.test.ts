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
  storage: { pvcs: [], pvs: [], storageClasses: [] },
  security: { serviceAccount: { id: 'sa-1', name: 'coredns' } },
};

describe('renderSchematicSvg', () => {
  it('renders valid SVG with data-resource-id on the pod, owner chain, and every single-item group icon', () => {
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

  it('draws dashed-red Creates arrowheads on the owner chain and solid References arrowheads to groups', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toContain('url(#sch-arrow-dashed)');
    expect(svg).toContain('url(#sch-arrow-solid)');
  });

  it('collapses a group with more than one item to a single aggregate icon + count, not one node per item', () => {
    const many: SchematicDto = {
      ...base,
      config: { configMaps: Array.from({ length: 8 }, (_, i) => ({ id: `cm-${i}`, name: `cm-${i}` })), secrets: [] },
    };
    const svg = renderSchematicSvg(many);
    expect(svg).toContain('(8)');
    expect(svg).not.toContain('data-resource-id="cm-0"');
  });

  it('renders the pvc -> pv -> storageClass chain with a solid edge then a dashed (Creates) edge', () => {
    const withStorage: SchematicDto = {
      ...base,
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [{ id: 'sc-1', name: 'fast-ssd' }],
      },
    };
    const svg = renderSchematicSvg(withStorage);
    expect(svg).toContain('data-resource-id="pvc-1"');
    expect(svg).toContain('data-resource-id="pv-1"');
    expect(svg).toContain('data-resource-id="sc-1"');
    expect(svg).toContain('Storage');
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
      storage: { pvcs: [], pvs: [], storageClasses: [] },
      security: {},
    };
    const svg = renderSchematicSvg(bare);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('data-resource-id="pod-2"');
  });
});
