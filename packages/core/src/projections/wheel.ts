import { nodeHealth, type NodeHealth } from './scene';
import { colorForKind } from '../kindColors';
import {
  isDaemonSetOwned,
  nodeRole,
  nodeRoleColor,
  podStatusCategory,
  podStatusColor,
  type NodeRole,
  type PodStatusCategory,
} from '../podStatus';
import { parseCpuQuantity, parseQuantity } from '../quantity';
import { projectControlPlane, type ControlPlaneScene } from './controlPlane';
import { allServiceBackingPods } from './serviceBackends';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

export interface WheelPoint {
  id: ResourceId;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  /** ISO 8601, mirrors the backing Resource's own creationTimestamp — the timelapse's time axis. CSI node
   *  driver dots inherit their owning CSINode's timestamp (several dots share one CSINode, so they share its
   *  timestamp too). Undefined only for local storage cylinders, which have no single backing resource at
   *  all — the client-side timelapse instead ties each cylinder's visibility to its own owning Node's
   *  timestamp (see Scene3D.tsx), so it never appears before the Node itself does. */
  creationTimestamp?: string;
  /** Only set when the backing resource's raw k8s object genuinely has metadata.deletionTimestamp — i.e. it's
   *  actually mid-termination (blocked by a finalizer), never fabricated. Most snapshots will have this unset
   *  on nearly everything; demo data can opt into synthetic churn instead (see demoTimestamps.ts). */
  deletionTimestamp?: string;
}
export interface WheelNode extends WheelPoint {
  health: NodeHealth;
  healthColor: string;
  role: NodeRole;
  /** Always the TRUE uncapped count of Pods scheduled on this node — unaffected by POD_CAP_PER_NODE, since
   *  this is also what the Field view's node summary and NodeFilterPanel read. */
  podCount: number;
  /** Only set when this node's Pods were actually cut by POD_CAP_PER_NODE (i.e. < podCount) — mirrors
   *  WheelTier.totalCount's "only report what's cut" convention. */
  renderedPodCount?: number;
  cpuCapacity?: number;
  memCapacityBytes?: number;
  /** For the Resource CPU & Memory filter's "Node Persistent Storage" bar, which hangs off the Node's
   *  local-storage cylinder rather than the Node itself. */
  ephemeralStorageCapacityBytes?: number;
}
export interface WheelPod extends WheelPoint {
  namespace?: string;
  nodeId?: ResourceId;
  /** Independent of `color` so the 3D filter panel filters on semantics, not on a rendered hex string. */
  status: PodStatusCategory;
  daemonSet: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  /** Summed across containers (requests, falling back to limits per-container) — undefined if NO container
   *  specifies either, so the client can tell "unspecified" apart from "explicitly zero". */
  cpuRequested?: number;
  memRequestedBytes?: number;
  /** The `uid` of this Pod's owning ReplicaSet, if any (undefined for DaemonSet/StatefulSet/Job-owned or
   *  bare Pods) — a plain grouping key for the "Show replica" feature (client-side: pods sharing the same
   *  value are siblings in the same ReplicaSet), not resolved against the graph, so it works even when the
   *  ReplicaSet resource itself isn't in this snapshot. */
  replicaSetId?: string;
}
export interface WheelTierItem extends WheelPoint {
  kind: string;
  /** Undefined for cluster-scoped kinds (PV, StorageClass, VolumeAttachment, CSIDriver) — the namespace filter
   *  always lets those through rather than treating "no namespace" as "no match". */
  namespace?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}
export interface WheelTier {
  items: WheelTierItem[];
  totalCount: number;
}
/** A real reference from a Pod to the resource it uses — drawn as a line, not a generic drop to the ring. */
export interface WheelEdge {
  podId: ResourceId;
  itemId: ResourceId;
}
/** A short local hop between two tier items themselves (e.g. Service -> its Endpoints/EndpointSlice) — not
 *  pod-anchored, so it gets its own shape distinct from WheelEdge. */
export interface WheelLinkEdge {
  fromId: ResourceId;
  toId: ResourceId;
}
/** One registered CSI driver entry from a Node's CSINode object — several of these stack vertically below
 *  their Node (down to the CSI ring), so each carries `nodeId` for Scene3D to group and chain-connect them
 *  client-side without a separate edge list (they always connect straight down to the SAME node). */
export interface WheelCsiNodeDriver extends WheelPoint {
  kind: string;
  nodeId: ResourceId;
}
/** A Node's own local/ephemeral storage — not a distinct K8s object (no `spec.capacity` sub-resource), so its
 *  `id` is the Node's own id (clicking it opens the Node's definition, where the real capacity field lives). */
export interface WheelLocalStorage extends WheelPoint {
  kind: string;
  nodeId: ResourceId;
}

export interface ClusterWheel {
  outerRadius: number;
  /** Radius of the CSI ring — a short torus outside the node ring. Sent explicitly (rather than left for the
   *  client to re-derive from `outerRadius`) because CSIDriver items are positioned AT this exact radius, so
   *  server and client must agree on one number, not two independently-maintained copies of it. */
  csiRingRadius: number;
  nodes: WheelNode[];
  pods: WheelPod[];
  /** True total across every node, uncapped — sum of each WheelNode's own podCount. Lets the client's
   *  WheelLegend report "showing X/Y pods" the same way it already does for every other capped tier. */
  totalPodCount: number;
  network: WheelTier;
  endpoints: WheelTier;
  /** Ingress + HTTPRoute (Gateway API) objects that route external traffic INTO a Service — the mirror image
   *  of Endpoints (which back a Service from below), so these sit above it instead. */
  ingress: WheelTier;
  storage: WheelTier;
  persistentVolumes: WheelTier;
  storageClasses: WheelTier;
  volumeAttachments: WheelTier;
  csiNodeDrivers: WheelCsiNodeDriver[];
  csiDrivers: WheelTier;
  localStorage: WheelLocalStorage[];
  podToNetwork: WheelEdge[];
  serviceToEndpoints: WheelLinkEdge[];
  serviceToIngress: WheelLinkEdge[];
  podToStorage: WheelEdge[];
  storageToPv: WheelLinkEdge[];
  pvToStorageClass: WheelLinkEdge[];
  pvToVolumeAttachment: WheelLinkEdge[];
  storageClassToCsiDriver: WheelLinkEdge[];
  volumeAttachmentToCsiDriver: WheelLinkEdge[];
  /** Control Plane ring, per-node Kubelet/Kube-Proxy, API Server/Scheduler/Controller Manager/etcd, kubectl,
   *  the image-registry stack, and the resource "planes" (one sphere per Kind, grouped by API group). */
  controlPlane: ControlPlaneScene;
}

