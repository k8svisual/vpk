import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, type MaterialNode } from '@react-three/fiber';
import { Line, OrbitControls, Text, Sky, Stars, shaderMaterial } from '@react-three/drei';
import { Color, DoubleSide, type ShaderMaterial } from 'three';
import { SKY_CONFIG, FOG_COLOR } from './skyConfig';
import type { Theme } from './theme';
import { PropertiesPanel, localStorageSelectionId } from './PropertiesPanel';
import { FilterPanel, loadDefaultFilters, METRIC_COLORS, PANES, type FilterState } from './FilterPanel';
import { resolveStructuralColor, defaultStructuralColor, type StructuralColorKey } from './structuralColorOverrides';
import { NodeFilterPanel, DEFAULT_NODE_FILTERS, nodePassesFilter, type NodeFilterState } from './NodeFilterPanel';
import { TimelapseControls } from './TimelapseControls';
import { TimelapseFilterPanel } from './TimelapseFilterPanel';
import {
  buildIntervals,
  visibleIdsAtInterval,
  changesInInterval,
  defaultTimelapseCategoryFilters,
  type TimelapseCategoryFilters,
} from './timelapse';
import { resolveKindColor } from './kindColorOverrides';
import { resolveApiGroupColor } from './apiGroupColorOverrides';

interface SceneNode {
  id: string;
  name: string;
  cpuCapacity?: number;
  cpuAllocatable?: number;
  memCapacityBytes?: number;
  memAllocatableBytes?: number;
  podCapacity?: number;
  podAllocatable?: number;
  ephemeralStorageCapacityBytes?: number;
  ephemeralStorageAllocatableBytes?: number;
  podCount: number;
  health: 'ok' | 'warn' | 'error';
  unschedulable: boolean;
  role: 'master' | 'worker';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  taints: { key: string; value?: string; effect: string }[];
  architecture?: string;
  operatingSystem?: string;
  osImage?: string;
  kernelVersion?: string;
  kubeletVersion?: string;
  kubeProxyVersion?: string;
  containerRuntimeVersion?: string;
}

// Mirrors @vpk/core's podStatus.ts ROLE_COLOR — same master/worker shades the Wheel view's node dots use
// (there, computed server-side via nodeRoleColor and sent as `color`; here, the Field view needs its own
// client-side copy since it renders straight from `/scene/nodes` role data instead of a pre-colored point).
const ROLE_COLOR: Record<SceneNode['role'], string> = {
  master: '#8b2e2e',
  worker: '#9aa1a8',
};

// Matches the Wheel/Filter panel's own Running/Failed pod colors (FilterPanel.tsx POD_ROWS) — a node's
// included/excluded border reads as "green = passes, red = doesn't" using the same vocabulary the rest of the
// app already uses for pass/fail, not a new ad-hoc color pair.
const NODE_INCLUDED_COLOR = '#2e9e4f';
const NODE_EXCLUDED_COLOR = '#c0392b';

// Node cube footprint (nodeBoxWidth) maxes out at 3 (half-width 1.5 per side) for a high-CPU node. 10.5 is
// triple the previous 3.5 spacing (itself already enough to clear the widest-node worst case with a visible
// gap) — a deliberately roomy grid, not just "not touching."
const GRID_GAP = 10.5;
// Extra room past the outermost node/item before the ground grid's own edge — without this, an item sitting
// exactly at the computed extent would have its far edge flush with (or just past) the last grid line, not
// visibly "inside" it.
const GRID_MARGIN = 6;

/** Half-width/depth FieldScene's own node layout actually needs, mirroring its `cols`/`positions` math exactly
 *  (same GRID_GAP, same cols-from-sqrt formula) — used by Scene3D's outer ground grid so it's sized from the
 *  SAME formula FieldScene lays nodes out with, not a second, driftable copy of it. Nodes are laid out with X
 *  centered on 0 but Z only ever growing positive (`row * GRID_GAP`, no centering offset), so this returns the
 *  larger of the two half-extents — good enough for a square/round grid to always cover both axes. */
function fieldGridExtent(nodeCount: number): number {
  if (nodeCount === 0) return 20;
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodeCount)));
  const rows = Math.ceil(nodeCount / cols);
  const halfWidth = ((cols - 1) * GRID_GAP) / 2;
  const depth = (rows - 1) * GRID_GAP;
  return Math.max(halfWidth, depth) + GRID_MARGIN;
}

// The Wheel's furthest-out items (kubectl / image-registry stack) sit at outerRadius + up to ~7.5 (see
// @vpk/core's controlPlane.ts CONTROL_PLANE_RADIUS_OFFSET+KUBECTL_RADIUS_OFFSET) — this buffer covers that
// without duplicating those exact constants here (which would silently drift if core's ever retuned).
const WHEEL_GRID_RADIUS_BUFFER = 12;

// Fallback used only as PulseRingMaterial's module-level default uColor (immediately overridden by the
// `color` prop at every actual SelectionRing call site below) — real ring colors are per-theme, see RING_COLORS.
const SELECTION_RING_COLOR = '#e63946';

/** Per-theme ring palette (selection = primary red ring, replica = "Show replica" siblings, associated = a
 *  selected Pod's connected Node/Services/storage lineage) — same "resolved in JS since Three.js materials
 *  aren't CSS" reasoning as SKY_CONFIG/FOG_COLOR in skyConfig.ts. A flat color that reads well against Light's
 *  pale sky can vanish or clash against Dark's near-black backdrop or Forest/Ocean's green/blue-heavy scenes,
 *  so each theme gets its own tuned set instead of one fixed hex reused everywhere:
 *  - dark: selection brightened (plain crimson dims into near-black '#05070c'); replica lightened for the
 *    same reason (dark grey is nearly invisible against a near-black background).
 *  - forest/ocean: associated switches from cyan to magenta — cyan sits too close in hue to forest's green
 *    backdrop and ocean's blue-heavy horizon to read as a distinct highlight there.
 */
