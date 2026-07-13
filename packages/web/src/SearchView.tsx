import { useEffect, useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChipList } from './Chips';

interface ResourceRow {
  id: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  name: string;
  creationTimestamp?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  placeholder: boolean;
}

const columns: ColumnDef<ResourceRow>[] = [
  { accessorKey: 'kind', header: 'Kind' },
  { accessorKey: 'namespace', header: 'Namespace', cell: (c) => c.getValue<string>() ?? '—' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'creationTimestamp', header: 'Created', cell: (c) => c.getValue<string>() ?? '—' },
];

/** Sentinel namespace-filter value standing in for "no namespace" (cluster-scoped resources) — `''` already
 *  means "any namespace" for this filter, so undefined needs its own distinct, non-empty option value. */
const CLUSTER_SCOPED = '(cluster-scoped)';

/** Matches a Metadata (labels) / Annotation filter against a resource's key/value map. `key=value` requires
 *  the key to contain the part before `=` AND the value to contain the part after; with no `=`, the query
 *  matches if it appears in EITHER a key or a value. Case-insensitive; blank query always matches. */
export function matchesKV(map: Record<string, string>, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const eq = q.indexOf('=');
  if (eq !== -1) {
    const keyQ = q.slice(0, eq).trim().toLowerCase();
    const valQ = q.slice(eq + 1).trim().toLowerCase();
    return Object.entries(map).some(([k, v]) => k.toLowerCase().includes(keyQ) && v.toLowerCase().includes(valQ));
  }
  const ql = q.toLowerCase();
  return Object.entries(map).some(([k, v]) => k.toLowerCase().includes(ql) || v.toLowerCase().includes(ql));
}

const fieldStyle: React.CSSProperties = { padding: '4px 8px', fontSize: 13 };

/** Passes when no Kind is selected (any kind) or `kind` is one of the selected ones — OR semantics, since
 *  "Pod, Deployment" reads as "show me either", not "show me things that are somehow both". */
function matchesAny(selected: string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

/** Same OR semantics as matchesAny, but a resource with no namespace only matches the CLUSTER_SCOPED
 *  sentinel — it never falls through to "any selected namespace matches", since it genuinely has none. */
function matchesNamespace(selected: string[], namespace: string | undefined): boolean {
  if (selected.length === 0) return true;
  return namespace ? selected.includes(namespace) : selected.includes(CLUSTER_SCOPED);
}

export function SearchView({
  onSelect,
  initialKind,
  onReturn,
  courseData = false,
}: {
  onSelect: (id: string) => void;
  /** Scopes the Kind dropdown below on arrival — set when a 3D resource-pane sphere's "Search" button sent
   *  the user here (that sphere stands for a whole Kind, not one instance, so this is how it hands off "show
   *  me all of them"). */
  initialKind?: string;
  /** Shown as a "Return" pill when set — present only when Search was entered FROM the 3D view, so a normal
   *  nav-rail visit to Search doesn't get an button back to a view the user was never in. */
  onReturn?: () => void;
  /** Render the ISOLATED course capture instead of the global snapshot — fetches the /course/graphic/* twin
   *  of /resources. Set only by the course cluster-view pop-out (ClusterViewPopout), reached via the 3D
   *  pop-out's own "Search" button; the main app leaves it false. */
  courseData?: boolean;
}) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [kindFilters, setKindFilters] = useState<string[]>(initialKind ? [initialKind] : []);
  const [namespaceFilters, setNamespaceFilters] = useState<string[]>([]);
  const [labelFilter, setLabelFilter] = useState('');
  const [annotationFilter, setAnnotationFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'kind', desc: false }]);

  useEffect(() => {
    fetch(courseData ? '/course/graphic/resources' : '/resources')
      .then((r) => r.json() as Promise<ResourceRow[]>)
      .then(setRows)
      .catch(() => setRows([]));
  }, [courseData]);

  // A plain useState initializer only runs once on mount — this re-applies the incoming scope (replacing any
  // prior selection) if the user clicks a DIFFERENT pane sphere's Search button while already on this page.
  useEffect(() => {
    if (initialKind) setKindFilters([initialKind]);
  }, [initialKind]);

  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))].sort(), [rows]);
  const namespaces = useMemo(() => [...new Set(rows.map((r) => r.namespace).filter((n): n is string => !!n))].sort(), [rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (!matchesAny(kindFilters, r.kind)) return false;
        if (!matchesNamespace(namespaceFilters, r.namespace)) return false;
        if (!matchesKV(r.labels, labelFilter)) return false;
        if (!matchesKV(r.annotations, annotationFilter)) return false;
        return true;
      }),
    [rows, kindFilters, namespaceFilters, labelFilter, annotationFilter],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const count = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  const thStyle = useMemo<React.CSSProperties>(
    () => ({ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #d0d0d0', cursor: 'pointer', whiteSpace: 'nowrap' }),
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0 8px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {onReturn && (
            <button
              onClick={onReturn}
              style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #999', cursor: 'pointer', background: '#fff', fontSize: 13 }}
            >
              ← Return to 3D view
            </button>
          )}
          <div>
            <select
              value=""
              onChange={(e) => {
                const k = e.target.value;
                if (k && !kindFilters.includes(k)) setKindFilters([...kindFilters, k]);
              }}
              style={fieldStyle}
            >
              <option value="" disabled>
                + kind…
              </option>
              {kinds
                .filter((k) => !kindFilters.includes(k))
                .map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
            </select>
            <ChipList items={kindFilters} label={(k) => k} onRemove={(i) => setKindFilters(kindFilters.filter((_, j) => j !== i))} />
          </div>
          <div>
            <select
              value=""
              onChange={(e) => {
                const n = e.target.value;
                if (n && !namespaceFilters.includes(n)) setNamespaceFilters([...namespaceFilters, n]);
              }}
              style={fieldStyle}
            >
              <option value="" disabled>
                + namespace…
              </option>
              {[CLUSTER_SCOPED, ...namespaces]
                .filter((n) => !namespaceFilters.includes(n))
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
            <ChipList
              items={namespaceFilters}
              label={(n) => n}
              onRemove={(i) => setNamespaceFilters(namespaceFilters.filter((_, j) => j !== i))}
            />
          </div>
          <input
            placeholder="search…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            style={{ ...fieldStyle, width: 200 }}
          />
          <span style={{ fontSize: 13, color: '#555' }}>{count} resources</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="metadata (label): key, value, or key=value"
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            style={{ ...fieldStyle, width: 260 }}
          />
          <input
            placeholder="annotation: key, value, or key=value"
            value={annotationFilter}
            onChange={(e) => setAnnotationFilter(e.target.value)}
            style={{ ...fieldStyle, width: 260 }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} style={thStyle} onClick={h.column.getToggleSortingHandler()}>
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
                onClick={() => onSelect(row.original.id)}
                style={{ cursor: 'pointer', opacity: row.original.placeholder ? 0.5 : 1 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0ee')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ padding: '3px 8px', borderBottom: '1px solid #eee' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0 0', fontSize: 13 }}>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          ‹ prev
        </button>
        <span>
          page {pageIndex + 1} / {Math.max(pageCount, 1)}
        </span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          next ›
        </button>
      </div>
    </div>
  );
}
