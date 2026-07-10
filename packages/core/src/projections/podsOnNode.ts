import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import { podStatusCategory, podStatusColor, isDaemonSetOwned, type PodStatusCategory } from '../podStatus';
import { podResourceRequests } from '../podResources';

export interface NodePodRow {
  id: ResourceId;
  name: string;
  namespace: string;
  status: PodStatusCategory;
  /** Same color podStatusColor already gives every other pod-status rendering in the app (including the
   *  DaemonSet-is-always-grey rule) — computed once here so the caller never needs its own copy of that
   *  mapping. */
  color: string;
  daemonSet: boolean;
  creationTimestamp?: string;
  /** Total requested CPU (cores) / Memory (bytes) across this Pod's containers — see podResources.ts's own
   *  doc comment for why initContainers are excluded. Undefined means that resource was never requested. */
  cpuCores?: number;
  memBytes?: number;
  /** False when NEITHER cpuCores nor memBytes is set — the "Pods without requests" filter's signal. */
  hasRequests: boolean;
}

/**
 * Every Pod currently scheduled onto `nodeName` (its `spec.nodeName`) — DaemonSet-owned pods included
 * alongside every other kind of pod, not filtered out. The old (pre-rewrite) app only ever used DaemonSet-
 * ownership to recolor an icon (grey vs. green) in a couple of other views, never to exclude a pod from a
 * "what's running here" list, and there's no reason a DaemonSet pod is less "currently running" than any
 * other — so this includes them by design, matching the feature the "Resources" nav view was built for.
 */
export function projectPodsOnNode(graph: ResourceGraph, nodeName: string): NodePodRow[] {
  const rows: NodePodRow[] = [];
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Pod') continue;
    const podNode = (r.raw.spec as { nodeName?: string } | undefined)?.nodeName;
    if (podNode !== nodeName) continue;
    const { cpuCores, memBytes, hasRequests } = podResourceRequests(r);
    rows.push({
      id: r.id,
      name: r.name,
      namespace: r.namespace ?? '',
      status: podStatusCategory(r),
      color: podStatusColor(r),
      daemonSet: isDaemonSetOwned(r),
      creationTimestamp: r.creationTimestamp,
      cpuCores,
      memBytes,
      hasRequests,
    });
  }
  return rows.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name));
}
