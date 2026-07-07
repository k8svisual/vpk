import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * 3D filter panel, ported from the legacy app's left-side "Filter" slide-in (DESIGN §6.8's locked "filters =
 * visibility predicates over render-all scene" decision — this is the first real slice of that mechanism).
 * Every row here is wired to real filtering (Nodes, Network, Storage, CSI, Ingress, Pod status, Namespace,
 * label/annotation text match, selection sound, Resource CPU & Memory bars, Control Plane, and the 10
 * resource "panes") — nothing in this panel is a disabled placeholder anymore.
 */
export interface FilterState {
  showNodes: boolean;
  showNetwork: boolean;
  showStorage: boolean;
  showCsi: boolean;
  showIngress: boolean;
  podRunning: boolean;
  podWarning: boolean;
  podFailed: boolean;
  podSucceeded: boolean;
  podDaemonSet: boolean;
  /** Empty string = all namespaces. Applied to anything carrying its own `namespace` (Pods + tier items) —
   *  cluster-scoped items (PV, StorageClass, VolumeAttachment, CSIDriver, Nodes) have none, so always pass. */
  namespace: string;
  /** Case-insensitive substring match against every label key/value on an item — empty string = no filtering. */
  labelFilter: string;
  /** Same as `labelFilter`, but against annotation key/value pairs instead. */
  annotationFilter: string;
  /** Gates whether selecting an item in the 3D view plays a sound (legacy app's "Play Sound" toggle). */
  playSound: boolean;
  /** Resource CPU & Memory bars (Scene3D renders these, gated by these 5 toggles). */
  showNodeCpuBar: boolean;
  showNodeMemoryBar: boolean;
  showNodeStorageBar: boolean;
  showPodCpuBar: boolean;
  showPodMemoryBar: boolean;
  /** Control Plane ring, per-node Kubelet/Kube-Proxy, API Server/Scheduler/Controller Manager/etcd, kubectl,
   *  and the image-registry stack — one toggle for the whole group, matching the legacy app's single
   *  "Control Plane" row. */
  showControlPlane: boolean;
  /** One toggle per resource "pane" (PANE_ORDER in @vpk/core's controlPlane.ts) — each shows/hides that
   *  pane's translucent wall plus its one-sphere-per-Kind spheres. */
  showPlaneWorkload: boolean;
  showPlaneNetworking: boolean;
  showPlaneStorage: boolean;
  showPlaneConfig: boolean;
  showPlaneRBAC: boolean;
  showPlaneAuthentication: boolean;
  showPlanePolicy: boolean;
  showPlaneExtend: boolean;
  showPlaneCluster: boolean;
  showPlaneThirdParty: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  showNodes: true,
  showNetwork: true,
  showStorage: true,
  showCsi: true,
  showIngress: true,
  podRunning: true,
  podWarning: true,
  podFailed: true,
  podSucceeded: true,
  podDaemonSet: true,
  namespace: '',
  labelFilter: '',
  annotationFilter: '',
  playSound: true,
  showNodeCpuBar: true,
  showNodeMemoryBar: true,
  showNodeStorageBar: true,
  showPodCpuBar: true,
  showPodMemoryBar: true,
  showControlPlane: true,
  showPlaneWorkload: true,
  showPlaneNetworking: true,
  showPlaneStorage: true,
  showPlaneConfig: true,
  showPlaneRBAC: true,
  showPlaneAuthentication: true,
  showPlanePolicy: true,
  showPlaneExtend: true,
  showPlaneCluster: true,
  showPlaneThirdParty: true,
};

const FILTERS_STORAGE_KEY = 'vpk-default-filters';

/** The 3D view's own initial `useState` reads this once, at mount — a personal display preference (which
 *  panes/kinds/pods to show), not server-enforced data-shaping behavior, so it's localStorage-only, same
 *  reasoning as the theme picker in theme.ts. Merged OVER DEFAULT_FILTERS (not returned as-is) so a save from
 *  before a new filter field existed doesn't leave that new field silently undefined after this app updates. */
export function loadDefaultFilters(): FilterState {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<FilterState>) };
  } catch {
    return DEFAULT_FILTERS; // corrupt/unparseable saved value — fall back rather than throw
  }
}

export function saveDefaultFilters(filters: FilterState): void {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // best-effort — a failed write just means the save silently doesn't survive a reload, not worth surfacing
  }
}

/** Single source of truth for the Resource CPU & Memory bar colors — both the filter panel's swatches AND
 *  Scene3D's actual rendered bars import this, so "colors match the filter" can never drift out of sync. */
export const METRIC_COLORS = {
  nodeCpu: '#d9711f',
  nodeMemory: '#7a7a7a',
  nodeStorage: '#c9584a',
  podCpu: '#3f9e8a',
  podMemory: '#d968a0',
} as const;

/** Control Plane items (ring, Kubelet/Kube-Proxy, components, kubectl) all share one color. Mirrors
 *  @vpk/core's controlPlane.ts CONTROL_PLANE_COLOR constant — kept as its own client-side copy per this
 *  app's established "server computes geometry, client duplicates small color/label lookups" convention. */