const HEALTH_COLOR: Record<NodeHealth, string> = { ok: '#86bc9e', warn: '#e6c878', error: '#da8c84' };

/** Render at most this many items per linked tier — even after restricting to actually-referenced resources,
 *  a real cluster can reference hundreds of Services/PVCs. `totalCount` always reports what's cut. */
const TIER_CAP = 120;
/** Render at most this many Pods per Node — Pods were previously the one tier rendered fully uncapped (every
 *  other tier already caps at TIER_CAP), which is what actually froze the tab on a real 30k+-pod snapshot (see
 *  Scene3D.tsx's WheelScene). Applied per-node (not as one global slice) so ring/wedge geometry, computed from
 *  the FULL uncapped pod counts via layoutPodRows below, never shifts based on which nodes happen to get
 *  capped, and every node still gets a representative sample rather than one busy node eating the whole
 *  budget. `WheelNode.podCount` always reports the true uncapped count regardless of this cap. */
const POD_CAP_PER_NODE = 60;
const ROW_STEP = 0.6;
const INNER_R = 1.4;
const NODE_MARGIN = 1.3;
const WEDGE_FRACTION = 0.8; // leave a visual gap between adjacent node wedges
const NET_Y = 3.75; // 25% closer to the pod plane (y=0) than the original 5
const ENDPOINTS_Y = 6.5; // above the Service tier — Service -> Endpoints/EndpointSlice is one more hop up
const INGRESS_Y = 8; // above Endpoints — Ingress/HTTPRoute route INTO the Service, so they sit even higher
// PVC sits close to the Pod ring (was -5 — pushed far below); PV steps down further, then StorageClass AND
// VolumeAttachment both branch off PV as siblings (two separate hops from PV, not chained to each other) —
// each gets its own Y band so an SC item and a VA item can never land on top of each other even if they
// happen to anchor near the same PV.
const STORAGE_Y = -1.8;
const PV_Y = -3.2;
const STORAGE_CLASS_Y = -4.6;
const VOLUME_ATTACHMENT_Y = -5.4;
/** Below the node's bottom (nodes sit at y=0..0.6) — the "CSI ring" that node-side CSINode driver entries
 *  drop down to, and that CSIDriver's cluster-wide definition also connects up to. */
const CSI_RING_Y = -0.3;
/** CSIDriver hangs below the CSI ring on the ring's own vertical line (see csiDriverTier) — placed well past
 *  VOLUME_ATTACHMENT_Y itself (not just StorageClass's shallower plane), so the driver ends up clearly BELOW
 *  VolumeAttachment rather than just closer to it. A placement anywhere between StorageClass's plane and
 *  VolumeAttachment's plane would only shrink the vertical gap to VolumeAttachment (flattening that link, the
 *  opposite of the intent) — pushing past it re-opens a real gap, on the other side, so the
 *  VolumeAttachment<->CSIDriver connector reads as a clearly angled line rather than a nearly flat one. Its
 *  own line back to StorageClass is no longer flat as a result — an acceptable tradeoff. Two successive
 *  "push it further" rounds compound to 1.15² (32.25% past the ring-to-VolumeAttachment distance, not a
 *  flat 30%) since each round re-measured from the ring to wherever the driver already sat. */
const CSI_DRIVER_Y = CSI_RING_Y - (CSI_RING_Y - VOLUME_ATTACHMENT_Y) * 1.15 * 1.15;
/** The CSI ring is a short torus OUTSIDE the node ring (nodes sit at outerRadius) — this is how far past it. */
const CSI_RING_RADIUS_OFFSET = 1.6;
/** Radius of a rendered CSINode driver dot (mirrors Scene3D's `<Dot size={0.06}>`) — used only to size the
 *  minimum gap between stacked dots, never sent over the wire itself. */
const CSI_DOT_RADIUS = 0.06;
/** Minimum center-to-center vertical gap between adjacent CSINode driver dots: enough for a full dot-radius of
 *  clear space between their surfaces (radius + gap + radius), not a count-dependent lerp — a node with many
 *  registered drivers must never visually overlap them. */
const CSI_DOT_SPACING = CSI_DOT_RADIUS * 3;
/** A Node's local/ephemeral storage sits between the node and the PVC tier, keeping the "storage renders
 *  below the pod plane" rule; offset just outside the node ring so it doesn't collide with the node itself. */
const LOCAL_STORAGE_Y = -1.0;
const LOCAL_STORAGE_RADIAL_OFFSET = 0.9;
/** Minimum center-to-center arc distance kept between adjacent pods sharing a row, in scene units — bigger
 *  than the ~0.2-unit hex puck diameter Scene3D renders pods at, so pods never visually overlap. */
const MIN_POD_ARC = 0.3;
/** Minimum center-to-center distance kept between any two items in the same tier (Network/Endpoints/Storage),
 *  bigger than the ~0.24-unit rendered size of those items, so tier items never visually overlap either. */
const MIN_ITEM_DIST = 0.5;

/** Nudges (x, z) outward in a deterministic spiral search until it clears every already-placed point by
 *  `minDist` — keeps an item as close as possible to its real semantic anchor (e.g. "above the first Pod")
 *  while guaranteeing no two tier items ever land on top of each other. */
function deconflict(x: number, z: number, placed: { x: number; z: number }[], minDist: number): { x: number; z: number } {
  const clearOf = (px: number, pz: number) => placed.every((p) => Math.hypot(p.x - px, p.z - pz) >= minDist);
  if (clearOf(x, z)) return { x, z };
  for (let ring = 1; ring <= 40; ring++) {
    const radius = ring * minDist;
    const steps = Math.max(6, Math.ceil((2 * Math.PI * radius) / minDist));
    for (let s = 0; s < steps; s++) {
      const angle = (2 * Math.PI * s) / steps;
      const nx = x + radius * Math.cos(angle);
      const nz = z + radius * Math.sin(angle);
      if (clearOf(nx, nz)) return { x: nx, z: nz };
    }
  }
  return { x, z }; // exhausted a generous search radius — leave as-is rather than loop forever
}

/** Timestamp pair spread into every wheel point built from a real backing Resource — see WheelPoint's own doc
 *  comments for what each field means and when it's absent. `raw.metadata` is the only place deletionTimestamp
 *  lives; it isn't promoted to a typed Resource field elsewhere in @vpk/core, so it's read here directly. */
function pointTimestamps(r: Resource | undefined): { creationTimestamp?: string; deletionTimestamp?: string } {
  if (!r) return {};
  return {
    creationTimestamp: r.creationTimestamp,
    deletionTimestamp: (r.raw.metadata as { deletionTimestamp?: string } | undefined)?.deletionTimestamp,
  };
}

