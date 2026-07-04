import type { Resource } from './types';

export type NodeRole = 'master' | 'worker';

const MASTER_LABELS = ['node-role.kubernetes.io/master', 'node-role.kubernetes.io/control-plane'];
const ROLE_COLOR: Record<NodeRole, string> = { master: '#8b2e2e', worker: '#9aa1a8' };

/** Master/control-plane label presence wins even when a node also carries the worker label (common on
 *  small clusters where masters are schedulable). */
export function nodeRole(node: Resource): NodeRole {
  return MASTER_LABELS.some((l) => l in node.labels) ? 'master' : 'worker';
}

export function nodeRoleColor(role: NodeRole): string {
  return ROLE_COLOR[role];
}

const DAEMONSET_COLOR = '#8c8c8c';

export type PodStatusCategory = 'running' | 'pending' | 'failed' | 'succeeded' | 'unknown';

const PHASE_CATEGORY: Record<string, PodStatusCategory> = {
  Running: 'running',
  Pending: 'pending',
  Failed: 'failed',
  Succeeded: 'succeeded',
};
// Vivid, matching the legacy filter-panel legend's swatches (traffic-light semaphore colors), not a pastel tint.
const CATEGORY_COLOR: Record<PodStatusCategory, string> = {
  running: '#2e9e4f',
  pending: '#e6b800',
  failed: '#c0392b',
  succeeded: '#3a7bd5',
  unknown: '#8a8a86',
};

interface OwnerRefRaw {
  kind?: string;
}

/** Exported for the wheel projection, which groups DaemonSet pods innermost regardless of status color. */
export function isDaemonSetOwned(pod: Resource): boolean {
  const owners = pod.raw.metadata?.ownerReferences as OwnerRefRaw[] | undefined;
  return Array.isArray(owners) && owners.some((o) => o.kind === 'DaemonSet');
}

/** Coarse status bucket a Pod falls into, independent of color — the 3D filter panel filters on this, not on
 *  the rendered color, so a future palette change can never silently break filtering. */
export function podStatusCategory(pod: Resource): PodStatusCategory {
  const phase = (pod.raw.status as { phase?: string } | undefined)?.phase;
  return (phase && PHASE_CATEGORY[phase]) || 'unknown';
}

/**
 * Pod status color: green=Running, yellow=Pending (warning), red=Failed, blue=Succeeded (Completed) — EXCEPT
 * a DaemonSet-owned pod is always grey regardless of phase, matching the legacy app's convention (this was
 * flagged as an open question in the redesign notes; now resolved from the original behavior).
 */
export function podStatusColor(pod: Resource): string {
  if (isDaemonSetOwned(pod)) return DAEMONSET_COLOR;
  return CATEGORY_COLOR[podStatusCategory(pod)];
}
