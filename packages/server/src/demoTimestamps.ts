import type { RawObject } from '@vpk/core';

/**
 * Rough "typical real-cluster bring-up order" — lower = created earlier. Kinds not listed fall at
 * DEFAULT_PRIORITY, between core infrastructure and workloads. This is a best-effort heuristic for giving
 * generated demo data plausible-looking creationTimestamps across Kinds that don't (yet) carry real
 * ownerReferences to derive a true dependency order from — see `assignCreationTimestamps`' doc comment for
 * how this should be extended once a Kind's template gains ownerReferences.
 */
const KIND_PRIORITY: Record<string, number> = {
  Namespace: 0,
  Node: 1,
  StorageClass: 1,
  CSIDriver: 1,
  CSINode: 1,
  PersistentVolume: 1,
  ClusterRole: 1,
  ClusterRoleBinding: 1,
  CustomResourceDefinition: 1,
  GatewayClass: 1,
  ServiceAccount: 2,
  Role: 2,
  RoleBinding: 2,
  ResourceQuota: 2,
  LimitRange: 2,
  NetworkPolicy: 2,
  ConfigMap: 2,
  Secret: 2,
  PersistentVolumeClaim: 2,
  Gateway: 3,
  Service: 3,
  Endpoints: 3,
  HTTPRoute: 3,
  Route: 3,
  Deployment: 4,
  StatefulSet: 4,
  DaemonSet: 4,
  Job: 4,
  CronJob: 4,
  HorizontalPodAutoscaler: 4,
  ReplicaSet: 5,
  Pod: 6,
  Event: 7,
};
const DEFAULT_PRIORITY = 3.5;

// 60 days — arbitrary but plausible "this cluster's been running a while", not tied to item count.
const WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export interface TimestampOptions {
  /** Defaults to Date.now() — overridable so tests get deterministic output. */
  now?: number;
}

/**
 * Assigns `metadata.creationTimestamp` to every item that doesn't already have one — real extracted data
 * (e.g. Event's own timestamp fields, carried through from the source snapshot) is left untouched, only
 * missing timestamps get filled in. Items are grouped by Kind priority (KIND_PRIORITY) into time slices
 * across a fixed window ending "now", so e.g. every Node/Namespace lands earlier than every Pod, which lands
 * earlier than every Event — without needing real ownerReferences to derive that order from, since none of
 * today's templates carry any yet. Within one Kind, items are staggered evenly across that Kind's slice in
 * the order given (so the first-generated node predates the second, etc.).
 *
 * Deliberately done at FINISH time, not at generate time: only once every staged Kind is known can a single
 * consistent "point in time" be chosen and the whole set ordered against it in one pass, rather than each
 * generate call guessing independently.
 *
 * Extension point for later: once a Kind's template gains real `ownerReferences` (and a matching
 * `metadata.uid`), replace/augment this priority-bucket grouping with an actual topological sort keyed on
 * owner uid -> item. `validateHierarchy` below is the paired check for that case — today it's a no-op since
 * no item has an owner reference to validate against yet.
 */
export function assignCreationTimestamps(items: RawObject[], opts: TimestampOptions = {}): RawObject[] {
  const now = opts.now ?? Date.now();
  const windowStart = now - WINDOW_MS;

  const buckets = new Map<number, number[]>(); // priority -> item indices, in given order
  items.forEach((item, i) => {
    const priority = KIND_PRIORITY[(item.kind as string) ?? ''] ?? DEFAULT_PRIORITY;
    const bucket = buckets.get(priority) ?? [];
    bucket.push(i);
    buckets.set(priority, bucket);
  });
  const priorities = [...buckets.keys()].sort((a, b) => a - b);
  const sliceMs = priorities.length > 0 ? WINDOW_MS / priorities.length : WINDOW_MS;

  const result = [...items];
  priorities.forEach((priority, sliceIndex) => {
    const indices = buckets.get(priority) as number[];
    const sliceStart = windowStart + sliceIndex * sliceMs;
    indices.forEach((itemIndex, posInBucket) => {
      const item = items[itemIndex] as RawObject;
      const existing = (item.metadata as { creationTimestamp?: string } | undefined)?.creationTimestamp;
      if (existing) return;
      // Spread across 90% of the slice (not the full width) so this bucket's latest items still predate
      // the next bucket's earliest, even after floating-point rounding.
      const spread = indices.length > 1 ? (posInBucket / (indices.length - 1)) * sliceMs * 0.9 : 0;
      const metadata = { ...(item.metadata as object | undefined), creationTimestamp: new Date(sliceStart + spread).toISOString() };
      result[itemIndex] = { ...item, metadata };
    });
  });
  return result;
}

