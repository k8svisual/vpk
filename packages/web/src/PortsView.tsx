import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { KindIcon } from './StorageView';
import { networkIconBg } from './kindColors';

// A translucent grey that reads on any theme — `--vpk-rail-active-bg` is a DARK rail color, so using it as a
// light-modal row hover turned the background near-black under dark text (unreadable).
const HOVER_BG = 'rgba(128,128,128,0.15)';

type PortSource = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' | 'containerPort' | 'hostPort';
const HOST_LEVEL = new Set<PortSource>(['NodePort', 'LoadBalancer', 'hostPort']);

interface PortUsage {
  port: number;
  protocol: string;
  source: PortSource;
  name?: string;
  targetPort?: string | number;
  nodePort?: number;
  hostPort?: number;
  containerName?: string;
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  namespace?: string;
}

/** Color per source; host-level sources warm, cluster-internal cool. */
const SOURCE_COLOR: Record<PortSource, string> = {
  ClusterIP: '#3d6fd6',
  NodePort: '#c0392b',
  LoadBalancer: '#c0392b',
  ExternalName: '#7a7a7a',
  containerPort: '#2e9e4f',
  hostPort: '#d4820a',
};

function SourceChip({ source, count }: { source: PortSource; count?: number }) {
  return (
    <span
      title={HOST_LEVEL.has(source) ? 'host-level (reachable outside the pod network)' : 'cluster-internal'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 6px',
        borderRadius: 10,
        fontSize: 11,
        color: '#fff',
        background: SOURCE_COLOR[source],
        whiteSpace: 'nowrap',
      }}
    >
      {source}
      {count !== undefined && <b>{count}</b>}
    </span>
  );
}

/** The extra detail a given source carries (targetPort / nodePort / hostPort / container). */
function detailOf(u: PortUsage): string {
  if (u.source === 'NodePort' || u.source === 'LoadBalancer') return u.nodePort ? `nodePort ${u.nodePort}` : u.targetPort ? `→ ${u.targetPort}` : '';
  if (u.source === 'ClusterIP') return u.targetPort ? `→ ${u.targetPort}` : '';
  if (u.source === 'hostPort') return `hostPort ${u.hostPort} · ${u.containerName ?? ''}`;
  if (u.source === 'containerPort') return u.containerName ?? '';
  return '';
}

const th: React.CSSProperties = { textAlign: 'left', padding: '5px 10px', borderBottom: '2px solid var(--vpk-border, #ccc)', fontSize: 12, cursor: 'pointer' };
const td: React.CSSProperties = { padding: '4px 10px', borderBottom: '1px solid var(--vpk-border, #eee)' };

// ---- Aggregate (group by port) mode ---------------------------------------------------------------------

interface PortGroup {
  key: string;
  port: number;
  protocol: string;
  total: number;
  counts: Record<string, number>;
  hostLevel: boolean;
}

/** The source columns shown (and sortable) in the aggregate table — each a per-port count. */
const SOURCE_COLS: PortSource[] = ['ClusterIP', 'NodePort', 'LoadBalancer', 'containerPort', 'hostPort'];

function groupByPort(usages: PortUsage[]): PortGroup[] {
  const map = new Map<string, PortGroup>();
  for (const u of usages) {
    const key = `${u.port}/${u.protocol}`;
    let g = map.get(key);
    if (!g) {
      g = { key, port: u.port, protocol: u.protocol, total: 0, counts: {}, hostLevel: false };
      map.set(key, g);
    }
    g.total++;
    g.counts[u.source] = (g.counts[u.source] ?? 0) + 1;
    if (HOST_LEVEL.has(u.source)) g.hostLevel = true;
  }
  // Insertion order follows projectPortUsage's port-ascending sort → sensible default before any header click.
  return [...map.values()];
}

const aggColumns: ColumnDef<PortGroup>[] = [
  {
    accessorKey: 'port',
    header: 'Port',
    cell: (c) => (
      <span style={{ color: '#2a5db0', fontWeight: 600 }}>
        {c.getValue<number>()}
        {c.row.original.hostLevel && (
          <span title="host-level exposure (NodePort / LoadBalancer / hostPort)" style={{ marginLeft: 6, color: '#c0392b' }}>
            ●
          </span>
        )}
      </span>
    ),
  },
  { accessorKey: 'protocol', header: 'Proto' },
  { accessorKey: 'total', header: 'Total' },
  ...SOURCE_COLS.map(
    (s): ColumnDef<PortGroup> => ({
      id: s,
      header: () => <span style={{ color: SOURCE_COLOR[s] }}>{s}</span>,
      accessorFn: (r) => r.counts[s] ?? 0,
      cell: (c) => {
        const v = c.getValue<number>();
        return v ? <span style={{ color: SOURCE_COLOR[s], fontWeight: 600 }}>{v}</span> : <span style={{ color: '#ccc' }}>·</span>;
      },
    }),
  ),
];