interface ContainerResourcesRaw {
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}
interface ContainerRaw {
  resources?: ContainerResourcesRaw;
}

/** Sums one resource (cpu or memory) across a pod's main containers (init containers run sequentially before
 *  them, not concurrently, so they don't count toward steady-state usage) — each container falls back to its
 *  limit when it has no request, per-container. Returns undefined (not 0) when NOT ONE container specifies
 *  either, so the client can tell "unspecified" apart from "explicitly requests nothing". */
function sumContainerResource(pod: Resource, resourceKey: 'cpu' | 'memory', parse: (v: string | undefined) => number | undefined): number | undefined {
  const containers = (pod.raw.spec as { containers?: ContainerRaw[] } | undefined)?.containers ?? [];
  let total = 0;
  let anySpecified = false;
  for (const c of containers) {
    const value = c.resources?.requests?.[resourceKey] ?? c.resources?.limits?.[resourceKey];
    const parsed = parse(value);
    if (parsed !== undefined) {
      anySpecified = true;
      total += parsed;
    }
  }
  return anySpecified ? total : undefined;
}

interface OwnerRefRaw {
  kind?: string;
  uid?: string;
}

/** The `uid` of a Pod's owning ReplicaSet, if any — mirrors podStatus.ts's `isDaemonSetOwned` shape (a plain
 *  ownerReferences scan, not a graph lookup) for the "Show replica" feature's sibling-grouping key. */
function podReplicaSetId(pod: Resource): string | undefined {
  const owners = pod.raw.metadata?.ownerReferences as OwnerRefRaw[] | undefined;
  return owners?.find((o) => o.kind === 'ReplicaSet')?.uid;
}

interface PodRowSlot {
  row: number;
  indexInRow: number;
  podsInRow: number;
  radius: number;
}

/**
 * Assigns `count` pods to concentric rows so pods sharing a row stay at least MIN_POD_ARC apart. A fixed
 * pods-per-row would overlap: arc length between two pods at angular delta `d` is `radius * d`, so the same
 * angular slice packs pods closer together at a small radius than at a large one. Row capacity is instead
 * derived from that arc-length relationship (capacity = wedgeAngle * radius / MIN_POD_ARC), so it naturally
 * grows row-by-row as radius grows — real trigonometry, not a magic constant.
 */
function layoutPodRows(count: number, wedgeAngle: number): { slots: PodRowSlot[]; rows: number } {
  const slots: PodRowSlot[] = [];
  let row = 0;
  let placed = 0;
  while (placed < count) {
    const radius = INNER_R + (row + 0.5) * ROW_STEP;
    const capacity = Math.max(1, Math.floor((wedgeAngle * radius) / MIN_POD_ARC));
    const podsInRow = Math.min(capacity, count - placed);
    for (let i = 0; i < podsInRow; i++) slots.push({ row, indexInRow: i, podsInRow, radius });
    placed += podsInRow;
    row++;
  }
  return { slots, rows: row };
}

/** podId -> the Service ids that back it, via each Service's Endpoints object AND EndpointSlice objects
 *  (targetRef) — see serviceBackends.ts's own doc comment for why both sources matter. Only READY backing
 *  pods count here (mirrors the wheel's existing pod->Service edge convention — a not-ready pod still shows
 *  in the Network cards view, flagged `ready: false`, but doesn't get a wheel line). */
function podToServiceIds(graph: ResourceGraph): Map<ResourceId, Set<ResourceId>> {
  const result = new Map<ResourceId, Set<ResourceId>>();
  for (const [serviceId, backing] of allServiceBackingPods(graph)) {
    for (const pod of backing) {
      if (!pod.ready) continue;
      const set = result.get(pod.uid) ?? new Set<ResourceId>();
      set.add(serviceId);
      result.set(pod.uid, set);
    }
  }
  return result;
}

/** serviceId -> the Endpoints + EndpointSlice objects that back it. Endpoints is matched by ns/name equality
 *  (the legacy 1:1 object); EndpointSlice is matched by the standard `kubernetes.io/service-name` label,
 *  since a Service can fan out to several EndpointSlices (and modern clusters may have both at once). */
function serviceToEndpointsIds(graph: ResourceGraph): Map<ResourceId, ResourceId[]> {
  const servicesByNsName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'Service') servicesByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);

  const result = new Map<ResourceId, ResourceId[]>();
  const add = (serviceId: ResourceId, epId: ResourceId) => {
    const list = result.get(serviceId) ?? [];
    list.push(epId);
    result.set(serviceId, list);
  };

  for (const r of graph.nodes.values()) {
    if (r.kind === 'Endpoints') {
      const svc = servicesByNsName.get(`${r.namespace ?? ''}/${r.name}`);
      if (svc) add(svc.id, r.id);
    } else if (r.kind === 'EndpointSlice') {
      const svcName = r.labels['kubernetes.io/service-name'];
      const svc = svcName ? servicesByNsName.get(`${r.namespace ?? ''}/${svcName}`) : undefined;
      if (svc) add(svc.id, r.id);
    }
  }
  return result;
}

interface IngressBackend {
  service?: { name?: string };
}
interface IngressSpecRaw {
  rules?: { http?: { paths?: { backend?: IngressBackend }[] } }[];
  defaultBackend?: IngressBackend;
}
interface HttpRouteSpecRaw {
  rules?: { backendRefs?: { name?: string; kind?: string }[] }[];
}
interface RouteBackend {
  kind?: string;
  name?: string;
}
interface RouteSpecRaw {
  to?: RouteBackend;
  alternateBackends?: RouteBackend[];
}

/** serviceId -> the Ingress + HTTPRoute (Gateway API) + Route (OpenShift) objects that route external traffic
 *  INTO it. An Ingress names a Service via each rule's `http.paths[].backend.service.name` (plus
 *  `defaultBackend`); an HTTPRoute does the same via each rule's `backendRefs[].name` (skipping any backendRef
 *  explicitly naming a non-Service kind — backendRefs can target other kinds too); an OpenShift Route does it
 *  via `spec.to` (plus `spec.alternateBackends` for traffic-split routes). A Service can be routed to by more
 *  than one of these, and one route object can list several backends, so this is a many-to-many lookup, same
 *  shape as serviceToEndpointsIds — never a plain 1:1 map. */
