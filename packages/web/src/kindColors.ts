/**
 * Kind -> color, mirroring `@vpk/core`'s `kindColors.ts` (the same palette used by the 3D wheel/OwnerRef/
 * Schematic) so an icon's badge color always matches that kind's color elsewhere in the app. Duplicated
 * client-side rather than imported — @vpk/web never depends on @vpk/core (thin-client architecture), same as
 * `kindIcons.ts`.
 */
const KIND_COLOR: Record<string, string> = {
  Pod: '#78c9d6',
  Node: '#b59090',
  Namespace: '#aab2bb',
  Deployment: '#ead6c1',
  ReplicaSet: '#eb8a93',
  StatefulSet: '#90d0a9',
  DaemonSet: '#b0d7e6',
  Job: '#d49cb3',
  CronJob: '#bb90a0',
  Service: '#3d6fd6',
  Endpoints: '#4a86e0',
  EndpointSlice: '#5a7fd0',
  Ingress: '#d9c94a',
  HTTPRoute: '#d9c94a',
  Route: '#d9c94a',
  Secret: '#a0c3b0',
  ServiceAccount: '#8dceb3',
  PersistentVolumeClaim: '#f4b942',
  PersistentVolume: '#d9822a',
  StorageClass: '#8a4a12',
  VolumeAttachment: '#4a2a0a',
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

/** Deterministic (not random) color for a kind not in KIND_COLOR, stable across calls. */
function hashColor(kind: string): string {
  let hash = 0;
  for (let i = 0; i < kind.length; i++) hash = (hash * 31 + kind.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length] as string;
}

export function colorForKind(kind: string): string {
  return KIND_COLOR[kind] ?? hashColor(kind);
}

/**
 * Kinds the 3D cluster wheel actually draws — icon badges get the wheel's kind color for these, and a neutral
 * light grey for everything else. Mirrors `@vpk/core`'s `kindColors.ts` (thin-client duplication).
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

const WORKER_NODE_BG = '#9aa1a8'; // podStatus ROLE_COLOR.worker — the wheel colors nodes by role, not kind
const NON_WHEEL_BG = '#d9d9d9'; // light grey for kinds the wheel doesn't draw

/** Icon-badge background matching the 3D wheel: Worker-node color for Node, the wheel's kind color for a
 *  wheel-drawn kind, else a neutral light grey. */
export function networkIconBg(kind: string): string {
  if (kind === 'Node') return WORKER_NODE_BG;
  return WHEEL_KINDS.has(kind) ? colorForKind(kind) : NON_WHEEL_BG;
}
