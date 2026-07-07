import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { matchesKV } from './SearchView';

/**
 * Filter panel for the 3D "Field" view — deliberately a SEPARATE state shape from the Wheel view's
 * FilterPanel/FilterState. That panel's facets (namespace, pod status, resource panes, ...) describe the
 * Wheel's own render model; this one is built from whatever a raw Node resource actually exposes (role,
 * health, hardware, OS, taints, labels, ...), since the whole point of filtering here is to narrow down the
 * Node set BEFORE switching to Wheel — a different question from "what should Wheel show."
 *
 * Config-driven rather than one hand-written row per field: CATEGORICAL_FIELDS/NUMERIC_FIELDS below are the
 * only place a new Node attribute needs to be added — the panel, the "same on every node" collapse, and the
 * include/exclude counts all derive from that list plus whatever nodes are actually loaded.
 */
export type FilterMode = 'include' | 'exclude';

export interface CategoricalFilter {
  mode: FilterMode;
  /** Selected values. Empty = field doesn't restrict anything (matches every node). */
  values: string[];
}

export interface NumericFilter {
  mode: FilterMode;
  /** Both null = field doesn't restrict anything. Either bound may be set independently of the other. */
  min: number | null;
  max: number | null;
}

export interface NodeFilterState {
  categorical: Record<string, CategoricalFilter>;
  numeric: Record<string, NumericFilter>;
  /** Case-insensitive substring match against every label/annotation key-value on the Node — same `key=value`
   *  or bare-substring syntax as SearchView's metadata filters (see matchesKV). Empty string = no filtering. */
  labelFilter: string;
  annotationFilter: string;
}

export const DEFAULT_NODE_FILTERS: NodeFilterState = {
  categorical: {},
  numeric: {},
  labelFilter: '',
  annotationFilter: '',
};

/** The minimal shape a node needs for these filters to apply — SceneNode (Scene3D.tsx) satisfies this
 *  structurally without importing it directly, matching this app's convention of small client-side type
 *  duplication over cross-file coupling (see FilterPanel.tsx's CONTROL_PLANE_COLOR comment for the same call). */
export interface FilterableNode {
  role: 'master' | 'worker';
  health: 'ok' | 'warn' | 'error';
  unschedulable: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  taints: { key: string; value?: string; effect: string }[];
  architecture?: string;
  operatingSystem?: string;
  osImage?: string;
  kernelVersion?: string;
  kubeletVersion?: string;
  kubeProxyVersion?: string;
  containerRuntimeVersion?: string;
  cpuCapacity?: number;
  cpuAllocatable?: number;
  memCapacityBytes?: number;
  memAllocatableBytes?: number;
  podCapacity?: number;
  podAllocatable?: number;
  podCount: number;
  ephemeralStorageCapacityBytes?: number;
  ephemeralStorageAllocatableBytes?: number;
}

interface CategoricalFieldDef {
  key: string;
  label: string;
  group: string;
  /** Values this node contributes to the field — usually one, but a node can carry several taints. */
  getValues: (n: FilterableNode) => string[];
}

interface NumericFieldDef {
  key: string;
  label: string;
  group: string;
  getValue: (n: FilterableNode) => number | undefined;
  format: (v: number) => string;
}

const GiB = 1024 ** 3;
const formatCores = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(2));
const formatGiB = (v: number) => `${(v / GiB).toFixed(1)} GiB`;
const formatCount = (v: number) => `${Math.round(v)}`;

const taintLabel = (t: { key: string; value?: string; effect: string }) => `${t.key}${t.value ? `=${t.value}` : ''}:${t.effect}`;