function serviceToIngressIds(graph: ResourceGraph): Map<ResourceId, ResourceId[]> {
  const servicesByNsName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'Service') servicesByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);

  const result = new Map<ResourceId, ResourceId[]>();
  const add = (serviceId: ResourceId, routeId: ResourceId) => {
    const list = result.get(serviceId) ?? [];
    if (!list.includes(routeId)) list.push(routeId);
    result.set(serviceId, list);
  };

  for (const r of graph.nodes.values()) {
    if (r.kind === 'Ingress') {
      const spec = r.raw.spec as IngressSpecRaw | undefined;
      const backends = [...(spec?.rules ?? []).flatMap((rule) => rule.http?.paths ?? []).map((p) => p.backend), spec?.defaultBackend];
      for (const backend of backends) {
        const svcName = backend?.service?.name;
        const svc = svcName ? servicesByNsName.get(`${r.namespace ?? ''}/${svcName}`) : undefined;
        if (svc) add(svc.id, r.id);
      }
    } else if (r.kind === 'HTTPRoute') {
      const spec = r.raw.spec as HttpRouteSpecRaw | undefined;
      for (const rule of spec?.rules ?? []) {
        for (const ref of rule.backendRefs ?? []) {
          if (ref.kind && ref.kind !== 'Service') continue;
          const svc = ref.name ? servicesByNsName.get(`${r.namespace ?? ''}/${ref.name}`) : undefined;
          if (svc) add(svc.id, r.id);
        }
      }
    } else if (r.kind === 'Route') {
      const spec = r.raw.spec as RouteSpecRaw | undefined;
      for (const backend of [spec?.to, ...(spec?.alternateBackends ?? [])]) {
        if (backend?.kind && backend.kind !== 'Service') continue;
        const svc = backend?.name ? servicesByNsName.get(`${r.namespace ?? ''}/${backend.name}`) : undefined;
        if (svc) add(svc.id, r.id);
      }
    }
  }
  return result;
}

/** podId -> the PVC ids it mounts, via pod.spec.volumes[].persistentVolumeClaim.claimName. */
function podToPvcIds(graph: ResourceGraph): Map<ResourceId, Set<ResourceId>> {
  const pvcByNsName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'PersistentVolumeClaim') pvcByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);

  const result = new Map<ResourceId, Set<ResourceId>>();
  for (const pod of graph.nodes.values()) {
    if (pod.kind !== 'Pod') continue;
    const volumes = (pod.raw.spec as { volumes?: { persistentVolumeClaim?: { claimName?: string } }[] } | undefined)?.volumes ?? [];
    for (const v of volumes) {
      const claimName = v.persistentVolumeClaim?.claimName;
      if (!claimName) continue;
      const pvc = pvcByNsName.get(`${pod.namespace ?? ''}/${claimName}`);
      if (!pvc) continue;
      const set = result.get(pod.id) ?? new Set<ResourceId>();
      set.add(pvc.id);
      result.set(pod.id, set);
    }
  }
  return result;
}

/** pvcId -> the PV it's bound to, via pvc.spec.volumeName (a PVC binds to exactly one PV; PVs are
 *  cluster-scoped, matched by name only — no namespace). */
function pvcToPvId(graph: ResourceGraph): Map<ResourceId, ResourceId> {
  const pvByName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'PersistentVolume') pvByName.set(r.name, r);

  const result = new Map<ResourceId, ResourceId>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'PersistentVolumeClaim') continue;
    const volumeName = (r.raw.spec as { volumeName?: string } | undefined)?.volumeName;
    const pv = volumeName ? pvByName.get(volumeName) : undefined;
    if (pv) result.set(r.id, pv.id);
  }
  return result;
}

/** pvId -> its StorageClass, via pv.spec.storageClassName (cluster-scoped, matched by name — many PVs
 *  commonly share one StorageClass, unlike the 1:1 PVC->PV bind). */
function pvToStorageClassId(graph: ResourceGraph): Map<ResourceId, ResourceId> {
  const scByName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'StorageClass') scByName.set(r.name, r);

  const result = new Map<ResourceId, ResourceId>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'PersistentVolume') continue;
    const scName = (r.raw.spec as { storageClassName?: string } | undefined)?.storageClassName;
    const sc = scName ? scByName.get(scName) : undefined;
    if (sc) result.set(r.id, sc.id);
  }
  return result;
}

/** pvId -> the VolumeAttachment that attaches it to a node, via va.spec.source.persistentVolumeName
 *  (cluster-scoped, matched by PV name). A sibling of pvToStorageClassId — both branch off the PV, not off
 *  each other. */
function pvToVolumeAttachmentId(graph: ResourceGraph): Map<ResourceId, ResourceId> {
  const pvByName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'PersistentVolume') pvByName.set(r.name, r);

  const result = new Map<ResourceId, ResourceId>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'VolumeAttachment') continue;
    const pvName = (r.raw.spec as { source?: { persistentVolumeName?: string } } | undefined)?.source?.persistentVolumeName;
    const pv = pvName ? pvByName.get(pvName) : undefined;
    if (pv) result.set(pv.id, r.id);
  }
  return result;
}

/** storageClassId -> its CSIDriver, via storageClass.provisioner matched against a CSIDriver's name — that's
 *  the CSI spec convention (a CSI-backed StorageClass's `provisioner` field IS the driver name). Built-in
 *  non-CSI provisioners (e.g. "kubernetes.io/no-provisioner") simply match no CSIDriver, correctly producing
 *  no edge rather than a wrong one. */
function storageClassToCsiDriverId(graph: ResourceGraph): Map<ResourceId, ResourceId> {
  const driverByName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'CSIDriver') driverByName.set(r.name, r);

  const result = new Map<ResourceId, ResourceId>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'StorageClass') continue;
    const provisioner = (r.raw as { provisioner?: string }).provisioner;
    const driver = provisioner ? driverByName.get(provisioner) : undefined;
    if (driver) result.set(r.id, driver.id);
  }
  return result;
}

/** volumeAttachmentId -> its CSIDriver, via volumeAttachment.spec.attacher matched against a CSIDriver's name
 *  — the same CSI-spec convention as storageClassToCsiDriverId (a VolumeAttachment's `attacher` field IS the
 *  driver name), but resolved independently: a VolumeAttachment references its driver directly, not through
 *  whatever StorageClass its PV happens to use. */
function volumeAttachmentToCsiDriverId(graph: ResourceGraph): Map<ResourceId, ResourceId> {
  const driverByName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'CSIDriver') driverByName.set(r.name, r);

  const result = new Map<ResourceId, ResourceId>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'VolumeAttachment') continue;
    const attacher = (r.raw.spec as { attacher?: string } | undefined)?.attacher;
    const driver = attacher ? driverByName.get(attacher) : undefined;
    if (driver) result.set(r.id, driver.id);
  }
  return result;
}

