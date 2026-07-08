import { describe, it, expect } from 'vitest';
import {
  buildIntervals,
  visibleIdsAtInterval,
  changesInInterval,
  defaultTimelapseCategoryFilters,
  presentTimelapseCategories,
  presentTimelapsePlanes,
} from './timelapse';
import type { ClusterWheel, WheelNode, WheelPod, WheelTierItem } from './Scene3D';

const DAY = 24 * 60 * 60 * 1000;
// A fixed epoch anchor so tests never depend on wall-clock "now" (Date.now()/new Date() are otherwise banned
// in this harness) — 2024-01-01T00:00:00Z.
const BASE = Date.UTC(2024, 0, 1);
const iso = (offsetMs: number) => new Date(BASE + offsetMs).toISOString();

function node(id: string, creationTimestamp?: string, deletionTimestamp?: string): WheelNode {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    z: 0,
    color: '#000',
    creationTimestamp,
    deletionTimestamp,
    health: 'ok',
    healthColor: '#000',
    role: 'worker',
    podCount: 0,
  };
}
function pod(id: string, creationTimestamp?: string, deletionTimestamp?: string): WheelPod {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    z: 0,
    color: '#000',
    creationTimestamp,
    deletionTimestamp,
    status: 'running',
    daemonSet: false,
    labels: {},
    annotations: {},
  };
}
function tierItem(id: string, kind: string, creationTimestamp?: string, deletionTimestamp?: string): WheelTierItem {
  return { id, name: id, x: 0, y: 0, z: 0, color: '#000', creationTimestamp, deletionTimestamp, kind, labels: {}, annotations: {} };
}

function makeWheel(overrides: Partial<ClusterWheel> = {}): ClusterWheel {
  return {
    outerRadius: 0,
    csiRingRadius: 0,
    nodes: [],
    pods: [],
    totalPodCount: overrides.pods?.length ?? 0,
    network: { items: [], totalCount: 0 },
    endpoints: { items: [], totalCount: 0 },
    ingress: { items: [], totalCount: 0 },
    storage: { items: [], totalCount: 0 },
    persistentVolumes: { items: [], totalCount: 0 },
    storageClasses: { items: [], totalCount: 0 },
    volumeAttachments: { items: [], totalCount: 0 },
    csiNodeDrivers: [],
    csiDrivers: { items: [], totalCount: 0 },
    localStorage: [],
    podToNetwork: [],
    serviceToEndpoints: [],
    serviceToIngress: [],
    podToStorage: [],
    storageToPv: [],
    pvToStorageClass: [],
    pvToVolumeAttachment: [],
    storageClassToCsiDriver: [],
    volumeAttachmentToCsiDriver: [],
    controlPlane: {
      radius: 0,
      y: 0,
      height: 0,
      kubelets: [],
      kubeProxies: [],
      components: [],
      imageRegistries: [],
      planes: [],
      kubectl: { id: 'kubectl', name: 'kubectl', x: 0, y: 0, z: 0, color: '#000', popupKind: 'kubectl', title: 'kubectl' },
    },
    ...overrides,
  };
}

describe('buildIntervals', () => {
  it('gives events on the same day but at different exact times SEPARATE intervals, not one', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(0)), pod('p2', iso(3 * 60 * 60 * 1000))] }); // 3h apart, same day
    const intervals = buildIntervals(wheel);
    // before-first + p1's own instant + p2's own instant — the number of intervals tracks unique creation
    // times, not calendar days, so two resources hours apart on the same day still get two distinct steps.
    expect(intervals).toHaveLength(3);
  });

  it('collapses two resources created at the EXACT same instant into one interval', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(1000)), pod('p2', iso(1000))] });
    const intervals = buildIntervals(wheel);
    expect(intervals).toHaveLength(2); // before-first + the one shared instant
  });

  it('produces one interval per unique timestamp regardless of the gap between them', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(0)), pod('p2', iso(5 * DAY))] });
    const intervals = buildIntervals(wheel);
    expect(intervals).toHaveLength(3); // before-first + p1's instant + p2's instant
  });

  it('returns an empty array when nothing on the wheel has a timestamp', () => {
    const wheel = makeWheel({ nodes: [{ ...node('a'), creationTimestamp: undefined }] });
    expect(buildIntervals(wheel)).toEqual([]);
  });
});