export interface ChurnOptions {
  /** Defaults to Date.now() — overridable so tests get deterministic output. Should match the `now` passed to
   *  assignCreationTimestamps for the same generation run, so churn never picks a deletion time past "now". */
  now?: number;
  /** 0-100. Fraction of eligible Pods (already timestamped, non-DaemonSet) that receive a synthetic
   *  metadata.deletionTimestamp. */
  percent: number;
}

/**
 * Simulates real pod churn for demo timelapse playback: picks roughly `percent`% of eligible Pods and gives
 * each a synthetic `metadata.deletionTimestamp` somewhere between its own creationTimestamp and `now` — i.e.
 * "this pod existed for a while, then got replaced." Opt-in (see the Demo Data "Simulate pod churn" setting)
 * since most snapshots should show real deletion signal only (near-zero, honestly) rather than fabricated
 * churn; this exists purely so demo playback isn't just monotonic growth.
 *
 * DaemonSet-owned pods are excluded — a real DaemonSet roll is node-by-node and comparatively rare within a
 * short demo window, and faithfully modeling that is out of scope; plain/ReplicaSet-owned pods (an ordinary
 * rollout replacing them) are the realistic churn subject. Must run AFTER assignCreationTimestamps (every
 * churned pod needs a real creationTimestamp to pick a later deletionTimestamp from) and BEFORE
 * validateHierarchy (which never inspects deletionTimestamp, so this can't fail that check — see its own doc
 * comment).
 */
export function simulatePodChurn(items: RawObject[], opts: ChurnOptions): RawObject[] {
  const now = opts.now ?? Date.now();
  return items.map((item) => {
    if (item.kind !== 'Pod') return item;
    const metadata = item.metadata as { ownerReferences?: { kind?: string }[]; creationTimestamp?: string } | undefined;
    if (metadata?.ownerReferences?.some((ref) => ref.kind === 'DaemonSet')) return item;
    if (!metadata?.creationTimestamp) return item;
    if (Math.random() * 100 >= opts.percent) return item;
    const createdMs = new Date(metadata.creationTimestamp).getTime();
    if (createdMs >= now) return item; // nothing to pick a later deletion time from
    const deletionMs = createdMs + Math.random() * (now - createdMs);
    return { ...item, metadata: { ...metadata, deletionTimestamp: new Date(deletionMs).toISOString() } };
  });
}

/**
 * Checks every item that has BOTH a `metadata.uid` and an `ownerReferences` entry whose `uid` matches
 * another item in this same set — the child's `creationTimestamp` must not predate its resolved owner's.
 * Returns a human-readable problem string per violation (empty array = no problems found).
 *
 * No longer a no-op: several bundles (bundles.ts's buildDaemonSetsForNodes, buildDeploymentsForPods,
 * buildWorkloadsBundle's StatefulSet replicas) set real `ownerReferences` + `uid` on the objects they build —
 * DaemonSet/Deployment->ReplicaSet/StatefulSet -> Pod chains all resolve here. The free-form per-Kind
 * templates (demoTemplates.ts) still strip both fields during extraction, so this only ever finds something
 * to check for bundle-built data, not anything generated through the plain "Individual resources" form.
 */
export function validateHierarchy(items: RawObject[]): string[] {
  const byUid = new Map<string, RawObject>();
  for (const item of items) {
    const uid = (item.metadata as { uid?: string } | undefined)?.uid;
    if (uid) byUid.set(uid, item);
  }

  const problems: string[] = [];
  for (const item of items) {
    const metadata = item.metadata as { name?: string; ownerReferences?: { uid?: string }[]; creationTimestamp?: string } | undefined;
    for (const ref of metadata?.ownerReferences ?? []) {
      const owner = ref.uid ? byUid.get(ref.uid) : undefined;
      if (!owner) continue; // owner not present in this set — nothing to validate against
      const ownerMetadata = owner.metadata as { name?: string; creationTimestamp?: string } | undefined;
      if (
        metadata?.creationTimestamp &&
        ownerMetadata?.creationTimestamp &&
        new Date(metadata.creationTimestamp).getTime() < new Date(ownerMetadata.creationTimestamp).getTime()
      ) {
        problems.push(`${item.kind as string}/${metadata.name} is timestamped before its owner ${owner.kind as string}/${ownerMetadata.name}`);
      }
    }
  }
  return problems;
}
