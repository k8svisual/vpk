import { useEffect, useMemo, useRef, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
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
import { EventsTimeline, formatBucketTime, messageCategory, CATEGORY_COLOR, type MessageCategory } from './EventsTimeline';
import { EmptyState } from './EmptyState';

// A translucent grey that reads on any theme — see PortsView.tsx's HOVER_BG for why not --vpk-rail-active-bg.
const HOVER_BG = 'rgba(128,128,128,0.15)';

type EventType = 'Normal' | 'Warning';

interface EventRecord {
  id: string;
  type: EventType;
  reason?: string;
  message?: string;
  count: number;
  lastSeen?: string;
  firstSeen?: string;
  reportingComponent?: string;
  involvedObjectKind?: string;
  involvedObjectName?: string;
  involvedObjectNamespace?: string;
  involvedObjectId?: string;
  namespace?: string;
}

/** Normal (grey) / Warning (yellow) / Failed (red) — see EventsTimeline's messageCategory doc comment for why
 *  "Failed" is a reason-text sub-category of type:Warning rather than a 4th real API value. */
function TypeChip({ e }: { e: { type: string; reason?: string } }) {
  const category = messageCategory(e);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 6px',
        borderRadius: 10,
        fontSize: 11,
        color: category === 'Warning' ? '#3a2f00' : '#fff',
        background: CATEGORY_COLOR[category],
        whiteSpace: 'nowrap',
      }}
    >
      {category}
    </span>
  );
}

/** The involvedObject cell — a real click-to-definition link when it resolves against this snapshot, else a
 *  de-emphasized label with a tooltip explaining why (Events outlive the objects they describe by design;
 *  roughly 1 in 7 on a real cluster snapshot don't resolve, so this is an expected state, not an error). */
function InvolvedObjectCell({ e, onSelect }: { e: EventRecord; onSelect: (id: string) => void }) {
  if (!e.involvedObjectKind) return <span style={{ color: 'var(--vpk-fg-muted)' }}>—</span>;
  if (e.involvedObjectId) {
    return (
      <span
        onClick={(ev) => {
          ev.stopPropagation();
          onSelect(e.involvedObjectId!);
        }}
        className="flex items-center gap-1.5 truncate"
        style={{ cursor: 'pointer' }}
      >
        <KindIcon kind={e.involvedObjectKind} name={e.involvedObjectName ?? ''} size={13} bg={networkIconBg(e.involvedObjectKind)} />
        <span style={{ color: 'var(--vpk-accent)' }}>{e.involvedObjectName}</span>
      </span>
    );
  }
  return (
    <span
      title="Not present at capture time — this object was already deleted before the snapshot was taken."
      className="flex items-center gap-1.5 truncate"
      style={{ color: 'var(--vpk-fg-muted)', opacity: 0.7 }}
    >
      <KindIcon kind={e.involvedObjectKind} name={e.involvedObjectName ?? ''} size={13} bg={networkIconBg(e.involvedObjectKind)} />
      {e.involvedObjectName}
    </span>
  );
}

/** The Message cell — a clickable Event k8s icon (kind:Event) that opens this Event's OWN raw source in the
 *  editor (onSelect uses the Event's id, unlike InvolvedObjectCell which opens the object the Event is ABOUT),
 *  followed by the message text. Used in both the Messages tab's flat list and the per-object popup modal. */
function MessageCell({ e, onSelect }: { e: EventRecord; onSelect: (id: string) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        onClick={(ev) => {
          ev.stopPropagation();
          onSelect(e.id);
        }}
        title="View this Event's raw source"
        style={{ cursor: 'pointer', display: 'inline-flex', flexShrink: 0 }}
      >
        <KindIcon kind="Event" name={e.reason ?? 'Event'} size={13} />
      </span>
      <span style={{ color: 'var(--vpk-fg-muted)' }}>{e.message ?? ''}</span>
    </span>
  );
}

// position:sticky keeps the header visible while scrolling inside a contained (maxHeight+overflow:auto) table
// area — EventsView now wraps the Messages tab's tables that way, so without this the header would scroll out
// of view entirely instead of the page itself scrolling past it.
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '5px 10px',
  borderBottom: '2px solid var(--vpk-border, #ccc)',
  fontSize: 12,
  cursor: 'pointer',
  position: 'sticky',
  top: 0,
  background: 'var(--vpk-surface, #fff)',
  zIndex: 1,
};
const td: React.CSSProperties = { padding: '4px 10px', borderBottom: '1px solid var(--vpk-border, #eee)' };

