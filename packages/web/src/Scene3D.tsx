import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { DoubleSide } from 'three';
import { PropertiesPanel } from './PropertiesPanel';
import { FilterPanel, DEFAULT_FILTERS, type FilterState } from './FilterPanel';

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

const GRID_GAP = 2.2;
const SELECTION_RING_COLOR = '#e63946';

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
      <Text position={[0, height + 0.3, 0]} fontSize={0.22} color="#1f1f1d" anchorX="center" anchorY="bottom">
        {node.name}
      </Text>
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
}: {
  onSelect: (id: string) => void;
  selected: string | null;
  filters: FilterState;
}) {
  const [nodes, setNodes] = useState<SceneNode[]>([]);

  useEffect(() => {
    fetch('/scene/nodes')
      .then((r) => r.json() as Promise<SceneNode[]>)
      .then(setNodes)
      .catch(() => setNodes([]));
  }, []);

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
}
interface WheelPod extends WheelPoint {
  status: 'running' | 'pending' | 'failed' | 'succeeded' | 'unknown';
  daemonSet: boolean;
}
interface WheelTierItem extends WheelPoint {
  kind: string;
}
interface WheelEdge {
  podId: string;
  itemId: string;
}
interface ClusterWheel {
  outerRadius: number;
  nodes: WheelNode[];
  pods: WheelPod[];
  network: { items: WheelTierItem[]; totalCount: number };
  config: { items: WheelTierItem[]; totalCount: number };
  storage: { items: WheelTierItem[]; totalCount: number };
  podToNetwork: WheelEdge[];
  podToStorage: WheelEdge[];
}

/** Whether a pod passes the Pods section of the filter panel — DaemonSet-ness takes priority over phase,
 *  mirroring the color rule (a DaemonSet pod is always grey regardless of phase). */