const RING_COLORS: Record<Theme, { selection: string; replica: string; associated: string }> = {
  light: { selection: '#e63946', replica: '#4a4a4a', associated: '#00f5d4' },
  dark: { selection: '#ff4d5e', replica: '#b0b0b0', associated: '#00f5d4' },
  forest: { selection: '#e63946', replica: '#4a4a4a', associated: '#ff2fd4' },
  ocean: { selection: '#e63946', replica: '#4a4a4a', associated: '#ff2fd4' },
};
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
  visible = true,
}: {
  x: number;
  z: number;
  baseY: number;
  height: number;
  direction: 1 | -1;
  color: string;
  onSelect: (id: string) => void;
  id: string;
  visible?: boolean;
}) {
  if (height <= 0) return null;
  const centerY = baseY + (direction * height) / 2;
  return (
    <mesh
      visible={visible}
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

/** Custom shader (this file's one hand-written GLSL material, see the "shaders" exploration in chat) driving
 *  every pulsing selection marker (primary selection, "Show replica" siblings, a selected Pod's associated
 *  components) — a sine wave on `uTime` (advanced every frame via useFrame below) modulates alpha AND the
 *  color's own brightness (not just alpha — a flat-opacity pulse read as too subtle per direct feedback), so
 *  the marker visibly glows/breathes rather than sitting at one flat brightness. Normal-based (not UV-based,
 *  unlike an earlier version of this shader written for the old flat RingGeometry): a rim term brightens
 *  whichever part of the surface faces most away from the camera, which works correctly on ANY geometry this
 *  gets applied to — specifically the torus SelectionRing now uses instead of a flat ring, for real 3D
 *  volume ("donut", not a flat disc) per the same feedback. */
const PulseRingMaterial = shaderMaterial(
  { uTime: 0, uColor: new Color(SELECTION_RING_COLOR) },
  `varying vec3 vNormal;
   void main() {
     vNormal = normalize(normalMatrix * normal);
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,
  `uniform float uTime;
   uniform vec3 uColor;
   varying vec3 vNormal;
   void main() {
     float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
     float rim = 0.6 + 0.4 * pow(1.0 - abs(vNormal.z), 1.5);
     float alpha = mix(0.5, 1.0, pulse) * rim;
     vec3 glow = uColor * mix(1.0, 1.8, pulse);
     gl_FragColor = vec4(glow, alpha);
   }`,
);
extend({ PulseRingMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    pulseRingMaterial: MaterialNode<ShaderMaterial & { uTime: number; uColor: Color }, [{ uColor?: Color }]>;
  }
}

/** meshStandardMaterial alone (tried previously — see the removed "Unlit" comment this replaces) washes a
 *  shape's shaded side to near-grey, because its diffuse term is entirely light-dependent: turn away from the
 *  directional light and the color just isn't there anymore. Setting `emissive` to the SAME color at a modest
 *  intensity gives every shape a light-INDEPENDENT color floor (its own hue always shows, lit or not), while
 *  the standard diffuse+specular terms still layer real shading and highlights on top — enough to read as a
 *  solid volume instead of a flat color disc, without the legend-destroying washout. Used for every small
 *  discrete resource shape (tier spheres, pod pucks, storage cylinders, node boxes) that used to be
 *  meshBasicMaterial. */
function ColoredMaterial({ color }: { color: string }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.55} metalness={0.05} />;
}

/** Fresnel/rim-lit demo material (see the "shaders" exploration in chat, item 2) — NOT used elsewhere yet,
 *  applied here only to Field's NodeBox as a live, screenshottable trial. Half-lambert diffuse (`base`, floored
 *  at 0.5 so the shaded side dims rather than blacks out) gives real volume; the `fresnel` term brightens edges
 *  facing away from the camera (classic rim-light look — the viewer sees more "graze" at silhouette edges than
 *  face-on), which is what actually reads as "roundness" on a box or sphere alike. `uHighlight` swaps in for
 *  NodeBox's old opacity-based hover feedback (opacity/alpha blending doesn't mix cleanly with a fully custom
 *  fragment shader) — hovering brightens the diffuse floor and intensifies the rim instead of fading the shape. */
const RimLitMaterial = shaderMaterial(
  { uColor: new Color('#888888'), uHighlight: 0 },
  `varying vec3 vWorldNormal;
   varying vec3 vWorldPosition;
   void main() {
     vec4 worldPosition = modelMatrix * vec4(position, 1.0);
     vWorldPosition = worldPosition.xyz;
     vWorldNormal = normalize(mat3(modelMatrix) * normal);
     gl_Position = projectionMatrix * viewMatrix * worldPosition;
   }`,
  `uniform vec3 uColor;
   uniform float uHighlight;
   varying vec3 vWorldNormal;
   varying vec3 vWorldPosition;
   void main() {
     vec3 viewDir = normalize(cameraPosition - vWorldPosition);
     vec3 lightDir = normalize(vec3(5.0, 8.0, 5.0));
     float diffuse = max(dot(vWorldNormal, lightDir), 0.0);
     float base = 0.5 + 0.5 * diffuse;
     float fresnel = pow(1.0 - max(dot(vWorldNormal, viewDir), 0.0), 2.5);
     vec3 finalColor = uColor * base * (1.0 + uHighlight * 0.35) + vec3(1.0) * fresnel * (0.6 + uHighlight * 0.4);
     gl_FragColor = vec4(finalColor, 1.0);
   }`,
);
extend({ RimLitMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    rimLitMaterial: MaterialNode<ShaderMaterial & { uColor: Color; uHighlight: number }, [{ uColor?: Color; uHighlight?: number }]>;
  }
}

/** Persistent selection marker: a torus (real 3D "donut" volume, not a flat disc — per direct feedback that
 *  the previous flat RingGeometry version read as too flat) lying in the XZ plane (parallel to the wheel/grid
 *  plane, same orientation as the outer node ring) that dissects the selected item at its own height —
 *  independent of whether its definition modal is open, so it stays lit after the modal closes and moves when
 *  selection changes. `color` defaults to the usual red, but every call site passes an explicit per-theme
 *  color from RING_COLORS instead (selection/replica/associated) — every selection marker pulses, so a
 *  static one next to a pulsing one never looks broken. */
function SelectionRing({ x, y, z, radius, color = SELECTION_RING_COLOR }: { x: number; y: number; z: number; radius: number; color?: string }) {
  const material = useRef<ShaderMaterial & { uTime: number; uColor: Color }>(null);
  useFrame(({ clock }) => {
    if (material.current) material.current.uTime = clock.elapsedTime;
  });
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <torusGeometry args={[radius * 0.86, radius * 0.14, 12, 40]} />
      <pulseRingMaterial ref={material} uColor={new Color(color)} transparent side={DoubleSide} depthTest={false} />
    </mesh>
  );
}

/** Footprint half-width used both to size the node box and to size its selection ring consistently. */
function nodeBoxWidth(node: SceneNode): number {
  return 1 + Math.min(2, (node.cpuCapacity ?? 1) / 8);
}

/** All 12 edges of a `width` x `height` x `width` box, centered on its own local origin, as consecutive
 *  point pairs — one pair per segment (drei's `<Line segments>` draws every (2i, 2i+1) pair as its own
 *  disconnected line, which is what actually outlines all SIX faces; a single closed polyline can't do that,
 *  and drei's `<Outlines>` component only traces the silhouette — the outer boundary of whichever faces
 *  happen to be visible from the camera, not the edges BETWEEN them). */
function boxEdgePoints(width: number, height: number): [number, number, number][] {
  const hx = width / 2;
  const hy = height / 2;
  const hz = width / 2;
  const corners = {
    a: [-hx, -hy, -hz],
    b: [hx, -hy, -hz],
    c: [hx, -hy, hz],
    d: [-hx, -hy, hz],
    e: [-hx, hy, -hz],
    f: [hx, hy, -hz],
    g: [hx, hy, hz],
    h: [-hx, hy, hz],
  } as const;
  const edges: [keyof typeof corners, keyof typeof corners][] = [
    ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], // bottom face
    ['e', 'f'], ['f', 'g'], ['g', 'h'], ['h', 'e'], // top face
    ['a', 'e'], ['b', 'f'], ['c', 'g'], ['d', 'h'], // verticals
  ];
  return edges.flatMap(([p, q]) => [corners[p], corners[q]]) as [number, number, number][];
}

function NodeBox({
  node,
  position,
  included,
  onSelect,
}: {
  node: SceneNode;
  position: [number, number, number];
  /** Whether this node currently passes the Field view's own Node filter — drives the border color (green
   *  included / red excluded) so the filter's effect is visible on every node at once, not just the ones it
   *  hides. */
  included: boolean;
  onSelect: (id: string) => void;
}) {
  const width = nodeBoxWidth(node);
  const height = 0.5 + Math.min(2, (node.memCapacityBytes ?? 0) / (16 * 1024 ** 3));
  const [hovered, setHovered] = useState(false);
  const edgePoints = useMemo(() => boxEdgePoints(width, height), [width, height]);

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
        <rimLitMaterial uColor={new Color(ROLE_COLOR[node.role])} uHighlight={hovered ? 1 : 0} />
        <Line segments points={edgePoints} color={included ? NODE_INCLUDED_COLOR : NODE_EXCLUDED_COLOR} lineWidth={3} />
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
  nodeFilters,
  allNodes,
  nodesHidden,
  theme,
}: {
  onSelect: (id: string) => void;
  selected: string | null;
  filters: FilterState;
  nodeFilters: NodeFilterState;
  allNodes: SceneNode[];
  /** Once the "Hide excluded" button is clicked, nodes failing nodeFilters stop rendering entirely instead of
   *  just showing a red border — toggled back by "Reset view" (see the button row in Scene3D). */
  nodesHidden: boolean;
  theme: Theme;
}) {
  // The Field view's own Node-field filter (role/health/hardware/OS/taints/labels) — separate from the Wheel
  // view's FilterState, since the whole point here is narrowing the Node set down BEFORE switching to Wheel.
  // Every node still renders (bordered green/red) until nodesHidden actually removes the excluded ones.
  const included = useMemo(() => new Map(allNodes.map((n) => [n.id, nodePassesFilter(n, nodeFilters)])), [allNodes, nodeFilters]);
  const nodes = useMemo(
    () => (nodesHidden ? allNodes.filter((n) => included.get(n.id)) : allNodes),
    [allNodes, nodesHidden, included],
  );

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

  // Field view still has just one "show nodes at all" concept — Master/Worker only became separately
  // filterable in the Wheel view's own panel (FilterPanel.tsx), so this treats "either role enabled" as
  // Field view's equivalent of the old single showNodes toggle.
  if (!filters.showMasterNodes && !filters.showWorkerNodes) return null;

  const selectedIndex = nodes.findIndex((n) => n.id === selected);
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : undefined;
  const selectedPos = selectedIndex >= 0 ? positions[selectedIndex] : undefined;

  return (
    <>
      {nodes.map((n, i) => (
        <NodeBox
          key={n.id}
          node={n}
          position={positions[i] as [number, number, number]}
          included={included.get(n.id) ?? true}
          onSelect={onSelect}
        />
      ))}
      {selectedNode && selectedPos && (
        <SelectionRing
          x={selectedPos[0]}
          y={0.05}
          z={selectedPos[2]}
          radius={nodeBoxWidth(selectedNode) * 0.75}
          color={RING_COLORS[theme].selection}
        />
      )}
    </>
  );
}

export interface WheelPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  /** Mirrors @vpk/core's wheel.ts WheelPoint — the timelapse's time axis. Undefined only for local storage
   *  cylinders (no single backing resource); CSI node driver dots inherit their owning CSINode's timestamp. */
  creationTimestamp?: string;
  /** Only set when the backing resource is genuinely mid-termination (real metadata.deletionTimestamp), never
   *  fabricated — see the matching comment in @vpk/core's wheel.ts. */
  deletionTimestamp?: string;
}
export interface WheelNode extends WheelPoint {
  health: 'ok' | 'warn' | 'error';
  healthColor: string;
  role: 'master' | 'worker';
  podCount: number;
  renderedPodCount?: number;
  cpuCapacity?: number;
  memCapacityBytes?: number;
  ephemeralStorageCapacityBytes?: number;
}
export interface WheelPod extends WheelPoint {
  namespace?: string;
  status: 'running' | 'pending' | 'failed' | 'succeeded' | 'unknown';
  daemonSet: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  cpuRequested?: number;
  memRequestedBytes?: number;
  /** Owning ReplicaSet's uid, if any — the "Show replica" feature's sibling-grouping key (see wheel.ts's own
   *  doc comment on this field). */
  replicaSetId?: string;
  /** The Node this Pod is scheduled on — already sent over the wire (core's WheelPod has always carried it),
   *  just not previously typed on this side since nothing client-side needed it before associatedWheelIds. */
  nodeId?: string;
}
export interface WheelTierItem extends WheelPoint {
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
export interface WheelCsiNodeDriver extends WheelPoint {
  kind: string;
  nodeId: string;
}
export interface WheelLocalStorage extends WheelPoint {
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
export interface ClusterWheel {
  outerRadius: number;
  csiRingRadius: number;
  nodes: WheelNode[];
  pods: WheelPod[];
  totalPodCount: number;
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

/** Applies Settings' per-kind color overrides to every kind-colored item in a freshly-fetched wheel — the ONE
 *  place that needs it, since everything downstream (WheelScene etc.) just trusts each item's own `.color`.
 *  Only items carrying a `kind` field are kind-colored (WheelNode/WheelPod are role/status-colored instead,
 *  deliberately untouched here). Three.js material colors are plain JS values, not CSS — unlike every other
 *  kind-colored surface in the app (server SVGs, icon badges), which re-color live via a `--vpk-kind-<kind>`
 *  CSS custom property and need no equivalent of this function at all. */
function remapWheelKindColors(w: ClusterWheel): ClusterWheel {
  const items = (arr: WheelTierItem[]) => arr.map((it) => ({ ...it, color: resolveKindColor(it.kind, it.color) }));
  return {
    ...w,
    network: { ...w.network, items: items(w.network.items) },
    endpoints: { ...w.endpoints, items: items(w.endpoints.items) },
    ingress: { ...w.ingress, items: items(w.ingress.items) },
    storage: { ...w.storage, items: items(w.storage.items) },
    persistentVolumes: { ...w.persistentVolumes, items: items(w.persistentVolumes.items) },
    storageClasses: { ...w.storageClasses, items: items(w.storageClasses.items) },
    volumeAttachments: { ...w.volumeAttachments, items: items(w.volumeAttachments.items) },
    csiDrivers: { ...w.csiDrivers, items: items(w.csiDrivers.items) },
    csiNodeDrivers: w.csiNodeDrivers.map((d) => ({ ...d, color: resolveKindColor(d.kind, d.color) })),
    localStorage: w.localStorage.map((d) => ({ ...d, color: resolveKindColor(d.kind, d.color) })),
    controlPlane: remapStructuralColors({ ...w.controlPlane, planes: remapPlaneColors(w.controlPlane.planes) }),
  };
}

/** Maps a Control Plane component's own id (`control-plane-component:api-server`, `:scheduler`, ...) to its
 *  Settings override key — each of the 4 gets an independent color even though the server currently assigns
 *  them all the same default (CONTROL_PLANE_COMPONENTS_COLOR), since the id already distinguishes them. */
const COMPONENT_OVERRIDE_KEY: Record<string, StructuralColorKey> = {
  'api-server': 'apiServer',
  scheduler: 'scheduler',
  'controller-manager': 'controllerManager',
  etcd: 'etcd',
};

/** Applies Settings' "Control Plane" color overrides to a freshly-fetched wheel's synthetic (non-Kind-backed)
 *  Control Plane items — same remap-after-fetch approach as remapWheelKindColors/remapPlaneColors, and for the
 *  same reason (Three.js material colors aren't CSS, so this can't just be a CSS var like the server-SVG
 *  views). Ring color isn't handled here — it has no server-sent color of its own at all (see ControlPlaneRing/
 *  CsiRing's own render sites, which resolve it directly). */
function remapStructuralColors(cp: ControlPlaneScene): ControlPlaneScene {
  return {
    ...cp,
    kubelets: cp.kubelets.map((k) => ({ ...k, color: resolveStructuralColor('kubeletKubeProxy', k.color) })),
    kubeProxies: cp.kubeProxies.map((k) => ({ ...k, color: resolveStructuralColor('kubeletKubeProxy', k.color) })),
    components: cp.components.map((c) => {
      const key = COMPONENT_OVERRIDE_KEY[c.id.replace('control-plane-component:', '')];
      return key ? { ...c, color: resolveStructuralColor(key, c.color) } : c;
    }),
    kubectl: { ...cp.kubectl, color: resolveStructuralColor('kubectl', cp.kubectl.color) },
    imageRegistries: cp.imageRegistries.map((r) => ({ ...r, color: resolveStructuralColor('imageRegistries', r.color) })),
  };
}

/** Applies Settings' per-API-group (per-pane) color overrides to a freshly-fetched wheel's resource planes —
 *  the sphere per Kind and the plane's own wall (PlaneWall, rendered at opacity 0.3) both read a plane's
 *  `color`/each item's `color`, which the server always sends at PANE_COLORS' default — same remap-after-fetch
 *  approach as remapWheelKindColors, and for the same reason (Three.js material colors aren't CSS). */
function remapPlaneColors(planes: WheelPlane[]): WheelPlane[] {
  return planes.map((plane) => {
    const color = resolveApiGroupColor(plane.name, plane.color);
    return { ...plane, color, items: plane.items.map((item) => ({ ...item, color })) };
  });
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

function Dot({
  p,
  size,
  onSelect,
  visible = true,
}: {
  p: WheelPoint;
  size: number;
  onSelect: (id: string) => void;
  /** Hidden-state toggle for the timelapse's time dimension — stays mounted (no add/remove churn every
   *  playback tick), just flips Three.js's own `visible` flag, matching every other shape component here. */
  visible?: boolean;
}) {
  return (
    <mesh
      visible={visible}
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(p.id);
      }}
    >
      <sphereGeometry args={[size, 10, 10]} />
      <ColoredMaterial color={p.color} />
    </mesh>
  );
}

/** Pods render as a hexagonal puck (a 6-sided cylinder — its cross-section is a hexagon by construction,
 *  cylinder's height axis is Y by default so the hex faces lie flat in the wheel's ground plane) rather than
 *  the generic sphere used for tier items, so pods read as a distinct shape at a glance. */
function PodHex({ p, size, onSelect, visible = true }: { p: WheelPoint; size: number; onSelect: (id: string) => void; visible?: boolean }) {
  return (
    <mesh
      visible={visible}
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(p.id);
      }}
    >
      <cylinderGeometry args={[size, size, size * 0.7, 6]} />
      <ColoredMaterial color={p.color} />
    </mesh>
  );
}

/** The storage-family shape (PVC/PV/StorageClass) — a short cylinder, distinct from the pod hex and the
 *  network/endpoints sphere so the three storage tiers still read as one visual family stacked vertically. */
function StorageCylinder({ p, onSelect, visible = true }: { p: WheelPoint; onSelect: (id: string) => void; visible?: boolean }) {
  return (
    <mesh
      visible={visible}
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(p.id);
      }}
    >
      <cylinderGeometry args={[0.12, 0.12, 0.22, 8]} />
      <ColoredMaterial color={p.color} />
    </mesh>
  );
}

/** A real resource->resource line (e.g. Pod -> the PVC it mounts, or Service -> its Endpoints). Colored to
 *  match the resource kind at the far end. */
function LinkLine({
  a,
  b,
  color,
  opacity = 0.55,
  visible = true,
}: {
  a: WheelPoint;
  b: WheelPoint;
  color: string;
  opacity?: number;
  visible?: boolean;
}) {
  const points: [number, number, number][] = [
    [a.x, a.y, a.z],
    [b.x, b.y, b.z],
  ];
  return (
    // `visible` goes on the wrapping <group>, not <line> itself — JSX's `line` intrinsic ambiguously resolves
    // against React DOM's SVG <line> typing (no such conflict for <group>, which SVG has no equivalent tag
    // for), and Three.js's renderer already skips an invisible object's children entirely during traversal, so
    // this achieves the exact same hidden-state toggle without fighting that type conflict.
    <group visible={visible}>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </line>
    </group>
  );
}

/** A Pod -> Service edge, drawn as an elbow (straight up ~1/4 of the way, then over to the Service) rather
 *  than a direct diagonal — the Service anchors above the FIRST (earliest-created) referencing pod, so a
 *  straight line for every other sharing pod would read as "the Service sits between us", which isn't the
 *  relationship being shown. Degenerates to a plain straight-up line for the anchor pod itself, since its x/z
 *  already match the Service's. */
function ElbowLine({ a, b, color, visible = true }: { a: WheelPoint; b: WheelPoint; color: string; visible?: boolean }) {
  const midY = a.y + (b.y - a.y) * 0.25;
  const points: [number, number, number][] = [
    [a.x, a.y, a.z],
    [a.x, midY, a.z],
    [b.x, b.y, b.z],
  ];
  return (
    // See LinkLine's comment on why `visible` goes on the wrapping <group>, not <line> itself.
    <group visible={visible}>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.55} />
      </line>
    </group>
  );
}

/** An arbitrary multi-segment line — used for the CSI node-driver chain and the local-storage right-angle
 *  connector, both of which need more than ElbowLine's fixed 3-point shape. */
function PolyLine({
  points,
  color,
  opacity = 0.55,
  visible = true,
}: {
  points: [number, number, number][];
  color: string;
  opacity?: number;
  visible?: boolean;
}) {
  return (
    // See LinkLine's comment on why `visible` goes on the wrapping <group>, not <line> itself.
    <group visible={visible}>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={opacity} />
      </line>
    </group>
  );
}

/** The "CSI ring" — a torus (a real short cylinder, not a thin wireframe line like the outer node-ring)
 *  running around the same radius as the nodes but at a lower Y, just below the node boxes' bottom. Purely
 *  structural (no single backing resource): CSINode driver chains drop down to it, and CSIDriver spheres
 *  connect up to it, so it reads as the shared "CSI bus" tying node-side and cluster-side CSI objects together. */
function CsiRing({ radius, y, visible = true }: { radius: number; y: number; visible?: boolean }) {
  return (
    <mesh visible={visible} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.08, 8, 64]} />
      <meshBasicMaterial color={resolveStructuralColor('csiRing', defaultStructuralColor('csiRing'))} transparent opacity={0.85} />
    </mesh>
  );
}

/** The "Control Plane" ring — a full torus (translucent, unlike the CSI ring) circling the whole node ring at
 *  its own Y band, clickable in its own right (matches the legacy app's wall, whose popup just explains "click
 *  each component for details"). */
function ControlPlaneRing({
  radius,
  y,
  height,
  onSelect,
  visible = true,
}: {
  radius: number;
  y: number;
  height: number;
  onSelect: (id: string) => void;
  visible?: boolean;
}) {
  return (
    <mesh
      visible={visible}
      position={[0, y, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(CONTROL_PLANE_RING_ID);
      }}
    >
      <torusGeometry args={[radius, height / 2, 8, 64]} />
      <meshBasicMaterial color={resolveStructuralColor('controlPlaneRing', defaultStructuralColor('controlPlaneRing'))} transparent opacity={0.3} />
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

/** Every wheel item connected to `podId` by an edge the wheel ALREADY draws a connecting line for — its Node,
 *  the Service(s) it's a member of, and its full storage lineage (PVC -> PV -> StorageClass/VolumeAttachment
 *  -> CSIDriver). Deliberately built from the wheel's own edge lists rather than a fresh `/schematic` fetch:
 *  it's then guaranteed every id returned actually has a wheel position to ring (a ConfigMap/Secret/
 *  ServiceAccount/ReplicaSet is "associated" in the schematic sense too, but isn't drawn as its own point
 *  here, so highlighting it would have nowhere to put a ring), and it's a pure client-side graph walk with
 *  no network round-trip needed for something that should feel instant on click. */
function associatedWheelIds(wheel: ClusterWheel, podId: string): string[] {
  const pod = wheel.pods.find((p) => p.id === podId);
  const result = new Set<string>();
  if (pod?.nodeId) result.add(pod.nodeId);

  const frontier = new Set<string>([podId]);
  for (const e of wheel.podToNetwork) {
    if (e.podId === podId) {
      result.add(e.itemId);
      frontier.add(e.itemId);
    }
  }
  for (const e of wheel.podToStorage) {
    if (e.podId === podId) {
      result.add(e.itemId);
      frontier.add(e.itemId);
    }
  }

  // Chase the rest of the storage/network lineage transitively (PVC -> PV -> StorageClass/VolumeAttachment ->
  // CSIDriver, Service -> Endpoints/Ingress) until a full pass adds nothing new.
  const linkLists: WheelLinkEdge[][] = [
    wheel.storageToPv,
    wheel.pvToStorageClass,
    wheel.pvToVolumeAttachment,
    wheel.storageClassToCsiDriver,
    wheel.volumeAttachmentToCsiDriver,
    wheel.serviceToEndpoints,
    wheel.serviceToIngress,
  ];
  let grew = true;
  while (grew) {
    grew = false;
    for (const list of linkLists) {
      for (const e of list) {
        if (frontier.has(e.fromId) && !result.has(e.toId)) {
          result.add(e.toId);
          frontier.add(e.toId);
          grew = true;
        }
      }
    }
  }
  result.delete(podId);
  return [...result];
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
      color: resolveStructuralColor('controlPlaneRing', defaultStructuralColor('controlPlaneRing')),
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
  visibleAtTime,
  timelapseCategoryFilters,
  controlPlaneRevealed,
  theme,
}: {
  wheel: ClusterWheel;
  onSelect: (id: string) => void;
  selected: string | null;
  filters: FilterState;
  theme: Theme;
  /** Timelapse's own per-item TIME dimension — null means timelapse is off (no restriction, today's default
   *  "show everything" behavior). Composed via the `visible` prop on each mesh below (hidden-state toggling —
   *  the item stays mounted in the Three.js scene graph and just flips visible on/off) rather than by
   *  filtering it out of an array, so nothing mounts/unmounts on every playback tick. */
  visibleAtTime: Set<string> | null;
  /** Timelapse's own CATEGORY toggle set — independent state from the main FilterPanel's `filters`, only in
   *  effect while timelapse is enabled (null otherwise). Unlike `visibleAtTime` this changes rarely (a manual
   *  checkbox, not a playback tick), so — like `filters` itself — it's applied as ordinary array filtering. */
  timelapseCategoryFilters: TimelapseCategoryFilters | null;
  /** Whether the Control Plane (ring + kubelets/kube-proxies/components/kubectl/registries) has been revealed
   *  yet. None of those items carry an individual creationTimestamp of their own (they're synthetic/derived,
   *  not real per-instance resources), so "the Control Plane exists" is anchored to the timelapse's own first
   *  event rather than any one item's timestamp — true whenever timelapse is off. */
  controlPlaneRevealed: boolean;
}) {
  const ringPoints: [number, number, number][] = Array.from({ length: 65 }, (_, i) => {
    const a = (2 * Math.PI * i) / 64;
    return [wheel.outerRadius * Math.cos(a), 0, wheel.outerRadius * Math.sin(a)];
  });
  const csiRingRadius = wheel.csiRingRadius;

  // Timelapse's per-item TIME dimension — applied via the `visible` prop at each render call below, not by
  // filtering items out of the visible* arrays (see this function's own prop doc comment for why). Takes the
  // ITEM, not just its id: a point with no creationTimestamp defaults to always visible when checked directly.
  // Local storage cylinders are the one point that HAS no creationTimestamp, but they deliberately do NOT rely
  // on that default — their own visibility is instead computed as `atTime(node)` (the owning Node's own
  // timestamp) at each local-storage render call below, so a cylinder never appears before its Node does.
  // visibleIdsAtInterval also deliberately never adds untimestamped ids to its Set at all, since local storage
  // reuses its Node's own id, and treating "no timestamp = always visible" as Set membership would make that
  // shared id incorrectly force the Node itself to always be visible too (see timelapse.ts's own doc comment
  // on visibleIdsAtInterval).
  const atTime = (item: { id: string; creationTimestamp?: string }) =>
    !visibleAtTime || item.creationTimestamp === undefined || visibleAtTime.has(item.id);
  // Timelapse's own CATEGORY toggle — like `filters.showX`, but a separate state, only in effect while
  // timelapse is enabled.
  const categoryOn = (key: keyof Omit<TimelapseCategoryFilters, 'planes'>) => !timelapseCategoryFilters || timelapseCategoryFilters[key];
  const paneOn = (name: string) => !timelapseCategoryFilters || (timelapseCategoryFilters.planes[name] ?? false);

  // Namespace/label/annotation scope filters are ANDed with the existing category toggles below — an item
  // must pass both to render. Deliberately NOT time-filtered here (see `atTime`'s own comment above) — every
  // item that passes category+scope stays mounted and fades in/out via its own `visible` prop instead.
  const visiblePods = categoryOn('pods') ? wheel.pods.filter((p) => podPassesFilter(p, filters) && passesScopeFilters(p, filters)) : [];
  // The server now caps Pods per-node (POD_CAP_PER_NODE in @vpk/core's wheel.ts), same as every other tier —
  // this is just a defensive backstop in case a future change to that cap (or a very large node count) still
  // pushes the rendered set high enough to freeze the tab; it should essentially never fire in practice.
  if (visiblePods.length > 10000) {
    console.warn(
      `[Scene3D] rendering ${visiblePods.length} Pods in the wheel despite the server-side per-node cap — this can still freeze the tab.`,
    );
  }
  // Service/Endpoint are now separately filterable (previously one combined "Network" toggle).
  const visibleNetwork = filters.showService && categoryOn('network') ? wheel.network.items.filter((i) => passesScopeFilters(i, filters)) : [];
  const visibleEndpoints = filters.showEndpoint && categoryOn('network') ? wheel.endpoints.items.filter((i) => passesScopeFilters(i, filters)) : [];
  // Ingress and Gateway API (HTTPRoute) share one wheel tier server-side (wheel.ingress) but are separately
  // filterable client-side, keyed off each item's own `kind` — OpenShift Route objects ride along with Ingress
  // as the closest existing analog. Both stay in ONE array (they share the same Dot rendering + serviceToIngress
  // edge list below), just with a per-item toggle check instead of one shared one.
  const visibleIngress = categoryOn('ingress')
    ? wheel.ingress.items.filter(
        (i) => passesScopeFilters(i, filters) && (i.kind === 'HTTPRoute' ? filters.showGatewayApi : filters.showIngress),
      )
    : [];
  // Storage chain: Pod -> PVC -> PV -> StorageClass / VolumeAttachment (CSIDriver hangs off both SC and VA).
  // Each tier's ELIGIBLE set (scope + reachable-from-a-visible-pod, but NOT gated by its own showX toggle) is
  // kept separate from its RENDERED set (eligible AND its own toggle) — an edge into a downstream item must be
  // able to find its position even when the UPSTREAM item's own toggle is off (see the storage edges further
  // below: hiding PVC must not hide the PVC->PV line as long as PV is still shown).
  const visiblePodIds = new Set(visiblePods.map((p) => p.id));
  const pvcIdsFromVisiblePod = new Set(wheel.podToStorage.filter((e) => visiblePodIds.has(e.podId)).map((e) => e.itemId));
  const pvIdsFromVisiblePod = new Set(wheel.storageToPv.filter((e) => pvcIdsFromVisiblePod.has(e.fromId)).map((e) => e.toId));
  const scIdsFromVisiblePod = new Set(wheel.pvToStorageClass.filter((e) => pvIdsFromVisiblePod.has(e.fromId)).map((e) => e.toId));
  const vaIdsFromVisiblePod = new Set(wheel.pvToVolumeAttachment.filter((e) => pvIdsFromVisiblePod.has(e.fromId)).map((e) => e.toId));
  const pvcEligible = categoryOn('storage') ? wheel.storage.items.filter((i) => passesScopeFilters(i, filters)) : [];
  const pvEligible = categoryOn('storage')
    ? wheel.persistentVolumes.items.filter((i) => passesScopeFilters(i, filters) && pvIdsFromVisiblePod.has(i.id))
    : [];
  const scEligible = categoryOn('storage')
    ? wheel.storageClasses.items.filter((i) => passesScopeFilters(i, filters) && scIdsFromVisiblePod.has(i.id))
    : [];
  const vaEligible = categoryOn('storage')
    ? wheel.volumeAttachments.items.filter((i) => passesScopeFilters(i, filters) && vaIdsFromVisiblePod.has(i.id))
    : [];
  // CSINode driver dots (below Master/Worker Nodes), CSIDriver dots (near the ring), and the ring itself are
  // now three independently toggleable things (previously all under one `showCsi`) — `showCsi` alone now just
  // means "draw the ring".
  const csiEligible = categoryOn('csi') ? wheel.csiDrivers.items.filter((i) => passesScopeFilters(i, filters)) : [];
  const visibleStorage = filters.showPvc ? pvcEligible : [];
  const visiblePv = filters.showPv ? pvEligible : [];
  const visibleStorageClasses = filters.showStorageClass ? scEligible : [];
  const visibleVolumeAttachments = filters.showVolumeAttachment ? vaEligible : [];
  const visibleCsiDrivers = filters.showCsiDrivers ? csiEligible : [];
  const visibleCsiNodeDrivers = filters.showCsiNodes && categoryOn('csi') ? wheel.csiNodeDrivers : [];
  const visibleLocalStorage = filters.showNodeLocalStorage && categoryOn('localStorage') ? wheel.localStorage : [];
  // Master/Worker are now separately filterable (previously one combined "Nodes" toggle).
  const visibleNodes = categoryOn('nodes')
    ? wheel.nodes.filter((n) => (n.role === 'master' ? filters.showMasterNodes : filters.showWorkerNodes))
    : [];
  // The CSI ring/dots only reveal once at least one CSI item's own creation event has actually occurred —
  // computed from the same category+scope-filtered arrays above, so it stays in sync with whatever's toggled.
  const csiRevealed = !visibleAtTime || visibleCsiDrivers.some(atTime) || visibleCsiNodeDrivers.some(atTime);

  // Resource CPU & Memory bars: each category's max is taken over the currently-VISIBLE set only, so the
  // tallest bar in a group always uses the full up-to-Ingress (or down-to-VolumeAttachment) range regardless
  // of what else is filtered out — a fixed universal scale would make every bar a sliver once filtered down.
  const nodeCpuMax = Math.max(0, ...visibleNodes.map((n) => n.cpuCapacity ?? 0));
  const nodeMemMax = Math.max(0, ...visibleNodes.map((n) => n.memCapacityBytes ?? 0));
  // Unlike the CPU/Memory bars (attached to the Node box itself, so they disappear along with it), the
  // storage bar hangs off the local-storage cylinder, which has its own independent Master/Worker-agnostic
  // toggle (showNodeLocalStorage) — so its scale shouldn't collapse to zero just because Master/Worker
  // visibility happens to be toggled off.
  const nodeStorageMax = Math.max(0, ...wheel.nodes.map((n) => n.ephemeralStorageCapacityBytes ?? 0));
  const podCpuMax = Math.max(0, ...visiblePods.map((p) => p.cpuRequested ?? 0));
  const podMemMax = Math.max(0, ...visiblePods.map((p) => p.memRequestedBytes ?? 0));

  const byId = useMemo(() => {
    const map = new Map<string, WheelPoint>();
    for (const p of visiblePods) map.set(p.id, p);
    for (const item of visibleNetwork) map.set(item.id, item);
    for (const item of visibleEndpoints) map.set(item.id, item);
    for (const item of visibleIngress) map.set(item.id, item);
    // Storage-family items come from their ELIGIBLE sets (scope+reachability), not their toggle-filtered
    // "visible" sets — see the storage-chain edge rendering below for why: an edge's visibility is driven by
    // its DOWNSTREAM endpoint's own toggle, so the upstream endpoint must still be findable here even when its
    // own toggle is off.
    for (const item of pvcEligible) map.set(item.id, item);
    for (const item of pvEligible) map.set(item.id, item);
    for (const item of scEligible) map.set(item.id, item);
    for (const item of vaEligible) map.set(item.id, item);
    for (const item of csiEligible) map.set(item.id, item);
    return map;
  }, [wheel, filters, timelapseCategoryFilters]);

  const csiChainsByNode = useMemo(() => {
    const byNode = new Map<string, WheelCsiNodeDriver[]>();
    for (const d of visibleCsiNodeDrivers) {
      const list = byNode.get(d.nodeId) ?? [];
      list.push(d);
      byNode.set(d.nodeId, list);
    }
    for (const list of byNode.values()) list.sort((a, b) => b.y - a.y); // closest-to-node first
    return byNode;
  }, [wheel, filters, timelapseCategoryFilters]);

  // The exact dot last clicked, so the selection ring can land on it specifically — see findWheelSelection's
  // comment on why a plain id lookup can't tell two of the same Node's driver dots apart.
  const [clickedCsiDot, setClickedCsiDot] = useState<WheelCsiNodeDriver | null>(null);

  const selection = findWheelSelection(wheel, selected, clickedCsiDot);

  // "Show replica" — ring every OTHER Pod sharing the selected Pod's ReplicaSet (0.17 matches
  // findWheelSelection's own Pod radius), using the exact same SelectionRing mechanism as the main selection,
  // just REPLICA_RING_COLOR instead of red. Recomputed fresh from `selected`/`filters.showReplica` on every
  // render rather than tracked as separate state, so it's automatically cleared the instant a different item
  // (or a Pod with no ReplicaSet siblings) is selected — nothing to explicitly "turn off". Siblings are drawn
  // from `visiblePods` (not raw `wheel.pods`), so a sibling currently hidden by another filter never gets a
  // floating ring with no pod underneath it.
  const selectedPod = filters.showReplica ? wheel.pods.find((p) => p.id === selected) : undefined;
  const replicaSiblings = selectedPod?.replicaSetId
    ? visiblePods.filter((p) => p.replicaSetId === selectedPod.replicaSetId && p.id !== selectedPod.id)
    : [];

  // Selecting a Pod pulses every wheel item connected to it (Node, Services, storage lineage) — always on,
  // no filter checkbox needed the way "Show replica" has one, since it's just following the connecting lines
  // the wheel already draws rather than adding a whole new relationship to the scene. See associatedWheelIds's
  // own doc comment for exactly what "associated" means here.
  const selectedPodForAssociations = wheel.pods.find((p) => p.id === selected);
  const associatedPositions = selectedPodForAssociations
    ? associatedWheelIds(wheel, selectedPodForAssociations.id)
        .map((id) => ({ id, pos: findWheelSelection(wheel, id, null) }))
        .filter((r): r is { id: string; pos: NonNullable<ReturnType<typeof findWheelSelection>> } => r.pos !== null)
    : [];

  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(ringPoints.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#da8c84" transparent opacity={0.5} />
      </line>
      {visibleNodes.map((n) => {
        // Rotate the box so one face is perpendicular to the line from the wheel's center to the node — the
        // radial line hits that face at a true 90 degrees, rather than the box sitting at whatever fixed
        // world-axis orientation it happened to have.
        const angle = Math.atan2(n.z, n.x);
        return (
          <mesh
            key={n.id}
            visible={atTime(n)}
            position={[n.x, 0.3, n.z]}
            rotation={[0, -angle, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n.id);
            }}
          >
            <boxGeometry args={[0.7, 0.6, 0.7]} />
            <ColoredMaterial color={n.color} />
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
        const nodeVisible = atTime(n);
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
                visible={nodeVisible}
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
                visible={nodeVisible}
              />
            )}
          </group>
        );
      })}
      {visiblePods.map((p) => (
        <PodHex key={p.id} p={p} size={0.1} onSelect={onSelect} visible={atTime(p)} />
      ))}
      {visiblePods.map((p) => {
        const cpu = tangentOffset(p.x, p.z, -METRIC_BAR_OFFSET);
        const mem = tangentOffset(p.x, p.z, METRIC_BAR_OFFSET);
        const podVisible = atTime(p);
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
                visible={podVisible}
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
                visible={podVisible}
              />
            )}
          </group>
        );
      })}
      {visibleNetwork.map((item) => (
        <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.podToNetwork.map((e) => {
        const a = byId.get(e.podId);
        const b = byId.get(e.itemId);
        return a && b ? <ElbowLine key={`${e.podId}|${e.itemId}`} a={a} b={b} color={b.color} visible={atTime(a) && atTime(b)} /> : null;
      })}
      {visibleEndpoints.map((item) => (
        <Dot key={item.id} p={item} size={0.1} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.serviceToEndpoints.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} visible={atTime(a) && atTime(b)} /> : null;
      })}
      {visibleIngress.map((item) => (
        <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.serviceToIngress.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? (
          <LinkLine key={`ingress-${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} visible={atTime(a) && atTime(b)} />
        ) : null;
      })}
      {visibleStorage.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.podToStorage.map((e) => {
        const a = byId.get(e.podId);
        const b = byId.get(e.itemId);
        // Storage-chain edges are gated by their DOWNSTREAM endpoint's own toggle only, not the upstream
        // one's — hiding a PVC's own checkbox must not hide the line if what it connects TO is still shown
        // (and vice versa: hiding the downstream end DOES hide the line, even if the upstream end is shown).
        return a && b ? <LinkLine key={`${e.podId}|${e.itemId}`} a={a} b={b} color={b.color} visible={filters.showPvc && atTime(a) && atTime(b)} /> : null;
      })}
      {visiblePv.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.storageToPv.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} visible={filters.showPv && atTime(a) && atTime(b)} /> : null;
      })}
      {visibleStorageClasses.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.pvToStorageClass.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? (
          <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} visible={filters.showStorageClass && atTime(a) && atTime(b)} />
        ) : null;
      })}
      {visibleVolumeAttachments.map((item) => (
        <StorageCylinder key={item.id} p={item} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.pvToVolumeAttachment.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        return a && b ? (
          <LinkLine key={`${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} visible={filters.showVolumeAttachment && atTime(a) && atTime(b)} />
        ) : null;
      })}
      {filters.showCsi && categoryOn('csi') && <CsiRing radius={csiRingRadius} y={CSI_RING_Y} visible={csiRevealed} />}
      {visibleCsiDrivers.map((item) => (
        <Dot key={item.id} p={item} size={0.1} onSelect={onSelect} visible={atTime(item)} />
      ))}
      {wheel.storageClassToCsiDriver.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        // Full opacity — the CSI subsystem's own lines shouldn't fade into the generic pod/tier link lines.
        return a && b ? (
          <LinkLine key={`sc-driver-${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} opacity={1} visible={filters.showCsiDrivers && atTime(a) && atTime(b)} />
        ) : null;
      })}
      {wheel.volumeAttachmentToCsiDriver.map((e) => {
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        // Same "own subsystem, full opacity" treatment as storageClassToCsiDriver just above — a
        // VolumeAttachment names its driver directly (spec.attacher), independent of its PV's StorageClass.
        return a && b ? (
          <LinkLine key={`va-driver-${e.fromId}|${e.toId}`} a={a} b={b} color={b.color} opacity={1} visible={filters.showCsiDrivers && atTime(a) && atTime(b)} />
        ) : null;
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
        return <LinkLine key={`driver-ring-${item.id}`} a={item} b={ringAnchor} color={item.color} opacity={1} visible={atTime(item)} />;
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
          visible={atTime(d)}
        />
      ))}
      {[...csiChainsByNode.entries()].map(([nodeId, dots]) => {
        const n = wheel.nodes.find((nd) => nd.id === nodeId);
        if (!n || dots.length === 0) return null;
        const color = dots[0]!.color;
        // Every dot for a node shares its CSINode's own timestamp (see wheel.ts), so any one of them speaks
        // for the whole chain's visibility.
        const chainVisible = atTime(dots[0]!);
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
            <PolyLine points={chainPoints} color={color} opacity={0.9} visible={chainVisible} />
            <PolyLine points={ringConnector} color={color} opacity={0.9} visible={chainVisible} />
          </group>
        );
      })}
      {visibleLocalStorage.map((ls) => {
        // Local storage carries no creationTimestamp of its own (it's not a distinct k8s object — see
        // WheelLocalStorage's doc comment) — its visibility rides on its owning NODE's instead, so the
        // cylinder never appears before the Node itself does.
        const n = wheel.nodes.find((nd) => nd.id === ls.nodeId);
        return (
          <StorageCylinder
            key={`local-storage-${ls.nodeId}`}
            p={ls}
            onSelect={(id) => onSelect(localStorageSelectionId(id))}
            visible={!!n && atTime(n)}
          />
        );
      })}
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
              visible={!!n && atTime(n)}
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
        return <PolyLine key={`local-storage-line-${ls.nodeId}`} points={points} color="#c9c9c9" visible={atTime(n)} />;
      })}
      {filters.showControlPlane && categoryOn('controlPlane') && (
        <>
          <ControlPlaneRing
            radius={wheel.controlPlane.radius}
            y={wheel.controlPlane.y}
            height={wheel.controlPlane.height}
            onSelect={onSelect}
            visible={controlPlaneRevealed}
          />
          {/* Previously all-or-nothing under one showControlPlane toggle — each sub-group below now has its
              own checkbox too (still additionally gated by showControlPlane/controlPlaneRevealed above). */}
          {wheel.controlPlane.kubelets.map((k) => (
            <Dot key={k.id} p={k} size={0.09} onSelect={onSelect} visible={controlPlaneRevealed && filters.showKubeletKubeProxy} />
          ))}
          {wheel.controlPlane.kubeProxies.map((k) => (
            <Dot key={k.id} p={k} size={0.09} onSelect={onSelect} visible={controlPlaneRevealed && filters.showKubeletKubeProxy} />
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
            return (
              <PolyLine
                key={`kubelet-link-${k.nodeId}`}
                points={points}
                color={k.color}
                opacity={0.6}
                visible={controlPlaneRevealed && filters.showKubeletKubeProxy}
              />
            );
          })}
          {wheel.controlPlane.components.map((c) => (
            <Dot key={c.id} p={c} size={0.14} onSelect={onSelect} visible={controlPlaneRevealed && filters.showControlPlaneComponents} />
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
            return (
              <LinkLine
                key={`component-ring-${c.id}`}
                a={ringAnchor}
                b={c}
                color={c.color}
                opacity={0.8}
                visible={controlPlaneRevealed && filters.showControlPlaneComponents}
              />
            );
          })}
          <Dot p={wheel.controlPlane.kubectl} size={0.16} onSelect={onSelect} visible={controlPlaneRevealed && filters.showKubectl} />
          {(() => {
            const apiServer = wheel.controlPlane.components.find((c) => c.title === 'API Server');
            return apiServer ? (
              <LinkLine
                a={apiServer}
                b={wheel.controlPlane.kubectl}
                color={wheel.controlPlane.kubectl.color}
                opacity={0.7}
                visible={controlPlaneRevealed && filters.showControlPlaneComponents && filters.showKubectl}
              />
            ) : null;
          })()}
          {wheel.controlPlane.imageRegistries.map((r) => (
            <StorageCylinder key={r.id} p={r} onSelect={onSelect} visible={controlPlaneRevealed && filters.showImageRegistries} />
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
              return (
                <LinkLine
                  a={ringAnchor}
                  b={top}
                  color={top.color}
                  opacity={0.7}
                  visible={controlPlaneRevealed && filters.showImageRegistries}
                />
              );
            })()}
        </>
      )}
      {PANES.map((p) => {
        const plane = wheel.controlPlane.planes.find((pl) => pl.name === p.name);
        if (!plane || !filters[p.key] || !paneOn(p.name)) return null;
        return (
          <group key={p.name}>
            <PlaneWall plane={plane} />
            {plane.items.map((item) => (
              <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} />
            ))}
          </group>
        );
      })}
      {replicaSiblings.map((p) => (
        <SelectionRing key={`replica-${p.id}`} x={p.x} y={p.y} z={p.z} radius={0.17} color={RING_COLORS[theme].replica} />
      ))}
      {associatedPositions.map(({ id, pos }) => (
        <SelectionRing key={`assoc-${id}`} {...pos} color={RING_COLORS[theme].associated} />
      ))}
      {selection && <SelectionRing {...selection} color={RING_COLORS[theme].selection} />}
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
  const podsCapped = wheel.pods.length < wheel.totalPodCount;
  const capped = podsCapped || tiers.some((t) => t.items.length < t.totalCount);
  if (!capped) return null;
  return (
    <div
      className="absolute bottom-2 left-2 rounded px-2 py-1 text-xs"
      style={{ background: 'var(--vpk-surface)', color: 'var(--vpk-fg-muted)', border: '1px solid var(--vpk-border)' }}
    >
      showing {wheel.pods.length}/{wheel.totalPodCount} pods · {wheel.network.items.length}/{wheel.network.totalCount} services ·{' '}
      {wheel.endpoints.items.length}/{wheel.endpoints.totalCount} endpoints
      · {wheel.ingress.items.length}/{wheel.ingress.totalCount} ingress · {wheel.storage.items.length}/{wheel.storage.totalCount} storage ·{' '}
      {wheel.persistentVolumes.items.length}/{wheel.persistentVolumes.totalCount} PVs · {wheel.storageClasses.items.length}/
      {wheel.storageClasses.totalCount} storage classes · {wheel.volumeAttachments.items.length}/{wheel.volumeAttachments.totalCount} volume
      attachments · {wheel.csiDrivers.items.length}/{wheel.csiDrivers.totalCount} CSI drivers
    </div>
  );
}

