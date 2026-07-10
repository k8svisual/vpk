import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Inbox, MousePointerClick } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { KindIcon, formatBytes } from './StorageView';
import { networkIconBg } from './kindColors';

type Scope = 'namespace' | 'node';
type GroupSort = 'name' | 'count';

interface ResourceRow {
  id: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  name: string;
  creationTimestamp?: string;
  /** Pod-kind rows only — see @vpk/core's podResources.ts. */
  cpuCores?: number;
  memBytes?: number;
  hasRequests?: boolean;
}

interface NodePodRow {
  id: string;
  name: string;
  namespace: string;
  status: string;
  color: string;
  daemonSet: boolean;
  creationTimestamp?: string;
  cpuCores?: number;
  memBytes?: number;
  hasRequests: boolean;
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
/** Sorts a possibly-undefined numeric column (CPU/Memory requested) treating "not requested" as below any
 *  real value, including an explicit 0 — the two are meaningfully different (0 was set, undefined never was). */
const sortUndefinedLow = (rowA: { getValue: (id: string) => unknown }, rowB: { getValue: (id: string) => unknown }, columnId: string) => {
  const a = (rowA.getValue(columnId) as number | undefined) ?? -1;
  const b = (rowB.getValue(columnId) as number | undefined) ?? -1;
  return a - b;
};

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

/** "250m" below a full core, otherwise a trimmed decimal ("1", "1.5") — matches how `kubectl top`/requests are
 *  usually read at a glance. */
function formatCpu(cores: number | undefined): string {
  if (cores === undefined) return '—';
  if (cores < 1) return `${Math.round(cores * 1000)}m`;
  return `${Math.round(cores * 100) / 100}`;
}

/** Pod-only columns (CPU/Memory requested) — appended to a group's table only when that group's kind is Pod;
 *  every other kind has no resources.requests to show. */
function podResourceColumns<T extends { cpuCores?: number; memBytes?: number }>(): ColumnDef<T>[] {
  return [
    { accessorKey: 'cpuCores', header: 'CPU (req)', cell: (c) => formatCpu(c.getValue<number | undefined>()), sortingFn: sortUndefinedLow },
    { accessorKey: 'memBytes', header: 'Memory (req)', cell: (c) => formatBytes(c.getValue<number | undefined>()), sortingFn: sortUndefinedLow },
  ];
}

/** kubectl-explain-style description panel, toggled from a group header's Explain button — same fetch/cache
 *  contract as DefinitionModal's own Explain button (see /explain's doc comment there for why this is almost
 *  always the "not captured" fallback today). Cached per kind so re-toggling the same group doesn't re-fetch. */
function useExplain() {
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string | null>>({});
  const [loadingKind, setLoadingKind] = useState<string | null>(null);

  function toggle(kind: string) {
    if (openKind === kind) {
      setOpenKind(null);
      return;
    }
    setOpenKind(kind);
    if (kind in text || loadingKind === kind) return;
    setLoadingKind(kind);
    fetch(`/explain?kind=${encodeURIComponent(kind)}`)
      .then((r) => r.json() as Promise<{ description: string | null }>)
      .then((d) => setText((t) => ({ ...t, [kind]: d.description ?? 'No description captured for this resource kind yet.' })))
      .catch(() => setText((t) => ({ ...t, [kind]: 'Could not load an explanation for this resource kind.' })))
      .finally(() => setLoadingKind(null));
  }

  return { openKind, toggle, text, loadingKind };
}

function GroupTable({ rows, kind, onSelect }: { rows: ResourceRow[]; kind: string; onSelect: (id: string) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const columns = useMemo<ColumnDef<ResourceRow>[]>(() => {
    const base: ColumnDef<ResourceRow>[] = [
      { accessorKey: 'name', header: 'Name' },
      ...(kind === 'Pod' ? podResourceColumns<ResourceRow>() : []),
      { accessorKey: 'apiVersion', header: 'API Version', cell: (c) => <span style={{ color: 'var(--vpk-fg-muted)' }}>{c.getValue<string>()}</span> },
      { accessorKey: 'creationTimestamp', header: 'Age', cell: (c) => formatAge(c.getValue<string>()) },
    ];
    return base;
  }, [kind]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <ResourceTableShell table={table} onRowSelect={(row) => onSelect(row.id)} empty="No resources." />;
}

/** Namespace mode's grouped-by-Kind layout (DESIGN follow-on): one collapsible section per Kind, its header
 *  showing the Kind, a count badge, and an Explain button — replaces the old single flat table so a
 *  namespace with many kinds (and many resources per kind) stays scannable. Group order is either
 *  alphabetical (default) or by resource count, toggled by the caller. */
function NamespaceResourceGroups({
  rows,
  groupSort,
  onSelect,
}: {
  rows: ResourceRow[];
  groupSort: GroupSort;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const explain = useExplain();

  const groups = useMemo(() => {
    const byKind = new Map<string, ResourceRow[]>();
    for (const r of rows) {
      if (!byKind.has(r.kind)) byKind.set(r.kind, []);
      byKind.get(r.kind)!.push(r);
    }
    const list = [...byKind.entries()].map(([kind, groupRows]) => ({ kind, rows: groupRows }));
    return list.sort((a, b) => (groupSort === 'count' ? b.rows.length - a.rows.length : a.kind.localeCompare(b.kind)));
  }, [rows, groupSort]);

  function toggleCollapsed(kind: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  if (groups.length === 0) {
    return <EmptyState icon={Inbox}>No resources found in this namespace.</EmptyState>;
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.kind);
        const isExplainOpen = explain.openKind === group.kind;
        return (
          <div key={group.kind} className="border-b" style={{ borderColor: 'var(--vpk-border)' }}>
            <div
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs"
              onClick={() => toggleCollapsed(group.kind)}
              style={{ background: 'var(--vpk-bg)' }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <KindIcon kind={group.kind} size={13} bg={networkIconBg(group.kind)} apiVersion={group.rows[0]?.apiVersion} />
              <span className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
                {group.kind}
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ background: 'var(--vpk-surface)', color: 'var(--vpk-fg-muted)' }}
              >
                {group.rows.length}
              </span>
              <div className="flex-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  explain.toggle(group.kind);
                }}
                className="cursor-pointer rounded border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: isExplainOpen ? 'var(--vpk-accent)' : 'var(--vpk-border)',
                  color: isExplainOpen ? 'var(--vpk-accent)' : 'var(--vpk-fg-muted)',
                }}
              >
                Explain
              </button>
            </div>
            {isExplainOpen && (
              <div className="px-4 py-2 text-xs" style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)', whiteSpace: 'pre-wrap' }}>
                {explain.loadingKind === group.kind ? 'Loading…' : explain.text[group.kind]}
              </div>
            )}
            {!isCollapsed && <GroupTable rows={group.rows} kind={group.kind} onSelect={onSelect} />}
          </div>
        );
      })}
    </div>
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
      ...podResourceColumns<NodePodRow>(),
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

  return (
    <ResourceTableShell
      table={table}
      onRowSelect={(row) => onSelect(row.id)}
      empty={<EmptyState icon={Inbox}>No pods scheduled on this node.</EmptyState>}
    />
  );
}