function podPassesFilter(p: WheelPod, filters: FilterState): boolean {
  if (p.daemonSet) return filters.podDaemonSet;
  return { running: filters.podRunning, pending: filters.podWarning, failed: filters.podFailed, succeeded: filters.podSucceeded, unknown: true }[
    p.status
  ];
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

/** A real Pod -> resource line (References a Service it's backed by, or a PVC it mounts) — not a generic
 *  drop to the ring plane. Colored to match the resource kind at the far end. */
function LinkLine({ a, b, color }: { a: WheelPoint; b: WheelPoint; color: string }) {
  const points: [number, number, number][] = [
    [a.x, a.y, a.z],
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

/** Faint vertical connector for the ambient (unlinked) Config tier — ConfigMaps/Secrets aren't tied to one
 *  pod the way Services/PVCs are, so there's no single real edge to draw for them. */
function DropLine({ p }: { p: WheelPoint }) {
  const points: [number, number, number][] = [
    [p.x, p.y, p.z],
    [p.x, 0, p.z],
  ];
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#bbbbbb" transparent opacity={0.4} />
    </line>
  );
}

/** Radius a selection ring should draw at for each wheel category, roughly enclosing that category's own
 *  geometry (node role box, pod/tier dot, storage cylinder). */
function findWheelSelection(wheel: ClusterWheel, selected: string | null): { x: number; y: number; z: number; radius: number } | null {
  if (!selected) return null;
  const node = wheel.nodes.find((n) => n.id === selected);
  if (node) return { x: node.x, y: 0.3, z: node.z, radius: 0.55 };
  const pod = wheel.pods.find((p) => p.id === selected);
  if (pod) return { x: pod.x, y: pod.y, z: pod.z, radius: 0.17 };
  const net = wheel.network.items.find((i) => i.id === selected);
  if (net) return { x: net.x, y: net.y, z: net.z, radius: 0.2 };
  const store = wheel.storage.items.find((i) => i.id === selected);
  if (store) return { x: store.x, y: store.y, z: store.z, radius: 0.22 };
  const cfg = wheel.config.items.find((i) => i.id === selected);
  if (cfg) return { x: cfg.x, y: cfg.y, z: cfg.z, radius: 0.18 };
  return null;
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

  const visiblePods = wheel.pods.filter((p) => podPassesFilter(p, filters));
  const visibleNetwork = filters.showNetwork ? wheel.network.items : [];
  const visibleStorage = filters.showStorage ? wheel.storage.items : [];

  const byId = useMemo(() => {
    const map = new Map<string, WheelPoint>();
    for (const p of visiblePods) map.set(p.id, p);
    for (const item of visibleNetwork) map.set(item.id, item);
    for (const item of visibleStorage) map.set(item.id, item);
    return map;
  }, [wheel, filters]);

  const selection = findWheelSelection(wheel, selected);

  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(ringPoints.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#da8c84" transparent opacity={0.5} />
      </line>
      {filters.showNodes &&
        wheel.nodes.map((n) => (
          <group key={n.id}>
            {/* box color = role (master vs worker); small dot = health, so neither signal is lost */}
            <mesh
              position={[n.x, 0.3, n.z]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
              }}
            >
              <boxGeometry args={[0.7, 0.6, 0.7]} />
              <meshBasicMaterial color={n.color} />
            </mesh>
            <mesh position={[n.x + 0.4, 0.6, n.z + 0.4]}>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshBasicMaterial color={n.healthColor} />
            </mesh>
            <Text position={[n.x, 0.75, n.z]} fontSize={0.24} color="#1f1f1d" anchorX="center" anchorY="bottom">
              {n.name}
            </Text>
          </group>
        ))}
      {visiblePods.map((p) => (
        <PodHex key={p.id} p={p} size={0.1} onSelect={onSelect} />
      ))}
      {visibleNetwork.map((item) => (
        <Dot key={item.id} p={item} size={0.12} onSelect={onSelect} />
      ))}
      {wheel.podToNetwork.map((e) => {
        const a = byId.get(e.podId);
        const b = byId.get(e.itemId);
        return a && b ? <LinkLine key={`${e.podId}|${e.itemId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {visibleStorage.map((item) => (
        <mesh
          key={item.id}
          position={[item.x, item.y, item.z]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.id);
          }}
        >
          <cylinderGeometry args={[0.12, 0.12, 0.22, 8]} />
          <meshBasicMaterial color={item.color} />
        </mesh>
      ))}
      {wheel.podToStorage.map((e) => {
        const a = byId.get(e.podId);
        const b = byId.get(e.itemId);
        return a && b ? <LinkLine key={`${e.podId}|${e.itemId}`} a={a} b={b} color={b.color} /> : null;
      })}
      {wheel.config.items.map((item) => (
        <group key={item.id}>
          <DropLine p={item} />
          <Dot p={item} size={0.1} onSelect={onSelect} />
        </group>
      ))}
      {selection && <SelectionRing {...selection} />}
    </>
  );
}

function WheelLegend({ wheel }: { wheel: ClusterWheel | null }) {
  if (!wheel) return null;
  const capped = [wheel.network, wheel.config, wheel.storage].some((t) => t.items.length < t.totalCount);
  if (!capped) return null;
  return (
    <div
      className="absolute bottom-2 left-2 rounded px-2 py-1 text-xs"
      style={{ background: 'var(--vpk-surface)', color: 'var(--vpk-fg-muted)', border: '1px solid var(--vpk-border)' }}
    >
      showing {wheel.network.items.length}/{wheel.network.totalCount} services · {wheel.config.items.length}/{wheel.config.totalCount} config
      · {wheel.storage.items.length}/{wheel.storage.totalCount} storage
    </div>
  );
}

type Mode = 'field' | 'wheel';

/**
 * 3D hero view (DESIGN §6.8), scaling model: field (all nodes, flat grid) -> wheel (small-N radial layout with
 * network/config/storage tiers) -> pill/single-node (not built yet). Toggle between the two built modes.
 */
export function Scene3D({
  onSelect,
  active,
  selected,
  onOpenEditor,
  onViewSchematic,
}: {
  onSelect: (id: string) => void;
  active: boolean;
  selected: string | null;
  onOpenEditor: () => void;
  onViewSchematic: () => void;
}) {
  const [mode, setMode] = useState<Mode>('field');
  const [wheel, setWheel] = useState<ClusterWheel | null>(null);
  // Separate from `selected`/the ring: a 3D click shows the small Properties popup first (matching the
  // legacy app), not the full editor — the editor only opens when the popup's own button is clicked.
  const [propsOpen, setPropsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  function handleSelect(id: string) {
    onSelect(id);
    setPropsOpen(true);
  }

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
      {filterOpen && <FilterPanel filters={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} />}
      <PropertiesPanel
        resourceId={propsOpen ? selected : null}
        onOpenEditor={onOpenEditor}
        onViewSchematic={onViewSchematic}
        onClose={() => setPropsOpen(false)}
      />
      <Canvas camera={{ position: mode === 'wheel' ? [0, 10, 22] : [4, 4, 8], fov: 50 }} style={{ background: 'var(--vpk-bg)' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} />
        {mode === 'field' ? (
          <FieldScene onSelect={handleSelect} selected={selected} filters={filters} />
        ) : wheel ? (
          <WheelScene wheel={wheel} onSelect={handleSelect} selected={selected} filters={filters} />
        ) : null}
        <gridHelper args={[40, 40, '#d9d9d5', '#e8e8e5']} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
