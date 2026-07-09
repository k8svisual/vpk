import { useEffect, useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { KindIcon } from './StorageView';
import { networkIconBg } from './kindColors';

type Scope = 'namespace' | 'node';

interface ResourceRow {
  id: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  name: string;
  creationTimestamp?: string;
}

interface NodePodRow {
  id: string;
  name: string;
  namespace: string;
  status: string;
  color: string;
  daemonSet: boolean;
  creationTimestamp?: string;
}

interface NodeDto {
  id: string;
  name: string;
}

const HOVER_BG = 'rgba(128,128,128,0.15)';
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '5px 10px',
  borderBottom: '2px solid var(--vpk-border)',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};
const td: React.CSSProperties = { padding: '4px 10px', borderBottom: '1px solid var(--vpk-border)' };
const SORT_GLYPH: Record<string, string> = { asc: ' ▲', desc: ' ▼' };

/** "3d", "5h", "12m", ... — no reusable age formatter existed anywhere in the app yet. */
function formatAge(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d`;
  return `${Math.floor(days / 365)}y`;
}

function NamespaceResourceTable({ rows, onSelect }: { rows: ResourceRow[]; onSelect: (id: string) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'kind', desc: false }]);

  const columns = useMemo<ColumnDef<ResourceRow>[]>(
    () => [
      {
        accessorKey: 'kind',
        header: 'Kind',
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <KindIcon kind={c.getValue<string>()} size={13} bg={networkIconBg(c.getValue<string>())} />
            <span>{c.getValue<string>()}</span>
          </span>
        ),
      },
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'apiVersion', header: 'API Version', cell: (c) => <span style={{ color: 'var(--vpk-fg-muted)' }}>{c.getValue<string>()}</span> },
      { accessorKey: 'creationTimestamp', header: 'Age', cell: (c) => formatAge(c.getValue<string>()) },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <ResourceTableShell
      table={table}
      onRowSelect={(row) => onSelect(row.id)}
      empty="No resources found in this namespace."
    />
  );
}

function NodePodTable({ rows, onSelect }: { rows: NodePodRow[]; onSelect: (id: string) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'namespace', desc: false }]);

  const columns = useMemo<ColumnDef<NodePodRow>[]>(
    () => [
      { accessorKey: 'namespace', header: 'Namespace', cell: (c) => <span style={{ color: 'var(--vpk-fg-muted)' }}>{c.getValue<string>()}</span> },
      {
        accessorKey: 'name',
        header: 'Pod',
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <KindIcon kind="Pod" name={c.getValue<string>()} size={13} bg={networkIconBg('Pod')} />
            <span>{c.getValue<string>()}</span>
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.row.original.color, display: 'inline-block' }} />
            <span style={{ textTransform: 'capitalize' }}>{c.getValue<string>()}</span>
          </span>
        ),
      },
      { accessorKey: 'daemonSet', header: 'DaemonSet', cell: (c) => (c.getValue<boolean>() ? 'Yes' : '—') },
      { accessorKey: 'creationTimestamp', header: 'Age', cell: (c) => formatAge(c.getValue<string>()) },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <ResourceTableShell table={table} onRowSelect={(row) => onSelect(row.id)} empty="No pods scheduled on this node." />;
}

/** Shared sortable-table chrome for both scopes — kept generic over the row shape so NamespaceResourceTable and
 *  NodePodTable (different columns entirely) don't have to duplicate the header/row/hover markup. */
function ResourceTableShell<T extends { id: string }>({
  table,
  onRowSelect,
  empty,
}: {
  table: ReturnType<typeof useReactTable<T>>;
  onRowSelect: (row: T) => void;
  empty: string;
}) {
  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return (
      <p className="p-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
        {empty}
      </p>
    );
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} className="text-xs">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id} style={th} onClick={h.column.getToggleSortingHandler()}>
                {flexRender(h.column.columnDef.header, h.getContext())}
                {SORT_GLYPH[h.column.getIsSorted() as string] ?? ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowSelect(row.original)}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} style={td}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const selectStyle: React.CSSProperties = {
  borderColor: 'var(--vpk-field-border)',
  background: 'var(--vpk-bg)',
  color: 'var(--vpk-fg)',
};

/**
 * "Resources by Namespace or Node" (DESIGN follow-on, ported from the old app's Schematic-screen Namespace
 * icon — "click Namespace, see a table of every resource in it" — generalized to also cover Node, which the
 * old app never had: "click Node, see every pod scheduled there," DaemonSet pods included (they're real,
 * currently-running pods like any other — the old app only ever used DaemonSet-ownership to recolor an icon
 * elsewhere, never to filter a list). Namespace mode reuses the same `/resources` the Search view already
 * fetches; Node mode is a new server projection (see @vpk/core's projectPodsOnNode).
 */
export function ResourcesView({ onSelect }: { onSelect: (id: string) => void }) {
  const [scope, setScope] = useState<Scope>('namespace');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [nodeNames, setNodeNames] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [selectedNode, setSelectedNode] = useState('');
  const [allResources, setAllResources] = useState<ResourceRow[]>([]);
  const [nodePods, setNodePods] = useState<NodePodRow[]>([]);
  const [loading, setLoading] = useState(false);

  // No snapshot-change reset effect needed — App.tsx remounts this view (key={snaps.current}) on every
  // snapshot switch, same as EventsView/ContainerImagesView, so this only ever runs once per snapshot anyway.
  useEffect(() => {
    fetch('/namespaces')
      .then((r) => r.json() as Promise<string[]>)
      .then(setNamespaces)
      .catch(() => setNamespaces([]));
    fetch('/network/nodes')
      .then((r) => r.json() as Promise<NodeDto[]>)
      .then((nodes) => setNodeNames(nodes.map((n) => n.name).sort()))
      .catch(() => setNodeNames([]));
  }, []);

  useEffect(() => {
    if (scope !== 'namespace' || !selectedNamespace || allResources.length > 0) return;
    setLoading(true);
    fetch('/resources')
      .then((r) => r.json() as Promise<ResourceRow[]>)
      .then(setAllResources)
      .catch(() => setAllResources([]))
      .finally(() => setLoading(false));
  }, [scope, selectedNamespace, allResources.length]);

  useEffect(() => {
    if (scope !== 'node' || !selectedNode) return;
    setLoading(true);
    fetch(`/resources/pods-on-node?node=${encodeURIComponent(selectedNode)}`)
      .then((r) => r.json() as Promise<NodePodRow[]>)
      .then(setNodePods)
      .catch(() => setNodePods([]))
      .finally(() => setLoading(false));
  }, [scope, selectedNode]);

  const namespaceRows = useMemo(() => allResources.filter((r) => r.namespace === selectedNamespace), [allResources, selectedNamespace]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 pb-3 text-xs">
        <div className="flex overflow-hidden rounded border" style={{ borderColor: 'var(--vpk-border)' }}>
          {(['namespace', 'node'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="cursor-pointer px-3 py-1 capitalize"
              style={{
                background: scope === s ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
                color: scope === s ? '#fff' : 'var(--vpk-fg)',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {scope === 'namespace' ? (
          <label className="flex items-center gap-2">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Namespace</span>
            <select value={selectedNamespace} onChange={(e) => setSelectedNamespace(e.target.value)} className="rounded border px-2 py-1" style={selectStyle}>
              <option value="">Select…</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex items-center gap-2">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Node</span>
            <select value={selectedNode} onChange={(e) => setSelectedNode(e.target.value)} className="rounded border px-2 py-1" style={selectStyle}>
              <option value="">Select…</option>
              {nodeNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        {loading && <span style={{ color: 'var(--vpk-fg-muted)' }}>loading…</span>}
        {scope === 'namespace' && selectedNamespace && !loading && (
          <span style={{ color: 'var(--vpk-fg-muted)' }}>
            {namespaceRows.length} resource{namespaceRows.length === 1 ? '' : 's'}
          </span>
        )}
        {scope === 'node' && selectedNode && !loading && (
          <span style={{ color: 'var(--vpk-fg-muted)' }}>
            {nodePods.length} pod{nodePods.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded border" style={{ borderColor: 'var(--vpk-border)' }}>
        {scope === 'namespace' &&
          (selectedNamespace ? (
            <NamespaceResourceTable rows={namespaceRows} onSelect={onSelect} />
          ) : (
            <p className="p-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              Select a namespace to see every resource in it.
            </p>
          ))}
        {scope === 'node' &&
          (selectedNode ? (
            <NodePodTable rows={nodePods} onSelect={onSelect} />
          ) : (
            <p className="p-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              Select a node to see every pod currently running on it (DaemonSet pods included).
            </p>
          ))}
      </div>
    </div>
  );
}