export const CATEGORICAL_FIELDS: CategoricalFieldDef[] = [
  { key: 'role', label: 'Role', group: 'Role', getValues: (n) => [n.role] },
  { key: 'health', label: 'Health', group: 'Health', getValues: (n) => [n.health] },
  {
    key: 'schedulable',
    label: 'Schedulability',
    group: 'Schedulability',
    getValues: (n) => [n.unschedulable ? 'Cordoned' : 'Schedulable'],
  },
  {
    key: 'taints',
    label: 'Taints',
    group: 'Taints',
    getValues: (n) => (n.taints.length ? n.taints.map(taintLabel) : ['(none)']),
  },
  { key: 'architecture', label: 'Architecture', group: 'Operating System', getValues: (n) => [n.architecture ?? '(unknown)'] },
  { key: 'operatingSystem', label: 'Operating System', group: 'Operating System', getValues: (n) => [n.operatingSystem ?? '(unknown)'] },
  { key: 'osImage', label: 'OS Image', group: 'Operating System', getValues: (n) => [n.osImage ?? '(unknown)'] },
  { key: 'kernelVersion', label: 'Kernel Version', group: 'Operating System', getValues: (n) => [n.kernelVersion ?? '(unknown)'] },
  { key: 'kubeletVersion', label: 'Kubelet Version', group: 'Container Runtime', getValues: (n) => [n.kubeletVersion ?? '(unknown)'] },
  {
    key: 'kubeProxyVersion',
    label: 'Kube-Proxy Version',
    group: 'Container Runtime',
    getValues: (n) => [n.kubeProxyVersion ?? '(unknown)'],
  },
  {
    key: 'containerRuntimeVersion',
    label: 'Container Runtime',
    group: 'Container Runtime',
    getValues: (n) => [n.containerRuntimeVersion ?? '(unknown)'],
  },
];

export const NUMERIC_FIELDS: NumericFieldDef[] = [
  { key: 'cpuCapacity', label: 'CPU Capacity', group: 'Hardware', getValue: (n) => n.cpuCapacity, format: formatCores },
  { key: 'cpuAllocatable', label: 'CPU Allocatable', group: 'Hardware', getValue: (n) => n.cpuAllocatable, format: formatCores },
  { key: 'memCapacityBytes', label: 'Memory Capacity', group: 'Hardware', getValue: (n) => n.memCapacityBytes, format: formatGiB },
  {
    key: 'memAllocatableBytes',
    label: 'Memory Allocatable',
    group: 'Hardware',
    getValue: (n) => n.memAllocatableBytes,
    format: formatGiB,
  },
  {
    key: 'ephemeralStorageCapacityBytes',
    label: 'Ephemeral Storage Capacity',
    group: 'Hardware',
    getValue: (n) => n.ephemeralStorageCapacityBytes,
    format: formatGiB,
  },
  {
    key: 'ephemeralStorageAllocatableBytes',
    label: 'Ephemeral Storage Allocatable',
    group: 'Hardware',
    getValue: (n) => n.ephemeralStorageAllocatableBytes,
    format: formatGiB,
  },
  { key: 'podCapacity', label: 'Pod Capacity', group: 'Hardware', getValue: (n) => n.podCapacity, format: formatCount },
  { key: 'podAllocatable', label: 'Pod Allocatable', group: 'Hardware', getValue: (n) => n.podAllocatable, format: formatCount },
  { key: 'podCount', label: 'Pods Running', group: 'Hardware', getValue: (n) => n.podCount, format: formatCount },
];

export function nodePassesFilter(node: FilterableNode, filters: NodeFilterState): boolean {
  for (const field of CATEGORICAL_FIELDS) {
    const filter = filters.categorical[field.key];
    if (!filter || filter.values.length === 0) continue;
    const intersects = field.getValues(node).some((v) => filter.values.includes(v));
    if (filter.mode === 'include' && !intersects) return false;
    if (filter.mode === 'exclude' && intersects) return false;
  }
  for (const field of NUMERIC_FIELDS) {
    const filter = filters.numeric[field.key];
    if (!filter || (filter.min === null && filter.max === null)) continue;
    const value = field.getValue(node);
    if (value === undefined) continue; // can't range-check missing data — pass through rather than silently drop
    const inRange = (filter.min === null || value >= filter.min) && (filter.max === null || value <= filter.max);
    if (filter.mode === 'include' && !inRange) return false;
    if (filter.mode === 'exclude' && inRange) return false;
  }
  if (!matchesKV(node.labels, filters.labelFilter)) return false;
  if (!matchesKV(node.annotations, filters.annotationFilter)) return false;
  return true;
}

