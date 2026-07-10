import { describe, it, expect } from 'vitest';
import { renderSchematicSvg } from './schematicSvg';
import type { SchematicDto } from '../schematic';
import type { SchematicContainer } from '@vpk/core';

/** Fills the container fields the renderer doesn't read (ports/mounts/probes/configRefs — those are the
 *  Container schematic's concern) so these Pod-schematic fixtures stay focused on name/status. */
const c = (name: string, extra: Partial<SchematicContainer> = {}): SchematicContainer => ({
  name,
  kind: 'app',
  ports: [],
  mounts: [],
  probes: { liveness: false, readiness: false, startup: false },
  configRefs: { configMaps: [], secrets: [] },
  ...extra,
});

const base: SchematicDto = {
  podId: 'pod-1',
  podName: 'coredns-abc',
  namespace: 'kube-system',
  phase: 'Running',
  conditions: [{ type: 'Ready', status: 'True' }],
  containers: [c('coredns', { ready: true, stateLabel: 'Running', restartCount: 2 })],
  initContainers: [],
  ephemeralContainers: [],
  volumes: [],
  ownerChain: [
    { id: 'dep-1', kind: 'Deployment', name: 'coredns' },
    { id: 'rs-1', kind: 'ReplicaSet', name: 'coredns-abc123' },
  ],
  config: { configMaps: [{ id: 'cm-1', name: 'coredns' }], secrets: [] },
  network: { services: [{ id: 'svc-1', name: 'kube-dns' }], endpoints: [], endpointKind: 'Endpoints' },
  storage: { pvcs: [], pvs: [], storageClasses: [], volumeAttachments: [] },
  security: { serviceAccount: { id: 'sa-1', name: 'coredns' } },
  node: { id: 'node-1', name: 'minikube' },
  crds: [],
  policies: { networkPolicies: [], resourceQuotas: [], limitRanges: [], roleBindings: [] },
  events: { total: 0, warnings: 0 },
};

