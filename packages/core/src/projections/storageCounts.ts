import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

export interface VolumeUsage {
  podId: ResourceId;
  podName: string;
  namespace?: string;
  namespaceId?: ResourceId;
  nodeName?: string;
  nodeId?: ResourceId;
  volumeName: string;
  volumeType: string;
}

interface PodVolumeRaw {
  name?: string;
  [key: string]: unknown;
}

/** A pod.spec.volumes[] entry's TYPE is whichever key besides `name` is present (the k8s API only ever sets
 *  one source field per volume — configMap/secret/emptyDir/hostPath/persistentVolumeClaim/projected/
 *  downwardAPI/nfs/csi/... ) — reading it this way covers every volume source without a hand-maintained list. */
function volumeTypeOf(v: PodVolumeRaw): string {
  return Object.keys(v).find((k) => k !== 'name') ?? 'unknown';
}

/**
 * Flat Pod x Volume usage list (DESIGN §6.10 Storage "Counts by VolumeType/ClusterNode/Namespace" mode) — one
 * row per `pod.spec.volumes[]` entry. "Volume" here is EVERY pod volume source (configMap/secret/emptyDir/
 * hostPath/PVC/projected/...), not just PersistentVolumes — ConfigMaps and Secrets are storage too, from a
 * Pod's point of view. Grouping/drilling by type, node, or namespace is a view concern over this flat list.
 */
export function projectVolumeUsage(graph: ResourceGraph): VolumeUsage[] {
  const namespaceIds = new Map<string, ResourceId>();
  for (const r of graph.nodes.values()) if (r.kind === 'Namespace' || r.kind === 'Project') namespaceIds.set(r.name, r.id);
  const nodeIds = new Map<string, ResourceId>();
  for (const r of graph.nodes.values()) if (r.kind === 'Node') nodeIds.set(r.name, r.id);

  const usages: VolumeUsage[] = [];
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Pod') continue;
    const spec = r.raw.spec as { nodeName?: string; volumes?: PodVolumeRaw[] } | undefined;
    for (const v of spec?.volumes ?? []) {
      usages.push({
        podId: r.id,
        podName: r.name,
        namespace: r.namespace,
        namespaceId: r.namespace ? namespaceIds.get(r.namespace) : undefined,
        nodeName: spec?.nodeName,
        nodeId: spec?.nodeName ? nodeIds.get(spec.nodeName) : undefined,
        volumeName: v.name ?? '',
        volumeType: volumeTypeOf(v),
      });
    }
  }
  return usages;
}
