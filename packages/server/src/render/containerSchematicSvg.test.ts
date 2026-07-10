import { describe, it, expect } from 'vitest';
import { renderContainerSchematicSvg } from './containerSchematicSvg';
import type { SchematicDto } from '../schematic';
import type { SchematicContainer } from '@vpk/core';

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
  podName: 'web-api-7d9f',
  namespace: 'ns1',
  phase: 'Running',
  conditions: [],
  containers: [
    c('app', {
      image: 'myapp/web:v1',
      ready: true,
      stateLabel: 'Running',
      restartCount: 2,
      ports: [{ containerPort: 8080, protocol: 'TCP' }],
      resources: { cpuRequest: '250m', cpuLimit: '500m', memRequest: '256Mi', memLimit: '512Mi' },
      probes: { liveness: true, readiness: true, startup: false },
      configRefs: { configMaps: ['app-config'], secrets: [] },
      mounts: [{ volumeName: 'data', mountPath: '/var/data' }],
    }),
    c('sidecar', { image: 'fluent/bit:2', ready: true, stateLabel: 'Running', mounts: [{ volumeName: 'data', mountPath: '/var/log', readOnly: true }] }),
  ],
  initContainers: [c('migrate', { kind: 'init', image: 'myapp/migrate:v1', stateLabel: 'Completed' })],
  ephemeralContainers: [c('debugger', { kind: 'ephemeral', image: 'busybox:1.36', stateLabel: 'Running', targetContainerName: 'app' })],
  volumes: [
    {
      name: 'data',
      type: 'persistentVolumeClaim',
      backingRef: { id: 'pvc-1', name: 'data-claim', kind: 'PersistentVolumeClaim' },
      implementation: 'pvc-pv-va-csi',
      pv: { id: 'pv-1', name: 'pv-001', kind: 'PersistentVolume' },
      volumeAttachment: { id: 'va-1', name: 'csi-abc', kind: 'VolumeAttachment' },
      csiDriver: { id: 'csid-1', name: 'ebs.csi.aws.com', kind: 'CSIDriver' },
    },
    { name: 'cfg', type: 'configMap', backingRef: { id: 'cm-1', name: 'app-config', kind: 'ConfigMap' }, implementation: 'local' },
    { name: 'scratch', type: 'emptyDir', implementation: 'local' },
  ],
  ownerChain: [],
  config: { configMaps: [{ id: 'cm-1', name: 'app-config' }], secrets: [] },
  network: { services: [{ id: 'svc-1', name: 'web-api', targetPorts: [8080] }], endpoints: [], endpointKind: 'Endpoints' },
  storage: { pvcs: [], pvs: [], storageClasses: [], volumeAttachments: [] },
  security: {},
  node: { id: 'node-1', name: 'minikube' },
  crds: [],
  policies: { networkPolicies: [], resourceQuotas: [], limitRanges: [], roleBindings: [] },
  events: { total: 0, warnings: 0 },
};

