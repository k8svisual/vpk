import type { Resource } from './types';
import { parseCpuQuantity, parseQuantity } from './quantity';

export interface PodResourceRequests {
  cpuCores?: number;
  memBytes?: number;
  /** True when at least one container declares a CPU or Memory request. False (not just "0") means NEITHER
   *  was ever set — the pod has no reservation against its Node's allocatable capacity at all, which is the
   *  cluster-hygiene signal the Resources view's "Pods without requests" filter looks for. */
  hasRequests: boolean;
}

interface ContainerRaw {
  resources?: { requests?: { cpu?: string; memory?: string } };
}

/** Sums `spec.containers[].resources.requests.{cpu,memory}` — the total CPU/Memory a Pod has reserved
 *  against its Node's allocatable capacity. Excludes `initContainers`: Kubernetes only ever reserves
 *  max(sum of init requests, sum of regular-container requests) for scheduling, and a pod whose only
 *  declared requests came from an init container has effectively no steady-state reservation once it's
 *  running — counting those in would overstate what's actually held for this pod's lifetime. */
export function podResourceRequests(pod: Resource): PodResourceRequests {
  const containers = (pod.raw.spec as { containers?: ContainerRaw[] } | undefined)?.containers ?? [];
  let cpuCores: number | undefined;
  let memBytes: number | undefined;
  for (const c of containers) {
    const cpu = parseCpuQuantity(c.resources?.requests?.cpu);
    if (cpu !== undefined) cpuCores = (cpuCores ?? 0) + cpu;
    const mem = parseQuantity(c.resources?.requests?.memory);
    if (mem !== undefined) memBytes = (memBytes ?? 0) + mem;
  }
  return { cpuCores, memBytes, hasRequests: cpuCores !== undefined || memBytes !== undefined };
}