describe('visibleIdsAtInterval', () => {
  it('at the last interval, shows everything with a creationTimestamp that was never deleted', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(0)), pod('p2', iso(DAY))] });
    const intervals = buildIntervals(wheel);
    const last = intervals[intervals.length - 1]!;
    const visible = visibleIdsAtInterval(wheel, last.end);
    expect(visible.has('p1')).toBe(true);
    expect(visible.has('p2')).toBe(true);
  });

  it('at the synthesized first interval, nothing timestamped is visible yet', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(0))] });
    const intervals = buildIntervals(wheel);
    const first = intervals[0]!;
    expect(visibleIdsAtInterval(wheel, first.end).has('p1')).toBe(false);
  });

  it('excludes a point once its deletionTimestamp has passed', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(0), iso(2 * DAY))] });
    const beforeDeletion = visibleIdsAtInterval(wheel, BASE + DAY);
    const afterDeletion = visibleIdsAtInterval(wheel, BASE + 3 * DAY);
    expect(beforeDeletion.has('p1')).toBe(true);
    expect(afterDeletion.has('p1')).toBe(false);
  });

  it('never represents an untimestamped point in the Set at all (caller decides "always visible")', () => {
    const wheel = makeWheel({ nodes: [node('synthetic')], pods: [pod('p1', iso(0))] });
    const intervals = buildIntervals(wheel);
    // Neither absent (id genuinely not visible yet) nor present (id would incorrectly force-include anything
    // sharing that id) — untimestamped points simply never touch this Set, by design.
    expect(visibleIdsAtInterval(wheel, intervals[0]!.end).has('synthetic')).toBe(false);
    expect(visibleIdsAtInterval(wheel, intervals[intervals.length - 1]!.end).has('synthetic')).toBe(false);
  });

  it("regression: an untimestamped point sharing another timestamped point's id never forces that id to be visible early", () => {
    // Mirrors WheelLocalStorage's real shape — it deliberately reuses its owning Node's own `id` (see
    // wheel.ts). If an untimestamped point's "always visible" behavior worked by inserting its id into this
    // Set, that would collide with the Node's own id and make the Node visible before its own
    // creationTimestamp — this must not happen.
    const wheel = makeWheel({ nodes: [node('shared-id', iso(DAY))] });
    const intervals = buildIntervals(wheel);
    // At the synthesized "before first" interval, the Node itself (has a real, later creationTimestamp) must
    // NOT be visible yet.
    expect(visibleIdsAtInterval(wheel, intervals[0]!.end).has('shared-id')).toBe(false);
  });
});

describe('changesInInterval', () => {
  it('reports exactly the ids that transitioned created/deleted within the window, tagged with kind', () => {
    const wheel = makeWheel({
      nodes: [node('n1', iso(0))],
      pods: [pod('p1', iso(DAY))],
    });
    const changes = changesInInterval(wheel, BASE - 1, BASE + DAY);
    expect(changes).toContainEqual({ id: 'n1', name: 'n1', kind: 'Node', action: 'created', createdAt: BASE });
    expect(changes).toContainEqual({ id: 'p1', name: 'p1', kind: 'Pod', action: 'created', createdAt: BASE + DAY });
  });

  it('tags tier items with their real kind, not a synthesized one', () => {
    const wheel = makeWheel({ network: { items: [tierItem('svc1', 'Service', iso(0))], totalCount: 1 } });
    const changes = changesInInterval(wheel, BASE - 1, BASE + DAY);
    expect(changes).toContainEqual({ id: 'svc1', name: 'svc1', kind: 'Service', action: 'created', createdAt: BASE });
  });

  it('a resource created and deleted at the EXACT same instant appears as both, and is not visible at that interval', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(1000), iso(1000))] }); // created and deleted at the same instant
    const intervals = buildIntervals(wheel);
    expect(intervals).toHaveLength(2); // before-first + the one shared instant
    const sameInstant = intervals[1]!;
    const changes = changesInInterval(wheel, intervals[0]!.end, sameInstant.end);
    expect(changes).toContainEqual({ id: 'p1', name: 'p1', kind: 'Pod', action: 'created', createdAt: BASE + 1000 });
    expect(changes).toContainEqual({ id: 'p1', name: 'p1', kind: 'Pod', action: 'deleted', createdAt: BASE + 1000 });
    expect(visibleIdsAtInterval(wheel, sameInstant.end).has('p1')).toBe(false);
  });

  it('is empty when nothing changed between two adjacent interval ends', () => {
    const wheel = makeWheel({ pods: [pod('p1', iso(0))] });
    expect(changesInInterval(wheel, BASE + DAY, BASE + 2 * DAY)).toEqual([]);
  });

  it('sorts results into time sequence by createdAt, oldest first, regardless of source array order', () => {
    // n1 is later than p1 in creation time but earlier in iteration order (nodes before pods in allTimedPoints).
    const wheel = makeWheel({
      nodes: [node('n1', iso(2 * 60 * 1000))],
      pods: [pod('p1', iso(0))],
    });
    const changes = changesInInterval(wheel, BASE - 1, BASE + DAY);
    expect(changes.map((c) => c.id)).toEqual(['p1', 'n1']);
  });
});

