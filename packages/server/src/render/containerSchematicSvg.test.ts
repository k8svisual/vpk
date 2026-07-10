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
  network: { services: [{ id: 'svc-1', name: 'web-api' }] },
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
    // Edge paths look like `M<x> <y> L…` (space-separated coords); the only other <path>s are the arrowhead
    // marker defs (`M0,0 …`). So a clean default has no coordinate edge path at all.
    expect(svg).not.toMatch(/<path d="M[\d.]+ [\d.]+ L/);
  });

  it('reveals the selected container\'s edges — a red shares-path + solid paths for its port/config', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    // `data` is shared with sidecar -> app's mount edge to it is a red path.
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-red\)"/);
    // app has a port + consumes config -> at least one solid path edge (to Service / Configuration).
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-solid\)"/);
  });

  it('does not draw another container\'s edges — selecting `sidecar` yields only its shared mount, no solid edge', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'sidecar' });
    // sidecar mounts `data` (shared) -> a red path; but it has no ports/config, so no solid path edge.
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-red\)"/);
    expect(svg).not.toMatch(/<path[^>]*marker-end="url\(#cs-solid\)"/);
  });

  it('marks the selected container card and its radio with the selection accent', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    expect(svg).toContain('data-select-container="app"');
    expect(svg).toContain('#2f6df6'); // SELECT accent used on the selected card/radio
  });

  it('draws the selected container\'s edges AFTER the cards so mount lines render on top', () => {
    const svg = renderContainerSchematicSvg(base, { selectedContainer: 'app' });
    // The edge <path>s must come after the last container card <g> in document order (painted on top).
    const lastCard = svg.lastIndexOf('data-select-container=');
    const firstEdge = svg.search(/<path d="M[\d.]+ [\d.]+ L/);
    expect(firstEdge).toBeGreaterThan(lastCard);
  });

  it('routes a configMap/secret volume mount to the Configuration icon, not the volume tile', () => {
    // A container that ONLY mounts a configMap volume (no env, no ports, no other mounts).
    const dto: SchematicDto = {
      ...base,
      containers: [c('cfg-only', { image: 'x', ready: true, stateLabel: 'Running', mounts: [{ volumeName: 'cfg', mountPath: '/etc' }] })],
      initContainers: [],
      ephemeralContainers: [],
    };
    const svg = renderContainerSchematicSvg(dto, { selectedContainer: 'cfg-only' });
    // Exactly one edge path, and it's solid (to the ConfigMap icon) — no red/other edge to the cfg volume tile.
    const paths = svg.match(/<path d="M[\d.]+ [\d.]+ L/g) ?? [];
    expect(paths).toHaveLength(1);
    expect(svg).toMatch(/<path[^>]*marker-end="url\(#cs-solid\)"/);
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
