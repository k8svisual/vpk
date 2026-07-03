import type { Resource } from './types';

export type NodeRole = 'master' | 'worker';

const MASTER_LABELS = ['node-role.kubernetes.io/master', 'node-role.kubernetes.io/control-plane'];
const ROLE_COLOR: Record<NodeRole, string> = { master: '#8b2e2e', worker: '#9fa6ad' };

/** Master/control-plane label presence wins even when a node also carries the worker label (common on
 *  small clusters where masters are schedulable). */
export function nodeRole(node: Resource): NodeRole {
  return MASTER_LABELS.some((l) => l in node.labels) ? 'master' : 'worker';
}

export function nodeRoleColor(role: NodeRole): string {
  return ROLE_COLOR[role];
}

const DAEMONSET_COLOR = '#9a9a9a';
const PHASE_COLOR: Record<string, string> = {
  Running: '#2e8b57',
  Pending: '#d4a017',
  Failed: '#c0392b',
  Succeeded: '#3a7bd5',
};
const UNKNOWN_COLOR = '#8a8a86';

interface OwnerRefRaw {
  kind?: string;
}

function isDaemonSetOwned(pod: Resource): boolean {
  const owners = pod.raw.metadata?.ownerReferences as OwnerRefRaw[] | undefined;
  return Array.isArray(owners) && owners.some((o) => o.kind === 'DaemonSet');
}

/**
 * Pod status color: green=Running, yellow=Pending (warning), red=Failed, blue=Succeeded (Completed) — EXCEPT
 * a DaemonSet-owned pod is always grey regardless of phase, matching the legacy app's convention (this was
 * flagged as an open question in the redesign notes; now resolved from the original behavior).
 */
export function podStatusColor(pod: Resource): string {
  if (isDaemonSetOwned(pod)) return DAEMONSET_COLOR;
  const phase = (pod.raw.status as { phase?: string } | undefined)?.phase;
  return (phase && PHASE_COLOR[phase]) || UNKNOWN_COLOR;
}
