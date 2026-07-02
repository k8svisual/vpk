import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';

interface Usage {
  image: string;
  registry?: string;
  repository: string;
  tag?: string;
  digest?: string;
  podId: string;
  podName: string;
  namespace?: string;
  containerName: string;
  initContainer: boolean;
}

type Mode = 'tree' | 'table';

const columns: ColumnDef<Usage>[] = [
  { accessorKey: 'repository', header: 'Repository' },
  { accessorKey: 'tag', header: 'Tag', cell: (c) => c.getValue<string>() ?? c.row.original.digest ?? '—' },
  { accessorKey: 'namespace', header: 'Namespace', cell: (c) => c.getValue<string>() ?? '—' },
  { accessorKey: 'podName', header: 'Pod' },
  {
    accessorKey: 'containerName',
    header: 'Container',
    cell: (c) => `${c.getValue<string>()}${c.row.original.initContainer ? ' (init)' : ''}`,
  },
];

function TableMode({ rows, onSelect }: { rows: Usage[]; onSelect: (id: string) => void }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th
                key={h.id}
                onClick={h.column.getToggleSortingHandler()}
                style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #d0d0d0', cursor: 'pointer' }}
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
                {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} onClick={() => onSelect(row.original.podId)} style={{ cursor: 'pointer' }}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} style={{ padding: '3px 8px', borderBottom: '1px solid #eee' }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TreeMode({ rows, onSelect }: { rows: Usage[]; onSelect: (id: string) => void }) {
  const byRepo = new Map<string, Usage[]>();
  for (const u of rows) {
    const list = byRepo.get(u.repository) ?? [];
    list.push(u);
    byRepo.set(u.repository, list);
  }

  return (
    <div style={{ fontSize: 13 }}>
      {[...byRepo.entries()].map(([repo, usages]) => {
        const byTag = new Map<string, Usage[]>();
        for (const u of usages) {
          const key = u.tag ?? u.digest ?? '(untagged)';
          const list = byTag.get(key) ?? [];
          list.push(u);
          byTag.set(key, list);
        }
        return (
          <details key={repo} open style={{ marginBottom: 6 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              {repo} <span style={{ fontWeight: 400, color: '#777' }}>({usages.length})</span>
            </summary>
            <div style={{ paddingLeft: 16 }}>
              {[...byTag.entries()].map(([tag, tagUsages]) => (
                <details key={tag} style={{ marginBottom: 2 }}>
                  <summary style={{ cursor: 'pointer' }}>
                    {tag} <span style={{ color: '#777' }}>({tagUsages.length})</span>
                  </summary>
                  <ul style={{ margin: '2px 0', paddingLeft: 20 }}>
                    {tagUsages.map((u) => (
                      <li
                        key={`${u.podId}|${u.containerName}`}
                        style={{ cursor: 'pointer', color: '#2a5db0' }}
                        onClick={() => onSelect(u.podId)}
                      >
                        {u.namespace}/{u.podName} — {u.containerName}
                        {u.initContainer ? ' (init)' : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function ContainerImagesView({ onSelect }: { onSelect: (id: string) => void }) {
  const [usages, setUsages] = useState<Usage[]>([]);
  const [mode, setMode] = useState<Mode>('tree');
  const [repoFilter, setRepoFilter] = useState('');

  useEffect(() => {
    fetch('/container-images')
      .then((r) => r.json() as Promise<Usage[]>)
      .then(setUsages)
      .catch(() => setUsages([]));
  }, []);

  const repos = useMemo(() => [...new Set(usages.map((u) => u.repository))].sort(), [usages]);
  const filtered = repoFilter ? usages.filter((u) => u.repository === repoFilter) : usages;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              ['tree', 'Tree'],
              ['table', 'Table'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              style={{
                padding: '3px 10px',
                fontSize: 12,
                border: '1px solid #d0d0d0',
                background: mode === id ? '#333' : '#fff',
                color: mode === id ? '#fff' : '#333',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">All repositories ({repos.length})</option>
          {repos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: '#777' }}>{filtered.length} container usages</span>
      </div>
      {filtered.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>No container images in this snapshot.</p>}
      {mode === 'tree' ? <TreeMode rows={filtered} onSelect={onSelect} /> : <TableMode rows={filtered} onSelect={onSelect} />}
    </div>
  );
}
