import { parseQuantity, parseCpuQuantity } from '../quantity';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import { nodeRole, type NodeRole } from '../podStatus';

export type NodeHealth = 'ok' | 'warn' | 'error';

export interface NodeTaint {
  key: string;
  value?: string;
  effect: string;
}

export interface SceneNode {
  id: ResourceId;
  name: string;
  cpuCapacity?: number;
  cpuAllocatable?: number;
  memCapacityBytes?: number;
  memAllocatableBytes?: number;
  podCapacity?: number;
  podAllocatable?: number;
  ephemeralStorageCapacityBytes?: number;
  ephemeralStorageAllocatableBytes?: number;
  podCount: number;
  health: NodeHealth;
  unschedulable: boolean;
  role: NodeRole;
  /** Every label on the raw Node resource — the Field view's own filter panel is built from this (and the
   *  other fields already on this type), not the Wheel view's namespace/pod-status filters. */
  labels: Record<string, string>;
  annotations: Record<string, string>;
  taints: NodeTaint[];
  /** From status.nodeInfo — absent entirely on some (e.g. hand-built test) Node objects, hence all optional. */
  architecture?: string;
  operatingSystem?: string;
  osImage?: string;
  kernelVersion?: string;
  kubeletVersion?: string;
  kubeProxyVersion?: string;
  containerRuntimeVersion?: string;
}

interface NodeConditionRaw {
  type?: string;
  status?: string;
}

interface NodeTaintRaw {
  key?: string;
  value?: string;
  effect?: string;
}

interface NodeInfoRaw {
  architecture?: string;
  operatingSystem?: string;
  osImage?: string;
  kernelVersion?: string;
  kubeletVersion?: string;
  kubeProxyVersion?: string;
  containerRuntimeVersion?: string;
}

const PRESSURE_TYPES = new Set(['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']);

/**
 * "Follow red down" status rollup (DESIGN §6.8): Ready=False/Unknown -> error; any pressure condition
 * True -> warn; unschedulable (cordoned) -> warn (unless already error); else ok.
 */
export function nodeHealth(conditions: NodeConditionRaw[], unschedulable: boolean): NodeHealth {
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
    const status = r.raw.status as
      | {
          capacity?: Record<string, string>;
          allocatable?: Record<string, string>;
          conditions?: NodeConditionRaw[];
          nodeInfo?: NodeInfoRaw;
        }
      | undefined;
    const spec = r.raw.spec as { unschedulable?: boolean; taints?: NodeTaintRaw[] } | undefined;
    const nodeInfo = status?.nodeInfo;
    nodes.push({
      id: r.id,
      name: r.name,
      cpuCapacity: parseCpuQuantity(status?.capacity?.cpu),
      cpuAllocatable: parseCpuQuantity(status?.allocatable?.cpu),
      memCapacityBytes: parseQuantity(status?.capacity?.memory),
      memAllocatableBytes: parseQuantity(status?.allocatable?.memory),
      podCapacity: parseQuantity(status?.capacity?.pods),
      podAllocatable: parseQuantity(status?.allocatable?.pods),
      ephemeralStorageCapacityBytes: parseQuantity(status?.capacity?.['ephemeral-storage']),
      ephemeralStorageAllocatableBytes: parseQuantity(status?.allocatable?.['ephemeral-storage']),
      podCount: podCountByNode.get(r.name) ?? 0,
      health: nodeHealth(status?.conditions ?? [], spec?.unschedulable === true),
      unschedulable: spec?.unschedulable === true,
      role: nodeRole(r),
      labels: r.labels,
      annotations: r.annotations,
      taints: (spec?.taints ?? [])
        .filter((t): t is NodeTaintRaw & { key: string; effect: string } => !!t.key && !!t.effect)
        .map((t) => ({ key: t.key, value: t.value, effect: t.effect })),
      architecture: nodeInfo?.architecture,
      operatingSystem: nodeInfo?.operatingSystem,
      osImage: nodeInfo?.osImage,
      kernelVersion: nodeInfo?.kernelVersion,
      kubeletVersion: nodeInfo?.kubeletVersion,
      kubeProxyVersion: nodeInfo?.kubeProxyVersion,
      containerRuntimeVersion: nodeInfo?.containerRuntimeVersion,
    });
  }
  return nodes.sort((a, b) => a.name.localeCompare(b.name));
}