/** One dot per driver entry in each Node's CSINode object (cluster-scoped, matched by name === node name),
 *  chained straight down from the node's own center — a plain vertical drop, not routed out to touch the CSI
 *  ring (the ring is a separate, unconnected structural reference in this part of the scene). Each dot steps
 *  down by a fixed CSI_DOT_SPACING regardless of driver count, so dots never overlap no matter how many a node
 *  registers. All dots for one node share that CSINode's id, since they're really one object's driver list,
 *  not separate resources. */
function csiNodeDriverDots(graph: ResourceGraph, nodes: WheelNode[]): WheelCsiNodeDriver[] {
  const csiNodeByName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'CSINode') csiNodeByName.set(r.name, r);

  const dots: WheelCsiNodeDriver[] = [];
  for (const n of nodes) {
    const csiNode = csiNodeByName.get(n.name);
    const drivers = (csiNode?.raw.spec as { drivers?: unknown[] } | undefined)?.drivers ?? [];
    if (!csiNode || drivers.length === 0) continue;
    drivers.forEach((_, i) => {
      dots.push({
        id: csiNode.id,
        name: csiNode.name,
        kind: 'CSINode',
        x: n.x,
        y: CSI_RING_Y - (i + 1) * CSI_DOT_SPACING, // the first (i=0) dot already starts lower than the ring
        z: n.z,
        color: colorForKind('CSINode'),
        nodeId: n.id,
        ...pointTimestamps(csiNode),
      });
    });
  }
  return dots;
}

/** One fixed cylinder per Node for its own local/ephemeral storage — offset just outside the node ring and
 *  dropped to a lower plane (storage always renders below the pod plane), not a separate tier since it isn't
 *  a distinct K8s object: `id` is the Node's own id so clicking it opens the Node (where the real
 *  `status.capacity['ephemeral-storage']` field lives). */
function localStorageDots(nodes: WheelNode[]): WheelLocalStorage[] {
  return nodes.map((n) => {
    const angle = Math.atan2(n.z, n.x);
    const radius = Math.hypot(n.x, n.z) + LOCAL_STORAGE_RADIAL_OFFSET;
    return {
      id: n.id,
      name: n.name,
      kind: 'Node',
      x: radius * Math.cos(angle),
      y: LOCAL_STORAGE_Y,
      z: radius * Math.sin(angle),
      color: '#c9c9c9',
      nodeId: n.id,
    };
  });
}

/**
 * 3D hero view, wheel step (DESIGN §6.8): nodes ring the OUTER perimeter; each node's pods fill a pie wedge
 * pointing toward the center, with wedge depth sized by the busiest node's pod count (not node count alone) —
 * that maximum determines how many concentric pod-rows are needed, which in turn sets the ring diameter.
 * Every pod draws a real line up to the Service(s) that back it and down to the PVC(s) it mounts — not a
 * generic drop-line to the ring plane. Positions/colors are computed server-side (the "server scene-model
 * contract" decision). DaemonSet pods always occupy the innermost row (closest to the open donut-hole center)
 * regardless of graph order — they're the one pod kind pinned to a fixed radius rather than packed by index.
 *
 * `nodeIds`, when given, restricts the ring to just those Node resource ids (e.g. the Field view's "view in
 * Wheel" button, handing over whichever Nodes currently pass its filter) — everything downstream (pods, the
 * busiest-node ring sizing, per-node kubelet/kube-proxy tiers) is derived FROM this filtered Node list, so
 * excluded Nodes' Pods simply never appear rather than needing a second filter pass.
 */