/** Shared sortable-table chrome for both scopes — kept generic over the row shape so NamespaceResourceGroups'
 *  per-kind tables and NodePodTable (different columns entirely) don't have to duplicate the header/row/hover
 *  markup. */
function ResourceTableShell<T extends { id: string }>({
  table,
  onRowSelect,
  empty,
}: {
  table: ReturnType<typeof useReactTable<T>>;
  onRowSelect: (row: T) => void;
  empty: React.ReactNode;
}) {
  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return typeof empty === 'string' ? (
      <p className="p-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
        {empty}
      </p>
    ) : (
      empty
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
 * fetches (grouped by Kind, collapsible, sortable by name/count); Node mode is a new server projection (see
 * @vpk/core's projectPodsOnNode), sortable by requested CPU/Memory. Both scopes share a "Pods without
 * requests" filter — a cluster-hygiene signal (unbounded scheduling, no eviction protection) that's just as
 * relevant whether you're looking at a namespace's Pods or a node's.
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
  const [groupSort, setGroupSort] = useState<GroupSort>('name');
  const [noRequestsOnly, setNoRequestsOnly] = useState(false);

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
    // Guards against a slower response for a PREVIOUSLY-selected Node landing after a newer one has already
    // started — without this a fast Node switch can leave the table showing the wrong Node's pods.
    let cancelled = false;
    fetch(`/resources/pods-on-node?node=${encodeURIComponent(selectedNode)}`)
      .then((r) => r.json() as Promise<NodePodRow[]>)
      .then((rows) => {
        if (!cancelled) setNodePods(rows);
      })
      .catch(() => {
        if (!cancelled) setNodePods([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, selectedNode]);

  const namespaceRows = useMemo(() => {
    const inNamespace = allResources.filter((r) => r.namespace === selectedNamespace);
    return noRequestsOnly ? inNamespace.filter((r) => r.kind === 'Pod' && !r.hasRequests) : inNamespace;
  }, [allResources, selectedNamespace, noRequestsOnly]);

  const filteredNodePods = useMemo(() => (noRequestsOnly ? nodePods.filter((r) => !r.hasRequests) : nodePods), [nodePods, noRequestsOnly]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 pb-3 text-xs">
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

        {scope === 'namespace' && selectedNamespace && (
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Sort groups by</span>
            <select value={groupSort} onChange={(e) => setGroupSort(e.target.value as GroupSort)} className="rounded border px-2 py-1" style={selectStyle}>
              <option value="name">Name</option>
              <option value="count">Count</option>
            </select>
          </label>
        )}

        {((scope === 'namespace' && selectedNamespace) || (scope === 'node' && selectedNode)) && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={noRequestsOnly} onChange={(e) => setNoRequestsOnly(e.target.checked)} />
            <span style={{ color: 'var(--vpk-fg)' }}>Pods without requests only</span>
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
            {filteredNodePods.length} pod{filteredNodePods.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded border" style={{ borderColor: 'var(--vpk-border)' }}>
        {scope === 'namespace' &&
          (selectedNamespace ? (
            <NamespaceResourceGroups rows={namespaceRows} groupSort={groupSort} onSelect={onSelect} />
          ) : (
            <EmptyState icon={MousePointerClick}>Select a namespace to see every resource in it.</EmptyState>
          ))}
        {scope === 'node' &&
          (selectedNode ? (
            <NodePodTable rows={filteredNodePods} onSelect={onSelect} />
          ) : (
            <EmptyState icon={MousePointerClick}>
              Select a node to see every pod currently running on it (DaemonSet pods included).
            </EmptyState>
          ))}
      </div>
    </div>
  );
}
