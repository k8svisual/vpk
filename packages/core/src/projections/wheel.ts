import { nodeHealth, type NodeHealth } from './scene';
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

export interface ClusterWheel {
  ringRadius: number;
  nodes: WheelNode[];
  pods: WheelPod[];
  network: WheelTier;
  config: WheelTier;
  storage: WheelTier;
}

const HEALTH_COLOR: Record<NodeHealth, string> = { ok: '#2e8b57', warn: '#d4a017', error: '#c0392b' };
const PHASE_COLOR: Record<string, string> = {
  Running: '#2e8b57',
  Succeeded: '#3a7bd5',
  Pending: '#d4a017',
  Failed: '#c0392b',
  Unknown: '#8a8a86',
};
const KIND_COLOR: Record<string, string> = {
  Service: '#5bc0de',
  ConfigMap: '#cc89d6',
  Secret: '#5b9877',
  PersistentVolumeClaim: '#f0ad4e',
  PersistentVolume: '#c9974f',
  StorageClass: '#8a5a2b',
};

/** Render at most this many items per tier — config/secret counts can run into the thousands on real
 *  clusters; `totalCount` on WheelTier reports what was left out instead of silently truncating. */
const TIER_CAP = 90;

const NET_Y = 6;
const CONFIG_Y = -3.5;
const STORAGE_Y = -7;

/**
 * 3D hero view, wheel step (DESIGN §6.8): small-N (<=~20 nodes) radial layout — nodes on a ring, their pods
 * clustered nearby, network tier (Services) floating above, config/storage tiers below. Positions and colors
 * are computed server-side (the "server scene-model contract" decision) so the client is a thin renderer.
 */
export function projectClusterWheel(graph: ResourceGraph): ClusterWheel {
  const nodeResources = [...graph.nodes.values()].filter((r) => r.kind === 'Node').sort((a, b) => a.name.localeCompare(b.name));
  const n = Math.max(1, nodeResources.length);
  const ringRadius = Math.max(6, n * 1.3);

  const podsByNode = new Map<string, Resource[]>();
  for (const pod of graph.nodes.values()) {
    if (pod.kind !== 'Pod') continue;
    const nodeName = (pod.raw.spec as { nodeName?: string } | undefined)?.nodeName;
    if (!nodeName) continue;
    const list = podsByNode.get(nodeName) ?? [];
    list.push(pod);
    podsByNode.set(nodeName, list);
  }

  const nodes: WheelNode[] = [];
  const pods: WheelPod[] = [];
  nodeResources.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = ringRadius * Math.cos(angle);
    const z = ringRadius * Math.sin(angle);
    const status = node.raw.status as { conditions?: { type?: string; status?: string }[] } | undefined;
    const spec = node.raw.spec as { unschedulable?: boolean } | undefined;
    const health = nodeHealth(status?.conditions ?? [], spec?.unschedulable === true);
    const nodePods = podsByNode.get(node.name) ?? [];
    nodes.push({ id: node.id, name: node.name, x, y: 0, z, color: HEALTH_COLOR[health], health, podCount: nodePods.length });

    nodePods.forEach((pod, j) => {
      const spread = Math.min(nodePods.length, 12);
      const podAngle = angle + (j % spread === 0 ? 0 : ((j % spread) - spread / 2) * 0.04);
      const ring = ringRadius + 0.6 + Math.floor(j / spread) * 0.5;
      const phase = (pod.raw.status as { phase?: string } | undefined)?.phase ?? 'Unknown';
      pods.push({
        id: pod.id,
        name: pod.name,
        namespace: pod.namespace,
        nodeId: node.id,
        x: ring * Math.cos(podAngle),
        y: 0,
        z: ring * Math.sin(podAngle),
        color: PHASE_COLOR[phase] ?? '#8a8a86',
      });
    });
  });

  const network = tier(graph, ['Service'], ringRadius * 0.85, NET_Y);
  const config = tier(graph, ['ConfigMap', 'Secret'], ringRadius * 0.6, CONFIG_Y);
  const storage = tier(graph, ['PersistentVolumeClaim', 'PersistentVolume', 'StorageClass'], ringRadius * 0.85, STORAGE_Y);

  return { ringRadius, nodes, pods, network, config, storage };
}

function tier(graph: ResourceGraph, kinds: string[], radius: number, y: number): WheelTier {
  const all = [...graph.nodes.values()].filter((r) => kinds.includes(r.kind));
  const shown = all.slice(0, TIER_CAP);
  const items: WheelTierItem[] = shown.map((r, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, shown.length);
    return {
      id: r.id,
      name: r.name,
      kind: r.kind,
      x: radius * Math.cos(angle),
      y,
      z: radius * Math.sin(angle),
      color: KIND_COLOR[r.kind] ?? '#888888',
    };
  });
  return { items, totalCount: all.length };
}