export function projectClusterWheel(graph: ResourceGraph, nodeIds?: Set<string>): ClusterWheel {
  // Role-first, then name: masters sort before workers, alphabetically within each group. Nodes are placed
  // around the ring strictly in this array's order (see the angle formula in the forEach below), so grouping
  // masters contiguously here is ALL that's needed for their pod-wedges to adjoin each other in a multi-master
  // cluster — no separate geometry step. A single-master or all-worker cluster sees no visible change, since
  // there's nothing to group.
  const nodeResources = [...graph.nodes.values()]
    .filter((r) => r.kind === 'Node')
    .filter((r) => !nodeIds || nodeIds.has(r.id))
    .sort((a, b) => {
      const roleDiff = (nodeRole(a) === 'master' ? 0 : 1) - (nodeRole(b) === 'master' ? 0 : 1);
      return roleDiff !== 0 ? roleDiff : a.name.localeCompare(b.name);
    });
  const n = Math.max(1, nodeResources.length);

  const podsByNode = new Map<string, Resource[]>();
  for (const pod of graph.nodes.values()) {
    if (pod.kind !== 'Pod') continue;
    const nodeName = (pod.raw.spec as { nodeName?: string } | undefined)?.nodeName;
    if (!nodeName) continue;
    const list = podsByNode.get(nodeName) ?? [];
    list.push(pod);
    podsByNode.set(nodeName, list);
  }

  const wedgeAngle = ((2 * Math.PI) / n) * WEDGE_FRACTION;
  const maxPods = Math.max(1, ...nodeResources.map((nd) => podsByNode.get(nd.name)?.length ?? 0));
  const { rows } = layoutPodRows(maxPods, wedgeAngle);
  const outerRadius = INNER_R + rows * ROW_STEP + NODE_MARGIN;
  const csiRingRadius = outerRadius + CSI_RING_RADIUS_OFFSET;

  const nodes: WheelNode[] = [];
  const pods: WheelPod[] = [];
  const podPosById = new Map<ResourceId, WheelPod>();

  nodeResources.forEach((nodeRes, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = outerRadius * Math.cos(angle);
    const z = outerRadius * Math.sin(angle);
    const status = nodeRes.raw.status as
      | { conditions?: { type?: string; status?: string }[]; capacity?: Record<string, string> }
      | undefined;
    const spec = nodeRes.raw.spec as { unschedulable?: boolean } | undefined;
    const health = nodeHealth(status?.conditions ?? [], spec?.unschedulable === true);
    const role = nodeRole(nodeRes);
    const nodePods = podsByNode.get(nodeRes.name) ?? [];
    nodes.push({
      id: nodeRes.id,
      name: nodeRes.name,
      x,
      y: 0,
      z,
      color: nodeRoleColor(role),
      health,
      healthColor: HEALTH_COLOR[health],
      role,
      podCount: nodePods.length,
      cpuCapacity: parseCpuQuantity(status?.capacity?.cpu),
      memCapacityBytes: parseQuantity(status?.capacity?.memory),
      ephemeralStorageCapacityBytes: parseQuantity(status?.capacity?.['ephemeral-storage']),
      ...pointTimestamps(nodeRes),
    });

    // DaemonSet pods go first — since row 0 sits at the smallest radius, this always groups them in the
    // innermost ring nearest the donut hole, regardless of what order the graph happened to return pods in.
    const orderedPods = [...nodePods.filter(isDaemonSetOwned), ...nodePods.filter((p) => !isDaemonSetOwned(p))];
    // Row/slot geometry is computed from the FULL uncapped count — capping only which pods get emitted below
    // must never shrink/grow the ring itself, or the wheel's radius would depend on which nodes got capped.
    const { slots } = layoutPodRows(orderedPods.length, wedgeAngle);
    // Only the EMISSION is capped — DaemonSet pods (always first in orderedPods) are never among the ones cut,
    // and every emitted pod keeps the exact slot position it would have had uncapped (slot index j is a valid
    // prefix of the full `slots` array). See POD_CAP_PER_NODE's own comment for why this is per-node.
    const renderedPods = orderedPods.slice(0, POD_CAP_PER_NODE);
    if (renderedPods.length < orderedPods.length) (nodes[nodes.length - 1] as WheelNode).renderedPodCount = renderedPods.length;

    renderedPods.forEach((pod, j) => {
      const { indexInRow, podsInRow, radius } = slots[j] as PodRowSlot;
      const podAngle = angle + (indexInRow - (podsInRow - 1) / 2) * (wedgeAngle / Math.max(podsInRow, 1));
      const wp: WheelPod = {
        id: pod.id,
        name: pod.name,
        namespace: pod.namespace,
        nodeId: nodeRes.id,
        x: radius * Math.cos(podAngle),
        y: 0,
        z: radius * Math.sin(podAngle),
        color: podStatusColor(pod),
        status: podStatusCategory(pod),
        daemonSet: isDaemonSetOwned(pod),
        replicaSetId: podReplicaSetId(pod),
        labels: pod.labels,
        annotations: pod.annotations,
        cpuRequested: sumContainerResource(pod, 'cpu', parseCpuQuantity),
        memRequestedBytes: sumContainerResource(pod, 'memory', parseQuantity),
        ...pointTimestamps(pod),
      };
      pods.push(wp);
      podPosById.set(pod.id, wp);
    });
  });

  const podServiceMap = podToServiceIds(graph);
  const podPvcMap = podToPvcIds(graph);

  const { tier: network, edges: podToNetwork } = serviceTier(graph, podServiceMap, podPosById, NET_Y);
  const { tier: endpoints, edges: serviceToEndpoints } = serviceChildTier(graph, serviceToEndpointsIds(graph), network.items, ENDPOINTS_Y);
  const { tier: ingress, edges: serviceToIngress } = serviceChildTier(graph, serviceToIngressIds(graph), network.items, INGRESS_Y);
  const { tier: storage, edges: podToStorage } = linkedTier(graph, podPvcMap, podPosById, STORAGE_Y);
  const { tier: persistentVolumes, edges: storageToPv } = oneHopTier(graph, pvcToPvId(graph), storage.items, PV_Y);
  const { tier: storageClasses, edges: pvToStorageClass } = oneHopTier(graph, pvToStorageClassId(graph), persistentVolumes.items, STORAGE_CLASS_Y);
  const { tier: volumeAttachments, edges: pvToVolumeAttachment } = oneHopTier(
    graph,
    pvToVolumeAttachmentId(graph),
    persistentVolumes.items,
    VOLUME_ATTACHMENT_Y,
  );
  const {
    tier: csiDrivers,
    storageClassEdges: storageClassToCsiDriver,
    volumeAttachmentEdges: volumeAttachmentToCsiDriver,
  } = csiDriverTier(
    graph,
    storageClassToCsiDriverId(graph),
    storageClasses.items,
    volumeAttachmentToCsiDriverId(graph),
    volumeAttachments.items,
    CSI_DRIVER_Y, // placed below VolumeAttachment's own plane, not StorageClass's — see CSI_DRIVER_Y's own comment
    csiRingRadius,
  );
  const csiNodeDrivers = csiNodeDriverDots(graph, nodes);
  const localStorage = localStorageDots(nodes);
  const controlPlane = projectControlPlane(graph, nodes, outerRadius);

  return {
    outerRadius,
    csiRingRadius,
    nodes,
    pods,
    totalPodCount: nodes.reduce((sum, nd) => sum + nd.podCount, 0),
    network,
    endpoints,
    ingress,
    storage,
    persistentVolumes,
    storageClasses,
    volumeAttachments,
    csiNodeDrivers,
    csiDrivers,
    localStorage,
    podToNetwork,
    serviceToEndpoints,
    serviceToIngress,
    podToStorage,
    storageToPv,
    pvToStorageClass,
    pvToVolumeAttachment,
    storageClassToCsiDriver,
    volumeAttachmentToCsiDriver,
    controlPlane,
  };
}

/** A tier whose items are exactly the resources actually referenced by rendered pods (not an arbitrary slice
 *  of every object of that kind), positioned at the centroid of their referencing pods (then deconflicted
 *  against every other item already placed in this tier, so two items never land on top of each other) —
 *  this is the real Pod->PVC linkage. */
function linkedTier(
  graph: ResourceGraph,
  podToItemIds: Map<ResourceId, Set<ResourceId>>,
  podPosById: Map<ResourceId, WheelPod>,
  y: number,
): { tier: WheelTier; edges: WheelEdge[] } {
  const referencingPods = new Map<ResourceId, ResourceId[]>();
  for (const [podId, itemIds] of podToItemIds) {
    if (!podPosById.has(podId)) continue;
    for (const itemId of itemIds) {
      const list = referencingPods.get(itemId) ?? [];
      list.push(podId);
      referencingPods.set(itemId, list);
    }
  }

  const ranked = [...referencingPods.entries()].sort((a, b) => b[1].length - a[1].length);
  const shown = ranked.slice(0, TIER_CAP);
  const shownIds = new Set(shown.map(([id]) => id));

  const placed: { x: number; z: number }[] = [];
  const items: WheelTierItem[] = shown.map(([itemId, podIds]) => {
    const item = graph.nodes.get(itemId);
    const positions = podIds.map((id) => podPosById.get(id)).filter((p): p is WheelPod => !!p);
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    const { x, z } = deconflict(cx, cz, placed, MIN_ITEM_DIST);
    placed.push({ x, z });
    return {
      id: itemId,
      name: item?.name ?? itemId,
      kind: item?.kind ?? '',
      namespace: item?.namespace,
      labels: item?.labels ?? {},
      annotations: item?.annotations ?? {},
      x,
      y,
      z,
      color: colorForKind(item?.kind ?? ''),
      ...pointTimestamps(item),
    };
  });

  const edges: WheelEdge[] = [];
  for (const [podId, itemIds] of podToItemIds) {
    if (!podPosById.has(podId)) continue;
    for (const itemId of itemIds) if (shownIds.has(itemId)) edges.push({ podId, itemId });
  }

  return { tier: { items, totalCount: referencingPods.size }, edges };
}