describe('renderSchematicSvg', () => {
  it('draws a data-show-containers pill on the Pod card (the entry point to the Container schematic)', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toContain('data-show-containers="1"');
    expect(svg).toContain('View Container Schematic ▸');
  });

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

  it('draws the Endpoints icon between Service and Pod (Service --creates--> Endpoints --references--> Pod)', () => {
    const withEp: SchematicDto = {
      ...base,
      network: { services: [{ id: 'svc-1', name: 'kube-dns' }], endpoints: [{ id: 'ep-1', name: 'kube-dns' }], endpointKind: 'Endpoints' },
    };
    const svg = renderSchematicSvg(withEp);
    expect(svg).toContain('icons/k8/ep.svg'); // the Endpoints icon is drawn
    expect(svg).toContain('data-resource-id="ep-1"'); // single endpoint is directly clickable
  });

  it('uses the EndpointSlice icon and a "(N)" list when more than one endpoint/slice backs the service', () => {
    const withSlices: SchematicDto = {
      ...base,
      network: {
        services: [{ id: 'svc-1', name: 'kube-dns' }],
        endpoints: [
          { id: 'ep-1', name: 'kube-dns' },
          { id: 'es-1', name: 'kube-dns-abc' },
        ],
        endpointKind: 'EndpointSlice',
      },
    };
    const svg = renderSchematicSvg(withSlices);
    expect(svg).toContain('icons/k8/eps.svg'); // EndpointSlice icon when a slice is present
    expect(svg).toContain('(2)'); // count for the merged list
    expect(svg).toContain('data-resource-list='); // clickable list box, not a single drill
    expect(svg).toContain('data-kind="EndpointSlice"');
  });

  it('places the Service "(N)" count below the icon, not to its right', () => {
    const twoSvc: SchematicDto = {
      ...base,
      network: {
        services: [
          { id: 'svc-1', name: 'a' },
          { id: 'svc-2', name: 'b' },
        ],
        endpoints: [],
        endpointKind: 'Endpoints',
      },
    };
    const svg = renderSchematicSvg(twoSvc);
    // count-below uses text-anchor="middle" centred on the icon's own X; the right-side variant does not.
    expect(svg).toMatch(/<text class="sch-count"[^>]*text-anchor="middle">\(2\)<\/text>/);
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
        volumeAttachments: [],
      },
    };
    const svg = renderSchematicSvg(withStorage);
    expect(svg).toContain('data-resource-id="pvc-1"');
    expect(svg).toContain('data-resource-id="pv-1"');
    expect(svg).toContain('data-resource-id="sc-1"');
    expect(svg).toContain('Storage');
  });

  it('keeps the namespaced PVC in the Namespace box, but draws PV and StorageClass (cluster-scoped) in the Cluster box', () => {
    const withStorage: SchematicDto = {
      ...base,
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [{ id: 'sc-1', name: 'fast-ssd' }],
        volumeAttachments: [],
      },
    };
    const svg = renderSchematicSvg(withStorage);
    // Everything namespace-scoped is inside the one <g transform="translate(...)"> the namespace box wraps;
    // the Cluster banner/box is rendered as a sibling right after that group closes.
    const nsGroupEnd = svg.indexOf('>Cluster Level<');
    expect(nsGroupEnd).toBeGreaterThan(-1);
    expect(svg.indexOf('data-resource-id="pvc-1"')).toBeLessThan(nsGroupEnd);
    expect(svg.indexOf('data-resource-id="pv-1"')).toBeGreaterThan(nsGroupEnd);
    expect(svg.indexOf('data-resource-id="sc-1"')).toBeGreaterThan(nsGroupEnd);
  });

  it('gives the Cluster-side PV/StorageClass the same storage fill/stroke as the namespace-side PVC box, at the same Y', () => {
    const withStorage: SchematicDto = {
      ...base,
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [{ id: 'sc-1', name: 'fast-ssd' }],
        volumeAttachments: [],
      },
    };
    const svg = renderSchematicSvg(withStorage);
    const storageRects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="112" fill="#fbe3c2" stroke="#c9974f" stroke-dasharray="3 2" \/>/g)];
    // One in the Namespace box (around the PVC icon, in the namespace <g>'s own LOCAL coordinates) and one
    // continuing in the Cluster box (around PV/SC, in absolute/top-level coordinates) — same fill/stroke,
    // and the same Y once the namespace <g>'s own translate() offset is accounted for.
    expect(storageRects.length).toBe(2);
    const translateY = Number(/<g transform="translate\([\d.]+, ([\d.]+)\)"/.exec(svg)![1]);
    expect(Number(storageRects[0]![2]) + translateY).toBe(Number(storageRects[1]![2]));
  });

  it('draws a VolumeAttachment in the Cluster box, linked to PV by a vertical edge (not chained through StorageClass)', () => {
    const withVA: SchematicDto = {
      ...base,
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [{ id: 'sc-1', name: 'fast-ssd' }],
        volumeAttachments: [{ id: 'va-1', name: 'csi-va-1' }],
      },
    };
    const svg = renderSchematicSvg(withVA);
    expect(svg).toContain('data-resource-id="va-1"');
    expect(svg).toContain('icons/k8/va.svg');
    // Lives in the Cluster box, same as PV/StorageClass — cluster-scoped, not namespaced.
    const nsGroupEnd = svg.indexOf('>Cluster Level<');
    expect(svg.indexOf('data-resource-id="va-1"')).toBeGreaterThan(nsGroupEnd);
    // The PV and VolumeAttachment icons share the same X (a pure vertical connector, per the "every line
    // horizontal or vertical" rule) rather than sitting in the same row as StorageClass.
    const pvImg = /<image href="\/icons\/k8\/pv\.svg" x="([\d.]+)"/.exec(svg);
    const vaImg = /<image href="\/icons\/k8\/va\.svg" x="([\d.]+)"/.exec(svg);
    expect(pvImg).not.toBeNull();
    expect(vaImg).not.toBeNull();
    expect(pvImg![1]).toBe(vaImg![1]);
  });

  it('omits VolumeAttachment entirely when none references the pod\'s PV (adaptive)', () => {
    const svg = renderSchematicSvg({
      ...base,
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [],
        volumeAttachments: [],
      },
    });
    expect(svg).not.toContain('va.svg');
  });

  it('collapses multiple VolumeAttachments to a single aggregate icon + count, like every other group', () => {
    const svg = renderSchematicSvg({
      ...base,
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [],
        volumeAttachments: [
          { id: 'va-1', name: 'csi-va-1' },
          { id: 'va-2', name: 'csi-va-2' },
        ],
      },
    });
    expect(svg).toContain('data-kind="VolumeAttachment"');
    expect(svg).toContain('(2)');
    expect(svg).not.toContain('data-resource-id="va-1"');
  });

  it('draws every connector line strictly horizontal or vertical, never diagonal', () => {
    const withEverything: SchematicDto = {
      ...base,
      config: { configMaps: [{ id: 'cm-1', name: 'cm-1' }], secrets: [{ id: 'sec-1', name: 'sec-1' }] },
      storage: {
        pvcs: [{ id: 'pvc-1', name: 'data-claim' }],
        pvs: [{ id: 'pv-1', name: 'pv-001' }],
        storageClasses: [{ id: 'sc-1', name: 'fast-ssd' }],
        volumeAttachments: [{ id: 'va-1', name: 'csi-va-1' }],
      },
      generatorLabel: 'helm',
    };
    const svg = renderSchematicSvg(withEverything);
    const lines = [...svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)];
    expect(lines.length).toBeGreaterThan(0);
    for (const [, x1, y1, x2, y2] of lines) {
      const horizontal = Number(y1) === Number(y2);
      const vertical = Number(x1) === Number(x2);
      expect(horizontal || vertical).toBe(true);
    }
  });

  it('a multi-item group carries a data-names payload (for the client hover tooltip) + data-resource-list/data-kind instead of a single data-resource-id', () => {
    const many: SchematicDto = {
      ...base,
      config: { configMaps: [{ id: 'cm-0', name: 'cm-0' }, { id: 'cm-1', name: 'cm-1' }], secrets: [] },
    };
    const svg = renderSchematicSvg(many);
    expect(svg).toContain('data-kind="ConfigMap"');
    const namesMatch = /data-resource-list="[^"]+" data-kind="ConfigMap" data-names="([^"]+)"/.exec(svg);
    expect(namesMatch).not.toBeNull();
    expect(JSON.parse(namesMatch![1]!.replace(/&quot;/g, '"'))).toEqual(['cm-0', 'cm-1']);
    const match = /data-resource-list="([^"]+)"/.exec(svg);
    expect(match).not.toBeNull();
    const payload = JSON.parse(match![1]!.replace(/&quot;/g, '"')) as { id: string; name: string }[];
    expect(payload).toEqual([
      { id: 'cm-0', name: 'cm-0' },
      { id: 'cm-1', name: 'cm-1' },
    ]);
  });

  it('gives every resource icon a data-names payload and drops the always-visible name label under it', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toContain('data-names="[&quot;coredns&quot;]"'); // ConfigMap (single item)
    expect(svg).not.toContain('sch-icon-name');
  });

  it('right-justifies the Pod name in the Namespace banner, padded off the edge (not flush)', () => {
    const svg = renderSchematicSvg(base);
    const match = /<text class="sch-banner-title" x="([\d.]+)" y="[\d.]+" text-anchor="end">coredns-abc<\/text>/.exec(svg);
    expect(match).not.toBeNull();
    const nsBoxRect = /<rect x="([\d.]+)" y="16" width="([\d.]+)" height="34" fill="#b3b0a8" \/>/.exec(svg);
    expect(nsBoxRect).not.toBeNull();
    const nsBoxRight = Number(nsBoxRect![1]) + Number(nsBoxRect![2]);
    expect(Number(match![1])).toBeLessThan(nsBoxRight);
    expect(nsBoxRight - Number(match![1])).toBe(14); // same padding the left-aligned "Namespace" title uses
  });

  it('gives each container row a data-focus-path pointing at its own spec.containers/initContainers index', () => {
    const withInit: SchematicDto = {
      ...base,
      initContainers: [c('init-a', { kind: 'init', ready: false, stateLabel: 'Completed' })],
      containers: [c('main-a', { ready: true, stateLabel: 'Running' }), c('main-b', { ready: true, stateLabel: 'Running' })],
    };
    const svg = renderSchematicSvg(withInit);
    expect(svg).toContain(`data-focus-path="${'[&quot;spec&quot;,&quot;initContainers&quot;,0]'}"`);
    expect(svg).toContain(`data-focus-path="${'[&quot;spec&quot;,&quot;containers&quot;,0]'}"`);
    expect(svg).toContain(`data-focus-path="${'[&quot;spec&quot;,&quot;containers&quot;,1]'}"`);
  });

  it('gives the Phase/Conditions area a data-focus-path pointing at status.conditions', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toContain('data-focus-path="[&quot;status&quot;,&quot;conditions&quot;]"');
  });

  it('extends the Pod box down at least as far as the Network group\'s bottom edge, not just its own content', () => {
    // A Pod with barely any of its own content (no containers) but a Network group that, on its own, would
    // extend well past where a content-sized Pod box would end.
    const thin: SchematicDto = { ...base, containers: [], conditions: [] };
    const svg = renderSchematicSvg(thin);
    const podRect = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="var\(--vpk-surface, #f2f2f0\)"/.exec(svg);
    expect(podRect).not.toBeNull();
    const [, , podYStr, , podHStr] = podRect!;
    const podY = Number(podYStr);
    const podH = Number(podHStr);
    const networkRect = /<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="112" fill="#dbeefa"/.exec(svg);
    expect(networkRect).not.toBeNull();
    const networkBottom = Number(networkRect![1]) + 112;
    expect(podY + podH).toBeGreaterThanOrEqual(networkBottom);
  });

  it('renders a Pod with no owner chain and no groups (fully adaptive, still valid SVG)', () => {
    const bare: SchematicDto = {
      podId: 'pod-2',
      podName: 'standalone',
      phase: 'Pending',
      conditions: [],
      containers: [],
      initContainers: [],
      ephemeralContainers: [],
      volumes: [],
      ownerChain: [],
      config: { configMaps: [], secrets: [] },
      network: { services: [], endpoints: [], endpointKind: 'Endpoints' },
      storage: { pvcs: [], pvs: [], storageClasses: [], volumeAttachments: [] },
      security: {},
      crds: [],
      policies: { networkPolicies: [], resourceQuotas: [], limitRanges: [], roleBindings: [] },
      events: { total: 0, warnings: 0 },
    };
    const svg = renderSchematicSvg(bare);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('data-resource-id="pod-2"');
  });

  it('draws dashed-border Namespace/Cluster boxes with grey/dark-grey banners, and the Node icon in the Cluster box', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).toContain('>Namespace Level<');
    expect(svg).toContain('>Cluster Level<');
    expect(svg).toContain('data-resource-id="node-1"');
    // Two outer dashed boxes in addition to every category box's own dashed border.
    expect((svg.match(/stroke-dasharray="3 3"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('badges a custom-resource owner-chain icon and its CustomResourceDefinition with the same letter', () => {
    const withCrd: SchematicDto = {
      ...base,
      ownerChain: [{ id: 'foo-1', kind: 'Foo', name: 'my-foo', crdLetter: 'a' }],
      crds: [{ letter: 'a', id: 'crd-1', name: 'foos.example.com' }],
    };
    const svg = renderSchematicSvg(withCrd);
    expect(svg).toContain('data-resource-id="foo-1"');
    expect(svg).toContain('data-resource-id="crd-1"');
    const circles = [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="8" fill="#000" \/><text x="[\d.-]+" y="[\d.-]+" text-anchor="middle" font-size="10" fill="#fff">a<\/text>/g)];
    expect(circles.length).toBe(2);
  });

  it('omits the Cluster box Node icon when the Pod has no resolvable node', () => {
    const noNode: SchematicDto = { ...base, node: undefined };
    const svg = renderSchematicSvg(noNode);
    expect(svg).toContain('>Cluster Level<');
    expect(svg).not.toContain('data-resource-id="node-1"');
  });

  it('omits the Policies row entirely when none of NetworkPolicy/ResourceQuota/LimitRange/RoleBinding apply', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).not.toContain('Policies');
  });

  it('draws one aggregate icon per applicable policy kind, single item directly clickable', () => {
    const withPolicies: SchematicDto = {
      ...base,
      policies: {
        networkPolicies: [{ id: 'np-1', name: 'deny-all' }],
        resourceQuotas: [{ id: 'rq-1', name: 'compute-quota' }],
        limitRanges: [],
        roleBindings: [{ id: 'rb-1', name: 'pod-reader-binding' }],
      },
    };
    const svg = renderSchematicSvg(withPolicies);
    expect(svg).toContain('Policies');
    expect(svg).toContain('data-resource-id="np-1"');
    expect(svg).toContain('data-resource-id="rq-1"');
    expect(svg).toContain('data-resource-id="rb-1"');
    expect(svg).not.toContain('LimitRange');
  });

  it('collapses multiple items of the same policy kind to a data-resource-list, like ConfigMap/Secret', () => {
    const withMultiplePolicies: SchematicDto = {
      ...base,
      policies: {
        networkPolicies: [
          { id: 'np-1', name: 'deny-all' },
          { id: 'np-2', name: 'allow-dns' },
        ],
        resourceQuotas: [],
        limitRanges: [],
        roleBindings: [],
      },
    };
    const svg = renderSchematicSvg(withMultiplePolicies);
    expect(svg).toContain('data-kind="NetworkPolicy"');
    const match = /data-resource-list="([^"]+)"/.exec(svg);
    expect(match).not.toBeNull();
    const payload = JSON.parse(match![1]!.replace(/&quot;/g, '"')) as { id: string; name: string }[];
    expect(payload).toEqual([
      { id: 'np-1', name: 'deny-all' },
      { id: 'np-2', name: 'allow-dns' },
    ]);
  });

  it('extends the namespace box far enough down to contain the Policies row', () => {
    const withPolicies: SchematicDto = {
      ...base,
      policies: { networkPolicies: [{ id: 'np-1', name: 'deny-all' }], resourceQuotas: [], limitRanges: [], roleBindings: [] },
    };
    const withoutPolicies: SchematicDto = { ...base, policies: { networkPolicies: [], resourceQuotas: [], limitRanges: [], roleBindings: [] } };
    const svgWith = renderSchematicSvg(withPolicies);
    const svgWithout = renderSchematicSvg(withoutPolicies);
    const heightOf = (svg: string) => Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)![1]);
    expect(heightOf(svgWith)).toBeGreaterThan(heightOf(svgWithout));
  });
});

