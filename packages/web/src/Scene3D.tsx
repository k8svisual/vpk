import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { DoubleSide } from 'three';
import { PropertiesPanel, localStorageSelectionId } from './PropertiesPanel';
import { FilterPanel, loadDefaultFilters, METRIC_COLORS, CONTROL_PLANE_COLOR, PANES, type FilterState } from './FilterPanel';

interface SceneNode {
  id: string;
  name: string;
  cpuCapacity?: number;
  memCapacityBytes?: number;
  podCapacity?: number;
  podCount: number;
  health: 'ok' | 'warn' | 'error';
  unschedulable: boolean;
}

const HEALTH_COLOR: Record<SceneNode['health'], string> = {
  ok: '#86bc9e',
  warn: '#e6c878',
  error: '#da8c84',
};

// Node cube footprint (nodeBoxWidth) maxes out at 3 (half-width 1.5 per side) for a high-CPU node. 10.5 is
// triple the previous 3.5 spacing (itself already enough to clear the widest-node worst case with a visible
// gap) — a deliberately roomy grid, not just "not touching."
const GRID_GAP = 10.5;
const SELECTION_RING_COLOR = '#e63946';
// Mirrors the same-named constant in @vpk/core's wheel.ts — purely for the CSI ring's own geometry (its Y
// isn't a resource position sent over the wire, unlike everything else in the wheel). The ring's RADIUS, by
// contrast, comes from `wheel.csiRingRadius` — CSIDriver items are positioned at that exact radius server-side,
// so it can't be a second, independently-maintained client constant.
const CSI_RING_Y = -0.3;
// Also mirrors @vpk/core's wheel.ts — the Resource CPU & Memory bars need these as hard ceilings/floors
// ("never go higher than Ingress", "never extend down more than the VolumeAttachment") even when the Ingress
// or VolumeAttachment tiers themselves are empty or filtered off, so they can't be derived from `wheel.*.items`
// at render time the way every other cross-reference in this file is.
const INGRESS_Y = 8;
const VOLUME_ATTACHMENT_Y = -5.4;
// Half of NodeBox's 0.7-wide box geometry below — anchors the local-storage connector on the node's outward
// face (the side furthest from the wheel center), a pure rendering offset never sent over the wire.
const NODE_HALF_WIDTH = 0.35;
// Node box height (see NodeBox's <boxGeometry args={[0.7, 0.6, 0.7]}>) — Node CPU/Memory bars start from its
// top face, not the ground plane, so they visually read as growing out of the node rather than through it.
const NODE_BOX_HEIGHT = 0.6;
/** Small tangential (perpendicular-to-radius) separation between a Node/Pod's two metric bars, so the CPU and
 *  Memory bars don't render on top of each other. */
const METRIC_BAR_OFFSET = 0.07;
const METRIC_BAR_RADIUS = 0.025;

/** The node's own (x, z) shifted outward, along its own radial direction, to the outer face of its box. */
function nodeOutwardXZ(n: { x: number; z: number }): { x: number; z: number } {
  const angle = Math.atan2(n.z, n.x);
  return { x: n.x + NODE_HALF_WIDTH * Math.cos(angle), z: n.z + NODE_HALF_WIDTH * Math.sin(angle) };
}

/** Tangential offset from (x, z) — perpendicular to the radius through the wheel's center — used to flank an
 *  item's two metric bars symmetrically rather than stacking them on the item's exact center point. */
function tangentOffset(x: number, z: number, dist: number): { x: number; z: number } {
  const angle = Math.atan2(z, x);
  return { x: x - dist * Math.sin(angle), z: z + dist * Math.cos(angle) };
}

/** A thin vertical cylinder standing for one CPU/Memory/Storage value — grows from `baseY` toward
 *  `direction` (1 = up, -1 = down) by `height`, normalized (0..1 of `capHeight`) by the caller so it never
 *  crosses the Ingress ceiling (up bars) or the VolumeAttachment floor (the one down bar). Renders nothing for
 *  a zero/negative height (item has no reported value for this category). */
