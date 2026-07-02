import { parseQuantity } from '../quantity';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

export type NodeHealth = 'ok' | 'warn' | 'error';

export interface SceneNode {
  id: ResourceId;
  name: string;
  cpuCapacity?: number;
  memCapacityBytes?: number;
  podCapacity?: number;
  podCount: number;
  health: NodeHealth;
  unschedulable: boolean;
}

interface NodeConditionRaw {
  type?: string;
  status?: string;
}

const PRESSURE_TYPES = new Set(['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']);

/**
 * "Follow red down" status rollup (DESIGN §6.8): Ready=False/Unknown -> error; any pressure condition
 * True -> warn; unschedulable (cordoned) -> warn (unless already error); else ok.
 */
function nodeHealth(conditions: NodeConditionRaw[], unschedulable: boolean): NodeHealth {
  const ready = conditions.find((c) => c.type === 'Ready');
  if (ready && ready.status !== 'True') return 'error';
  const hasPressure = conditions.some((c) => c.type && PRESSURE_TYPES.has(c.type) && c.status === 'True');
  if (hasPressure) return 'warn';
  if (unschedulable) return 'warn';
  return 'ok';
}

/**
 * 3D hero view, step 1 of the scaling model (DESIGN §6.8): node field — every Node as a sized/colored
 * rectangle. width/height come from capacity (view layer maps to actual geometry); health drives color.
 * Filtering down from here (facets) eventually collapses to pill/wheel/single-node — not built yet.
 */
export function projectClusterNodeField(graph: ResourceGraph): SceneNode[] {
  const podCountByNode = new Map<string, number>();
  for (const pod of graph.nodes.values()) {
    if (pod.kind !== 'Pod') continue;
    const nodeName = (pod.raw.spec as { nodeName?: string } | undefined)?.nodeName;
    if (!nodeName) continue;
    podCountByNode.set(nodeName, (podCountByNode.get(nodeName) ?? 0) + 1);
  }

  const nodes: SceneNode[] = [];
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Node') continue;
    const status = r.raw.status as { capacity?: Record<string, string>; conditions?: NodeConditionRaw[] } | undefined;
    const spec = r.raw.spec as { unschedulable?: boolean } | undefined;
    nodes.push({
      id: r.id,
      name: r.name,
      cpuCapacity: parseQuantity(status?.capacity?.cpu),
      memCapacityBytes: parseQuantity(status?.capacity?.memory),
      podCapacity: parseQuantity(status?.capacity?.pods),
      podCount: podCountByNode.get(r.name) ?? 0,
      health: nodeHealth(status?.conditions ?? [], spec?.unschedulable === true),
      unschedulable: spec?.unschedulable === true,
    });
  }
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}
