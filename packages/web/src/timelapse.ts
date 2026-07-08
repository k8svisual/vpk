import type { ClusterWheel, WheelPoint } from './Scene3D';

export interface TimelapseInterval {
  /** Inclusive upper bound, epoch ms — a point is visible AT this interval if its creationTimestamp <= end and
   *  it isn't (deletionTimestamp set and <= end). */
  end: number;
  /** Live date/time readout shown in the control cluster while the timelapse plays/steps. */
  label: string;
}

export interface TimelapseChange {
  id: string;
  name: string;
  kind: string;
  action: 'created' | 'deleted';
  /** The resource's own creationTimestamp, epoch ms — shown in the "Changes" list and used to sort it into
   *  time sequence, regardless of whether this particular change is a 'created' or 'deleted' entry. */
  createdAt: number;
}

interface TimedPoint extends WheelPoint {
  kind?: string;
}

/** Every point that can carry a timestamp, across every array ClusterWheel actually exposes — deliberately
 *  scoped to what the wheel projection already rendered, NOT the full ResourceGraph. Kinds that never make it
 *  into the wheel (Events, RoleBindings, ServiceAccounts, etc.) are never candidates here, because they were
 *  never wheel points to begin with. Pods/Nodes are tagged with a synthesized `kind` since they don't carry
 *  one on the wire, unlike tier items/CSI node drivers/local storage, which already do. */
function allTimedPoints(wheel: ClusterWheel): TimedPoint[] {
  const tiers = [
    wheel.network.items,
    wheel.endpoints.items,
    wheel.ingress.items,
    wheel.storage.items,
    wheel.persistentVolumes.items,
    wheel.storageClasses.items,
    wheel.volumeAttachments.items,
    wheel.csiDrivers.items,
  ];
  return [
    ...wheel.nodes.map((n): TimedPoint => ({ ...n, kind: 'Node' })),
    ...wheel.pods.map((p): TimedPoint => ({ ...p, kind: 'Pod' })),
    ...tiers.flatMap((items) => items),
    ...wheel.csiNodeDrivers,
    ...wheel.localStorage,
  ];
}

