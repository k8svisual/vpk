/**
 * Canonical resource-kind color palette. A given kind renders in the SAME color everywhere it appears —
 * OwnerRef graph, Schematic diagram, 3D wheel tiers, etc. — per the "Visually presented Kubernetes" design
 * intent: color is an identity cue, not a per-view styling choice. Kinds not listed here still get a stable
 * color via a deterministic hash, so nothing collapses to a single "unknown" gray.
 */
export const KIND_COLOR: Record<string, string> = {
  Pod: '#17a2b8',
  Node: '#804040',
  Namespace: '#6c7a89',
  Deployment: '#dab894',
  ReplicaSet: '#dc3545',
  StatefulSet: '#3fae6a',
  DaemonSet: '#77bad4',
  Job: '#b4547c',
  CronJob: '#8a3f5c',
  Service: '#3d6fd6',
  Endpoints: '#5bc0de',
  ConfigMap: '#cc89d6',
  Secret: '#5b9877',
  ServiceAccount: '#3aab7c',
  PersistentVolumeClaim: '#f0ad4e',
  PersistentVolume: '#c9974f',
  StorageClass: '#8a5a2b',
  Role: '#9b7ede',
  RoleBinding: '#7e5cc9',
  ClusterRole: '#6a4bb0',
  ClusterRoleBinding: '#563f96',
};

const FALLBACK_PALETTE = ['#5c7a99', '#8f6a4d', '#4d8f7a', '#8f4d6a', '#6a8f4d', '#4d6a8f', '#8f7a4d'];

/** Deterministic (not random) color for a kind not in KIND_COLOR, stable across calls/processes. */
function hashColor(kind: string): string {
  let hash = 0;
  for (let i = 0; i < kind.length; i++) hash = (hash * 31 + kind.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] as string;
}

export function colorForKind(kind: string): string {
  return KIND_COLOR[kind] ?? hashColor(kind);
}
