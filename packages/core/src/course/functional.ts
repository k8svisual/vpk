import type { ResourceGraph } from '../graph';
import { podStatusCategory } from '../podStatus';
import { allServiceBackingPods } from '../projections/serviceBackends';
import type { Resource } from '../types';

/**
 * Per-resource "does it actually run" read (redesign/training-course.md §7.5's functional axis, status
 * tier). Mostly reuse: Pod status comes from `podStatusCategory`, Service backing from the F1
 * Endpoints+EndpointSlice union (`allServiceBackingPods`). Workload-controller readiness (Deployment/
 * StatefulSet/DaemonSet), PVC Bound, and Job completion had no existing reader anywhere in the codebase —
 * this module adds that small, bounded set. Kinds with no runtime aspect (ConfigMap, Secret, ServiceAccount,
 * Role, ...) report 'n/a' — presence is the only thing that ever applied to them, and the conformance axis
 * already covers that.
 */
export type FunctionalStatus = 'working' | 'partial' | 'broken' | 'n/a';

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function podFunctional(pod: Resource): FunctionalStatus {
  switch (podStatusCategory(pod)) {
    case 'running':
    case 'succeeded':
      return 'working';
    case 'failed':
      return 'broken';
    case 'pending':
    case 'unknown':
      return 'partial';
  }
}

/** Deployment/StatefulSet/DaemonSet readiness: ready replicas vs desired. A controller deliberately scaled
 *  to zero (`spec.replicas: 0`) is 'n/a', not 'broken' — nothing SHOULD be running, so there's no functional
 *  signal to give. DaemonSet has no `spec.replicas`; its desired count is `status.desiredNumberScheduled`. */
function replicaControllerFunctional(res: Resource): FunctionalStatus {
  const status = (res.raw.status ?? {}) as Record<string, unknown>;
  const spec = (res.raw.spec ?? {}) as Record<string, unknown>;
  const ready = numberOr(res.kind === 'DaemonSet' ? status.numberReady : status.readyReplicas, 0);
  const desired = res.kind === 'DaemonSet' ? numberOr(status.desiredNumberScheduled, 0) : numberOr(spec.replicas, 1);
  if (desired === 0) return 'n/a';
  if (ready >= desired) return 'working';
  if (ready > 0) return 'partial';
  return 'broken';
}

function pvcFunctional(res: Resource): FunctionalStatus {
  const phase = ((res.raw.status ?? {}) as { phase?: string }).phase;
  if (phase === 'Bound') return 'working';
  if (phase === 'Pending') return 'partial';
  return 'broken';
}

function jobFunctional(res: Resource): FunctionalStatus {
  const status = (res.raw.status ?? {}) as Record<string, unknown>;
  const spec = (res.raw.spec ?? {}) as Record<string, unknown>;
  const completions = numberOr(spec.completions, 1);
  const succeeded = numberOr(status.succeeded, 0);
  const failed = numberOr(status.failed, 0);
  if (succeeded >= completions) return 'working';
  if (failed > 0) return 'broken';
  return 'partial'; // still running
}

/** A Service with no selector (ExternalName, or a manually-managed Endpoints target) has nothing to be
 *  "backed" by in-cluster — nothing functional to assert. Otherwise: no backing pods at all is 'broken', some
 *  but none ready is 'partial' (rides the exact F1 union that fixed EndpointSlice-only Pod<->Service
 *  linkage), at least one ready is 'working'. */
function serviceFunctional(res: Resource, graph: ResourceGraph): FunctionalStatus {
  const spec = (res.raw.spec ?? {}) as Record<string, unknown>;
  if (spec.type === 'ExternalName' || !spec.selector) return 'n/a';
  const backing = allServiceBackingPods(graph).get(res.id) ?? [];
  if (backing.length === 0) return 'broken';
  return backing.some((p) => p.ready) ? 'working' : 'partial';
}

export function resourceFunctional(res: Resource, graph: ResourceGraph): FunctionalStatus {
  switch (res.kind) {
    case 'Pod':
      return podFunctional(res);
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
      return replicaControllerFunctional(res);
    case 'PersistentVolumeClaim':
      return pvcFunctional(res);
    case 'Job':
      return jobFunctional(res);
    case 'Service':
      return serviceFunctional(res, graph);
    default:
      return 'n/a';
  }
}

const RANK: Record<FunctionalStatus, number> = { broken: 0, partial: 1, working: 2, 'n/a': 3 };

/** Worst-case aggregate across every resource a check examined — one broken resource makes the whole check
 *  read as broken (a partially-broken Deployment isn't "working"). All-'n/a' (no runtime-bearing kind was
 *  involved at all — e.g. a ConfigMap-only InventoryCheck) stays 'n/a', not 'working': there's genuinely no
 *  functional signal to report, and reporting 'working' would be a fabricated positive. */
export function aggregateFunctional(statuses: FunctionalStatus[]): FunctionalStatus {
  if (statuses.length === 0 || statuses.every((s) => s === 'n/a')) return 'n/a';
  return statuses.reduce((worst, s) => (RANK[s] < RANK[worst] ? s : worst), 'n/a' as FunctionalStatus);
}
