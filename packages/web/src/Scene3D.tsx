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

/**
 * 3D hero view, MVP (DESIGN §6.8): the "node field" — step 1 of the scaling model (field -> pill -> wheel
 * -> single-node). All nodes as boxes, width~cpu, height~memory, color=health rollup. Fixed grid layout for
 * now (no facet filtering / pill collapse yet — that's follow-up work).
 */
export function Scene3D({ onSelect, active }: { onSelect: (id: string) => void; active: boolean }) {
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
    // Kept mounted (visibility toggle, not conditional render) so there's ever only one WebGL context and
    // switching views doesn't tear down / recreate the canvas (DESIGN.md 3D lifecycle: resident-paused).
    <div className="h-full w-full" style={{ display: active ? 'block' : 'none' }}>
      {nodes.length === 0 && (
        <p className="p-2 text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>
          No nodes in this snapshot.
        </p>
      )}
      <Canvas camera={{ position: [4, 4, 8], fov: 50 }} style={{ background: 'var(--vpk-bg)' }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} />
        {nodes.map((n, i) => (
          <NodeBox key={n.id} node={n} position={positions[i] as [number, number, number]} onSelect={onSelect} />
        ))}
        <gridHelper args={[40, 40, '#d9d9d5', '#e8e8e5']} />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