describe('presentTimelapseCategories', () => {
  it('only lists a category that actually has ≥1 item in the wheel', () => {
    const wheel = makeWheel({ nodes: [node('n1')], pods: [] });
    const keys = presentTimelapseCategories(wheel).map((c) => c.key);
    expect(keys).toContain('nodes');
    expect(keys).not.toContain('pods');
    expect(keys).not.toContain('ingress');
  });

  it('lists network when EITHER Service or Endpoints items are present, not just Service', () => {
    const wheel = makeWheel({ endpoints: { items: [tierItem('ep1', 'Endpoints')], totalCount: 1 } });
    expect(presentTimelapseCategories(wheel).map((c) => c.key)).toContain('network');
  });

  it('lists controlPlane whenever components or kubelets are present (always true in practice)', () => {
    const wheel = makeWheel({
      controlPlane: {
        radius: 0,
        y: 0,
        height: 0,
        kubelets: [],
        kubeProxies: [],
        components: [{ id: 'c1', name: 'API Server', x: 0, y: 0, z: 0, color: '#000', popupKind: 'control-plane-component', title: 'API Server' }],
        imageRegistries: [],
        planes: [],
        kubectl: { id: 'kubectl', name: 'kubectl', x: 0, y: 0, z: 0, color: '#000', popupKind: 'kubectl', title: 'kubectl' },
      },
    });
    expect(presentTimelapseCategories(wheel).map((c) => c.key)).toContain('controlPlane');
  });
});

describe('presentTimelapsePlanes / defaultTimelapseCategoryFilters', () => {
  const wheelWithPlanes = makeWheel({
    controlPlane: {
      radius: 0,
      y: 0,
      height: 0,
      kubelets: [],
      kubeProxies: [],
      components: [],
      imageRegistries: [],
      planes: [
        { name: 'Workload', color: '#972aff', radius: 0, startAngle: 0, endAngle: 0, height: 0, items: [] },
        { name: 'Storage', color: '#4477aa', radius: 0, startAngle: 0, endAngle: 0, height: 0, items: [] },
      ],
      kubectl: { id: 'kubectl', name: 'kubectl', x: 0, y: 0, z: 0, color: '#000', popupKind: 'kubectl', title: 'kubectl' },
    },
  });

  it('presentTimelapsePlanes returns one row per plane actually present', () => {
    expect(presentTimelapsePlanes(wheelWithPlanes).map((p) => p.name)).toEqual(['Workload', 'Storage']);
  });

  it('defaultTimelapseCategoryFilters defaults every present plane to false, every other category to true', () => {
    const defaults = defaultTimelapseCategoryFilters(wheelWithPlanes);
    expect(defaults.planes).toEqual({ Workload: false, Storage: false });
    expect(defaults.nodes).toBe(true);
    expect(defaults.pods).toBe(true);
    expect(defaults.controlPlane).toBe(true);
  });
});
