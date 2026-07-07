import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { iconUrlForKind } from './kindIcons';

interface Usage {
  image: string;
  registry?: string;
  repoPath: string;
  imageName: string;
  tag?: string;
  digest?: string;
  resourceId: string;
  resourceName: string;
  resourceKind: string;
  namespace?: string;
  namespaceId?: string;
  containerName: string;
  initContainer: boolean;
  containerIndex: number;
}

type Mode = 'tree' | 'table';
type FocusPath = (string | number)[];

const TEMPLATED_WORKLOAD_KINDS = new Set(['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job']);

/** Path straight to this usage's container node in its resource's raw spec, for DefinitionModal's FocusPath —
 *  mirrors containerImages.ts's own idea of where each kind's containers live (Pod: spec directly, the
 *  templated workload kinds: spec.template.spec, CronJob: spec.jobTemplate.spec.template.spec). */
function containerFocusPath(u: Usage): FocusPath {
  const key = u.initContainer ? 'initContainers' : 'containers';
  if (u.resourceKind === 'CronJob') return ['spec', 'jobTemplate', 'spec', 'template', 'spec', key, u.containerIndex];
  if (TEMPLATED_WORKLOAD_KINDS.has(u.resourceKind)) return ['spec', 'template', 'spec', key, u.containerIndex];
  return ['spec', key, u.containerIndex];
}

function imageLabel(u: Usage): string {
  return `${u.imageName}${u.tag ? `:${u.tag}` : u.digest ? `@${u.digest}` : ''}`;
}

const columns: ColumnDef<Usage>[] = [
  { accessorKey: 'repoPath', header: 'Repository' },
  { id: 'image', header: 'Image', cell: (c) => imageLabel(c.row.original) },
  { accessorKey: 'namespace', header: 'Namespace', cell: (c) => c.getValue<string>() ?? '—' },
  { accessorKey: 'resourceKind', header: 'Kind' },
  { accessorKey: 'resourceName', header: 'Resource' },
  {
    accessorKey: 'containerName',
    header: 'Container',
    cell: (c) => `${c.getValue<string>()}${c.row.original.initContainer ? ' (init)' : ''}`,
  },
];

function TableMode({ rows, onSelect }: { rows: Usage[]; onSelect: (id: string, focusPath?: FocusPath) => void }) {
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
          <tr
            key={row.id}
            onClick={() => onSelect(row.original.resourceId, containerFocusPath(row.original))}
            style={{ cursor: 'pointer' }}
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
  );
}

/** One row per {repoPath -> image -> namespace -> kind} tree branch. */
function groupTree(rows: Usage[]) {
  const byRepo = new Map<string, Map<string, Map<string, Map<string, Usage[]>>>>();
  for (const u of rows) {
    const byImage = byRepo.get(u.repoPath) ?? new Map();
    byRepo.set(u.repoPath, byImage);
    const nsKey = u.namespace ?? '(cluster-scoped)';
    const byNs = byImage.get(imageLabel(u)) ?? new Map();
    byImage.set(imageLabel(u), byNs);
    const byKind = byNs.get(nsKey) ?? new Map();
    byNs.set(nsKey, byKind);
    const list = byKind.get(u.resourceKind) ?? [];
    list.push(u);
    byKind.set(u.resourceKind, list);
  }
  return byRepo;
}

function KindIcon({ kind, onOpen }: { kind: string; onOpen?: () => void }) {
  const img = <img src={iconUrlForKind(kind)} alt={kind} style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} />;
  if (!onOpen) return img;
  return (
    <span
      role="button"
      title={`Open ${kind} in editor`}
      onClick={(e) => {
        e.preventDefault(); // don't also toggle an ancestor <summary>'s <details> open/closed
        e.stopPropagation();
        onOpen();
      }}
      style={{ cursor: 'pointer', display: 'inline-block' }}
    >
      {img}
    </span>
  );
}

