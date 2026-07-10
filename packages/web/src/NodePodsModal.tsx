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

interface PodRow {
  id: string;
  name: string;
  namespace?: string;
  podIp?: string;
}
interface NodeDto {
  id: string;
  name: string;
  internalIp?: string;
  podCidr?: string;
  pods: PodRow[];
}

// A translucent grey that reads on any theme — the old `--vpk-rail-active-bg` is a DARK rail color, so it
// turned the row background near-black under dark text (unreadable) when used as a light-modal row hover.
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
 * The complete pod list for one Node, opened by clicking a Node in the Cluster Topology diagram (which only
 * shows the first few pods inline). Reuses `/network/nodes` (which carries every pod per node, uncapped);
 * clicking a pod opens it in the editor via `onSelect` and closes the modal. Columns are sortable.
 */
export function NodePodsModal({
  nodeId,
  nodeName,
  onSelect,
  onClose,
}: {
  nodeId: string;
  nodeName: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [node, setNode] = useState<NodeDto | undefined>();
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'namespace', desc: false }]);

  useEffect(() => {
    fetch('/network/nodes')
      .then((r) => r.json() as Promise<NodeDto[]>)
      .then((nodes) => setNode(nodes.find((n) => n.id === nodeId)))
      .catch(() => setNode(undefined))
      .finally(() => setLoading(false));
  }, [nodeId]);

  const pods = node?.pods ?? [];

  const columns = useMemo<ColumnDef<PodRow>[]>(
    () => [
      {
        accessorKey: 'namespace',
        header: 'Namespace',
        cell: (c) => <span style={{ color: 'var(--vpk-fg-muted)' }}>{(c.getValue() as string) || '—'}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Pod',
        cell: (c) => (
          <span className="flex items-center gap-1.5">
            <KindIcon kind="Pod" name={c.getValue() as string} size={13} bg={networkIconBg('Pod')} />
            <span className="truncate">{c.getValue() as string}</span>
          </span>
        ),
      },
      {
        accessorKey: 'podIp',
        header: 'Pod IP',
        cell: (c) => (
          <span style={{ color: '#2a5db0', fontFamily: 'ui-monospace, monospace' }}>{(c.getValue() as string) ?? '—'}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: pods,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--vpk-fg)' }}>
            <KindIcon kind="Node" name={nodeName} size={16} bg={networkIconBg('Node')} />
            <span className="font-medium">{nodeName}</span>
            <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              {node?.internalIp ? `· ${node.internalIp}` : ''} · {pods.length} pod{pods.length === 1 ? '' : 's'}
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
          {!loading && pods.length === 0 && (
            <p style={{ color: 'var(--vpk-fg-muted)', padding: 8 }}>No pods scheduled on this node.</p>
          )}
          {!loading && pods.length > 0 && (
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