function MetricBar({
  x,
  z,
  baseY,
  height,
  direction,
  color,
  onSelect,
  id,
}: {
  x: number;
  z: number;
  baseY: number;
  height: number;
  direction: 1 | -1;
  color: string;
  onSelect: (id: string) => void;
  id: string;
}) {
  if (height <= 0) return null;
  const centerY = baseY + (direction * height) / 2;
  return (
    <mesh
      position={[x, centerY, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      <cylinderGeometry args={[METRIC_BAR_RADIUS, METRIC_BAR_RADIUS, height, 6]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/** value/max normalized to a 0..capHeight bar height — 0 for a missing value or a non-positive max (nothing
 *  in the current scope to normalize against). */
function metricBarHeight(value: number | undefined, max: number, capHeight: number): number {
  if (value === undefined || value <= 0 || max <= 0) return 0;
  return Math.min(1, value / max) * capHeight;
}

/** Persistent selection marker: a flat ring lying in the XZ plane (parallel to the wheel/grid plane, same
 *  orientation as the outer node ring) that dissects the selected item at its own height — independent of
 *  whether its definition modal is open, so it stays lit after the modal closes and moves when selection
 *  changes. */
function SelectionRing({ x, y, z, radius }: { x: number; y: number; z: number; radius: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <ringGeometry args={[radius * 0.72, radius, 40]} />
      <meshBasicMaterial color={SELECTION_RING_COLOR} side={DoubleSide} transparent opacity={0.95} depthTest={false} />
    </mesh>
  );
}

/** Footprint half-width used both to size the node box and to size its selection ring consistently. */
function nodeBoxWidth(node: SceneNode): number {
  return 1 + Math.min(2, (node.cpuCapacity ?? 1) / 8);
}

function NodeBox({ node, position, onSelect }: { node: SceneNode; position: [number, number, number]; onSelect: (id: string) => void }) {
  const width = nodeBoxWidth(node);
  const height = 0.5 + Math.min(2, (node.memCapacityBytes ?? 0) / (16 * 1024 ** 3));
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        position={[0, height / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial color={HEALTH_COLOR[node.health]} opacity={hovered ? 1 : 0.85} transparent />
      </mesh>
      <Text position={[0, height + 0.05, 0]} fontSize={0.15} color="#6b6b66" anchorX="center" anchorY="bottom">
        {node.podCount}
        {node.podCapacity ? `/${node.podCapacity}` : ''} pods
      </Text>
    </group>
  );
}

function FieldScene({
  onSelect,
  selected,
  filters,
  snapshotKey,
}: {
  onSelect: (id: string) => void;
  selected: string | null;
  filters: FilterState;
  snapshotKey: string;
}) {
  const [nodes, setNodes] = useState<SceneNode[]>([]);

  // Re-fetch whenever the loaded snapshot changes — Scene3D never unmounts (single persistent WebGL context),
  // so unlike every other tab in the app (which remounts and refetches on navigation), this is the one place
  // that must explicitly react to a snapshot swap or it keeps showing the previous snapshot's nodes forever.
  useEffect(() => {
    fetch('/scene/nodes')
      .then((r) => r.json() as Promise<SceneNode[]>)
      .then(setNodes)
      .catch(() => setNodes([]));
  }, [snapshotKey]);

  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const positions = useMemo<[number, number, number][]>(
    () =>
      nodes.map((_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        return [col * GRID_GAP - ((cols - 1) * GRID_GAP) / 2, 0, row * GRID_GAP];
      }),
    [nodes, cols],
  );

  if (!filters.showNodes) return null;

  const selectedIndex = nodes.findIndex((n) => n.id === selected);
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : undefined;
  const selectedPos = selectedIndex >= 0 ? positions[selectedIndex] : undefined;

  return (
    <>
      {nodes.map((n, i) => (
        <NodeBox key={n.id} node={n} position={positions[i] as [number, number, number]} onSelect={onSelect} />
      ))}
      {selectedNode && selectedPos && (
        <SelectionRing x={selectedPos[0]} y={0.05} z={selectedPos[2]} radius={nodeBoxWidth(selectedNode) * 0.75} />
      )}
    </>
  );
}

interface WheelPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
}
interface WheelNode extends WheelPoint {
  health: 'ok' | 'warn' | 'error';
  healthColor: string;
  role: 'master' | 'worker';
  podCount: number;
  cpuCapacity?: number;
  memCapacityBytes?: number;
  ephemeralStorageCapacityBytes?: number;
}
interface WheelPod extends WheelPoint {
  namespace?: string;
  status: 'running' | 'pending' | 'failed' | 'succeeded' | 'unknown';
  daemonSet: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  cpuRequested?: number;
  memRequestedBytes?: number;
}
interface WheelTierItem extends WheelPoint {
  kind: string;
  namespace?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}
interface WheelEdge {
  podId: string;
  itemId: string;
}
interface WheelLinkEdge {
  fromId: string;
  toId: string;
}
interface WheelCsiNodeDriver extends WheelPoint {
  kind: string;
  nodeId: string;
}
interface WheelLocalStorage extends WheelPoint {
  kind: string;
  nodeId: string;
}
interface WheelInfoItem extends WheelPoint {
  popupKind: 'kubelet' | 'kube-proxy' | 'kubectl' | 'control-plane-ring' | 'control-plane-component' | 'kind-summary' | 'image-registry';
  title: string;
  description?: string;
  resourceId?: string;
  kind?: string;
  count?: number;
  nodeId?: string;
}
interface WheelPlane {
  name: string;
  color: string;
  radius: number;
  startAngle: number;
  endAngle: number;
  height: number;
  items: WheelInfoItem[];
}
interface ControlPlaneScene {
  radius: number;
  y: number;
  height: number;
  kubelets: WheelInfoItem[];
  kubeProxies: WheelInfoItem[];
  components: WheelInfoItem[];
  kubectl: WheelInfoItem;
  imageRegistries: WheelInfoItem[];
  planes: WheelPlane[];
}
interface ClusterWheel {
  outerRadius: number;
  csiRingRadius: number;
  nodes: WheelNode[];
  pods: WheelPod[];
  network: { items: WheelTierItem[]; totalCount: number };
  endpoints: { items: WheelTierItem[]; totalCount: number };
  ingress: { items: WheelTierItem[]; totalCount: number };
  storage: { items: WheelTierItem[]; totalCount: number };
  persistentVolumes: { items: WheelTierItem[]; totalCount: number };
  storageClasses: { items: WheelTierItem[]; totalCount: number };
  volumeAttachments: { items: WheelTierItem[]; totalCount: number };
  csiNodeDrivers: WheelCsiNodeDriver[];
  csiDrivers: { items: WheelTierItem[]; totalCount: number };
  localStorage: WheelLocalStorage[];
  podToNetwork: WheelEdge[];
  serviceToEndpoints: WheelLinkEdge[];
  serviceToIngress: WheelLinkEdge[];
  podToStorage: WheelEdge[];
  storageToPv: WheelLinkEdge[];
  pvToStorageClass: WheelLinkEdge[];
  pvToVolumeAttachment: WheelLinkEdge[];
  storageClassToCsiDriver: WheelLinkEdge[];
  volumeAttachmentToCsiDriver: WheelLinkEdge[];
  controlPlane: ControlPlaneScene;
}

/** Whether a pod passes the Pods section of the filter panel — DaemonSet-ness takes priority over phase,
 *  mirroring the color rule (a DaemonSet pod is always grey regardless of phase). */
function podPassesFilter(p: WheelPod, filters: FilterState): boolean {
  if (p.daemonSet) return filters.podDaemonSet;
  return { running: filters.podRunning, pending: filters.podWarning, failed: filters.podFailed, succeeded: filters.podSucceeded, unknown: true }[
    p.status
  ];
}

/** Case-insensitive substring match against every key AND value in a label/annotation map — an empty filter
 *  string always passes (no filtering applied). */
function matchesTextFilter(record: Record<string, string>, filterText: string): boolean {
  if (!filterText) return true;
  const needle = filterText.toLowerCase();
  return Object.entries(record).some(([k, v]) => k.toLowerCase().includes(needle) || v.toLowerCase().includes(needle));
}

/** Namespace + label + annotation filters shared by Pods and every tier item. Cluster-scoped items (PV,
 *  StorageClass, VolumeAttachment, CSIDriver) carry no `namespace`, so the namespace check always lets them
 *  through rather than treating "no namespace" as a mismatch. */
function passesScopeFilters(
  item: { namespace?: string; labels: Record<string, string>; annotations: Record<string, string> },
  filters: FilterState,
): boolean {
  if (filters.namespace && item.namespace && item.namespace !== filters.namespace) return false;
  if (!matchesTextFilter(item.labels, filters.labelFilter)) return false;
  if (!matchesTextFilter(item.annotations, filters.annotationFilter)) return false;
  return true;
}

/** Legacy app's real click-selection sound asset, ported forward — see src/server/public/sounds/LowDing.wav. */
const SELECT_SOUND_SRC = '/sounds/LowDing.wav';

function playSelectSound() {
  new Audio(SELECT_SOUND_SRC).play().catch(() => {});
}

function Dot({ p, size, onSelect }: { p: WheelPoint; size: number; onSelect: (id: string) => void }) {
  return (
    <mesh
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(p.id);
      }}
    >
      <sphereGeometry args={[size, 10, 10]} />
      {/* Unlit: these dots are a color-coded status legend, not lit geometry — meshStandardMaterial let the
          scene's directional light wash the (already-lightened) palette out to near-grey on the shaded side. */}
      <meshBasicMaterial color={p.color} />
    </mesh>
  );
}

/** Pods render as a hexagonal puck (a 6-sided cylinder — its cross-section is a hexagon by construction,
 *  cylinder's height axis is Y by default so the hex faces lie flat in the wheel's ground plane) rather than
 *  the generic sphere used for tier items, so pods read as a distinct shape at a glance. */
function PodHex({ p, size, onSelect }: { p: WheelPoint; size: number; onSelect: (id: string) => void }) {
  return (
    <mesh
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(p.id);
      }}
    >
      <cylinderGeometry args={[size, size, size * 0.7, 6]} />
      <meshBasicMaterial color={p.color} />
    </mesh>
  );
}

/** The storage-family shape (PVC/PV/StorageClass) — a short cylinder, distinct from the pod hex and the
 *  network/endpoints sphere so the three storage tiers still read as one visual family stacked vertically. */
function StorageCylinder({ p, onSelect }: { p: WheelPoint; onSelect: (id: string) => void }) {
  return (
    <mesh
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(p.id);
      }}
    >
      <cylinderGeometry args={[0.12, 0.12, 0.22, 8]} />
      <meshBasicMaterial color={p.color} />
    </mesh>
  );
}