describe('renderSchematicSvg events badge', () => {
  it('omits the purple "has Events" badge when the Pod has none', () => {
    const svg = renderSchematicSvg(base);
    expect(svg).not.toContain('data-pod-events');
  });

  it('draws a data-pod-events badge carrying the Pod id/namespace/name when it has Events', () => {
    const withEvents: SchematicDto = { ...base, events: { total: 5, warnings: 2 } };
    const svg = renderSchematicSvg(withEvents);
    expect(svg).toContain('data-pod-events=');
    const match = /data-pod-events="([^"]+)"/.exec(svg);
    expect(match).not.toBeNull();
    const payload = JSON.parse(match![1]!.replace(/&quot;/g, '"')) as { id: string; namespace: string; podName: string };
    expect(payload).toEqual({ id: 'pod-1', namespace: 'kube-system', podName: 'coredns-abc' });
    expect(svg).toContain('#8e44ad');
  });

  it('includes the warning count in the tooltip only when there are Warnings', () => {
    const noWarnings: SchematicDto = { ...base, events: { total: 3, warnings: 0 } };
    const withWarnings: SchematicDto = { ...base, events: { total: 3, warnings: 1 } };
    expect(renderSchematicSvg(noWarnings)).toContain('3 Events');
    expect(renderSchematicSvg(noWarnings)).not.toContain('Warning');
    expect(renderSchematicSvg(withWarnings)).toContain('1 Warning');
  });
});