/** One background per theme (see skyConfig.ts) — drei's `<Sky>`/`<Stars>` are both already procedural/shader-
 *  driven, so this is "free" per the shader exploration, no custom GLSL needed here. Shared by both Field and
 *  Wheel (they're the same <Canvas>), so the backdrop is consistent no matter which mode is active. */
function ThemeBackdrop({ theme }: { theme: Theme }) {
  const cfg = SKY_CONFIG[theme];
  if (cfg.kind === 'stars') {
    return (
      <>
        <color attach="background" args={[cfg.background]} />
        <Stars radius={cfg.radius} depth={cfg.depth} count={cfg.count} factor={cfg.factor} fade={cfg.fade} speed={cfg.speed} />
      </>
    );
  }
  return (
    <Sky
      sunPosition={cfg.sunPosition}
      turbidity={cfg.turbidity}
      rayleigh={cfg.rayleigh}
      mieCoefficient={cfg.mieCoefficient}
      mieDirectionalG={cfg.mieDirectionalG}
    />
  );
}

type Mode = 'field' | 'wheel';

/**
 * 3D hero view (DESIGN §6.8), scaling model: field (all nodes, flat grid) -> wheel (small-N radial layout with
 * network/endpoints/storage tiers) -> pill/single-node (not built yet). Toggle between the two built modes.
 */
