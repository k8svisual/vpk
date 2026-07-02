/**
 * Stable resource identity (DESIGN §5.1).
 *
 * Replaces the legacy `fnum` (a meaningless insertion counter, unstable across captures).
 * Identity is `metadata.uid` when present, else a deterministic composed key
 * `apiVersion|kind|namespace|name`. Stable across captures → enables snapshot diffing,
 * timelapse, and live deltas.
 */

export type ResourceId = string;

export interface Identifiable {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    uid?: string;
    name?: string;
    namespace?: string;
  };
}

/** Marker used for cluster-scoped resources (no namespace) in the composed key. */
export const CLUSTER_SCOPE = '~cluster';

/** Compute the stable `ResourceId` for a raw Kubernetes object. */
export function resourceId(obj: Identifiable): ResourceId {
  const uid = obj.metadata?.uid;
  if (uid) return uid;

  const apiVersion = obj.apiVersion ?? '';
  const kind = obj.kind ?? '';
  const namespace = obj.metadata?.namespace ?? CLUSTER_SCOPE;
  const name = obj.metadata?.name ?? '';
  return `${apiVersion}|${kind}|${namespace}|${name}`;
}