function formatIntervalLabel(end: number): string {
  return new Date(end).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

/** hh:mm:ss only (no date) — used for the "Changes" list's per-item creation-time readout, where the
 *  interval's own label already carries the date. */
export function formatChangeTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Discrete, steppable intervals derived purely from the timestamps already present on `wheel`'s own points —
 * no server round-trip. One interval per UNIQUE creation/deletion timestamp (millisecond-exact, not rounded
 * to a day or any other bucket) — two resources created at the exact same instant (e.g. a `kubectl apply -f`
 * sweep, or every demo-data item spread across the SAME priority slice landing on the same millisecond) share
 * one interval; anything even a second apart gets its own step. Interval 0 is synthesized as "before the first
 * event" (nothing with a timestamp is visible yet) so Play always has an obvious empty starting point.
 */
export function buildIntervals(wheel: ClusterWheel): TimelapseInterval[] {
  const points = allTimedPoints(wheel);
  const rawCreationTimes: number[] = [];
  const ends = new Set<number>();
  for (const p of points) {
    if (p.creationTimestamp) {
      const t = new Date(p.creationTimestamp).getTime();
      rawCreationTimes.push(t);
      ends.add(t);
    }
    if (p.deletionTimestamp) ends.add(new Date(p.deletionTimestamp).getTime());
  }
  if (ends.size === 0) return [];

  const sorted = [...ends].sort((a, b) => a - b);
  const intervals: TimelapseInterval[] = [];
  if (rawCreationTimes.length > 0) {
    const beforeFirst = Math.min(...rawCreationTimes) - 1;
    intervals.push({ end: beforeFirst, label: formatIntervalLabel(beforeFirst) });
  }
  for (const end of sorted) intervals.push({ end, label: formatIntervalLabel(end) });
  return intervals;
}

/**
 * The set of point ids that HAVE a creationTimestamp and are visible as of `intervalEnd`. Points with no
 * creationTimestamp (local storage cylinders — the one remaining point with no single backing resource) are
 * deliberately NOT represented here at all, in either direction — callers must treat "this item has no
 * creationTimestamp" as "always visible" themselves (see WheelScene's `atTime`).
 *
 * This split matters because WheelLocalStorage deliberately reuses its owning Node's own `id` (so clicking the
 * cylinder opens the Node's definition — see wheel.ts's own doc comment on WheelLocalStorage). If an
 * untimestamped local-storage point added its id to this Set as "always visible," that id would collide with
 * the Node's own id and incorrectly make the NODE always visible too, regardless of the Node's actual
 * creationTimestamp. Keeping the Set membership 1:1 with "has a timestamp AND passed the check" avoids that
 * collision entirely, since an untimestamped point never touches the Set either way.
 */
export function visibleIdsAtInterval(wheel: ClusterWheel, intervalEnd: number): Set<string> {
  const ids = new Set<string>();
  for (const p of allTimedPoints(wheel)) {
    if (!p.creationTimestamp) continue;
    if (new Date(p.creationTimestamp).getTime() > intervalEnd) continue;
    if (p.deletionTimestamp && new Date(p.deletionTimestamp).getTime() <= intervalEnd) continue;
    ids.add(p.id);
  }
  return ids;
}

/** Every creation/deletion event whose timestamp falls in `(prevEnd, currEnd]` — the "Changes" button's list
 *  for the interval ending at `currEnd`. A point created AND deleted within the same interval appears twice
 *  (once per action) and is correctly excluded from `visibleIdsAtInterval(wheel, currEnd)` — it existed only
 *  transiently within this interval, never actually visible at any interval boundary. */
export function changesInInterval(wheel: ClusterWheel, prevEnd: number, currEnd: number): TimelapseChange[] {
  const changes: TimelapseChange[] = [];
  for (const p of allTimedPoints(wheel)) {
    const createdAt = p.creationTimestamp ? new Date(p.creationTimestamp).getTime() : undefined;
    if (createdAt !== undefined && createdAt > prevEnd && createdAt <= currEnd) {
      changes.push({ id: p.id, name: p.name, kind: p.kind ?? '', action: 'created', createdAt });
    }
    if (p.deletionTimestamp) {
      const deleted = new Date(p.deletionTimestamp).getTime();
      // Every real k8s resource has a creationTimestamp, so this falls back to the deletion instant only as a
      // defensive guard against malformed data — never expected to actually trigger.
      if (deleted > prevEnd && deleted <= currEnd) changes.push({ id: p.id, name: p.name, kind: p.kind ?? '', action: 'deleted', createdAt: createdAt ?? deleted });
    }
  }
  // Time sequence, oldest first — matches the interval's own forward playback direction.
  return changes.sort((a, b) => a.createdAt - b.createdAt);
}

/** Timelapse's own CATEGORY toggle set — independent state from the main FilterPanel's `FilterState`, and only
 *  in effect while timelapse is enabled. `planes` is keyed by resource-plane name (Workload/Networking/.../
 *  ThirdParty in controlPlane.ts's PANE_ORDER) since the set of planes present varies per snapshot. */
export interface TimelapseCategoryFilters {
  nodes: boolean;
  pods: boolean;
  network: boolean;
  ingress: boolean;
  storage: boolean;
  csi: boolean;
  localStorage: boolean;
  controlPlane: boolean;
  /** Default false for every entry — resource-plane "kind-summary" spheres are aggregate counts with no single
   *  creation time, so they don't participate in the timelapse reveal by default; toggling one on here shows
   *  it for the WHOLE timelapse (not time-animated, since there's no per-item timestamp to animate it by). */
  planes: Record<string, boolean>;
}

/** One row's worth of metadata for the Timelapse filter panel — `presentTimelapseCategories` only returns rows
 *  for categories that actually have ≥1 item in `wheel`, per "only items in the wheel need to be in the filter
 *  slide out." */
export interface TimelapseCategoryRow {
  key: Exclude<keyof TimelapseCategoryFilters, 'planes'>;
  label: string;
}

const CATEGORY_DEFS: { key: TimelapseCategoryRow['key']; label: string; present: (wheel: ClusterWheel) => boolean }[] = [
  { key: 'nodes', label: 'Nodes', present: (w) => w.nodes.length > 0 },
  { key: 'pods', label: 'Pods', present: (w) => w.pods.length > 0 },
  { key: 'network', label: 'Network (Service, Endpoints)', present: (w) => w.network.items.length > 0 || w.endpoints.items.length > 0 },
  { key: 'ingress', label: 'Ingress', present: (w) => w.ingress.items.length > 0 },
  {
    key: 'storage',
    label: 'Storage (PVC, PV, StorageClass, VolumeAttachment)',
    present: (w) =>
      w.storage.items.length > 0 || w.persistentVolumes.items.length > 0 || w.storageClasses.items.length > 0 || w.volumeAttachments.items.length > 0,
  },
  { key: 'csi', label: 'CSI', present: (w) => w.csiDrivers.items.length > 0 || w.csiNodeDrivers.length > 0 },
  { key: 'localStorage', label: 'Node Local Storage', present: (w) => w.localStorage.length > 0 },
  { key: 'controlPlane', label: 'Control Plane', present: (w) => w.controlPlane.kubelets.length > 0 || w.controlPlane.components.length > 0 },
];

/** Default toggle state for a freshly-loaded wheel — every present category ON, every present resource plane
 *  OFF (see TimelapseCategoryFilters.planes' own doc comment for why). */
export function defaultTimelapseCategoryFilters(wheel: ClusterWheel): TimelapseCategoryFilters {
  const planes: Record<string, boolean> = {};
  for (const p of wheel.controlPlane.planes) planes[p.name] = false;
  return {
    nodes: true,
    pods: true,
    network: true,
    ingress: true,
    storage: true,
    csi: true,
    localStorage: true,
    controlPlane: true,
    planes,
  };
}

/** Rows the Timelapse filter panel should render for its main category list — only categories with ≥1 item in
 *  the current wheel. */
export function presentTimelapseCategories(wheel: ClusterWheel): TimelapseCategoryRow[] {
  return CATEGORY_DEFS.filter((c) => c.present(wheel)).map(({ key, label }) => ({ key, label }));
}

/** Rows for the panel's resource-plane sub-list — one per plane actually present in this wheel. */
export function presentTimelapsePlanes(wheel: ClusterWheel): { name: string; color: string }[] {
  return wheel.controlPlane.planes.map((p) => ({ name: p.name, color: p.color }));
}