/** The Network tier: each Service anchors directly above the referencing Pod with the EARLIEST creation
 *  timestamp ("the first Pod"), not a centroid — every other referencing pod still gets a real edge, but
 *  Scene3D renders it as an elbow (straight up, then over) rather than a direct diagonal, since the point is
 *  "this pod also uses that shared Service" rather than implying the Service sits somewhere between them.
 *  Items are deconflicted against each other the same way linkedTier's are. */
function serviceTier(
  graph: ResourceGraph,
  podToItemIds: Map<ResourceId, Set<ResourceId>>,
  podPosById: Map<ResourceId, WheelPod>,
  y: number,
): { tier: WheelTier; edges: WheelEdge[] } {
  const referencingPods = new Map<ResourceId, ResourceId[]>();
  for (const [podId, itemIds] of podToItemIds) {
    if (!podPosById.has(podId)) continue;
    for (const itemId of itemIds) {
      const list = referencingPods.get(itemId) ?? [];
      list.push(podId);
      referencingPods.set(itemId, list);
    }
  }

  const ranked = [...referencingPods.entries()].sort((a, b) => b[1].length - a[1].length);
  const shown = ranked.slice(0, TIER_CAP);
  const shownIds = new Set(shown.map(([id]) => id));

  const placed: { x: number; z: number }[] = [];
  const items: WheelTierItem[] = shown.map(([itemId, podIds]) => {
    const item = graph.nodes.get(itemId);
    const anchorPodId = [...podIds].sort((a, b) => {
      const ta = graph.nodes.get(a)?.creationTimestamp;
      const tb = graph.nodes.get(b)?.creationTimestamp;
      if (!ta && !tb) return 0;
      if (!ta) return 1; // pods with no timestamp sort last — we can't tell they're "first"
      if (!tb) return -1;
      return ta.localeCompare(tb);
    })[0] as ResourceId;
    const anchor = podPosById.get(anchorPodId);
    const { x, z } = deconflict(anchor?.x ?? 0, anchor?.z ?? 0, placed, MIN_ITEM_DIST);
    placed.push({ x, z });
    return {
      id: itemId,
      name: item?.name ?? itemId,
      kind: item?.kind ?? '',
      namespace: item?.namespace,
      labels: item?.labels ?? {},
      annotations: item?.annotations ?? {},
      x,
      y,
      z,
      color: colorForKind(item?.kind ?? ''),
      ...pointTimestamps(item),
    };
  });

  const edges: WheelEdge[] = [];
  for (const [podId, itemIds] of podToItemIds) {
    if (!podPosById.has(podId)) continue;
    for (const itemId of itemIds) if (shownIds.has(itemId)) edges.push({ podId, itemId });
  }

  return { tier: { items, totalCount: referencingPods.size }, edges };
}

/** A tier of objects that hang off a Service by name — Endpoints/EndpointSlice backing it from below, or
 *  Ingress/HTTPRoute/Route routing into it from above; either way each child anchors near its (first
 *  referencing, if there's more than one) Service's own position (deconflicted the same as every other tier)
 *  so the link reads as "belongs to that Service" without literally stacking on top of it. A child referenced
 *  by MORE THAN ONE Service (an Endpoints object never is, but an Ingress/Route commonly lists several
 *  backends) still gets exactly ONE tier item — not one duplicate per referencing Service — with an edge back
 *  to every Service that references it. Only computed for Services that made it into the (capped) network
 *  tier — a Service cut for exceeding TIER_CAP has nowhere to hang its children from either. */
function serviceChildTier(
  graph: ResourceGraph,
  serviceToChildren: Map<ResourceId, ResourceId[]>,
  serviceItems: WheelTierItem[],
  y: number,
): { tier: WheelTier; edges: WheelLinkEdge[] } {
  const serviceById = new Map(serviceItems.map((s) => [s.id, s]));

  const childToServices = new Map<ResourceId, ResourceId[]>();
  for (const [serviceId, childIds] of serviceToChildren) {
    if (!serviceById.has(serviceId)) continue;
    for (const childId of childIds) {
      const list = childToServices.get(childId) ?? [];
      list.push(serviceId);
      childToServices.set(childId, list);
    }
  }

  const placed: { x: number; z: number }[] = [];
  const items: WheelTierItem[] = [];
  const edges: WheelLinkEdge[] = [];

  for (const [childId, serviceIds] of childToServices) {
    if (items.length >= TIER_CAP) continue;
    const anchor = serviceById.get(serviceIds[0] as ResourceId);
    const item = graph.nodes.get(childId);
    const { x, z } = deconflict(anchor?.x ?? 0, anchor?.z ?? 0, placed, MIN_ITEM_DIST);
    placed.push({ x, z });
    items.push({
      id: childId,
      name: item?.name ?? childId,
      kind: item?.kind ?? '',
      namespace: item?.namespace,
      labels: item?.labels ?? {},
      annotations: item?.annotations ?? {},
      x,
      y,
      z,
      color: colorForKind(item?.kind ?? ''),
      ...pointTimestamps(item),
    });
    for (const serviceId of serviceIds) edges.push({ fromId: serviceId, toId: childId });
  }

  return { tier: { items, totalCount: childToServices.size }, edges };
}

/**
 * A tier one hop further from a parent tier via a 1:1-or-shared link (PVC -> PV, or PV -> StorageClass — a
 * StorageClass is commonly shared by many PVs, unlike the 1:1 PVC/PV bind, so this groups by CHILD id the
 * same way serviceTier/linkedTier group by item id: each child anchors near its first referencing parent
 * (deconflicted against every other child already placed), and gets an edge from every referencing parent,
 * not just the anchor. Only computed for parents that made it into the (capped) parent tier — a parent cut
 * for exceeding TIER_CAP has nowhere to hang its child from either.
 */