function ModeToggle({ mode, onChange }: { mode: FilterMode; onChange: (m: FilterMode) => void }) {
  return (
    <div className="flex overflow-hidden rounded border text-[11px]" style={{ borderColor: 'var(--vpk-border)' }}>
      {(['include', 'exclude'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="cursor-pointer px-1.5 py-0.5 capitalize"
          style={{
            background: mode === m ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
            color: mode === m ? '#fff' : 'var(--vpk-fg-muted)',
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function CategoricalRow({
  field,
  values,
  filter,
  onChange,
}: {
  field: CategoricalFieldDef;
  values: string[];
  filter: CategoricalFilter;
  onChange: (next: CategoricalFilter) => void;
}) {
  if (values.length <= 1) {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs opacity-60">
        <span style={{ color: 'var(--vpk-fg)' }}>{field.label}</span>
        <span style={{ color: 'var(--vpk-fg-muted)' }}>{values[0] ?? '(none)'} — same on every node</span>
      </div>
    );
  }

  function toggleValue(v: string) {
    const selected = filter.values.includes(v) ? filter.values.filter((x) => x !== v) : [...filter.values, v];
    onChange({ ...filter, values: selected });
  }

  return (
    <div className="px-2 py-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--vpk-fg)' }}>
          {field.label}
        </span>
        <ModeToggle mode={filter.mode} onChange={(mode) => onChange({ ...filter, mode })} />
      </div>
      <div
        className="max-h-28 overflow-y-auto rounded border"
        style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}
      >
        {values.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 px-1.5 py-0.5 text-xs">
            <input type="checkbox" checked={filter.values.includes(v)} onChange={() => toggleValue(v)} />
            <span className="truncate" style={{ color: 'var(--vpk-fg)' }} title={v}>
              {v}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function NumericRow({
  field,
  observedMin,
  observedMax,
  filter,
  onChange,
}: {
  field: NumericFieldDef;
  observedMin: number;
  observedMax: number;
  filter: NumericFilter;
  onChange: (next: NumericFilter) => void;
}) {
  if (observedMin === observedMax) {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs opacity-60">
        <span style={{ color: 'var(--vpk-fg)' }}>{field.label}</span>
        <span style={{ color: 'var(--vpk-fg-muted)' }}>{field.format(observedMin)} — same on every node</span>
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--vpk-fg)' }}>
          {field.label}
        </span>
        <ModeToggle mode={filter.mode} onChange={(mode) => onChange({ ...filter, mode })} />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={filter.min ?? ''}
          placeholder={`min ${field.format(observedMin)}`}
          onChange={(e) => onChange({ ...filter, min: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full rounded border px-1.5 py-1 text-xs"
          style={{ borderColor: 'var(--vpk-border)' }}
        />
        <span style={{ color: 'var(--vpk-fg-muted)' }}>–</span>
        <input
          type="number"
          value={filter.max ?? ''}
          placeholder={`max ${field.format(observedMax)}`}
          onChange={(e) => onChange({ ...filter, max: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full rounded border px-1.5 py-1 text-xs"
          style={{ borderColor: 'var(--vpk-border)' }}
        />
      </div>
    </div>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-1 px-2 pt-3 pb-1 text-xs font-medium"
        style={{ color: 'var(--vpk-rail-active-bg)' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

const DEFAULT_CATEGORICAL: CategoricalFilter = { mode: 'include', values: [] };
const DEFAULT_NUMERIC: NumericFilter = { mode: 'include', min: null, max: null };

export function NodeFilterPanel({
  filters,
  onChange,
  onClose,
  nodes,
}: {
  filters: NodeFilterState;
  onChange: (next: NodeFilterState) => void;
  onClose: () => void;
  /** The FULL, unfiltered node set for the loaded snapshot — needed to compute each field's available
   *  values/range and the "same on every node" collapse, independent of what's currently filtered. */
  nodes: FilterableNode[];
}) {
  const categoricalValues = useMemo(
    () =>
      Object.fromEntries(
        CATEGORICAL_FIELDS.map((f) => [f.key, [...new Set(nodes.flatMap((n) => f.getValues(n)))].sort()]),
      ) as Record<string, string[]>,
    [nodes],
  );

  const numericRanges = useMemo(
    () =>
      Object.fromEntries(
        NUMERIC_FIELDS.map((f) => {
          const observed = nodes.map((n) => f.getValue(n)).filter((v): v is number => v !== undefined);
          return [f.key, observed.length ? { min: Math.min(...observed), max: Math.max(...observed) } : null];
        }),
      ) as Record<string, { min: number; max: number } | null>,
    [nodes],
  );

  const includedCount = useMemo(() => nodes.filter((n) => nodePassesFilter(n, filters)).length, [nodes, filters]);
  const excludedCount = nodes.length - includedCount;

  function setCategorical(key: string, next: CategoricalFilter) {
    onChange({ ...filters, categorical: { ...filters.categorical, [key]: next } });
  }
  function setNumeric(key: string, next: NumericFilter) {
    onChange({ ...filters, numeric: { ...filters.numeric, [key]: next } });
  }

  const groups = [...new Set(CATEGORICAL_FIELDS.map((f) => f.group).concat(NUMERIC_FIELDS.map((f) => f.group)))];

  return (
    <div
      className="absolute top-11 left-2 z-10 max-h-[calc(100%-3rem)] w-[26rem] overflow-y-auto rounded border text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
    >
      <div
        className="sticky top-0 z-10 border-b px-2 py-1.5"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Filter Nodes
          </span>
          <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
            Close
          </button>
        </div>
        <div className="mt-1 flex gap-3 text-xs">
          <span style={{ color: 'var(--vpk-status-ok, #2e8b57)' }}>{includedCount} included</span>
          <span style={{ color: 'var(--vpk-status-error, #c0392b)' }}>{excludedCount} excluded</span>
          <span style={{ color: 'var(--vpk-fg-muted)' }}>({nodes.length} total)</span>
        </div>
      </div>

      {groups.map((group) => (
        <CollapsibleSection key={group} title={group}>
          {CATEGORICAL_FIELDS.filter((f) => f.group === group).map((f) => (
            <CategoricalRow
              key={f.key}
              field={f}
              values={categoricalValues[f.key] ?? []}
              filter={filters.categorical[f.key] ?? DEFAULT_CATEGORICAL}
              onChange={(next) => setCategorical(f.key, next)}
            />
          ))}
          {NUMERIC_FIELDS.filter((f) => f.group === group).map((f) => {
            const range = numericRanges[f.key];
            if (!range) {
              return (
                <div key={f.key} className="flex items-center justify-between gap-2 px-2 py-1 text-xs opacity-60">
                  <span style={{ color: 'var(--vpk-fg)' }}>{f.label}</span>
                  <span style={{ color: 'var(--vpk-fg-muted)' }}>no data</span>
                </div>
              );
            }
            return (
              <NumericRow
                key={f.key}
                field={f}
                observedMin={range.min}
                observedMax={range.max}
                filter={filters.numeric[f.key] ?? DEFAULT_NUMERIC}
                onChange={(next) => setNumeric(f.key, next)}
              />
            );
          })}
        </CollapsibleSection>
      ))}

      <CollapsibleSection title="Metadata & Annotations">
        <div className="flex flex-col gap-1.5 px-2 pb-3">
          <label className="flex flex-col gap-0.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Label contains</span>
            <input
              value={filters.labelFilter}
              onChange={(e) => onChange({ ...filters, labelFilter: e.target.value })}
              placeholder="key, value, or key=value"
              className="w-full rounded border px-1.5 py-1"
              style={{ borderColor: 'var(--vpk-border)' }}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Annotation contains</span>
            <input
              value={filters.annotationFilter}
              onChange={(e) => onChange({ ...filters, annotationFilter: e.target.value })}
              placeholder="key, value, or key=value"
              className="w-full rounded border px-1.5 py-1"
              style={{ borderColor: 'var(--vpk-border)' }}
            />
          </label>
        </div>
      </CollapsibleSection>
    </div>
  );
}