export function Scene3D({
  onSelect,
  onDeselect,
  active,
  selected,
  onOpenEditor,
  onViewSchematic,
  onViewOwnerRef,
  onSearchKind,
  onViewRepository,
  snapshotKey,
  theme,
  fogEnabled,
  gridEnabled,
}: {
  onSelect: (id: string) => void;
  /** "Clear" button — unselects whatever's currently selected (and, with it, every derived highlight: the
   *  selection ring, "Show replica" siblings, and a Pod's associated-component rings, all of which are
   *  computed fresh from `selected` rather than tracked as their own state — see associatedWheelIds/
   *  replicaSiblings's own doc comments). */
  onDeselect: () => void;
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
  /** Drives the Canvas's sky/starfield backdrop (see skyConfig.ts) — one look per theme, same as everything
   *  else var(--vpk-*)-driven, just resolved in JS since Three.js materials aren't CSS. */
  theme: Theme;
  /** Settings' "Depth fog" toggle (see fogSetting.ts) — off by default, since fog also fades out distant
   *  objects, which could hide real data on a wide Field grid. */
  fogEnabled: boolean;
  /** Settings' "Grid floor" toggle (see gridSetting.ts) — on by default. */
  gridEnabled: boolean;
}) {
  const [mode, setMode] = useState<Mode>('field');
  const [wheel, setWheel] = useState<ClusterWheel | null>(null);
  // Separate from `selected`/the ring: a 3D click shows the small Properties popup first (matching the
  // legacy app), not the full editor — the editor only opens when the popup's own button is clicked.
  const [propsOpen, setPropsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // Lazy initializer: reads the user's saved default (if any) exactly once, at mount — not on every render.
  const [filters, setFilters] = useState<FilterState>(() => loadDefaultFilters());
  // The Field view's own filter (role/health/cordon/labels over Node data) — the SAME "Filter" button opens
  // this instead of the Wheel's FilterPanel when mode === 'field' (see the panel-choice below), since the two
  // views filter fundamentally different things (a Node field vs. the Wheel's whole render model).
  const [nodeFilters, setNodeFilters] = useState<NodeFilterState>(DEFAULT_NODE_FILTERS);
  const [allNodes, setAllNodes] = useState<SceneNode[]>([]);
  // "Hide excluded" (button, top-right of the Field view) flips this true, actually removing excluded nodes
  // from the scene instead of just bordering them red; "Reset view" flips it back. Reset to false on every
  // snapshot swap so a stale hide from the PREVIOUS snapshot's node set doesn't carry over silently.
  const [nodesHidden, setNodesHidden] = useState(false);
  // Set by the Field view's "View in Wheel" button to the currently-included (green-border) Node ids — null
  // means "no restriction", which is what the plain Wheel tab always shows. Cleared (wheel refetched
  // unfiltered) whenever the user picks the Wheel tab directly rather than through that button.
  const [wheelNodeIds, setWheelNodeIds] = useState<string[] | null>(null);

  // Timelapse playback state (Wheel view only). `timelapseEnabled`/`playbackSpeed` are user preferences (like
  // `filters`) and deliberately survive a snapshot switch; `intervalIndex`/`playing`/`changesOpen` are
  // per-snapshot and reset alongside `wheel` below.
  const [timelapseEnabled, setTimelapseEnabled] = useState(false);
  const [intervalIndex, setIntervalIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [changesOpen, setChangesOpen] = useState(false);
  // Timelapse's own CATEGORY filter (separate state from the main FilterPanel's `filters`) — regenerated
  // whenever `wheel` itself changes (new snapshot, or a new Node-id restriction), since which categories/planes
  // are even present depends on the wheel's own contents. null before the first wheel loads.
  const [timelapseCategoryFilters, setTimelapseCategoryFilters] = useState<TimelapseCategoryFilters | null>(null);
  const [timelapseFilterOpen, setTimelapseFilterOpen] = useState(false);

  // Fetched here (not inside FieldScene) so the NodeFilterPanel — a sibling, not a child, of FieldScene — can
  // also see the full unfiltered Node set: it needs that to compute each field's available values/range and
  // the included/excluded counts, independent of whichever filters are currently applied.
  useEffect(() => {
    setAllNodes([]); // clear the PREVIOUS snapshot's Nodes immediately rather than leaving them showing until this fetch resolves
    const start = performance.now();
    console.log('[Scene3D] fetching /scene/nodes...');
    fetch('/scene/nodes')
      .then((r) => r.json() as Promise<SceneNode[]>)
      .then((nodes) => {
        console.log(`[Scene3D] /scene/nodes returned ${nodes.length} nodes in ${(performance.now() - start).toFixed(0)}ms`);
        setAllNodes(nodes);
      })
      .catch((err) => {
        console.error('[Scene3D] /scene/nodes failed:', err);
        setAllNodes([]);
      });
    setNodesHidden(false);
  }, [snapshotKey]);

  // Recomputed on every filter tweak so the top-right count row and the "Hide excluded" button both reflect
  // the CURRENT nodeFilters, not whatever was true the moment the button was last clicked.
  const includedNodeCount = useMemo(() => allNodes.filter((n) => nodePassesFilter(n, nodeFilters)).length, [allNodes, nodeFilters]);
  const excludedNodeCount = allNodes.length - includedNodeCount;

  // Ground grid sized to the CURRENT mode's actual content — a fixed size (the old behavior) fell short of the
  // outermost node/item on anything bigger than a handful of nodes, leaving nodes visibly floating past the
  // grid's own edge. Field's extent comes from the same layout formula FieldScene itself lays nodes out with
  // (fieldGridExtent); Wheel's from the server-computed outerRadius plus a buffer for the control-plane/
  // kubectl/registry items sitting further out still. One division per ~2 units keeps line density reasonable
  // even at a large extent (capped so a huge cluster doesn't emit thousands of grid lines).
  const gridExtent =
    mode === 'field' ? fieldGridExtent(nodesHidden ? includedNodeCount : allNodes.length) : (wheel?.outerRadius ?? 8) + WHEEL_GRID_RADIUS_BUFFER;
  const gridSize = Math.max(40, Math.ceil(gridExtent) * 2);
  const gridDivisions = Math.min(100, Math.round(gridSize / 2));

  function handleSelect(id: string) {
    onSelect(id);
    setPropsOpen(true);
    if (filters.playSound) playSelectSound();
  }

  // Timelapse's "Changes" list already names one specific resource per row, so a click jumps straight to its
  // source editor — unlike a 3D scene click (handleSelect above), there's no ambiguity that needs the small
  // Properties popup as an intermediate step.
  function handleChangeSelect(id: string) {
    onSelect(id);
    onOpenEditor();
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

  // Timelapse's discrete intervals — recomputed only when `wheel` itself changes (a new fetch), not on every
  // playback tick, same memo shape as `namespaces`/`presentPanes` above.
  const intervals = useMemo(() => (wheel ? buildIntervals(wheel) : []), [wheel]);

  // A fresh `wheel` fetch can produce a shorter/longer interval list than before — keep intervalIndex in
  // bounds rather than pointing past the end (or, worse, silently rendering nothing).
  useEffect(() => {
    if (intervalIndex >= intervals.length) setIntervalIndex(Math.max(0, intervals.length - 1));
  }, [intervals, intervalIndex]);

  // Autoplay: steps intervalIndex forward on a fixed real-world timer while `playing`, stopping (not looping)
  // at the end — the wheel finishing fully built and staying that way reads more naturally than jumping back
  // to empty. Every interval gets the SAME on-screen duration (BASE_STEP_MS / playbackSpeed) regardless of how
  // far apart its underlying cluster timestamp is from the previous one — a 2-minute gap in creation times
  // displays for exactly as long as a 2-second gap, since this is "watch the cluster's changes unfold at a
  // steady pace," not a literal real-time playback of elapsed cluster time. playbackSpeed (the control line's
  // speed selector) scales this directly: 1x = BASE_STEP_MS per interval, 2x = half that (faster), 0.5x =
  // double (slower).
  useEffect(() => {
    if (!playing || intervals.length === 0) return;
    if (intervalIndex >= intervals.length - 1) {
      setPlaying(false);
      return;
    }
    const BASE_STEP_MS = 1000; // 1 second per interval at the default 1x speed
    const timeout = setTimeout(() => setIntervalIndex((i) => Math.min(i + 1, intervals.length - 1)), BASE_STEP_MS / playbackSpeed);
    return () => clearTimeout(timeout);
  }, [playing, playbackSpeed, intervalIndex, intervals.length]);

  // The one derived value that composes timelapse into WheelScene's existing filter chain — null means
  // timelapse is off (no restriction, today's default behavior). Computed only from `wheel`/`intervals`/the
  // current index, not from anything render-only, so it's cheap to recompute per step.
  const visibleAtTime = useMemo(() => {
    if (!timelapseEnabled || !wheel || intervals.length === 0) return null;
    const interval = intervals[intervalIndex];
    if (!interval) return null;
    return visibleIdsAtInterval(wheel, interval.end);
  }, [timelapseEnabled, wheel, intervals, intervalIndex]);

  // None of the Control Plane's items (kubelets/kube-proxies/components/kubectl/registries) carry their own
  // creationTimestamp — they're synthesized per-Node or per-cluster, not individually timestamped resources —
  // so "the Control Plane exists" is anchored to the timelapse's own first event (intervalIndex > 0, i.e. past
  // the synthesized "before first event" interval) rather than any one item's timestamp. Always true when
  // timelapse itself is off.
  const controlPlaneRevealed = !visibleAtTime || intervalIndex > 0;

  // Timelapse's own CATEGORY filter is wheel-shaped (which categories/planes even exist varies per snapshot),
  // so it's regenerated to sensible defaults every time a NEW wheel is fetched — same trigger as the Field
  // view's `nodesHidden` reset, not the `snapshotKey` effect above (a "View in Wheel" Node-id restriction also
  // produces a new `wheel` without a snapshot change, and should reset this the same way).
  useEffect(() => {
    setTimelapseCategoryFilters(wheel ? defaultTimelapseCategoryFilters(wheel) : null);
  }, [wheel]);

  // Changes list for the CURRENT interval only (previous interval's end -> current interval's end) — the
  // "Changes" button's popover content.
  const changes = useMemo(() => {
    if (!wheel || intervals.length === 0 || intervalIndex === 0) return [];
    const prev = intervals[intervalIndex - 1];
    const curr = intervals[intervalIndex];
    if (!prev || !curr) return [];
    return changesInInterval(wheel, prev.end, curr.end);
  }, [wheel, intervals, intervalIndex]);

  // Invalidate the cached wheel whenever the snapshot changes, then let the effect below refetch it — Scene3D
  // never unmounts (see FieldScene's fetch comment above for why that matters here specifically). Without
  // this, switching snapshots leaves the wheel showing the PREVIOUS snapshot's resource ids, which then 404
  // when clicked against the new one.
  useEffect(() => {
    setWheel(null);
    setWheelNodeIds(null);
    setPropsOpen(false);
    setIntervalIndex(0);
    setPlaying(false);
    setChangesOpen(false);
    // timelapseEnabled/playbackSpeed are NOT reset here — user preferences, same as `filters` — see their own
    // declaration comment above.
  }, [snapshotKey]);

  // Also invalidate (and let the effect below refetch) whenever the Node-id restriction itself changes — e.g.
  // the Field view's "View in Wheel" button hands over a fresh set of ids while already in wheel mode.
  useEffect(() => {
    setWheel(null);
  }, [wheelNodeIds]);

  useEffect(() => {
    if (mode !== 'wheel' || wheel) return;
    const start = performance.now();
    console.log(`[Scene3D] fetching /scene/wheel (nodeIds=${wheelNodeIds?.length ?? 'all'})...`);
    fetch('/scene/wheel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeIds: wheelNodeIds }),
    })
      .then((r) => r.json() as Promise<ClusterWheel>)
      .then((w) => {
        console.log(`[Scene3D] /scene/wheel returned ${w.pods.length} pods in ${(performance.now() - start).toFixed(0)}ms`);
        setWheel(remapWheelKindColors(w));
      })
      .catch((err) => {
        console.error('[Scene3D] /scene/wheel failed:', err);
        setWheel(null);
      });
  }, [mode, wheel, wheelNodeIds]);

  // WheelScene mounts its whole Pod set (one PodHex + up to two MetricBar meshes each — see the uncapped-Pod
  // warning inside WheelScene) in a single React commit, which is the actual freeze on a large cluster, not
  // the fetch above. Setting `wheel` and mounting WheelScene in the same tick would schedule the freeze
  // before the browser ever gets to paint a "Rendering N pods..." message, so it'd never be seen. A single
  // rAF can still fire before that paint lands (timing is spec-loose here), so this waits for two — the
  // standard "definitely painted by now" pattern — before the heavy mount happens on the frame after that.
  const [wheelReady, setWheelReady] = useState(false);
  useEffect(() => {
    if (!wheel) {
      setWheelReady(false);
      return;
    }
    setWheelReady(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setWheelReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [wheel]);

  return (
    // Kept mounted (visibility toggle, not conditional render) so there's ever only one WebGL context and
    // switching views doesn't tear down / recreate the canvas (DESIGN.md 3D lifecycle: resident-paused).
    <div className="relative h-full w-full" style={{ display: active ? 'block' : 'none' }}>
      <div className="absolute top-2 left-2 z-10 flex gap-1">
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
        {(
          [
            ['field', 'Field'],
            ['wheel', 'Wheel'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setMode(id);
              // Picking the Wheel tab directly always shows the full cluster — only the Field view's
              // dedicated "View in Wheel" button narrows it to the green-bordered Nodes.
              if (id === 'wheel') setWheelNodeIds(null);
            }}
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
        {mode === 'wheel' && (
          <button
            onClick={() => setTimelapseEnabled((v) => !v)}
            className="rounded border px-2 py-1 text-xs cursor-pointer"
            style={{
              borderColor: 'var(--vpk-border)',
              background: timelapseEnabled ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
              color: timelapseEnabled ? '#fff' : 'var(--vpk-fg)',
            }}
          >
            Timelapse
          </button>
        )}
        <button
          onClick={() => {
            setPropsOpen(false);
            onDeselect();
          }}
          disabled={!selected}
          className="rounded border px-2 py-1 text-xs cursor-pointer disabled:cursor-default disabled:opacity-40"
          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
          title="Unselect and turn off every selection ring/highlight"
        >
          Clear
        </button>
      </div>
      {mode === 'field' && (
        <div
          className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded border px-2 py-1 text-xs"
          style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
        >
          <span>
            <span style={{ color: NODE_INCLUDED_COLOR }}>{nodesHidden ? includedNodeCount : allNodes.length}</span> shown ·{' '}
            <span style={{ color: NODE_EXCLUDED_COLOR }}>{nodesHidden ? excludedNodeCount : 0}</span> hidden · {allNodes.length} total ·{' '}
            <span style={{ color: NODE_INCLUDED_COLOR }}>{includedNodeCount}</span> in Wheel
          </span>
          <button
            onClick={() => setNodesHidden(true)}
            disabled={excludedNodeCount === 0}
            className="cursor-pointer rounded border px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Hide excluded
          </button>
          <button
            onClick={() => setNodesHidden(false)}
            disabled={!nodesHidden}
            className="cursor-pointer rounded border px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Reset view
          </button>
          <button
            onClick={() => {
              setWheelNodeIds(allNodes.filter((n) => nodePassesFilter(n, nodeFilters)).map((n) => n.id));
              setMode('wheel');
            }}
            disabled={includedNodeCount === 0}
            className="cursor-pointer rounded border px-1.5 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--vpk-border)' }}
            title="Switch to the Wheel view, showing only the Nodes with a green border here"
          >
            View in Wheel
          </button>
        </div>
      )}
      {mode === 'wheel' && <WheelLegend wheel={wheel} />}
      {mode === 'wheel' && wheel && timelapseEnabled && (
        <TimelapseControls
          intervals={intervals}
          intervalIndex={intervalIndex}
          onSetIntervalIndex={setIntervalIndex}
          playing={playing}
          onTogglePlaying={() => setPlaying((v) => !v)}
          speed={playbackSpeed}
          onSetSpeed={setPlaybackSpeed}
          changes={changes}
          changesOpen={changesOpen}
          onToggleChanges={() => setChangesOpen((v) => !v)}
          onSelectChange={handleChangeSelect}
          filterOpen={timelapseFilterOpen}
          onToggleFilter={() => setTimelapseFilterOpen((v) => !v)}
        />
      )}
      {timelapseFilterOpen && mode === 'wheel' && wheel && timelapseCategoryFilters && (
        <TimelapseFilterPanel
          wheel={wheel}
          filters={timelapseCategoryFilters}
          onChange={setTimelapseCategoryFilters}
          onClose={() => setTimelapseFilterOpen(false)}
        />
      )}
      {filterOpen && mode === 'field' && (
        <NodeFilterPanel filters={nodeFilters} onChange={setNodeFilters} onClose={() => setFilterOpen(false)} nodes={allNodes} />
      )}
      {filterOpen && mode === 'wheel' && (
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
      {mode === 'wheel' && wheel && !wheelReady && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'var(--vpk-bg)' }}
        >
          <span style={{ color: 'var(--vpk-fg)' }}>Rendering {wheel.pods.length.toLocaleString()} pods…</span>
        </div>
      )}
      <Canvas camera={{ position: mode === 'wheel' ? [0, 10, 22] : [4, 4, 8], fov: 50 }} style={{ background: 'var(--vpk-bg)' }}>
        <ThemeBackdrop theme={theme} />
        {fogEnabled && <fog attach="fog" args={[FOG_COLOR[theme], 25, 110]} />}
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} />
        {mode === 'field' ? (
          <FieldScene
            onSelect={handleSelect}
            selected={selected}
            filters={filters}
            nodeFilters={nodeFilters}
            allNodes={allNodes}
            nodesHidden={nodesHidden}
            theme={theme}
          />
        ) : wheel && wheelReady ? (
          <WheelScene
            wheel={wheel}
            onSelect={handleSelect}
            selected={selected}
            filters={filters}
            visibleAtTime={visibleAtTime}
            timelapseCategoryFilters={timelapseEnabled ? timelapseCategoryFilters : null}
            controlPlaneRevealed={controlPlaneRevealed}
            theme={theme}
          />
        ) : null}
        {gridEnabled && <gridHelper args={[gridSize, gridDivisions, '#d9d9d5', '#e8e8e5']} />}
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
