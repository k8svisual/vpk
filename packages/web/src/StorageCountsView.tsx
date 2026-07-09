import { useEffect, useState } from 'react';
import { KindIcon } from './StorageView';

interface VolumeUsage {
  podId: string;
  podName: string;
  namespace?: string;
  namespaceId?: string;
  nodeName?: string;
  nodeId?: string;
  volumeName: string;
  volumeType: string;
}

export type CountsDimension = 'type' | 'node' | 'namespace';

const DIM_LABEL: Record<CountsDimension, string> = { type: 'Volume Type', node: 'Cluster Node', namespace: 'Namespace' };

/** Each entry point's own fixed drill sequence (down to a leaf Pod list, appended by the caller) — NOT a
 *  generic rotation of one canonical order: Namespace deliberately skips Node entirely (3 stops, not 4),
 *  unlike Type/Node which both drill through all three dimensions. Matches the legacy app exactly: Type ->
 *  Node -> Namespace -> Pod, Node -> Type -> Namespace -> Pod, Namespace -> Type -> Pod. */
const DRILL_ORDER: Record<CountsDimension, CountsDimension[]> = {
  type: ['type', 'node', 'namespace'],
  node: ['node', 'type', 'namespace'],
  namespace: ['namespace', 'type'],
};

function drillOrder(root: CountsDimension): CountsDimension[] {
  return DRILL_ORDER[root];
}

function keyFor(u: VolumeUsage, dim: CountsDimension): string {
  if (dim === 'type') return u.volumeType;
  if (dim === 'node') return u.nodeName ?? '(unscheduled)';
  return u.namespace ?? '(none)';
}

/** A handful of pod volume source keys have a real matching K8s Kind (worth showing its real icon+color);
 *  everything else (emptyDir/hostPath/downwardAPI/nfs/projected/csi/...) falls through to the generic
 *  fallback icon — still gets a stable hashed color, just no dedicated artwork. */
const VOLUME_TYPE_KIND: Record<string, string> = {
  configMap: 'ConfigMap',
  secret: 'Secret',
  persistentVolumeClaim: 'PersistentVolumeClaim',
};

function iconKindFor(dim: CountsDimension, value: string): string {
  if (dim === 'node') return 'Node';
  if (dim === 'namespace') return 'Namespace';
  return VOLUME_TYPE_KIND[value] ?? value;
}

interface GroupRow {
  value: string;
  count: number;
}

function groupBy(usages: VolumeUsage[], dim: CountsDimension): GroupRow[] {
  const counts = new Map<string, number>();
  for (const u of usages) counts.set(keyFor(u, dim), (counts.get(keyFor(u, dim)) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
}

interface PodRow {
  podId: string;
  podName: string;
  namespace?: string;
  count: number;
}

function dedupePods(usages: VolumeUsage[]): PodRow[] {
  const byPod = new Map<string, PodRow>();
  for (const u of usages) {
    const existing = byPod.get(u.podId);
    if (existing) existing.count++;
    else byPod.set(u.podId, { podId: u.podId, podName: u.podName, namespace: u.namespace, count: 1 });
  }
  return [...byPod.values()].sort((a, b) => a.podName.localeCompare(b.podName));
}

const th: React.CSSProperties = { textAlign: 'left', padding: '5px 10px', borderBottom: '2px solid var(--vpk-border, #ccc)', fontSize: 12 };
const td: React.CSSProperties = { padding: '4px 10px', borderBottom: '1px solid var(--vpk-border, #eee)' };
const rowStyle: React.CSSProperties = { cursor: 'pointer' };

interface PathStep {
  dim: CountsDimension;
  value: string;
}

/** One entry point (Volume Type / Cluster Node / Namespace) into the shared aggregation-drill-down over
 *  every pod volume mount in the snapshot (DESIGN §6.10 Storage mode 2) — breadcrumb style per the locked
 *  "lean breadcrumb+collapsible" decision (not the legacy app's stacked-tables approach). Drills through the
 *  other two dimensions (fixed relative order, see `drillOrder`) down to a leaf Pod list; clicking a Pod opens
 *  its definition, clicking any earlier breadcrumb segment jumps back. */
export function StorageCountsView({ root, onSelect }: { root: CountsDimension; onSelect: (id: string) => void }) {
  const [usages, setUsages] = useState<VolumeUsage[]>([]);
  const [path, setPath] = useState<PathStep[]>([]);

  useEffect(() => {
    fetch('/storage-counts')
      .then((r) => r.json() as Promise<VolumeUsage[]>)
      .then(setUsages)
      .catch(() => setUsages([]));
  }, []);

  const order = drillOrder(root);
  const filtered = usages.filter((u) => path.every((step) => keyFor(u, step.dim) === step.value));
  const atLeaf = path.length >= order.length;
  const currentDim = atLeaf ? undefined : order[path.length];

  const jumpTo = (depth: number) => setPath((p) => p.slice(0, depth));

  if (usages.length === 0) {
    return <p style={{ color: '#888', fontSize: 13 }}>No pod volumes in this snapshot.</p>;
  }

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ marginBottom: 10 }}>
        <span
          onClick={() => jumpTo(0)}
          style={{ cursor: path.length > 0 ? 'pointer' : 'default', color: path.length > 0 ? '#2a5db0' : 'var(--vpk-fg-muted, #888)' }}
        >
          All {DIM_LABEL[root]}
        </span>
        {path.map((step, i) => (
          <span key={i}>
            {' → '}
            <span
              onClick={() => jumpTo(i + 1)}
              style={{ cursor: i < path.length - 1 ? 'pointer' : 'default', color: i < path.length - 1 ? '#2a5db0' : undefined }}
            >
              {step.value}
            </span>
          </span>
        ))}
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>{atLeaf ? 'Pod' : DIM_LABEL[currentDim!]}</th>
            <th style={th}>Count</th>
          </tr>
        </thead>
        <tbody>
          {atLeaf
            ? dedupePods(filtered).map((row) => (
                <tr key={row.podId} onClick={() => onSelect(row.podId)} style={rowStyle}>
                  <td style={{ ...td, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KindIcon kind="Pod" size={13} />
                    <span style={{ color: '#2a5db0' }}>{row.podName}</span>
                    {row.namespace && <span style={{ color: 'var(--vpk-fg-muted, #888)' }}>({row.namespace})</span>}
                  </td>
                  <td style={td}>{row.count}</td>
                </tr>
              ))
            : groupBy(filtered, currentDim!).map((row) => (
                <tr key={row.value} onClick={() => setPath((p) => [...p, { dim: currentDim!, value: row.value }])} style={rowStyle}>
                  <td style={{ ...td, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KindIcon kind={iconKindFor(currentDim!, row.value)} size={13} />
                    {row.value}
                  </td>
                  <td style={td}>{row.count}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
