import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { KindIcon } from './StorageView';
import { networkIconBg } from './kindColors';

interface EndpointSliceRow {
  id: string;
  name: string;
  addressType?: string;
  endpointCount: number;
}

// A translucent grey that reads on any theme — `--vpk-rail-active-bg` is a DARK rail color, so it turns the
// row background near-black under dark text (unreadable) when used as a light-modal row hover.
const HOVER_BG = 'rgba(128,128,128,0.15)';
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '5px 10px',
  borderBottom: '2px solid var(--vpk-border, #ccc)',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};
const td: React.CSSProperties = { padding: '4px 10px', borderBottom: '1px solid var(--vpk-border, #eee)' };
const SORT_GLYPH: Record<string, string> = { asc: ' ▲', desc: ' ▼' };

/**
 * Every EndpointSlice object backing one Service, opened by clicking the Ingress Path diagram's EndpointSlice
 * card when the Service has more than one (Kubernetes splits into multiple past a slice's own endpoint cap, or
 * per address family for dual-stack Services — the diagram itself only has room to show one summary card).
 * Reuses `/network/endpointslices`; clicking a row opens that slice's own definition via `onSelect`.
 */
export function EndpointSlicesModal({
  serviceId,
  serviceName,
  onSelect,
  onClose,
}: {
  serviceId: string;
  serviceName: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [slices, setSlices] = useState<EndpointSliceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  useEffect(() => {
    fetch(`/network/endpointslices?id=${encodeURIComponent(serviceId)}`)
      .then((r) => r.json() as Promise<EndpointSliceRow[]>)
      .then(setSlices)
      .catch(() => setSlices([]))
      .finally(() => setLoading(false));
  }, [serviceId]);

  const columns = useMemo<ColumnDef<EndpointSliceRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'EndpointSlice',
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <KindIcon kind="EndpointSlice" name={c.getValue() as string} size={13} bg={networkIconBg('EndpointSlice')} />
            <span className="truncate">{c.getValue() as string}</span>
          </span>
        ),
      },
      {
        accessorKey: 'addressType',
        header: 'Address type',
        cell: (c) => <span style={{ color: 'var(--vpk-fg-muted)' }}>{(c.getValue() as string) || '—'}</span>,
      },
      { accessorKey: 'endpointCount', header: 'Endpoints' },
    ],
    [],
  );

  const table = useReactTable({
    data: slices,
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
        className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--vpk-fg)' }}>
            <KindIcon kind="Service" name={serviceName} size={16} bg={networkIconBg('Service')} />
            <span className="font-medium">{serviceName}</span>
            <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              · {slices.length} EndpointSlice{slices.length === 1 ? '' : 's'}
            </span>
          </div>
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
          {loading && <p style={{ color: 'var(--vpk-fg-muted)', padding: 8 }}>Loading…</p>}
          {!loading && slices.length === 0 && (
            <p style={{ color: 'var(--vpk-fg-muted)', padding: 8 }}>No EndpointSlice objects found for this Service.</p>
          )}
          {!loading && slices.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      onSelect(row.original.id);
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
          )}
        </div>
      </div>
    </div>
  );
}
