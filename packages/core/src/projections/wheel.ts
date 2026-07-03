import { nodeHealth, type NodeHealth } from './scene';
import { colorForKind } from '../kindColors';
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
}
export interface WheelNode extends WheelPoint {
  health: NodeHealth;
  podCount: number;
}
export interface WheelPod extends WheelPoint {
  namespace?: string;
  nodeId?: ResourceId;
}
export interface WheelTierItem extends WheelPoint {
  kind: string;
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

export interface ClusterWheel {
  outerRadius: number;
  nodes: WheelNode[];
  pods: WheelPod[];
  network: WheelTier;
  config: WheelTier;
  storage: WheelTier;
  podToNetwork: WheelEdge[];
  podToStorage: WheelEdge[];
}

const HEALTH_COLOR: Record<NodeHealth, string> = { ok: '#2e8b57', warn: '#d4a017', error: '#c0392b' };
const PHASE_COLOR: Record<string, string> = {
  Running: '#2e8b57',
  Succeeded: '#3a7bd5',
  Pending: '#d4a017',
  Failed: '#c0392b',
  Unknown: '#8a8a86',
};

/** Render at most this many items per linked tier — even after restricting to actually-referenced resources,
 *  a real cluster can reference hundreds of Services/PVCs. `totalCount` always reports what's cut. */
const TIER_CAP = 120;
const PODS_PER_ROW = 10;
const ROW_STEP = 0.6;
const INNER_R = 1.4;
const NODE_MARGIN = 1.3;
const WEDGE_FRACTION = 0.8; // leave a visual gap between adjacent node wedges
const NET_Y = 5;
const STORAGE_Y = -5;
const CONFIG_Y = -2.2;

interface EndpointSubsetRaw {
  addresses?: { targetRef?: { kind?: string; uid?: string } }[];
}

/** podId -> the Service ids that back it, via each Service's Endpoints object (targetRef) — same technique as
 *  projections/network.ts, computed here for the reverse (pod-centric) direction the wheel needs. */
function podToServiceIds(graph: ResourceGraph): Map<ResourceId, Set<ResourceId>> {
  const endpointsByNsName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) if (r.kind === 'Endpoints') endpointsByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);

  const result = new Map<ResourceId, Set<ResourceId>>();
  for (const svc of graph.nodes.values()) {
    if (svc.kind !== 'Service') continue;
    const endpoints = endpointsByNsName.get(`${svc.namespace ?? ''}/${svc.name}`);
    const subsets = (endpoints?.raw.subsets as EndpointSubsetRaw[] | undefined) ?? [];
    for (const subset of subsets) {
      for (const addr of subset.addresses ?? []) {
        if (addr.targetRef?.kind !== 'Pod' || !addr.targetRef.uid) continue;
        const set = result.get(addr.targetRef.uid) ?? new Set<ResourceId>();
        set.add(svc.id);
        result.set(addr.targetRef.uid, set);
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

/**
 * 3D hero view, wheel step (DESIGN §6.8): nodes ring the OUTER perimeter; each node's pods fill a pie wedge
 * pointing toward the center, with wedge depth sized by the busiest node's pod count (not node count alone) —
 * that maximum determines how many concentric pod-rows are needed, which in turn sets the ring diameter.
 * Every pod draws a real line up to the Service(s) that back it and down to the PVC(s) it mounts — not a
 * generic drop-line to the ring plane. Positions/colors are computed server-side (the "server scene-model
 * contract" decision).
 */
export function projectClusterWheel(graph: ResourceGraph): ClusterWheel {
  const nodeResources = [...graph.nodes.values()].filter((r) => r.kind === 'Node').sort((a, b) => a.name.localeCompare(b.name));
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

  const maxPods = Math.max(1, ...nodeResources.map((nd) => podsByNode.get(nd.name)?.length ?? 0));
  const rows = Math.ceil(maxPods / PODS_PER_ROW);
  const outerRadius = INNER_R + rows * ROW_STEP + NODE_MARGIN;

  const nodes: WheelNode[] = [];
  const pods: WheelPod[] = [];
  const podPosById = new Map<ResourceId, WheelPod>();

  nodeResources.forEach((nodeRes, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = outerRadius * Math.cos(angle);
    const z = outerRadius * Math.sin(angle);
    const status = nodeRes.raw.status as { conditions?: { type?: string; status?: string }[] } | undefined;
    const spec = nodeRes.raw.spec as { unschedulable?: boolean } | undefined;
    const health = nodeHealth(status?.conditions ?? [], spec?.unschedulable === true);
    const nodePods = podsByNode.get(nodeRes.name) ?? [];
    nodes.push({ id: nodeRes.id, name: nodeRes.name, x, y: 0, z, color: HEALTH_COLOR[health], health, podCount: nodePods.length });

    const wedgeAngle = ((2 * Math.PI) / n) * WEDGE_FRACTION;
    nodePods.forEach((pod, j) => {
      const row = Math.floor(j / PODS_PER_ROW);
      const podsInRow = Math.min(PODS_PER_ROW, nodePods.length - row * PODS_PER_ROW);
      const indexInRow = j % PODS_PER_ROW;
      const podAngle = angle + (indexInRow - (podsInRow - 1) / 2) * (wedgeAngle / Math.max(podsInRow, 1));
      const radius = INNER_R + (row + 0.5) * ROW_STEP;
      const phase = (pod.raw.status as { phase?: string } | undefined)?.phase ?? 'Unknown';
      const wp: WheelPod = {
        id: pod.id,
        name: pod.name,
        namespace: pod.namespace,
        nodeId: nodeRes.id,
        x: radius * Math.cos(podAngle),
        y: 0,
        z: radius * Math.sin(podAngle),
        color: PHASE_COLOR[phase] ?? '#8a8a86',
      };
      pods.push(wp);
      podPosById.set(pod.id, wp);
    });
  });

  const podServiceMap = podToServiceIds(graph);
  const podPvcMap = podToPvcIds(graph);

  const { tier: network, edges: podToNetwork } = linkedTier(graph, podServiceMap, podPosById, NET_Y);
  const { tier: storage, edges: podToStorage } = linkedTier(graph, podPvcMap, podPosById, STORAGE_Y);
  const config = ambientTier(graph, ['ConfigMap', 'Secret'], outerRadius * 0.55, CONFIG_Y);

  return { outerRadius, nodes, pods, network, config, storage, podToNetwork, podToStorage };
}

/** A tier whose items are exactly the resources actually referenced by rendered pods (not an arbitrary slice
 *  of every object of that kind), positioned above/below the centroid of their referencing pods so the
 *  connecting line is close to vertical — this is the real Pod->Service / Pod->PVC linkage. */
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

  const items: WheelTierItem[] = shown.map(([itemId, podIds]) => {
    const item = graph.nodes.get(itemId);
    const positions = podIds.map((id) => podPosById.get(id)).filter((p): p is WheelPod => !!p);
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const cz = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    return {
      id: itemId,
      name: item?.name ?? itemId,
      kind: item?.kind ?? '',
      x: cx,
      y,
      z: cz,
      color: colorForKind(item?.kind ?? ''),
    };
  });

  const edges: WheelEdge[] = [];
  for (const [podId, itemIds] of podToItemIds) {
    if (!podPosById.has(podId)) continue;
    for (const itemId of itemIds) if (shownIds.has(itemId)) edges.push({ podId, itemId });
  }

  return { tier: { items, totalCount: referencingPods.size }, edges };
}

function ambientTier(graph: ResourceGraph, kinds: string[], radius: number, y: number): WheelTier {
  const all = [...graph.nodes.values()].filter((r) => kinds.includes(r.kind));
  const shown = all.slice(0, TIER_CAP);
  const items: WheelTierItem[] = shown.map((r, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, shown.length);
    return { id: r.id, name: r.name, kind: r.kind, x: radius * Math.cos(angle), y, z: radius * Math.sin(angle), color: colorForKind(r.kind) };
  });
  return { items, totalCount: all.length };
}
