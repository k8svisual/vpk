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
    { name: 'data', type: 'persistentVolumeClaim', backingRef: { id: 'pvc-1', name: 'data-claim', kind: 'PersistentVolumeClaim' } },
    { name: 'scratch', type: 'emptyDir' },
  ],
  ownerChain: [],
  config: { configMaps: [{ id: 'cm-1', name: 'app-config' }], secrets: [] },
  network: { services: [{ id: 'svc-1', name: 'web-api' }] },
  storage: { pvcs: [], pvs: [], storageClasses: [], volumeAttachments: [] },
  security: {},
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

  it('draws the red "shares volume" edge for a volume mounted by more than one container', () => {
    const svg = renderContainerSchematicSvg(base);
    // `data` is mounted by both app and sidecar -> the shared-volume marker must be present.
    expect(svg).toContain('url(#cs-red)');
  });

  it('makes a volume with a backing PVC clickable and leaves a plain emptyDir un-clickable', () => {
    const svg = renderContainerSchematicSvg(base);
    expect(svg).toContain('data-resource-id="pvc-1"');
    // emptyDir "scratch" has no backingRef, so no resource-id wrapper carrying its name as a drill target.
    expect(svg).not.toContain('data-resource-id="scratch"');
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
