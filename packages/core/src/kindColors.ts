/**
 * Canonical resource-kind color palette. A given kind renders in the SAME color everywhere it appears —
 * OwnerRef graph, Schematic diagram, 3D wheel tiers, etc. — per the "Visually presented Kubernetes" design
 * intent: color is an identity cue, not a per-view styling choice. Kinds not listed here still get a stable
 * color via a deterministic hash, so nothing collapses to a single "unknown" gray.
 */
export const KIND_COLOR: Record<string, string> = {
  Pod: '#78c9d6',
  Node: '#b59090',
  Namespace: '#aab2bb',
  Deployment: '#ead6c1',
  ReplicaSet: '#eb8a93',
  StatefulSet: '#90d0a9',
  DaemonSet: '#b0d7e6',
  Job: '#d49cb3',
  CronJob: '#bb90a0',
  // Network-family kinds share the blue hue (per the schematic reference's blue "Network" category box, and
  // the legacy filter-panel legend's vivid Network swatch) — Endpoints is a lighter tint of Service's blue,
  // not an unrelated cyan. Kept vivid, not pastel, to match that legend.
  Service: '#3d6fd6',
  Endpoints: '#4a86e0',
  EndpointSlice: '#5a7fd0',
  // Ingress-family kinds (traffic routing INTO a Service, the mirror of Endpoints) share the legacy
  // filter-panel's "Ingress/IngressControl" swatch color — one color for the whole category, same as CSI's.
  // Route is OpenShift's own Ingress-equivalent (real clusters this tool targets commonly use it instead of,
  // or alongside, standard Ingress).
  Ingress: '#d9c94a',
  HTTPRoute: '#d9c94a',
  Route: '#d9c94a',
  Secret: '#a0c3b0',
  ServiceAccount: '#8dceb3',
  // Storage-family kinds, vivid per the legacy filter-panel legend's Storage swatch. Same amber-brown hue as
  // before, but stretched from bright gold to near-black brown (was a tight ~1.3-2.6 pairwise WCAG contrast
  // band, easy to confuse in a 3D scene) so each of the four levels is unmistakable at a glance.
  PersistentVolumeClaim: '#f4b942',
  PersistentVolume: '#d9822a',
  StorageClass: '#8a4a12',
  VolumeAttachment: '#4a2a0a',
  // CSI-family kinds get their own pale-red hue (per the 3D wheel's CSI ring/reference image) — distinct from
  // both the storage-tier browns and the health/status reds used elsewhere.
  CSINode: '#e0908c',
  CSIDriver: '#e0908c',
  Role: '#c5b4ec',
  RoleBinding: '#b4a0e0',
  ClusterRole: '#a997d1',
  ClusterRoleBinding: '#9d90c2',
};

const FALLBACK_PALETTE = ['#a0b2c4', '#bea998', '#98beb2', '#be98a9', '#a9be98', '#98a9be', '#beb298'];

/** Deterministic (not random) color for a kind not in KIND_COLOR, stable across calls/processes. */
function hashColor(kind: string): string {
  let hash = 0;
  for (let i = 0; i < kind.length; i++) hash = (hash * 31 + kind.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] as string;
}

export function colorForKind(kind: string): string {
  return KIND_COLOR[kind] ?? hashColor(kind);
}