// ---- Aggregate (group by involved object) mode -----------------------------------------------------------

interface ObjectGroup {
  key: string;
  kind: string;
  name: string;
  namespace?: string;
  resolvedId?: string;
  total: number;
  warnings: number;
  lastSeen?: string;
  lastReason?: string;
}

function groupByObject(events: EventRecord[]): ObjectGroup[] {
  const map = new Map<string, ObjectGroup>();
  for (const e of events) {
    if (!e.involvedObjectKind) continue;
    const key = `${e.involvedObjectKind}|${e.involvedObjectNamespace ?? ''}|${e.involvedObjectName ?? ''}`;
    let g = map.get(key);
    if (!g) {
      g = { key, kind: e.involvedObjectKind, name: e.involvedObjectName ?? '', namespace: e.involvedObjectNamespace, resolvedId: e.involvedObjectId, total: 0, warnings: 0 };
      map.set(key, g);
    }
    g.total++;
    if (e.type === 'Warning') g.warnings++;
    // events arrive newest-first (server sorts by lastSeen desc) — first hit per group is the most recent.
    if (!g.lastSeen) {
      g.lastSeen = e.lastSeen;
      g.lastReason = e.reason;
    }
  }
  return [...map.values()];
}

function AggregateMode({ events, onOpenObject }: { events: EventRecord[]; onOpenObject: (g: ObjectGroup) => void }) {
  const groups = useMemo(() => groupByObject(events), [events]);
  const columns = useMemo<ColumnDef<ObjectGroup>[]>(
    () => [
      {
        id: 'object',
        accessorFn: (g) => `${g.namespace ?? ''}/${g.name}`,
        header: 'Object',
        cell: ({ row }) => {
          const g = row.original;
          return (
            <span className="flex items-center gap-1.5 truncate" style={{ opacity: g.resolvedId ? 1 : 0.7 }}>
              <KindIcon kind={g.kind} name={g.name} size={13} bg={networkIconBg(g.kind)} />
              {g.namespace && <span style={{ color: 'var(--vpk-fg-muted)' }}>{g.namespace} /</span>}
              <span style={{ color: g.resolvedId ? 'var(--vpk-accent)' : 'var(--vpk-fg-muted)' }}>{g.name}</span>
            </span>
          );
        },
      },
      { accessorKey: 'kind', header: 'Kind' },
      { accessorKey: 'total', header: 'Total' },
      {
        accessorKey: 'warnings',
        header: 'Warning',
        cell: (c) => {
          const v = c.getValue<number>();
          return v ? <span style={{ color: 'var(--vpk-status-error)', fontWeight: 600 }}>{v}</span> : <span style={{ color: 'var(--vpk-fg-muted)' }}>·</span>;
        },
      },
      { accessorKey: 'lastReason', header: 'Last reason', cell: (c) => c.getValue<string>() ?? '—' },
      { accessorKey: 'lastSeen', header: 'Last seen', cell: (c) => c.getValue<string>() ?? '—' },
    ],
    [],
  );
  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { sorting: [{ id: 'warnings', desc: true }] },
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
            data-row-time={row.original.lastSeen ? Date.parse(row.original.lastSeen) : undefined}
            onClick={() => onOpenObject(row.original)}
            style={{ cursor: 'pointer' }}
            title="Show all Events for this object"
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

/** Modal listing every Event for one involved object (opened by clicking an aggregate row). */
function ObjectEventsModal({ group, events, onSelect, onClose }: { group: ObjectGroup; events: EventRecord[]; onSelect: (id: string) => void; onClose: () => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastSeen', desc: true }]);
  const rows = useMemo(
    () => events.filter((e) => e.involvedObjectKind === group.kind && (e.involvedObjectNamespace ?? '') === (group.namespace ?? '') && e.involvedObjectName === group.name),
    [events, group],
  );

  const columns = useMemo<ColumnDef<EventRecord>[]>(
    () => [
      { accessorKey: 'type', header: 'Type', cell: (c) => <TypeChip e={c.row.original} /> },
      { accessorKey: 'reason', header: 'Reason', cell: (c) => c.getValue<string>() ?? '—' },
      { accessorKey: 'count', header: 'Count' },
      { accessorKey: 'lastSeen', header: 'Last seen', cell: (c) => c.getValue<string>() ?? '—' },
      { accessorKey: 'reportingComponent', header: 'Component', cell: (c) => c.getValue<string>() ?? '—' },
      { accessorKey: 'message', header: 'Message', cell: (c) => <MessageCell e={c.row.original} onSelect={onSelect} /> },
    ],
    [onSelect],
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
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--vpk-border)' }}>
          <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--vpk-fg)' }}>
            <KindIcon kind={group.kind} name={group.name} size={14} bg={networkIconBg(group.kind)} />
            {group.namespace && <span style={{ color: 'var(--vpk-fg-muted)' }}>{group.namespace} /</span>}
            {group.name}
            <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              · {rows.length} event{rows.length === 1 ? '' : 's'}
            </span>
            {!group.resolvedId && (
              <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }} title="Not present at capture time">
                (deleted before capture)
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {group.resolvedId && (
              <button
                onClick={() => {
                  onSelect(group.resolvedId!);
                  onClose();
                }}
                className="cursor-pointer rounded border px-2 py-1 text-xs"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-accent)' }}
              >
                Open definition
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
            >
              Close
            </button>
          </div>
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
                <tr key={row.id}>
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

// ---- Flat table mode --------------------------------------------------------------------------------------

function flatColumns(onSelect: (id: string) => void): ColumnDef<EventRecord>[] {
  return [
    { accessorKey: 'type', header: 'Type', cell: (c) => <TypeChip e={c.row.original} /> },
    { accessorKey: 'reason', header: 'Reason', cell: (c) => c.getValue<string>() ?? '—' },
    {
      id: 'object',
      accessorFn: (e) => `${e.involvedObjectNamespace ?? ''}/${e.involvedObjectName ?? ''}`,
      header: 'Object',
      cell: ({ row }) => <InvolvedObjectCell e={row.original} onSelect={onSelect} />,
    },
    { accessorKey: 'namespace', header: 'Namespace', cell: (c) => c.getValue<string>() ?? '—' },
    { accessorKey: 'count', header: 'Count' },
    { accessorKey: 'lastSeen', header: 'Last seen', cell: (c) => c.getValue<string>() ?? '—' },
    { accessorKey: 'reportingComponent', header: 'Component', cell: (c) => c.getValue<string>() ?? '—' },
    { accessorKey: 'message', header: 'Message', cell: ({ row }) => <MessageCell e={row.original} onSelect={onSelect} /> },
  ];
}

function TableMode({ rows, onSelect }: { rows: EventRecord[]; onSelect: (id: string) => void }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastSeen', desc: true }]);
  const columns = useMemo(() => flatColumns(onSelect), [onSelect]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  return (
    <div>
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Filter reason, object, message…"
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
            <tr
              key={row.id}
              data-row-time={row.original.lastSeen ? Date.parse(row.original.lastSeen) : undefined}
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
  );
}

export function EventsView({
  onSelect,
  initialNamespace,
  initialPodName,
  initialPodId,
  onReturn,
  courseData = false,
}: {
  onSelect: (id: string) => void;
  /** Pre-filters the Namespace/Pod selects below — set only when entered via the Schematic's purple "has
   *  Events" corner badge (see App.tsx's eventsPodFilter). A normal nav-rail visit starts unscoped. */
  initialNamespace?: string;
  initialPodName?: string;
  /** When set (schematic entry only — the manual Pod dropdown below has no id to offer), filtering matches
   *  this EXACT Pod object (involvedObjectId) instead of by name, so the count always agrees with the
   *  schematic badge's own count — a Pod recreated under the same name would otherwise pull in its
   *  predecessor's Events too, which name-only matching can't distinguish. Cleared as soon as the user
   *  touches either dropdown themselves, since a manual pick has no specific instance to pin to. */
  initialPodId?: string;
  /** Shown as a "Return" pill when set — same pattern as SchematicView/RbacView's own onReturn. */
  onReturn?: () => void;
  /** Render the ISOLATED course capture instead of the global snapshot — fetches the /course/graphic/* twin
   *  of /events. Set only by the course cluster-view pop-out (ClusterViewPopout), reached via the Schematic
   *  pop-out's own "has Events" badge; the main app leaves it false. */
  courseData?: boolean;
}) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  // A Pod-scoped visit is here to review that Pod's whole history, not just its Warnings — and the aggregate
  // "By object" view would just show one row (the Pod itself), so both defaults flip for that entry path;
  // going straight to the Messages tab (skipping the Graph) matches the same "here to read messages" intent.
  // Unscoped arrivals start with NEITHER tab picked (see the render below's EmptyState) — same "the picker
  // prompt only for a direct, unscoped visit" convention as every other view's own picker (OwnerRef/Schematic/
  // ContainerImages): a Pod-scoped visit already knows what it's here to see (Messages), so it skips straight
  // there instead of asking a question the entry point already answered.
  const [mainTab, setMainTab] = useState<'graph' | 'messages' | null>(initialPodName ? 'messages' : null);
  const [view, setView] = useState<'aggregate' | 'table'>(initialPodName ? 'table' : 'aggregate');
  // One independent checkbox per category (not a single "Warning only" boolean) — lets Warning and Failed be
  // shown/hidden separately (e.g. "Failed only"), not just together. A Pod-scoped visit starts with all three
  // on (reviewing that Pod's whole history); a normal nav-rail visit starts Warning+Failed on, Normal off —
  // same default the old single checkbox produced.
  const [visibleCategories, setVisibleCategories] = useState<Record<MessageCategory, boolean>>(() =>
    initialPodName ? { Normal: true, Warning: true, Failed: true } : { Normal: false, Warning: true, Failed: true },
  );
  const [namespaceFilter, setNamespaceFilter] = useState(initialNamespace ?? '');
  const [podFilter, setPodFilter] = useState(initialPodName ?? '');
  const [podIdFilter, setPodIdFilter] = useState(initialPodId);
  // Set by clicking a bar in the EventsTimeline once it's drilled to its 5-minute floor — narrows the table to
  // exactly that window. Cleared by its own chip, or by a manual namespace/pod change (the window was chosen
  // against the OLD scope, so keeping it under a different scope would silently over-narrow).
  const [timeWindowFilter, setTimeWindowFilter] = useState<{ start: number; end: number } | null>(null);
  const [modalGroup, setModalGroup] = useState<ObjectGroup | null>(null);

  // "Keep in sync with the top message in the list" (Graph tab checkbox) — topMessageTime is the timestamp of
  // whichever row currently sits at the top of the Messages tab's scroll viewport, tracked below. Only tracked
  // while syncEnabled (scanning every row on every scroll tick isn't free — see recomputeTopMessageTime).
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [topMessageTime, setTopMessageTime] = useState<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const scrollDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(courseData ? '/course/graphic/events' : '/events')
      .then((r) => r.json() as Promise<EventRecord[]>)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [courseData]);

  // Options are derived from the data itself (not a separate /namespaces fetch) — only namespaces/Pods that
  // actually HAVE Events in this snapshot are worth offering here.
  const namespaceOptions = useMemo(
    () => [...new Set(events.map((e) => e.namespace).filter((n): n is string => !!n))].sort(),
    [events],
  );
  const podOptions = useMemo(
    () =>
      [
        ...new Set(
          events
            .filter((e) => e.involvedObjectKind === 'Pod' && (!namespaceFilter || e.namespace === namespaceFilter))
            .map((e) => e.involvedObjectName)
            .filter((n): n is string => !!n),
        ),
      ].sort(),
    [events, namespaceFilter],
  );

  const scoped = useMemo(
    () =>
      events.filter(
        (e) =>
          (!namespaceFilter || e.namespace === namespaceFilter) &&
          (podIdFilter
            ? e.involvedObjectId === podIdFilter
            : !podFilter || (e.involvedObjectKind === 'Pod' && e.involvedObjectName === podFilter)),
      ),
    [events, namespaceFilter, podFilter, podIdFilter],
  );
  // categoryFiltered feeds the timeline chart too (so its bars reflect the same categories the checkboxes
  // show) — timeWindowFilter narrows further, ON TOP of it, only for the table/aggregate views below.
  const categoryFiltered = useMemo(
    () => scoped.filter((e) => visibleCategories[messageCategory(e)]),
    [scoped, visibleCategories],
  );
  const visible = useMemo(() => {
    if (!timeWindowFilter) return categoryFiltered;
    return categoryFiltered.filter((e) => {
      const t = e.lastSeen ? Date.parse(e.lastSeen) : NaN;
      return !Number.isNaN(t) && t >= timeWindowFilter.start && t < timeWindowFilter.end;
    });
  }, [categoryFiltered, timeWindowFilter]);
  // Per-category counts within the current namespace/pod scope — always the FULL scope, unaffected by the
  // checkboxes themselves, so a checkbox's own count doesn't change as you toggle it off.
  const categoryCounts = useMemo(() => {
    const counts: Record<MessageCategory, number> = { Normal: 0, Warning: 0, Failed: 0 };
    for (const e of scoped) counts[messageCategory(e)]++;
    return counts;
  }, [scoped]);

  function handleNamespaceChange(namespace: string) {
    setNamespaceFilter(namespace);
    setPodFilter(''); // the previously picked Pod almost certainly isn't in the new namespace
    setPodIdFilter(undefined); // a manual namespace change abandons any schematic-scoped exact instance
    setTimeWindowFilter(null); // the window was chosen against the OLD scope's chart
  }

  // Finds the first row (in current DOM/render order — respects whatever sort is active) whose bottom edge is
  // still below the scroll container's own top edge, i.e. the row currently at or crossing the top of the
  // visible viewport. A plain DOM scan rather than IntersectionObserver — simpler to reason about and only
  // runs debounced (not per scroll-frame), which is enough for the row counts real Event tables reach.
  function recomputeTopMessageTime() {
    const container = messagesScrollRef.current;
    if (!container) {
      setTopMessageTime(null);
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const rows = container.querySelectorAll<HTMLElement>('tr[data-row-time]');
    for (const row of rows) {
      if (row.getBoundingClientRect().bottom > containerTop) {
        const t = Number(row.dataset.rowTime);
        setTopMessageTime(Number.isFinite(t) ? t : null);
        return;
      }
    }
    setTopMessageTime(null);
  }

  function handleMessagesScroll() {
    if (!syncEnabled) return;
    if (scrollDebounce.current) clearTimeout(scrollDebounce.current);
    scrollDebounce.current = setTimeout(recomputeTopMessageTime, 120);
  }

  // Recompute whenever sync is switched on (so flipping the checkbox reflects whatever's already scrolled
  // into view, without waiting for the next scroll event) or the row set itself changes underneath a held
  // scroll position (sort/filter/mode change).
  useEffect(() => {
    if (syncEnabled) recomputeTopMessageTime();
    else setTopMessageTime(null);
  }, [syncEnabled, view, visible]);

  const returnPill = onReturn && (
    <button
      onClick={onReturn}
      style={{ marginBottom: 10, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--vpk-border)', cursor: 'pointer', background: 'var(--vpk-surface)', fontSize: 13 }}
    >
      ← Return to Schematic
    </button>
  );

  return (
    <div>
      {returnPill}
      {/* Top-level tabs — the graph and the message list are mutually exclusive views now (not stacked), per
          the explicit ask. Namespace lives on the Graph tab (see EventsTimeline); pod/warning/view-mode stay
          on the Messages tab since they only mean something once you're looking at individual rows. */}
      <div style={{ display: 'inline-flex', border: '1px solid var(--vpk-border, #c9c9c9)', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
        {(
          [
            ['graph', 'Graph'],
            ['messages', 'Messages'],
          ] as const
        ).map(([id, label], i) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            style={{
              padding: '5px 16px',
              fontSize: 13,
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--vpk-border, #c9c9c9)' : 'none',
              background: mainTab === id ? 'var(--vpk-accent)' : 'var(--vpk-surface, #fff)',
              color: mainTab === id ? 'var(--vpk-accent-fg)' : 'var(--vpk-fg, #333)',
              cursor: 'pointer',
              fontWeight: mainTab === id ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === null && <EmptyState icon={MousePointerClick}>Select Graph or Messages to view Events.</EmptyState>}

      {mainTab === 'graph' &&
        (events.length > 0 ? (
          <EventsTimeline
            events={categoryFiltered}
            allEvents={scoped}
            onSelectWindow={(start, end) => {
              setTimeWindowFilter({ start, end });
              setView('table'); // "jump to that interval to start viewing those messages" — the flat list is what shows individual messages
              setMainTab('messages');
            }}
            namespaceOptions={namespaceOptions}
            namespaceFilter={namespaceFilter}
            onNamespaceFilterChange={handleNamespaceChange}
            syncEnabled={syncEnabled}
            onSyncEnabledChange={setSyncEnabled}
            syncedTime={topMessageTime}
          />
        ) : (
          <p style={{ color: 'var(--vpk-fg-muted)', fontSize: 13 }}>No Events in this snapshot.</p>
        ))}

      {mainTab === 'messages' && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            {/* Segmented control — see PortsView.tsx for why a shared-border two-way toggle over two buttons. */}
            <div style={{ display: 'inline-flex', border: '1px solid var(--vpk-border, #c9c9c9)', borderRadius: 6, overflow: 'hidden' }}>
              {(
                [
                  ['aggregate', 'By object'],
                  ['table', 'All events'],
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
                    background: view === id ? 'var(--vpk-accent)' : 'var(--vpk-surface, #fff)',
                    color: view === id ? 'var(--vpk-accent-fg)' : 'var(--vpk-fg, #333)',
                    cursor: 'pointer',
                    fontWeight: view === id ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {namespaceFilter && (
              <span style={{ fontSize: 12, color: 'var(--vpk-fg-muted)' }}>
                namespace <b style={{ color: 'var(--vpk-fg)', fontWeight: 600 }}>{namespaceFilter}</b>{' '}
                <span style={{ color: 'var(--vpk-fg-muted)' }}>(set on the Graph tab)</span>
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              pod
              <select
                value={podFilter}
                onChange={(e) => {
                  setPodFilter(e.target.value);
                  setPodIdFilter(undefined); // a manual pick has no specific instance to pin to — falls back to name matching
                  setTimeWindowFilter(null); // the window was chosen against the OLD scope's chart
                }}
                style={{ padding: '3px 6px', fontSize: 12, minWidth: 160 }}
              >
                <option value="">All pods</option>
                {podOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {(['Normal', 'Warning', 'Failed'] as const).map((cat) => (
                <label key={cat} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--vpk-fg)' }}>
                  <input
                    type="checkbox"
                    checked={visibleCategories[cat]}
                    onChange={(e) => setVisibleCategories((v) => ({ ...v, [cat]: e.target.checked }))}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLOR[cat], display: 'inline-block' }} />
                  {cat} ({categoryCounts[cat]})
                </label>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'var(--vpk-fg-muted, #888)' }}>
              {visible.length} matching · {events.length} total in snapshot · captured at a single point in time, not a live stream
            </span>
            {timeWindowFilter && (
              <span
                style={{
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--vpk-border)',
                  color: 'var(--vpk-fg)',
                }}
              >
                {formatBucketTime(timeWindowFilter.start)} – {formatBucketTime(timeWindowFilter.end)}
                <button
                  onClick={() => setTimeWindowFilter(null)}
                  aria-label="Clear time window"
                  style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--vpk-fg-muted)', fontSize: 12, padding: 0 }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          {events.length === 0 ? (
            <p style={{ color: 'var(--vpk-fg-muted)', fontSize: 13 }}>No Events in this snapshot.</p>
          ) : visible.length === 0 ? (
            <p style={{ color: 'var(--vpk-fg-muted)', fontSize: 13 }}>No Events match the current filters.</p>
          ) : (
            <div ref={messagesScrollRef} onScroll={handleMessagesScroll} style={{ maxHeight: 560, overflow: 'auto', border: '1px solid var(--vpk-border)', borderRadius: 6 }}>
              {view === 'aggregate' ? <AggregateMode events={visible} onOpenObject={setModalGroup} /> : <TableMode rows={visible} onSelect={onSelect} />}
            </div>
          )}
        </>
      )}
      {modalGroup && <ObjectEventsModal group={modalGroup} events={visible} onSelect={onSelect} onClose={() => setModalGroup(null)} />}
    </div>
  );
}