export const CONTROL_PLANE_COLOR = '#8b7ab8';

/** Mirrors @vpk/core's controlPlane.ts PANE_COLORS/PANE_ORDER exactly — one entry per resource "pane", in
 *  display order. The FilterState key drives visibility; `name` must match the `WheelPlane.name` the server
 *  sends so Scene3D can look up each plane's own toggle. */
export const PANES: { key: keyof Pick<
  FilterState,
  | 'showPlaneWorkload'
  | 'showPlaneNetworking'
  | 'showPlaneStorage'
  | 'showPlaneConfig'
  | 'showPlaneRBAC'
  | 'showPlaneAuthentication'
  | 'showPlanePolicy'
  | 'showPlaneExtend'
  | 'showPlaneCluster'
  | 'showPlaneThirdParty'
>; name: string; label: string; color: string }[] = [
  { key: 'showPlaneWorkload', name: 'Workload', label: 'Workload (Deployment, Job, ...)', color: '#972aff' },
  { key: 'showPlaneNetworking', name: 'Networking', label: 'Networking (NetworkPolicy, ...)', color: '#88bbdd' },
  { key: 'showPlaneStorage', name: 'Storage', label: 'Storage (CSIStorageCapacity, ...)', color: '#4477aa' },
  { key: 'showPlaneConfig', name: 'Config', label: 'Config (ConfigMap, Secret)', color: '#ff4500' },
  { key: 'showPlaneRBAC', name: 'RBAC', label: 'RBAC (Role, ClusterRoleBinding, ...)', color: '#cc9900' },
  { key: 'showPlaneAuthentication', name: 'Authentication', label: 'Authentication (ServiceAccount, ...)', color: '#ffbed7' },
  { key: 'showPlanePolicy', name: 'Policy', label: 'Policy (Webhooks, SCC, ...)', color: '#66cc99' },
  { key: 'showPlaneExtend', name: 'Extend', label: 'Extend (CRD, OLM, APIService)', color: '#ffabab' },
  { key: 'showPlaneCluster', name: 'Cluster', label: 'Cluster (Namespace, Node config, ...)', color: '#baeee5' },
  { key: 'showPlaneThirdParty', name: 'ThirdParty', label: 'ThirdParty (other operators/CRDs)', color: '#ff0099' },
];

/** Only the boolean-valued FilterState keys — namespace/labelFilter/annotationFilter are strings, wired
 *  through their own dedicated inputs below, never through a plain checkbox Row. */
type BooleanFilterKey = { [K in keyof FilterState]: FilterState[K] extends boolean ? K : never }[keyof FilterState];

interface Row {
  key?: BooleanFilterKey;
  label: string;
  swatch: string[];
}

// Functional rows use the SAME colors the scene actually renders (nodeRoleColor/podStatusColor/kindColors) so
// the swatch is never a lie about what toggling it hides — kept vivid (not pastel) to match the legacy
// filter-panel legend's actual saturation. Disabled rows use vivid placeholders in the same spirit, as a
// forward-looking palette for when those categories are actually modeled in the 3D scene.
const TOP_ROWS: Row[] = [
  { key: 'showNodes', label: 'Nodes (Master, Worker)', swatch: ['#8b2e2e', '#9aa1a8'] },
  { key: 'showCsi', label: 'CSI (Container Storage Interface)', swatch: ['#e0908c'] },
  { key: 'showStorage', label: 'Storage (PVC, PV, StorageClass)', swatch: ['#e0a030', '#c98a3a', '#8a5a2b'] },
  { key: 'showNetwork', label: 'Network (Endpoint, Service)', swatch: ['#4a86e0', '#3d6fd6'] },
  { key: 'showIngress', label: 'Ingress/IngressControl (Gateway API)', swatch: ['#d9c94a'] },
];

const POD_ROWS: Row[] = [
  { key: 'podRunning', label: 'Running Pods', swatch: ['#2e9e4f'] },
  { key: 'podWarning', label: 'Warning Pods', swatch: ['#e6b800'] },
  { key: 'podFailed', label: 'Failed Pods', swatch: ['#c0392b'] },
  { key: 'podSucceeded', label: 'Successful/Finished Pods', swatch: ['#3a7bd5'] },
  { key: 'podDaemonSet', label: 'DaemonSet Pods', swatch: ['#8c8c8c'] },
];

// One bar per Node/Pod per category (not separate Limit/Requested rows) — Requested falls back to Limit
// per-container server-side, so this is already "the amount" of CPU/Memory, not two overlapping numbers.
const METRIC_ROWS: Row[] = [
  { key: 'showNodeCpuBar', label: 'Node CPU', swatch: [METRIC_COLORS.nodeCpu] },
  { key: 'showNodeMemoryBar', label: 'Node Memory', swatch: [METRIC_COLORS.nodeMemory] },
  { key: 'showNodeStorageBar', label: 'Node Persistent Storage', swatch: [METRIC_COLORS.nodeStorage] },
  { key: 'showPodCpuBar', label: 'Pod CPU', swatch: [METRIC_COLORS.podCpu] },
  { key: 'showPodMemoryBar', label: 'Pod Memory', swatch: [METRIC_COLORS.podMemory] },
];