describe('renderContainerSchematicSvg', () => {
  it('renders valid SVG with all three container-section headers', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('>initContainers<');
    expect(svg).toContain('>containers<');
    expect(svg).toContain('>ephemeralContainers<');
  });

  it('gives each container card a data-focus-path pointing at its own array + index', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('[&quot;spec&quot;,&quot;initContainers&quot;,0]');
    expect(svg).toContain('[&quot;spec&quot;,&quot;containers&quot;,0]');
    expect(svg).toContain('[&quot;spec&quot;,&quot;containers&quot;,1]');
    expect(svg).toContain('[&quot;spec&quot;,&quot;ephemeralContainers&quot;,0]');
  });

  it('shows the app container image, a port chip and its resources', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('myapp/web:v1');
    expect(svg).toContain('8080/TCP');
    expect(svg).toContain('cpu 250m / 500m');
  });

  it('draws the ephemeral container target note but no ports/probes/resources for it', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('target: app');
  });

  it('draws NO volume/config/port edges when nothing is selected (clean default)', () => {
    const svg = renderContainerSchematicSvg(base);
    // Edge paths are right-angle elbows (`M<x> <y> V…`/`H…`); the only other <path>s are the arrowhead marker
    // defs (`M0,0 …`, no space). So a clean default has no coordinate edge path at all.
    expect(svg).not.toMatch(/<path d="M[\d.]+ [\d.]+ [VH]/);
  });

  it('draws edges as right-angle elbows (V/H commands), not diagonal L lines', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    expect(svg).toMatch(/<path d="M[\d.]+ [\d.]+ [VH]/);
  });

  it('reveals the selected container\'s edges — a red shares-path (mount) + a solid path (port to Network)', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    // `data` is shared with sidecar -> app's mount edge to it is a red path.
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-red\)"/);
    // app has a port -> a solid elbow to the Network box.
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-solid\)"/);
  });

  it('does not draw another container\'s edges — selecting `sidecar` yields only its shared mount, no solid edge', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'sidecar' });
    // sidecar mounts `data` (shared) -> a red path; but it has no ports, so no solid path edge.
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-red\)"/);
    expect(svg).not.toMatch(/<path[^>]*marker-end="url\(#cs-solid\)"/);
  });

  it('marks the selected container card and its radio with the selection accent', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    expect(svg).toContain('data-select-container="app"');
    expect(svg).toContain('#2f6df6'); // SELECT accent used on the selected card/radio
  });

  it('mutes the OTHER containers (greyed + non-selectable) when one is selected', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    expect(svg).toContain('data-select-container="app"'); // the selected one stays clickable (to clear)
    expect(svg).not.toContain('data-select-container="sidecar"'); // others become non-selectable
    expect(svg).not.toContain('data-select-container="migrate"');
    expect(svg).toContain('<g opacity="0.4">'); // muted cards are greyed
  });

  it('mutes volumes the selected container does NOT mount (greyed + non-selectable)', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' }); // app mounts only `data`
    expect(svg).toContain('data-select-volume="data"'); // mounted -> still selectable
    expect(svg).not.toContain('data-select-volume="cfg"'); // not mounted -> non-selectable
    expect(svg).not.toContain('data-select-volume="scratch"');
    expect(svg).toContain('<g opacity="0.35">'); // muted volume tiles are greyed
  });

  it('leaves every container and volume selectable when nothing is selected', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('data-select-container="app"');
    expect(svg).toContain('data-select-container="sidecar"');
    expect(svg).toContain('data-select-volume="cfg"');
    expect(svg).not.toContain('<g opacity="0.4">'); // nothing muted
    expect(svg).not.toContain('<g opacity="0.35">');
  });

  it('draws the selected container\'s edges AFTER the cards so mount lines render on top', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    // The edge <path>s must come after the last container card <g> in document order (painted on top).
    const lastCard = svg.lastIndexOf('data-select-container=');
    const firstEdge = svg.search(/<path d="M[\d.]+ [\d.]+ [VH]/);
    expect(firstEdge).toBeGreaterThan(lastCard);
  });

  it('draws the Network box on the LEFT and Configuration on the RIGHT (swapped)', () => {
    const svg = renderContainerSchematicSvg(base);
    const netX = Number(/<rect x="([\d.]+)"[^>]*fill="#dbeefa"/.exec(svg)![1]);
    const cfgX = Number(/<rect x="([\d.]+)"[^>]*fill="#fdf6d3"/.exec(svg)![1]);
    expect(netX).toBeLessThan(cfgX);
  });

  it('draws a dashed storage→Configuration connector ONLY when a configMap/secret volume is clicked', () => {
    const connector = 'var(--vpk-fg-muted, #888)';
    expect(renderContainerSchematicSvg(base)).not.toContain(connector); // nothing selected
    expect(renderContainerSchematicSvg(base, { selectedVolume: 'cfg' })).toContain(connector); // configMap volume
    expect(renderContainerSchematicSvg(base, { selectedVolume: 'data' })).not.toContain(connector); // PVC volume -> no connector
  });

  it('PVC storage popup uses the Deployment storage background; a node-local one uses the neutral background', () => {
    expect(renderContainerSchematicSvg(base, { selectedVolume: 'cfg' })).toContain('#ede9e0'); // local -> neutral
    // A PVC-backed volume's popup uses the storage color (#fbe3c2) instead — so the neutral fill is absent.
    expect(renderContainerSchematicSvg(base, { selectedVolume: 'data' })).not.toContain('#ede9e0');
  });

  it('draws a kind-colored background disc behind storage icons that have a defined color', () => {
    const svg = renderContainerSchematicSvg(base, { selectedVolume: 'data' }); // PVC->PV->VA->CSIDriver chain
    expect(svg).toMatch(/<circle[^>]*fill="var\(--vpk-kind-persistentvolume/);
  });

  it('gives storage popup icons a data-names tooltip carrying the resource type', () => {
    const svg = renderContainerSchematicSvg(base, { selectedVolume: 'data' });
    expect(svg).toContain('PersistentVolume · pv-001'); // "<Kind> · <name>" for the hover tooltip
  });

  it('keeps the container→volume mount lines when a volume is then clicked', () => {
    const contOnly = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    const contPlusVol = renderContainerSchematicSvg(base, { selectedContainer: 'app', selectedVolume: 'data' });
    // app's mount edge to the shared `data` volume (red) must still be present after the volume is selected.
    expect(contOnly).toMatch(/<path[^>]*marker-end="url\(#cs-red\)"/);
    expect(contPlusVol).toMatch(/<path[^>]*marker-end="url\(#cs-red\)"/);
    // ...and the storage sub-diagram is now also shown.
    expect(contPlusVol).toContain('Storage · data');
  });

  it('renders one Service icon per service in the Network box, each clickable', () => {
    const twoSvc: SchematicDto = {
      ...base,
      network: {
        services: [
          { id: 'svc-1', name: 'web-api', targetPorts: [8080] },
          { id: 'svc-2', name: 'metrics', targetPorts: [9090] },
        ],
        endpoints: [],
        endpointKind: 'Endpoints',
      },
    };
    const svg = renderContainerSchematicSvg(twoSvc);
    expect(svg).toContain('data-resource-id="svc-1"');
    expect(svg).toContain('data-resource-id="svc-2"');
    expect((svg.match(/icons\/k8\/svc\.svg/g) ?? []).length).toBe(2);
  });

  it('links a selected container only to the Service whose targetPort matches one of its ports', () => {
    const solid = (svg: string) => svg.match(/<path[^>]*marker-end="url\(#cs-solid\)"/g) ?? [];
    // app declares port 8080; svc targetPorts [8080] matches -> a solid service line, and NO "no Service" marker.
    const matched = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    expect(solid(matched).length).toBeGreaterThan(0);
    expect(matched).not.toContain('/icons/other/unk.svg');
    // Same container, but the service targets a port it doesn't declare -> the "no Service" marker appears instead.
    const noMatch: SchematicDto = {
      ...base,
      network: { services: [{ id: 'svc-1', name: 'web-api', targetPorts: [9999] }], endpoints: [], endpointKind: 'Endpoints' },
    };
    expect(renderContainerSchematicSvg(noMatch, { selectedContainer: 'app' })).toContain('/icons/other/unk.svg');
  });

  it('shows a "no Service" marker + line when the selected container has ports no Service routes to', () => {
    const dto: SchematicDto = {
      ...base,
      containers: [c('metrics', { image: 'exporter', ready: true, stateLabel: 'Running', ports: [{ containerPort: 9216, protocol: 'TCP', name: 'metrics' }] })],
      initContainers: [],
      ephemeralContainers: [],
      network: { services: [{ id: 'svc-1', name: 'web', targetPorts: [8080] }], endpoints: [], endpointKind: 'Endpoints' },
    };
    const svg = renderContainerSchematicSvg(dto, { selectedContainer: 'metrics' });
    expect(svg).toContain('/icons/other/unk.svg'); // the unk marker icon
    expect(svg).toContain('>no Service<'); // its label
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-solid\)"/); // a line to it
  });

  it('does NOT show the "no Service" marker when the port IS exposed, when nothing is selected, or with no ports', () => {
    expect(renderContainerSchematicSvg(base, { selectedContainer: 'app' })).not.toContain('/icons/other/unk.svg'); // 8080 exposed
    expect(renderContainerSchematicSvg(base)).not.toContain('/icons/other/unk.svg'); // nothing selected
    expect(renderContainerSchematicSvg(base, { selectedContainer: 'sidecar' })).not.toContain('/icons/other/unk.svg'); // no ports
  });

  it('gives every volume tile a uniform 1px border, highlighting only the selected one', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    // The old per-mount highlight (orange 2px) is gone — no volume tile is orange-and-2px.
    expect(svg).not.toContain('stroke="#c9974f" stroke-width="2"');
  });

  it('shows the "select a container" instruction when nothing is selected', () => {
    expect(renderContainerSchematicSvg(base)).toContain('Select a container');
    expect(renderContainerSchematicSvg(base, { selectedContainer: 'app' })).toContain('Showing edges for');
  });

  it('volumes carry data-select-volume (click selects), not a direct resource-id drill', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('data-select-volume="data"');
    expect(svg).toContain('data-select-volume="scratch"');
  });

  it('renders the PVC->PV->VolumeAttachment->CSIDriver chain when the PVC volume is selected', () => {
    const svg = renderContainerSchematicSvg(base, { selectedVolume: 'data' });
    expect(svg).toContain('Storage · data');
    expect(svg).toContain('data-resource-id="pvc-1"');
    expect(svg).toContain('data-resource-id="pv-1"');
    expect(svg).toContain('data-resource-id="va-1"');
    expect(svg).toContain('data-resource-id="csid-1"');
  });

  it('renders a Node + local storage chain when a configMap volume is selected', () => {
    const svg = renderContainerSchematicSvg(base, { selectedVolume: 'cfg' });
    expect(svg).toContain('Storage · cfg');
    expect(svg).toContain('data-resource-id="cm-1"'); // the backing ConfigMap
    expect(svg).toContain('data-resource-id="node-1"'); // the Node the Pod runs on
    expect(svg).toContain('(local)');
  });

  it('links a container to the Service (data-resource-id on the aggregate Service icon)', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('data-resource-id="svc-1"');
  });

  it('omits the volumes box entirely when the Pod has no volumes (adaptive)', () => {
    const noVols: SchematicDto = { ...base, volumes: [] };
    const svg = renderContainerSchematicSvg(noVols);
    expect(svg).not.toContain('>volumes<');
  });
});
