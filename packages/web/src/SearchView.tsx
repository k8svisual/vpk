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

interface ResourceRow {
  id: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  name: string;
  creationTimestamp?: string;
  placeholder: boolean;
}

const columns: ColumnDef<ResourceRow>[] = [
  { accessorKey: 'kind', header: 'Kind' },
  { accessorKey: 'namespace', header: 'Namespace', cell: (c) => c.getValue<string>() ?? '—' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'creationTimestamp', header: 'Created', cell: (c) => c.getValue<string>() ?? '—' },
];

export function SearchView({ onSelect }: { onSelect: (id: string) => void }) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'kind', desc: false }]);

  useEffect(() => {
    fetch('/resources')
      .then((r) => r.json() as Promise<ResourceRow[]>)
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const table = useReactTable({
    data: rows,
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
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '4px 0 8px' }}>
        <input
          placeholder="search…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          style={{ padding: '4px 8px', width: 240 }}
        />
        <span style={{ fontSize: 13, color: '#555' }}>{count} resources</span>
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