/** A real resource->resource line (e.g. Pod -> the PVC it mounts, or Service -> its Endpoints). Colored to
 *  match the resource kind at the far end. */
function LinkLine({ a, b, color, opacity = 0.55 }: { a: WheelPoint; b: WheelPoint; color: string; opacity?: number }) {
  const points: [number, number, number][] = [
    [a.x, a.y, a.z],
    [b.x, b.y, b.z],
  ];
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}

/** A Pod -> Service edge, drawn as an elbow (straight up ~1/4 of the way, then over to the Service) rather
 *  than a direct diagonal — the Service anchors above the FIRST (earliest-created) referencing pod, so a
 *  straight line for every other sharing pod would read as "the Service sits between us", which isn't the
 *  relationship being shown. Degenerates to a plain straight-up line for the anchor pod itself, since its x/z
 *  already match the Service's. */
function ElbowLine({ a, b, color }: { a: WheelPoint; b: WheelPoint; color: string }) {
  const midY = a.y + (b.y - a.y) * 0.25;
  const points: [number, number, number][] = [
    [a.x, a.y, a.z],
    [a.x, midY, a.z],
    [b.x, b.y, b.z],
  ];
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.55} />
    </line>
  );
}

/** An arbitrary multi-segment line — used for the CSI node-driver chain and the local-storage right-angle
 *  connector, both of which need more than ElbowLine's fixed 3-point shape. */
function PolyLine({ points, color, opacity = 0.55 }: { points: [number, number, number][]; color: string; opacity?: number }) {
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}

/** The "CSI ring" — a torus (a real short cylinder, not a thin wireframe line like the outer node-ring)
 *  running around the same radius as the nodes but at a lower Y, just below the node boxes' bottom. Purely
 *  structural (no single backing resource): CSINode driver chains drop down to it, and CSIDriver spheres
 *  connect up to it, so it reads as the shared "CSI bus" tying node-side and cluster-side CSI objects together. */
function CsiRing({ radius, y }: { radius: number; y: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.08, 8, 64]} />
      <meshBasicMaterial color="#e0908c" transparent opacity={0.85} />
    </mesh>
  );
}

/** The "Control Plane" ring — a full torus (translucent, unlike the CSI ring) circling the whole node ring at
 *  its own Y band, clickable in its own right (matches the legacy app's wall, whose popup just explains "click
 *  each component for details"). */
function ControlPlaneRing({ radius, y, height, onSelect }: { radius: number; y: number; height: number; onSelect: (id: string) => void }) {
  return (
    <mesh
      position={[0, y, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(CONTROL_PLANE_RING_ID);
      }}
    >
      <torusGeometry args={[radius, height / 2, 8, 64]} />
      <meshBasicMaterial color={CONTROL_PLANE_COLOR} transparent opacity={0.3} />
    </mesh>
  );
}

/** A resource pane's translucent wall — a partial (open-ended) cylinder arc from y=0.5 up to `height`+0.5,
 *  spanning `startAngle`..`endAngle`, sitting behind that pane's one-sphere-per-Kind spheres. Mirrors the
 *  legacy app's per-plane wall geometry (a ribbon between two arcs), built here from THREE's own partial-
 *  cylinder support instead, since a plain CylinderGeometry already does an open angular slice natively. */
/** Vertex positions for the wall's quad strip, built with the EXACT same x = r·cos(angle), z = r·sin(angle)
 *  convention used everywhere else in this file (nodes, CSI ring, every Dot). A THREE.CylinderGeometry's own
 *  thetaStart/thetaLength use a different (x = r·sin, z = r·cos) parameterization internally, so compensating
 *  for that with a guessed `rotation.y` is exactly the kind of thing that silently drifts out of alignment —
 *  building the strip's own vertices directly instead means the wall can never disagree with where this
 *  file actually puts the plane's own spheres. */
function planeWallPositions(plane: WheelPlane): Float32Array {
  const segments = 24;
  const bottomY = 0.5;
  const topY = 0.5 + plane.height;
  const step = (plane.endAngle - plane.startAngle) / segments;
  const positions: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = plane.startAngle + step * i;
    const a1 = plane.startAngle + step * (i + 1);
    const x0 = plane.radius * Math.cos(a0);
    const z0 = plane.radius * Math.sin(a0);
    const x1 = plane.radius * Math.cos(a1);
    const z1 = plane.radius * Math.sin(a1);
    positions.push(x0, bottomY, z0, x1, bottomY, z1, x1, topY, z1);
    positions.push(x0, bottomY, z0, x1, topY, z1, x0, topY, z0);
  }
  return new Float32Array(positions);
}

function PlaneWall({ plane }: { plane: WheelPlane }) {
  if (plane.endAngle <= plane.startAngle) return null;
  const positions = planeWallPositions(plane);
  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <meshBasicMaterial color={plane.color} transparent opacity={0.3} side={DoubleSide} />
    </mesh>
  );
}