function AggregateMode({ usages, onOpenPort }: { usages: PortUsage[]; onOpenPort: (port: number, protocol: string) => void }) {
  const groups = useMemo(() => groupByPort(usages), [usages]);
  const table = useReactTable({
    data: groups,
    columns: aggColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id} onClick={h.column.getToggleSortingHandler()} style={th}>
                {flexRender(h.column.columnDef.header, h.getContext())}
                {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onOpenPort(row.original.port, row.original.protocol)}
            style={{ cursor: 'pointer' }}
            title="Show all uses of this port"
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

/** Modal listing every use of one port (opened by clicking a port row); each row → definition. */
function PortUsesModal({
  port,
  protocol,
  usages,
  onSelect,
  onClose,
}: {
  port: number;
  protocol: string;
  usages: PortUsage[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'resource', desc: false }]);
  const rows = useMemo(
    () => usages.filter((u) => u.port === port && u.protocol === protocol),
    [usages, port, protocol],
  );

  const columns = useMemo<ColumnDef<PortUsage>[]>(
    () => [
      {
        id: 'resource',
        accessorFn: (u) => `${u.namespace ?? ''}/${u.resourceName}`,
        header: 'Resource',
        cell: ({ row }) => {
          const u = row.original;
          return (
            <span className="flex items-center gap-1.5 truncate">
              <KindIcon kind={u.resourceKind} name={u.resourceName} size={13} bg={networkIconBg(u.resourceKind)} />
              {u.namespace && <span style={{ color: 'var(--vpk-fg-muted)' }}>{u.namespace} /</span>}
              <span style={{ color: '#2a5db0' }}>{u.resourceName}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => <SourceChip source={row.original.source} />,
      },
      {
        id: 'detail',
        accessorFn: (u) => detailOf(u),
        header: 'Detail',
        cell: ({ getValue }) => (
          <span style={{ color: '#555', fontFamily: 'ui-monospace, monospace' }}>{getValue() as string}</span>
        ),
      },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--vpk-border)' }}>
          <span className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Port {port}/{protocol}
            <span className="ml-2 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              · {rows.length} use{rows.length === 1 ? '' : 's'}
            </span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
          >
            Close
          </button>
        </div>
        <div className="overflow-auto text-xs" style={{ color: 'var(--vpk-fg)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} style={th} onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {({ asc: ' ▲', desc: ' ▼' } as Record<string, string>)[h.column.getIsSorted() as string] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    onSelect(row.original.resourceId);
                    onClose();
                  }}
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
        </div>
      </div>
    </div>
  );
}

// ---- Flat table mode ------------------------------------------------------------------------------------

const columns: ColumnDef<PortUsage>[] = [
  { accessorKey: 'port', header: 'Port' },
  { accessorKey: 'protocol', header: 'Proto' },
  { accessorKey: 'source', header: 'Source', cell: (c) => <SourceChip source={c.getValue<PortSource>()} /> },
  { id: 'detail', header: 'Detail', cell: (c) => detailOf(c.row.original) },
  { accessorKey: 'resourceKind', header: 'Kind' },
  { accessorKey: 'namespace', header: 'Namespace', cell: (c) => c.getValue<string>() ?? '—' },
  {
    accessorKey: 'resourceName',
    header: 'Resource',
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <KindIcon kind={row.original.resourceKind} name={row.original.resourceName} size={13} bg={networkIconBg(row.original.resourceKind)} />
        {row.original.resourceName}
      </span>
    ),
  },
];

function TableMode({ rows, onSelect }: { rows: PortUsage[]; onSelect: (id: string) => void }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  return (
    <div>
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Filter ports, sources, resources…"
        style={{ marginBottom: 8, padding: '4px 8px', fontSize: 12, width: 300, border: '1px solid var(--vpk-border, #ccc)', borderRadius: 4 }}
      />
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} onClick={h.column.getToggleSortingHandler()} style={th}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} onClick={() => onSelect(row.original.resourceId)} style={{ cursor: 'pointer' }}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} style={td}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortsView({ onSelect }: { onSelect: (id: string) => void }) {
  const [usages, setUsages] = useState<PortUsage[]>([]);
  const [view, setView] = useState<'aggregate' | 'table'>('aggregate');
  const [modalPort, setModalPort] = useState<{ port: number; protocol: string } | null>(null);

  useEffect(() => {
    fetch('/network/ports')
      .then((r) => r.json() as Promise<PortUsage[]>)
      .then(setUsages)
      .catch(() => setUsages([]));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        {/* Segmented control — a shared border + divider makes it read clearly as a two-way toggle (both
            sides always look selectable), rather than one bold button next to a near-invisible white one. */}
        <div
          style={{
            display: 'inline-flex',
            border: '1px solid var(--vpk-border, #c9c9c9)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {(
            [
              ['aggregate', 'By port'],
              ['table', 'All usages'],
            ] as const
          ).map(([id, label], i) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--vpk-border, #c9c9c9)' : 'none',
                background: view === id ? '#2a5db0' : 'var(--vpk-surface, #fff)',
                color: view === id ? '#fff' : 'var(--vpk-fg, #333)',
                cursor: 'pointer',
                fontWeight: view === id ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--vpk-fg-muted, #888)' }}>
          {usages.length} port usages · <span style={{ color: '#c0392b' }}>●</span> = host-level (NodePort / LoadBalancer / hostPort)
        </span>
      </div>
      {usages.length === 0 ? (
        <p style={{ color: '#888', fontSize: 13 }}>No ports declared in this snapshot.</p>
      ) : view === 'aggregate' ? (
        <AggregateMode usages={usages} onOpenPort={(port, protocol) => setModalPort({ port, protocol })} />
      ) : (
        <TableMode rows={usages} onSelect={onSelect} />
      )}
      {modalPort && (
        <PortUsesModal
          port={modalPort.port}
          protocol={modalPort.protocol}
          usages={usages}
          onSelect={onSelect}
          onClose={() => setModalPort(null)}
        />
      )}
    </div>
  );
}