function TreeMode({ rows, onSelect }: { rows: Usage[]; onSelect: (id: string, focusPath?: FocusPath) => void }) {
  const byRepo = groupTree(rows);

  return (
    <div style={{ fontSize: 13 }}>
      {[...byRepo.entries()].map(([repo, byImage]) => {
        const repoCount = [...byImage.values()].reduce((n, byNs) => n + countLeaves(byNs), 0);
        return (
          <details key={repo} open style={{ marginBottom: 6 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
              🟢 REPOSITORY: {repo} <span style={{ fontWeight: 400, color: '#777' }}>({repoCount})</span>
            </summary>
            <div style={{ paddingLeft: 18 }}>
              {[...byImage.entries()].map(([image, byNs]) => (
                <details key={image} open style={{ marginBottom: 4 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    📦 IMAGE: {image} <span style={{ color: '#777' }}>({countLeaves(byNs)})</span>
                  </summary>
                  <div style={{ paddingLeft: 18 }}>
                    {[...byNs.entries()].map(([ns, byKind]) => {
                      const namespaceId = [...byKind.values()].flat().find((u) => u.namespaceId)?.namespaceId;
                      return (
                      <details key={ns} open style={{ marginBottom: 2 }}>
                        <summary style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <KindIcon kind="Namespace" onOpen={namespaceId ? () => onSelect(namespaceId) : undefined} /> NAMESPACE:{' '}
                          {ns}{' '}
                          <span style={{ color: '#777' }}>
                            ({[...byKind.values()].reduce((n, l) => n + l.length, 0)})
                          </span>
                        </summary>
                        <div style={{ paddingLeft: 18 }}>
                          {[...byKind.entries()].map(([kind, usages]) => (
                            <div key={kind} style={{ marginBottom: 2 }}>
                              <div style={{ color: '#555', whiteSpace: 'nowrap' }}>
                                <KindIcon kind={kind} onOpen={() => onSelect(usages[0]!.resourceId)} /> KIND: {kind}
                              </div>
                              <ul style={{ margin: '2px 0', paddingLeft: 20 }}>
                                {usages.map((u) => (
                                  <li
                                    key={`${u.resourceId}|${u.containerName}|${u.initContainer}`}
                                    style={{ cursor: 'pointer', color: '#2a5db0' }}
                                    onClick={() => onSelect(u.resourceId, containerFocusPath(u))}
                                  >
                                    CONTAINER: {u.containerName} <span style={{ color: '#999' }}>({u.resourceName})</span>
                                    {u.initContainer ? ' (init)' : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </details>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function countLeaves(byNs: Map<string, Map<string, Usage[]>>): number {
  let n = 0;
  for (const byKind of byNs.values()) for (const list of byKind.values()) n += list.length;
  return n;
}

const IMPLICIT_REGISTRY = 'docker.io';

export function ContainerImagesView({
  onSelect,
  initialRegistry,
  onReturn,
}: {
  /** Second arg jumps DefinitionModal straight to the clicked container's node in the raw resource, instead
   *  of landing on the kind's generic default field (see DefinitionModal's FocusPath). */
  onSelect: (id: string, focusPath?: FocusPath) => void;
  /** Scopes the Registry dropdown below on arrival — set when the 3D view's image-registry stack's "View
   *  Repository" button sent the user here (that cylinder stands for every image reference under one registry
   *  hostname, not one repository, so this is how it hands off "show me all of them"). */
  initialRegistry?: string;
  /** Shown as a "Return" pill when set — present only when this page was entered FROM the 3D view. */
  onReturn?: () => void;
}) {
  const [usages, setUsages] = useState<Usage[]>([]);
  const [mode, setMode] = useState<Mode>('tree');
  const [registryFilter, setRegistryFilter] = useState(initialRegistry ?? '');
  const [repoFilter, setRepoFilter] = useState('');

  useEffect(() => {
    fetch('/container-images')
      .then((r) => r.json() as Promise<Usage[]>)
      .then(setUsages)
      .catch(() => setUsages([]));
  }, []);

  // A plain useState initializer only runs once on mount — this re-applies the incoming scope if the user
  // clicks a DIFFERENT registry cylinder's "View Repository" button while already on this page.
  useEffect(() => {
    if (initialRegistry) {
      setRegistryFilter(initialRegistry);
      setRepoFilter('');
    }
  }, [initialRegistry]);

  const registries = useMemo(() => [...new Set(usages.map((u) => u.registry ?? IMPLICIT_REGISTRY))].sort(), [usages]);
  const byRegistry = registryFilter ? usages.filter((u) => (u.registry ?? IMPLICIT_REGISTRY) === registryFilter) : usages;
  const repos = useMemo(() => [...new Set(byRegistry.map((u) => u.repoPath))].sort(), [byRegistry]);
  const filtered = repoFilter ? byRegistry.filter((u) => u.repoPath === repoFilter) : byRegistry;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        {onReturn && (
          <button
            onClick={onReturn}
            style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #999', cursor: 'pointer', background: '#fff', fontSize: 13 }}
          >
            ← Return to 3D view
          </button>
        )}
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
        <select
          value={registryFilter}
          onChange={(e) => {
            setRegistryFilter(e.target.value);
            setRepoFilter('');
          }}
          style={{ fontSize: 12 }}
        >
          <option value="">All registries ({registries.length})</option>
          {registries.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