/** Radius a selection ring should draw at for each wheel category, roughly enclosing that category's own
 *  geometry (node role box, pod/tier dot, storage cylinder). */
function findWheelSelection(
  wheel: ClusterWheel,
  selected: string | null,
  clickedCsiDot: WheelCsiNodeDriver | null,
): { x: number; y: number; z: number; radius: number } | null {
  if (!selected) return null;
  // Checked before the plain Node lookup below: a local-storage cylinder's selection id is a Node id wrapped
  // in the "::local-storage" suffix (see PropertiesPanel), so it never collides with a real Node's own id —
  // this must resolve to the CYLINDER's position, not the Node box's, or the ring would jump to the wrong mesh.
  const localStorage = wheel.localStorage.find((ls) => localStorageSelectionId(ls.nodeId) === selected);
  if (localStorage) return { x: localStorage.x, y: localStorage.y, z: localStorage.z, radius: 0.15 };
  const node = wheel.nodes.find((n) => n.id === selected);
  if (node) return { x: node.x, y: 0.3, z: node.z, radius: 0.55 };
  const pod = wheel.pods.find((p) => p.id === selected);
  if (pod) return { x: pod.x, y: pod.y, z: pod.z, radius: 0.17 };
  const net = wheel.network.items.find((i) => i.id === selected);
  if (net) return { x: net.x, y: net.y, z: net.z, radius: 0.2 };
  const store = wheel.storage.items.find((i) => i.id === selected);
  if (store) return { x: store.x, y: store.y, z: store.z, radius: 0.22 };
  const ep = wheel.endpoints.items.find((i) => i.id === selected);
  if (ep) return { x: ep.x, y: ep.y, z: ep.z, radius: 0.18 };
  const ing = wheel.ingress.items.find((i) => i.id === selected);
  if (ing) return { x: ing.x, y: ing.y, z: ing.z, radius: 0.2 };
  const pv = wheel.persistentVolumes.items.find((i) => i.id === selected);
  if (pv) return { x: pv.x, y: pv.y, z: pv.z, radius: 0.22 };
  const sc = wheel.storageClasses.items.find((i) => i.id === selected);
  if (sc) return { x: sc.x, y: sc.y, z: sc.z, radius: 0.22 };
  const va = wheel.volumeAttachments.items.find((i) => i.id === selected);
  if (va) return { x: va.x, y: va.y, z: va.z, radius: 0.22 };
  const driver = wheel.csiDrivers.items.find((i) => i.id === selected);
  if (driver) return { x: driver.x, y: driver.y, z: driver.z, radius: 0.18 };
  // Every driver dot in one Node's CSINode chain shares that CSINode's own resource id (they're one object's
  // driver list, not separate resources) — so a plain `.find()` by id would always resolve to the FIRST dot
  // pushed for that node, regardless of which of the (possibly several) dots was actually clicked. The exact
  // clicked dot is tracked separately so the ring lands on the real one, not always the shallowest.
  if (clickedCsiDot && clickedCsiDot.id === selected) return { x: clickedCsiDot.x, y: clickedCsiDot.y, z: clickedCsiDot.z, radius: 0.1 };
  const csiDot = wheel.csiNodeDrivers.find((d) => d.id === selected);
  if (csiDot) return { x: csiDot.x, y: csiDot.y, z: csiDot.z, radius: 0.1 };
  if (selected === CONTROL_PLANE_RING_ID) {
    return { x: wheel.controlPlane.radius, y: wheel.controlPlane.y, z: 0, radius: 0.3 };
  }
  const cp = wheel.controlPlane;
  const info =
    cp.kubelets.find((k) => k.id === selected) ??
    cp.kubeProxies.find((k) => k.id === selected) ??
    cp.components.find((c) => c.id === selected) ??
    (cp.kubectl.id === selected ? cp.kubectl : undefined) ??
    cp.imageRegistries.find((r) => r.id === selected) ??
    cp.planes.flatMap((p) => p.items).find((i) => i.id === selected);
  if (info) return { x: info.x, y: info.y, z: info.z, radius: 0.15 };
  return null;
}

const CONTROL_PLANE_RING_ID = 'control-plane-ring';

/** Everything this file's new Control Plane / resource-pane layer can select is either a real WheelInfoItem
 *  from the wheel payload, or (for the ring itself, which has no single point) a synthetic static card built
 *  here — PropertiesPanel renders straight from this instead of fetching `/definition`, since none of these
 *  correspond to exactly one fetchable resource the way a Pod/tier item does. */
function findWheelInfoItem(wheel: ClusterWheel | null, selected: string | null): WheelInfoItem | null {
  if (!wheel || !selected) return null;
  if (selected === CONTROL_PLANE_RING_ID) {
    return {
      id: CONTROL_PLANE_RING_ID,
      name: 'Control Plane',
      x: 0,
      y: 0,
      z: 0,
      color: CONTROL_PLANE_COLOR,
      popupKind: 'control-plane-ring',
      title: 'Control Plane',
      description: 'Multiple components comprise the Control Plane. Click on each component to view additional information.',
    };
  }
  const cp = wheel.controlPlane;
  return (
    cp.kubelets.find((k) => k.id === selected) ??
    cp.kubeProxies.find((k) => k.id === selected) ??
    cp.components.find((c) => c.id === selected) ??
    (cp.kubectl.id === selected ? cp.kubectl : undefined) ??
    cp.imageRegistries.find((r) => r.id === selected) ??
    cp.planes.flatMap((p) => p.items).find((i) => i.id === selected) ??
    null
  );
}

