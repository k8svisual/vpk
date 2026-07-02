import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

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
  ok: '#2e8b57',
  warn: '#d4a017',
  error: '#c0392b',
};

const GRID_GAP = 2.2;

function NodeBox({ node, position, onSelect }: { node: SceneNode; position: [number, number, number]; onSelect: (id: string) => void }) {
  const width = 1 + Math.min(2, (node.cpuCapacity ?? 1) / 8);
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

function FieldScene({ onSelect }: { onSelect: (id: string) => void }) {
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

  return (
    <>
      {nodes.map((n, i) => (
        <NodeBox key={n.id} node={n} position={positions[i] as [number, number, number]} onSelect={onSelect} />
      ))}
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
  podCount: number;
}
interface WheelTierItem extends WheelPoint {
  kind: string;
}
interface ClusterWheel {
  ringRadius: number;
  nodes: WheelNode[];
  pods: WheelPoint[];
  network: { items: WheelTierItem[]; totalCount: number };
  config: { items: WheelTierItem[]; totalCount: number };
  storage: { items: WheelTierItem[]; totalCount: number };
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
      <meshStandardMaterial color={p.color} />
    </mesh>
  );
}

/** Faint vertical connector from a tier item down/up to the main ring plane — a stylistic approximation of
 *  the reference image's fan-lines, not a literal per-resource edge (that would be a hairball at real scale). */
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
      <lineBasicMaterial color="#bbbbbb" transparent opacity={0.5} />
    </line>
  );
}

function WheelScene({ wheel, onSelect }: { wheel: ClusterWheel; onSelect: (id: string) => void }) {
  const ringPoints: [number, number, number][] = Array.from({ length: 65 }, (_, i) => {
    const a = (2 * Math.PI * i) / 64;
    return [wheel.ringRadius * Math.cos(a), 0, wheel.ringRadius * Math.sin(a)];
  });

  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(ringPoints.flat()), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#c0392b" transparent opacity={0.5} />
      </line>
      {wheel.nodes.map((n) => (
        <group key={n.id}>
          <mesh
            position={[n.x, 0.3, n.z]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n.id);
            }}
          >
            <boxGeometry args={[0.7, 0.6, 0.7]} />
            <meshStandardMaterial color={n.color} />
          </mesh>
          <Text position={[n.x, 0.75, n.z]} fontSize={0.24} color="#1f1f1d" anchorX="center" anchorY="bottom">
            {n.name}
          </Text>
        </group>
      ))}
      {wheel.pods.map((p) => (
        <Dot key={p.id} p={p} size={0.09} onSelect={onSelect} />
      ))}
      {wheel.network.items.map((item) => (
        <group key={item.id}>
          <DropLine p={item} />
          <Dot p={item} size={0.12} onSelect={onSelect} />
        </group>
      ))}
      {wheel.config.items.map((item) => (
        <group key={item.id}>
          <DropLine p={item} />
          <Dot p={item} size={0.1} onSelect={onSelect} />
        </group>
      ))}
      {wheel.storage.items.map((item) => (
        <group key={item.id}>
          <DropLine p={item} />
          <mesh
            position={[item.x, item.y, item.z]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
          >
            <cylinderGeometry args={[0.12, 0.12, 0.22, 8]} />
            <meshStandardMaterial color={item.color} />
          </mesh>
        </group>
      ))}
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
export function Scene3D({ onSelect, active }: { onSelect: (id: string) => void; active: boolean }) {
  const [mode, setMode] = useState<Mode>('field');
  const [wheel, setWheel] = useState<ClusterWheel | null>(null);

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
      </div>
      {mode === 'wheel' && <WheelLegend wheel={wheel} />}
      <Canvas camera={{ position: mode === 'wheel' ? [0, 10, 22] : [4, 4, 8], fov: 50 }} style={{ background: 'var(--vpk-bg)' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} />
        {mode === 'field' ? <FieldScene onSelect={onSelect} /> : wheel ? <WheelScene wheel={wheel} onSelect={onSelect} /> : null}
        <gridHelper args={[40, 40, '#d9d9d5', '#e8e8e5']} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
