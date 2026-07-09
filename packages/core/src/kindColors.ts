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
  // Gateway API's own two config kinds (the Gateway HTTPRoute attaches to, and the class it's provisioned
  // from) — same Ingress-family color, same reasoning: one traffic-routing category, one color.
  Gateway: '#d9c94a',
  GatewayClass: '#d9c94a',
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
  // Muted khaki — Events are ephemeral/informational (a log entry, not a live resource), so deliberately
  // duller than every "real" kind's color rather than picking a new vivid hue.
  Event: '#b5a875',
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

/** A kind name turned into a valid CSS custom-property suffix (`PersistentVolumeClaim` -> `persistentvolumeclaim`). */
export function cssKind(kind: string): string {
  return kind.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/** A kind's color as a CSS custom-property reference, falling back to colorForKind's own value — used
 *  everywhere a kind fill gets embedded into server-rendered SVG markup (that markup is inlined into the live
 *  DOM, so a `--vpk-kind-<kind>` property set client-side re-colors it instantly, no re-fetch). Settings' own
 *  per-kind color picker is what sets these properties (see web's applyKindColorOverrides) — this function
 *  itself has no knowledge of overrides, it just emits the right var() reference. */
export function cssKindVar(kind: string): string {
  return `var(--vpk-kind-${cssKind(kind)}, ${colorForKind(kind)})`;
}

/**
 * Kinds the 3D cluster wheel actually draws as colored tiers/rings. Icon badges in the Network diagrams and
 * the Network Layers listing get the wheel's kind color for these; every other kind (Deployment/ReplicaSet/
 * StatefulSet/DaemonSet/Gateway…) falls back to a neutral light grey so "not in the wheel" reads at a glance.
 */
export const WHEEL_KINDS = new Set<string>([
  'Pod',
  'Node',
  'Service',
  'Endpoints',
  'EndpointSlice',
  'Ingress',
  'HTTPRoute',
  'Route',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
  'VolumeAttachment',
  'CSIDriver',
  'CSINode',
]);

const WORKER_NODE_BG = '#9aa1a8'; // podStatus.ts ROLE_COLOR.worker — the wheel colors nodes by role, not kind
const NON_WHEEL_BG = '#d9d9d9'; // light grey for kinds the wheel doesn't draw

/** Icon-badge background matching the 3D wheel: the Worker-node color for Node, the wheel's kind color for a
 *  wheel-drawn kind, else a neutral light grey. Shared by the server SVG renderers and the web views. */
export function networkIconBg(kind: string): string {
  if (kind === 'Node') return WORKER_NODE_BG;
  return WHEEL_KINDS.has(kind) ? cssKindVar(kind) : NON_WHEEL_BG;
}