function Swatch({ colors }: { colors: string[] }) {
  return (
    <span className="flex h-4 w-8 shrink-0 overflow-hidden rounded-sm border" style={{ borderColor: 'var(--vpk-border)' }}>
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

function FilterRow({ row, filters, onToggle }: { row: Row; filters: FilterState; onToggle: (key: BooleanFilterKey) => void }) {
  const enabled = !!row.key;
  const checked = row.key ? filters[row.key] : false;
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1 text-xs ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
      title={enabled ? undefined : 'Not modeled in the 3D scene yet'}
    >
      <input type="checkbox" checked={checked} disabled={!enabled} onChange={() => row.key && onToggle(row.key)} />
      <Swatch colors={row.swatch} />
      <span style={{ color: 'var(--vpk-fg)' }}>{row.label}</span>
    </label>
  );
}

/** A collapsible group header — click to expand/collapse the rows beneath it. Starts expanded so existing
 *  behavior (everything visible) doesn't change until the user actually collapses something. */
function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
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

export function FilterPanel({
  filters,
  onChange,
  onClose,
  namespaces,
  presentPanes,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClose: () => void;
  /** Distinct namespaces found in the loaded wheel data, for the Namespace select's option list. */
  namespaces: string[];
  /** Names of the resource panes that actually have at least one Kind present in the loaded snapshot (matches
   *  `WheelPlane.name` — a pane with nothing in it is never sent at all, see controlPlane.ts). The filter list
   *  mirrors this exactly: a checkbox for a pane only appears when that pane actually exists in this cluster,
   *  rather than always listing all 10 regardless of what's really there. */
  presentPanes: string[];
}) {
  const [justSaved, setJustSaved] = useState(false);

  function toggle(key: BooleanFilterKey) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  function saveAsDefault() {
    saveDefaultFilters(filters);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  const controlPlaneRow: Row = { key: 'showControlPlane', label: 'Control Plane (Kubelet, API Server, etcd, ...)', swatch: [CONTROL_PLANE_COLOR] };
  const paneRows: Row[] = PANES.filter((p) => presentPanes.includes(p.name)).map((p) => ({ key: p.key, label: p.label, swatch: [p.color] }));

  return (
    <div
      className="absolute top-11 left-2 z-10 max-h-[calc(100%-3rem)] w-72 overflow-y-auto rounded border text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
    >
      <div
        className="sticky top-0 flex items-center justify-between border-b px-2 py-1.5"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <span className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
          Filter 3D view
        </span>
        <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
          Close
        </button>
      </div>

      {TOP_ROWS.map((row) => (
        <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
      ))}

      <CollapsibleSection title="Pods">
        {POD_ROWS.map((row) => (
          <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection title="Resource CPU & Memory">
        {METRIC_ROWS.map((row) => (
          <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection title="Control Plane & etcd Planes">
        <FilterRow row={controlPlaneRow} filters={filters} onToggle={toggle} />
        {paneRows.map((row) => (
          <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection title="Namespace (default: all-namespace)">
        <div className="px-2 pb-2">
          <select
            value={filters.namespace}
            onChange={(e) => onChange({ ...filters, namespace: e.target.value })}
            className="w-full cursor-pointer rounded border px-1.5 py-1"
            style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
          >
            <option value="">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Metadata & Annotations">
        <div className="flex flex-col gap-1.5 px-2 pb-3">
          <label className="flex flex-col gap-0.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Label contains</span>
            <input
              value={filters.labelFilter}
              onChange={(e) => onChange({ ...filters, labelFilter: e.target.value })}
              placeholder="key or value substring"
              className="w-full rounded border px-1.5 py-1"
              style={{ borderColor: 'var(--vpk-border)' }}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span style={{ color: 'var(--vpk-fg-muted)' }}>Annotation contains</span>
            <input
              value={filters.annotationFilter}
              onChange={(e) => onChange({ ...filters, annotationFilter: e.target.value })}
              placeholder="key or value substring"
              className="w-full rounded border px-1.5 py-1"
              style={{ borderColor: 'var(--vpk-border)' }}
            />
          </label>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Sound">
        <label className="flex cursor-pointer items-center gap-2 px-2 py-1 pb-3">
          <input type="checkbox" checked={filters.playSound} onChange={() => toggle('playSound')} />
          <span style={{ color: 'var(--vpk-fg)' }}>Play Sound (sound indicates resource was selected in view)</span>
        </label>
      </CollapsibleSection>

      <div className="p-2 pt-0">
        <button
          onClick={saveAsDefault}
          title="Saved to this browser — the 3D view opens with these filters applied next time"
          className="w-full cursor-pointer rounded px-2 py-1.5 font-medium text-white"
          style={{ background: 'var(--vpk-rail-active-bg)' }}
        >
          {justSaved ? 'Saved ✓' : 'Save current filter settings as default'}
        </button>
      </div>
    </div>
  );
}