function WheelScene({
  wheel,
  onSelect,
  selected,
  filters,
}: {
  wheel: ClusterWheel;
  onSelect: (id: string) => void;
  selected: string | null;
  filters: FilterState;
}) {
  const ringPoints: [number, number, number][] = Array.from({ length: 65 }, (_, i) => {
    const a = (2 * Math.PI * i) / 64;
    return [wheel.outerRadius * Math.cos(a), 0, wheel.outerRadius * Math.sin(a)];
  });
  const csiRingRadius = wheel.csiRingRadius;

  // Namespace/label/annotation scope filters are ANDed with the existing category toggles below — an item
  // must pass both to render.
  const visiblePods = wheel.pods.filter((p) => podPassesFilter(p, filters) && passesScopeFilters(p, filters));
  // Endpoints/EndpointSlice ride along with the "Network (Endpoint, Service)" filter row — they're the same
  // category, just one hop further up the stack. PV/StorageClass ride along with "Storage (PVC, PV,
  // StorageClass)" the same way, one/two hops further down.
  const visibleNetwork = filters.showNetwork ? wheel.network.items.filter((i) => passesScopeFilters(i, filters)) : [];
  const visibleEndpoints = filters.showNetwork ? wheel.endpoints.items.filter((i) => passesScopeFilters(i, filters)) : [];
  // Ingress/HTTPRoute get their own filter row (not tied to Network) — they're a distinct category in the
  // legacy filter legend, with their own swatch color, even though they anchor off the same Service position.
  const visibleIngress = filters.showIngress ? wheel.ingress.items.filter((i) => passesScopeFilters(i, filters)) : [];
  const visibleStorage = filters.showStorage ? wheel.storage.items.filter((i) => passesScopeFilters(i, filters)) : [];
  // PV/StorageClass/VolumeAttachment sit two-to-three hops from a Pod (Pod -> PVC -> PV -> SC/VA) — trace that
  // chain and only show one of these if it's actually reachable from a Pod that's currently visible, not just
  // its own category+scope filters. This way filtering pods (by status/namespace/label) also declutters
  // whatever hangs off their PVC, instead of leaving orphaned PV/SC/VA items with no visible pod behind them.
  const visiblePodIds = new Set(visiblePods.map((p) => p.id));
  const pvcIdsFromVisiblePod = new Set(wheel.podToStorage.filter((e) => visiblePodIds.has(e.podId)).map((e) => e.itemId));
  const pvIdsFromVisiblePod = new Set(wheel.storageToPv.filter((e) => pvcIdsFromVisiblePod.has(e.fromId)).map((e) => e.toId));
  const scIdsFromVisiblePod = new Set(wheel.pvToStorageClass.filter((e) => pvIdsFromVisiblePod.has(e.fromId)).map((e) => e.toId));
  const vaIdsFromVisiblePod = new Set(wheel.pvToVolumeAttachment.filter((e) => pvIdsFromVisiblePod.has(e.fromId)).map((e) => e.toId));
  const visiblePv = filters.showStorage
    ? wheel.persistentVolumes.items.filter((i) => passesScopeFilters(i, filters) && pvIdsFromVisiblePod.has(i.id))
    : [];
  const visibleStorageClasses = filters.showStorage
    ? wheel.storageClasses.items.filter((i) => passesScopeFilters(i, filters) && scIdsFromVisiblePod.has(i.id))
    : [];
  const visibleVolumeAttachments = filters.showStorage
    ? wheel.volumeAttachments.items.filter((i) => passesScopeFilters(i, filters) && vaIdsFromVisiblePod.has(i.id))
    : [];
  const visibleCsiDrivers = filters.showCsi ? wheel.csiDrivers.items.filter((i) => passesScopeFilters(i, filters)) : [];
  const visibleCsiNodeDrivers = filters.showCsi ? wheel.csiNodeDrivers : [];
  const visibleLocalStorage = filters.showStorage ? wheel.localStorage : [];
  const visibleNodes = filters.showNodes ? wheel.nodes : [];

  // Resource CPU & Memory bars: each category's max is taken over the currently-VISIBLE set only, so the
  // tallest bar in a group always uses the full up-to-Ingress (or down-to-VolumeAttachment) range regardless
  // of what else is filtered out — a fixed universal scale would make every bar a sliver once filtered down.
  const nodeCpuMax = Math.max(0, ...visibleNodes.map((n) => n.cpuCapacity ?? 0));
  const nodeMemMax = Math.max(0, ...visibleNodes.map((n) => n.memCapacityBytes ?? 0));
  // Unlike the CPU/Memory bars (attached to the Node box itself, so they disappear along with it), the
  // storage bar hangs off the local-storage cylinder, which is gated by Storage's own toggle, not Nodes' — so
  // its scale shouldn't collapse to zero just because Nodes happens to be toggled off.
  const nodeStorageMax = Math.max(0, ...wheel.nodes.map((n) => n.ephemeralStorageCapacityBytes ?? 0));
  const podCpuMax = Math.max(0, ...visiblePods.map((p) => p.cpuRequested ?? 0));
  const podMemMax = Math.max(0, ...visiblePods.map((p) => p.memRequestedBytes ?? 0));

  const byId = useMemo(() => {
    const map = new Map<string, WheelPoint>();
    for (const p of visiblePods) map.set(p.id, p);
    for (const item of visibleNetwork) map.set(item.id, item);
    for (const item of visibleEndpoints) map.set(item.id, item);
    for (const item of visibleIngress) map.set(item.id, item);
    for (const item of visibleStorage) map.set(item.id, item);
    for (const item of visiblePv) map.set(item.id, item);
    for (const item of visibleStorageClasses) map.set(item.id, item);
    for (const item of visibleVolumeAttachments) map.set(item.id, item);
    for (const item of visibleCsiDrivers) map.set(item.id, item);
    return map;
  }, [wheel, filters]);

  const csiChainsByNode = useMemo(() => {
    const byNode = new Map<string, WheelCsiNodeDriver[]>();
    for (const d of visibleCsiNodeDrivers) {
      const list = byNode.get(d.nodeId) ?? [];
      list.push(d);
      byNode.set(d.nodeId, list);
    }
    for (const list of byNode.values()) list.sort((a, b) => b.y - a.y); // closest-to-node first
    return byNode;
  }, [wheel, filters]);

  // The exact dot last clicked, so the selection ring can land on it specifically — see findWheelSelection's
  // comment on why a plain id lookup can't tell two of the same Node's driver dots apart.
  const [clickedCsiDot, setClickedCsiDot] = useState<WheelCsiNodeDriver | null>(null);

  const selection = findWheelSelection(wheel, selected, clickedCsiDot);

  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(ringPoints.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#da8c84" transparent opacity={0.5} />
      </line>
      {filters.showNodes &&
        wheel.nodes.map((n) => {
          // Rotate the box so one face is perpendicular to the line from the wheel's center to the node — the
          // radial line hits that face at a true 90 degrees, rather than the box sitting at whatever fixed
          // world-axis orientation it happened to have.
          const angle = Math.atan2(n.z, n.x);
          return (
            <mesh
              key={n.id}
              position={[n.x, 0.3, n.z]}
              rotation={[0, -angle, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
              }}
            >
              <boxGeometry args={[0.7, 0.6, 0.7]} />
              <meshBasicMaterial color={n.color} />
            </mesh>
          );
        })}
      {visibleNodes.map((n) => {
        // Kubelet/Kube-Proxy sit dead-center on the node's own column (controlPlane.ts gives them no x/z
        // offset at all) — tangentOffset alone only nudges the two bars sideways from that same center, so
        // they'd still cross straight through it. Starting from the node's OUTER edge (nodeOutwardXZ, already
        // used for the local-storage connector) instead of its center pushes both bars clear of that column.
        const edge = nodeOutwardXZ(n);
        const cpu = tangentOffset(edge.x, edge.z, -METRIC_BAR_OFFSET);
        const mem = tangentOffset(edge.x, edge.z, METRIC_BAR_OFFSET);
        return (
          <group key={`node-metrics-${n.id}`}>
            {filters.showNodeCpuBar && (
              <MetricBar
                id={n.id}
                x={cpu.x}
                z={cpu.z}
                baseY={NODE_BOX_HEIGHT}
                direction={1}
                height={metricBarHeight(n.cpuCapacity, nodeCpuMax, INGRESS_Y - NODE_BOX_HEIGHT)}
                color={METRIC_COLORS.nodeCpu}
                onSelect={onSelect}
              />
            )}
            {filters.showNodeMemoryBar && (
              <MetricBar
                id={n.id}
                x={mem.x}
                z={mem.z}
                baseY={NODE_BOX_HEIGHT}
                direction={1}
                height={metricBarHeight(n.memCapacityBytes, nodeMemMax, INGRESS_Y - NODE_BOX_HEIGHT)}
                color={METRIC_COLORS.nodeMemory}
                onSelect={onSelect}
              />
            )}
          </group>
        );
      })}
      {visiblePods.map((p) => (
        <PodHex key={p.id} p={p} size={0.1} onSelect={onSelect} />
      ))}
      {visiblePods.map((p) => {
        const cpu = tangentOffset(p.x, p.z, -METRIC_BAR_OFFSET);
        const mem = tangentOffset(p.x, p.z, METRIC_BAR_OFFSET);
        return (
          <group key={`pod-metrics-${p.id}`}>
            {filters.showPodCpuBar && (
              <MetricBar
                id={p.id}
                x={cpu.x}
                z={cpu.z}
                baseY={p.y}
                direction={1}
                height={metricBarHeight(p.cpuRequested, podCpuMax, INGRESS_Y)}
                color={METRIC_COLORS.podCpu}
                onSelect={onSelect}
              />
            )}
            {filters.showPodMemoryBar && (
              <MetricBar
                id={p.id}
                x={mem.x}
                z={mem.z}
                baseY={p.y}
                direction={1}
                height={metricBarHeight(p.memRequestedBytes, podMemMax, INGRESS_Y)}
                color={METRIC_COLORS.podMemory}
                onSelect={onSelect}
              />
            )}
          </group>
        );
      })}
      {visibleNetwork.map((item) => (
        <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} />
      ))}
      {wheel.podToNetwork.map((e) => {
        const a = byId.get(e.podId);
        const b = byId.get(e.itemId);
        return a && b ? <ElbowLine key={`${e.podId}|${e.itemId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visibleEndpoints.map((item) => (
        <Dot key={item.id} p={item} size={0.1} onSelect={onSelect} />
      ))}
      {wheel.serviceToEndpoints.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visibleIngress.map((item) => (
        <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} />
      ))}
      {wheel.serviceToIngress.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`ingress-${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visibleStorage.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} />
      ))}
      {wheel.podToStorage.map((e) => {
        const a = byId.get(e.podId);
        const b = byId.get(e.itemId);
        return a && b ? <LinkLine key={`${e.podId}|${e.itemId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visiblePv.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} />
      ))}
      {wheel.storageToPv.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visibleStorageClasses.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} />
      ))}
      {wheel.pvToStorageClass.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visibleVolumeAttachments.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} />
      ))}
      {wheel.pvToVolumeAttachment.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {filters.showCsi && <CsiRing radius={csiRingRadius} y={CSI_RING_Y} />}
      {visibleCsiDrivers.map((item) => (
        <Dot key={item.id} p={item} size={0.1} onSelect={onSelect} />
      ))}
      {wheel.storageClassToCsiDriver.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        // Full opacity — the CSI subsystem's own lines shouldn't fade into the generic pod/tier link lines.
        return a && b ? <LinkLine key={`sc-driver-${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} opacity={1} /> : null;
      })}
      {wheel.volumeAttachmentToCsiDriver.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        // Same "own subsystem, full opacity" treatment as storageClassToCsiDriver just above — a
        // VolumeAttachment names its driver directly (spec.attacher), independent of its PV's StorageClass.
        return a && b ? <LinkLine key={`va-driver-${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} opacity={1} /> : null;
      })}
      {visibleCsiDrivers.map((item) => {
        // "another connecting line up to the red cylinder [ring] that is outside of the server nodes" — the
        // ring has no single point to link to, so this connects to the point on the ring at the driver's own
        // angle, same technique the node ring itself uses to place nodes.
        const angle = Math.atan2(item.z, item.x);
        const ringAnchor: WheelPoint = {
          id: `${item.id}-ring`,
          name: item.name,
          x: csiRingRadius * Math.cos(angle),
          y: CSI_RING_Y,
          z: csiRingRadius * Math.sin(angle),
          color: item.color,
        };
        return <LinkLine key={`driver-ring-${item.id}`} a={item} b={ringAnchor} color={item.color} opacity={1} />;
      })}
      {visibleCsiNodeDrivers.map((d) => (
        <Dot
          key={`${d.id}-${d.x.toFixed(3)}-${d.y.toFixed(3)}`}
          p={d}
          size={0.06}
          onSelect={(id) => {
            setClickedCsiDot(d);
            onSelect(id);
          }}
        />
      ))}
      {[...csiChainsByNode.entries()].map(([nodeId, dots]) => {
        const n = wheel.nodes.find((nd) => nd.id === nodeId);
        if (!n || dots.length === 0) return null;
        const color = dots[0]!.color;
        const angle = Math.atan2(n.z, n.x);
        // A plain straight vertical drop from the node's own center through every driver dot — all of them
        // sit below the ring's own Y, so this line passes straight through the ring's height on its way down.
        const chainPoints: [number, number, number][] = [[n.x, 0, n.z], ...dots.map((d): [number, number, number] => [d.x, d.y, d.z])];
        // A separate horizontal segment, at the ring's own Y, from the ring straight in to that same vertical
        // line — a real 90-degree T-intersection with the chain, sitting ABOVE every driver dot (since they're
        // all below CSI_RING_Y), not a bend at the bottom of the chain.
        const ringConnector: [number, number, number][] = [
          [csiRingRadius * Math.cos(angle), CSI_RING_Y, csiRingRadius * Math.sin(angle)],
          [n.x, CSI_RING_Y, n.z],
        ];
        return (
          <group key={`csi-chain-${nodeId}`}>
            <PolyLine points={chainPoints} color={color} opacity={0.9} />
            <PolyLine points={ringConnector} color={color} opacity={0.9} />
          </group>
        );
      })}
      {visibleLocalStorage.map((ls) => (
        <StorageCylinder
          key={`local-storage-${ls.nodeId}`}
          p={ls}
          onSelect={(id) => onSelect(localStorageSelectionId(id))}
        />
      ))}
      {filters.showNodeStorageBar &&
        visibleLocalStorage.map((ls) => {
          const n = wheel.nodes.find((nd) => nd.id === ls.nodeId);
          return (
            <MetricBar
              key={`local-storage-bar-${ls.nodeId}`}
              id={ls.nodeId}
              x={ls.x}
              z={ls.z}
              baseY={ls.y}
              direction={-1}
              height={metricBarHeight(n?.ephemeralStorageCapacityBytes, nodeStorageMax, ls.y - VOLUME_ATTACHMENT_Y)}
              color={METRIC_COLORS.nodeStorage}
              onSelect={onSelect}
            />
          );
        })}
      {visibleLocalStorage.map((ls) => {
        const n = wheel.nodes.find((nd) => nd.id === ls.nodeId);
        if (!n) return null;
        // Leaves from the node's outward face (the side furthest from the wheel center) — its own distinct
        // point, separate from the CSINode chain's plain center-line start. A real right-angle elbow (straight
        // out, then straight down) — not ElbowLine's diagonal shape.
        const anchor = nodeOutwardXZ(n);
        const points: [number, number, number][] = [
          [anchor.x, 0, anchor.z],
          [anchor.x, ls.y, anchor.z],
          [ls.x, ls.y, ls.z],
        ];
        return <PolyLine key={`local-storage-line-${ls.nodeId}`} points={points} color="#c9c9c9" />;
      })}
      {filters.showControlPlane && (
        <>
          <ControlPlaneRing radius={wheel.controlPlane.radius} y={wheel.controlPlane.y} height={wheel.controlPlane.height} onSelect={onSelect} />
          {wheel.controlPlane.kubelets.map((k) => (
            <Dot key={k.id} p={k} size={0.09} onSelect={onSelect} />
          ))}
          {wheel.controlPlane.kubeProxies.map((k) => (
            <Dot key={k.id} p={k} size={0.09} onSelect={onSelect} />
          ))}
          {wheel.controlPlane.kubelets.map((k) => {
            const n = wheel.nodes.find((nd) => nd.id === k.nodeId);
            if (!n) return null;
            const angle = Math.atan2(n.z, n.x);
            const ringTopY = wheel.controlPlane.y + wheel.controlPlane.height / 2;
            // Straight up the node's own center (passing through Kube-Proxy on the way to Kubelet's height),
            // then out to the ring's radius, then a short drop to the ring's own top — the same 3-segment
            // shape the legacy app draws to visually tie every node's Kubelet+Kube-Proxy to the Control Plane.
            const points: [number, number, number][] = [
              [n.x, 0, n.z],
              [n.x, k.y, n.z],
              [wheel.controlPlane.radius * Math.cos(angle), k.y, wheel.controlPlane.radius * Math.sin(angle)],
              [wheel.controlPlane.radius * Math.cos(angle), ringTopY, wheel.controlPlane.radius * Math.sin(angle)],
            ];
            return <PolyLine key={`kubelet-link-${k.nodeId}`} points={points} color={CONTROL_PLANE_COLOR} opacity={0.6} />;
          })}
          {wheel.controlPlane.components.map((c) => (
            <Dot key={c.id} p={c} size={0.14} onSelect={onSelect} />
          ))}
          {wheel.controlPlane.components.map((c) => {
            const angle = Math.atan2(c.z, c.x);
            const ringAnchor: WheelPoint = {
              id: `${c.id}-ring`,
              name: c.title,
              x: wheel.controlPlane.radius * Math.cos(angle),
              y: 0,
              z: wheel.controlPlane.radius * Math.sin(angle),
              color: c.color,
            };
            return <LinkLine key={`component-ring-${c.id}`} a={ringAnchor} b={c} color={c.color} opacity={0.8} />;
          })}
          <Dot p={wheel.controlPlane.kubectl} size={0.16} onSelect={onSelect} />
          {(() => {
            const apiServer = wheel.controlPlane.components.find((c) => c.title === 'API Server');
            return apiServer ? <LinkLine a={apiServer} b={wheel.controlPlane.kubectl} color={CONTROL_PLANE_COLOR} opacity={0.7} /> : null;
          })()}
          {wheel.controlPlane.imageRegistries.map((r) => (
            <StorageCylinder key={r.id} p={r} onSelect={onSelect} />
          ))}
          {wheel.controlPlane.imageRegistries.length > 0 &&
            (() => {
              const top = wheel.controlPlane.imageRegistries[0] as WheelInfoItem;
              const angle = Math.atan2(top.z, top.x);
              const ringAnchor: WheelPoint = {
                id: 'registry-ring-anchor',
                name: 'registry-anchor',
                x: wheel.controlPlane.radius * Math.cos(angle),
                y: 0,
                z: wheel.controlPlane.radius * Math.sin(angle),
                color: top.color,
              };
              return <LinkLine a={ringAnchor} b={top} color={top.color} opacity={0.7} />;
            })()}
        </>
      )}
      {PANES.map((p) => {
        const plane = wheel.controlPlane.planes.find((pl) => pl.name === p.name);
        if (!plane || !filters[p.key]) return null;
        return (
          <group key={p.name}>
            <PlaneWall plane={plane} />
            {plane.items.map((item) => (
              <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} />
            ))}
          </group>
        );
      })}
      {selection && <SelectionRing {...selection} />}
    </>
  );
}

function WheelLegend({ wheel }: { wheel: ClusterWheel | null }) {
  if (!wheel) return null;
  const tiers = [
    wheel.network,
    wheel.endpoints,
    wheel.ingress,
    wheel.storage,
    wheel.persistentVolumes,
    wheel.storageClasses,
    wheel.volumeAttachments,
    wheel.csiDrivers,
  ];
  const capped = tiers.some((t) => t.items.length < t.totalCount);
  if (!capped) return null;
  return (
    <div
      className="absolute bottom-2 left-2 rounded px-2 py-1 text-xs"
      style={{ background: 'var(--vpk-surface)', color: 'var(--vpk-fg-muted)', border: '1px solid var(--vpk-border)' }}
    >
      showing {wheel.network.items.length}/{wheel.network.totalCount} services · {wheel.endpoints.items.length}/{wheel.endpoints.totalCount} endpoints
      · {wheel.ingress.items.length}/{wheel.ingress.totalCount} ingress · {wheel.storage.items.length}/{wheel.storage.totalCount} storage ·{' '}
      {wheel.persistentVolumes.items.length}/{wheel.persistentVolumes.totalCount} PVs · {wheel.storageClasses.items.length}/
      {wheel.storageClasses.totalCount} storage classes · {wheel.volumeAttachments.items.length}/{wheel.volumeAttachments.totalCount} volume
      attachments · {wheel.csiDrivers.items.length}/{wheel.csiDrivers.totalCount} CSI drivers
    </div>
  );
}

type Mode = 'field' | 'wheel';

/**
 * 3D hero view (DESIGN §6.8), scaling model: field (all nodes, flat grid) -> wheel (small-N radial layout with
 * network/endpoints/storage tiers) -> pill/single-node (not built yet). Toggle between the two built modes.
 */
export function Scene3D({
  onSelect,
  active,
  selected,
  onOpenEditor,
  onViewSchematic,
  onViewOwnerRef,
  onSearchKind,
  onViewRepository,
  snapshotKey,
}: {
  onSelect: (id: string) => void;
  active: boolean;
  selected: string | null;
  onOpenEditor: () => void;
  onViewSchematic: () => void;
  /** Jumps to the OwnerRef view focused on whatever's currently selected, when it has owner links. */
  onViewOwnerRef: (id: string) => void;
  /** A resource-pane sphere's Properties popup routes "view all instances" through Search rather than opening
   *  one specific instance's editor (there IS no single instance — the sphere stands for the whole Kind). */
  onSearchKind: (kind: string) => void;
  /** The green image-registry stack's Properties popup routes here instead — the Container Images page,
   *  scoped to this registry hostname. */
  onViewRepository: (registry: string) => void;
  snapshotKey: string;
}) {
  const [mode, setMode] = useState<Mode>('field');
  const [wheel, setWheel] = useState<ClusterWheel | null>(null);
  // Separate from `selected`/the ring: a 3D click shows the small Properties popup first (matching the
  // legacy app), not the full editor — the editor only opens when the popup's own button is clicked.
  const [propsOpen, setPropsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // Lazy initializer: reads the user's saved default (if any) exactly once, at mount — not on every render.
  const [filters, setFilters] = useState<FilterState>(() => loadDefaultFilters());

  function handleSelect(id: string) {
    onSelect(id);
    setPropsOpen(true);
    if (filters.playSound) playSelectSound();
  }

  // Distinct namespaces across pods + every tier item, for the filter panel's Namespace select — recomputed
  // only when the wheel itself changes, not on every filter tweak.
  const namespaces = useMemo(() => {
    if (!wheel) return [];
    const set = new Set<string>();
    for (const p of wheel.pods) if (p.namespace) set.add(p.namespace);
    const tiers = [
      wheel.network,
      wheel.endpoints,
      wheel.ingress,
      wheel.storage,
      wheel.persistentVolumes,
      wheel.storageClasses,
      wheel.volumeAttachments,
      wheel.csiDrivers,
    ];
    for (const t of tiers) for (const item of t.items) if (item.namespace) set.add(item.namespace);
    return [...set].sort();
  }, [wheel]);

  // Which resource panes actually have a Kind present in THIS snapshot — a pane with nothing in it is never
  // sent at all (see controlPlane.ts), so the filter panel's pane checkboxes mirror that instead of always
  // listing all 10 regardless of what's really in the cluster.
  const presentPanes = useMemo(() => wheel?.controlPlane.planes.map((p) => p.name) ?? [], [wheel]);

  // Invalidate the cached wheel whenever the snapshot changes, then let the effect below refetch it — Scene3D
  // never unmounts (see FieldScene's fetch comment above for why that matters here specifically). Without
  // this, switching snapshots leaves the wheel showing the PREVIOUS snapshot's resource ids, which then 404
  // when clicked against the new one.
  useEffect(() => {
    setWheel(null);
    setPropsOpen(false);
  }, [snapshotKey]);

  useEffect(() => {
    if (mode !== 'wheel' || wheel) return;
    fetch('/scene/wheel')
      .then((r) => r.json() as Promise<ClusterWheel>)
      .then(setWheel)
      .catch(() => setWheel(null));
  }, [mode, wheel]);

  return (
    // Kept mounted (visibility toggle, not conditional render) so there's ever only one WebGL context and
    // switching views doesn't tear down / recreate the canvas (DESIGN.md 3D lifecycle: resident-paused).
    <div className="relative h-full w-full" style={{ display: active ? 'block' : 'none' }}>
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        {(
          [
            ['field', 'Field'],
            ['wheel', 'Wheel'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className="rounded border px-2 py-1 text-xs cursor-pointer"
            style={{
              borderColor: 'var(--vpk-border)',
              background: mode === id ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
              color: mode === id ? '#fff' : 'var(--vpk-fg)',
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className="rounded border px-2 py-1 text-xs cursor-pointer"
          style={{
            borderColor: 'var(--vpk-border)',
            background: filterOpen ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
            color: filterOpen ? '#fff' : 'var(--vpk-fg)',
          }}
        >
          Filter
        </button>
      </div>
      {mode === 'wheel' && <WheelLegend wheel={wheel} />}
      {filterOpen && (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
          namespaces={namespaces}
          presentPanes={presentPanes}
        />
      )}
      <PropertiesPanel
        resourceId={propsOpen ? selected : null}
        info={propsOpen ? findWheelInfoItem(wheel, selected) : null}
        onOpenEditor={onOpenEditor}
        onViewSchematic={onViewSchematic}
        onViewOwnerRef={onViewOwnerRef}
        onSearchKind={onSearchKind}
        onViewRepository={onViewRepository}
        onClose={() => setPropsOpen(false)}
      />
      <Canvas camera={{ position: mode === 'wheel' ? [0, 10, 22] : [4, 4, 8], fov: 50 }} style={{ background: 'var(--vpk-bg)' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} />
        {mode === 'field' ? (
          <FieldScene onSelect={handleSelect} selected={selected} filters={filters} snapshotKey={snapshotKey} />
        ) : wheel ? (
          <WheelScene wheel={wheel} onSelect={handleSelect} selected={selected} filters={filters} />
        ) : null}
        <gridHelper args={[40, 40, '#d9d9d5', '#e8e8e5']} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