function oneHopTier(
  graph: ResourceGraph,
  parentToChildId: Map<ResourceId, ResourceId>,
  parentItems: WheelTierItem[],
  y: number,
): { tier: WheelTier; edges: WheelLinkEdge[] } {
  const parentById = new Map(parentItems.map((p) => [p.id, p]));
  const referencingParents = new Map<ResourceId, ResourceId[]>();
  for (const [parentId, childId] of parentToChildId) {
    if (!parentById.has(parentId)) continue;
    const list = referencingParents.get(childId) ?? [];
    list.push(parentId);
    referencingParents.set(childId, list);
  }

  const ranked = [...referencingParents.entries()].sort((a, b) => b[1].length - a[1].length);
  const shown = ranked.slice(0, TIER_CAP);
  const shownIds = new Set(shown.map(([id]) => id));

  const placed: { x: number; z: number }[] = [];
  const items: WheelTierItem[] = shown.map(([childId, parentIds]) => {
    const item = graph.nodes.get(childId);
    const anchor = parentById.get(parentIds[0] as ResourceId);
    const { x, z } = deconflict(anchor?.x ?? 0, anchor?.z ?? 0, placed, MIN_ITEM_DIST);
    placed.push({ x, z });
    return {
      id: childId,
      name: item?.name ?? childId,
      kind: item?.kind ?? '',
      namespace: item?.namespace,
      labels: item?.labels ?? {},
      annotations: item?.annotations ?? {},
      x,
      y,
      z,
      color: colorForKind(item?.kind ?? ''),
      ...pointTimestamps(item),
    };
  });

  const edges: WheelLinkEdge[] = [];
  for (const [parentId, childId] of parentToChildId) {
    if (!parentById.has(parentId)) continue;
    if (shownIds.has(childId)) edges.push({ fromId: parentId, toId: childId });
  }

  return { tier: { items, totalCount: referencingParents.size }, edges };
}

/**
 * The CSIDriver tier: unlike every other one-hop tier, a CSIDriver is NOT anchored near its parent's own
 * position — a CSIDriver is a cluster-wide object, not owned by any one StorageClass or VolumeAttachment, so
 * it sits out at the CSI ring's own radius instead.
 *
 * A driver can be named by EITHER a StorageClass (provisioner) or a VolumeAttachment (attacher) — real PVs
 * commonly have only the latter (dynamically CSI-attached, no storageClassName at all; confirmed against real
 * snapshot data — several real captures are 100% this shape). Both sources are unioned here rather than
 * resolving only through StorageClass, so a VA-only PV's driver still gets a dot and the
 * Pod->PVC->PV->VolumeAttachment->CSIDriver chain never silently dead-ends at VolumeAttachment for lack of a
 * StorageClass to hang the driver from.
 *
 * Its ANGLE is evenly spaced around the ring (equal degrees between each driver — see the angleStep comment
 * below), NOT anchored to any one referencing StorageClass/VolumeAttachment's own angle, so drivers stay
 * legible instead of piling up wherever their parents happen to cluster. Its Y is passed in as `y`
 * (CSI_DRIVER_Y, placed 15% further from the ring than VolumeAttachment's own plane, below it rather than
 * above — see CSI_DRIVER_Y's own comment for why) while the hop up to the ring stays a plain vertical one (x,z
 * match the ring point exactly).
 */
function csiDriverTier(
  graph: ResourceGraph,
  storageClassToDriverId: Map<ResourceId, ResourceId>,
  storageClassItems: WheelTierItem[],
  volumeAttachmentToDriverId: Map<ResourceId, ResourceId>,
  volumeAttachmentItems: WheelTierItem[],
  y: number,
  ringRadius: number,
): { tier: WheelTier; storageClassEdges: WheelLinkEdge[]; volumeAttachmentEdges: WheelLinkEdge[] } {
  const scById = new Map(storageClassItems.map((s) => [s.id, s]));
  const vaById = new Map(volumeAttachmentItems.map((v) => [v.id, v]));

  const scRefs = new Map<ResourceId, ResourceId[]>();
  for (const [scId, driverId] of storageClassToDriverId) {
    if (!scById.has(scId)) continue;
    const list = scRefs.get(driverId) ?? [];
    list.push(scId);
    scRefs.set(driverId, list);
  }
  const vaRefs = new Map<ResourceId, ResourceId[]>();
  for (const [vaId, driverId] of volumeAttachmentToDriverId) {
    if (!vaById.has(vaId)) continue;
    const list = vaRefs.get(driverId) ?? [];
    list.push(vaId);
    vaRefs.set(driverId, list);
  }

  const driverIds = new Set([...scRefs.keys(), ...vaRefs.keys()]);
  const ranked = [...driverIds].sort((a, b) => {
    const countOf = (id: ResourceId) => (scRefs.get(id)?.length ?? 0) + (vaRefs.get(id)?.length ?? 0);
    return countOf(b) - countOf(a);
  });
  const shown = ranked.slice(0, TIER_CAP);
  const shownIds = new Set(shown);

  // Evenly spaced around the CSI ring (equal degrees apart) rather than anchored to a referencing
  // StorageClass/VolumeAttachment's own angle — with dozens of drivers all inheriting angles from wherever
  // their first referencing parent happened to land, drivers piled up unevenly (dense near busy parts of the
  // ring, sparse elsewhere); a fixed angular step spreads them out for legibility regardless of how their
  // parents happen to be distributed. `shown`'s order (by reference count, tie-broken by driverId's stable
  // position in `driverIds`) is deterministic, so a given snapshot always renders the same layout.
  const angleStep = shown.length > 0 ? (2 * Math.PI) / shown.length : 0;
  const placed: { x: number; z: number }[] = [];
  const items: WheelTierItem[] = shown.map((driverId, i) => {
    const item = graph.nodes.get(driverId);
    const angle = i * angleStep;
    const { x, z } = deconflict(ringRadius * Math.cos(angle), ringRadius * Math.sin(angle), placed, MIN_ITEM_DIST);
    placed.push({ x, z });
    return {
      id: driverId,
      name: item?.name ?? driverId,
      kind: item?.kind ?? '',
      namespace: item?.namespace,
      labels: item?.labels ?? {},
      annotations: item?.annotations ?? {},
      x,
      y,
      z,
      color: colorForKind(item?.kind ?? ''),
      ...pointTimestamps(item),
    };
  });

  const storageClassEdges: WheelLinkEdge[] = [];
  for (const [scId, driverId] of storageClassToDriverId) {
    if (!scById.has(scId)) continue;
    if (shownIds.has(driverId)) storageClassEdges.push({ fromId: scId, toId: driverId });
  }
  const volumeAttachmentEdges: WheelLinkEdge[] = [];
  for (const [vaId, driverId] of volumeAttachmentToDriverId) {
    if (!vaById.has(vaId)) continue;
    if (shownIds.has(driverId)) volumeAttachmentEdges.push({ fromId: vaId, toId: driverId });
  }

  return { tier: { items, totalCount: driverIds.size }, storageClassEdges, volumeAttachmentEdges };
}
