/**
 * 3D filter panel, ported from the legacy app's left-side "Filter" slide-in (DESIGN §6.8's locked "filters =
 * visibility predicates over render-all scene" decision — this is the first real slice of that mechanism).
 * Only rows that map to something the 3D scene actually renders today are wired to real filtering (Nodes,
 * Network, Storage, Pod status) — everything else in the reference layout (CSI, Ingress, the 11 control/data
 * "planes", CPU & Memory bars, namespace scoping, sound) is shown disabled so the eventual panel shape is
 * already in place, without pretending toggles do something they don't yet.
 */
export interface FilterState {
  showNodes: boolean;
  showNetwork: boolean;
  showStorage: boolean;
  podRunning: boolean;
  podWarning: boolean;
  podFailed: boolean;
  podSucceeded: boolean;
  podDaemonSet: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  showNodes: true,
  showNetwork: true,
  showStorage: true,
  podRunning: true,
  podWarning: true,
  podFailed: true,
  podSucceeded: true,
  podDaemonSet: true,
};

interface Row {
  key?: keyof FilterState;
  label: string;
  swatch: string[];
}

// Functional rows use the SAME colors the scene actually renders (nodeRoleColor/podStatusColor/kindColors) so
// the swatch is never a lie about what toggling it hides — kept vivid (not pastel) to match the legacy
// filter-panel legend's actual saturation. Disabled rows use vivid placeholders in the same spirit, as a
// forward-looking palette for when those categories are actually modeled in the 3D scene.
const TOP_ROWS: Row[] = [
  { key: 'showNodes', label: 'Nodes (Master, Worker)', swatch: ['#8b2e2e', '#9aa1a8'] },
  { label: 'CSI (Container Storage Interface)', swatch: ['#d97a6e'] },
  { key: 'showStorage', label: 'Storage (PVC, PV, StorageClass)', swatch: ['#e0a030', '#c98a3a', '#8a5a2b'] },
  { key: 'showNetwork', label: 'Network (Endpoint, Service)', swatch: ['#4a86e0', '#3d6fd6'] },
  { label: 'Ingress/IngressControl', swatch: ['#d9c94a'] },
];

const PLANE_ROWS: Row[] = [
  { label: 'Control Plane', swatch: ['#7b3fc9'] },
  { label: 'Workload level plane', swatch: ['#5b3fb0'] },
  { label: 'Service level plane', swatch: ['#4f6f9e'] },
  { label: 'ConfigStorage level plane', swatch: ['#d9711f'] },
  { label: 'Authenticate related plane', swatch: ['#d968a0'] },
  { label: 'Authorization related plane', swatch: ['#a67c1f'] },
  { label: 'Policy related plane', swatch: ['#3f9e5f'] },
  { label: 'Extend resources plane', swatch: ['#d9776a'] },
  { label: 'Cluster resources plane', swatch: ['#6fc9a8'] },
  { label: 'Other resources plane', swatch: ['#8a8a8a'] },
  { label: 'ThirdParty resources plane', swatch: ['#c93f8a'] },
];

const POD_ROWS: Row[] = [
  { key: 'podRunning', label: 'Running Pods', swatch: ['#2e9e4f'] },
  { key: 'podWarning', label: 'Warning Pods', swatch: ['#e6b800'] },
  { key: 'podFailed', label: 'Failed Pods', swatch: ['#c0392b'] },
  { key: 'podSucceeded', label: 'Successful/Finished Pods', swatch: ['#3a7bd5'] },
  { key: 'podDaemonSet', label: 'DaemonSet Pods', swatch: ['#8c8c8c'] },
];

const METRIC_ROWS: Row[] = [
  { label: 'Node Memory', swatch: ['#7a7a7a'] },
  { label: 'Node CPU', swatch: ['#d9711f'] },
  { label: 'Node Persistent Storage', swatch: ['#c9584a'] },
  { label: 'Pod Memory Limit', swatch: ['#d968a0'] },
  { label: 'Pod Memory Requested', swatch: ['#4f5fc9'] },
  { label: 'Pod CPU Limit', swatch: ['#d9711f'] },
  { label: 'Pod CPU Requested', swatch: ['#3f9e8a'] },
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

function FilterRow({ row, filters, onToggle }: { row: Row; filters: FilterState; onToggle: (key: keyof FilterState) => void }) {
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

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="px-2 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--vpk-rail-active-bg)' }}>
      {children}
    </div>
  );
}

export function FilterPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClose: () => void;
}) {
  function toggle(key: keyof FilterState) {
    onChange({ ...filters, [key]: !filters[key] });
  }

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

      <SectionTitle>Control Plane &amp; etcd Planes</SectionTitle>
      {PLANE_ROWS.map((row) => (
        <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
      ))}

      <SectionTitle>Pods</SectionTitle>
      {POD_ROWS.map((row) => (
        <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
      ))}

      <SectionTitle>Resource CPU &amp; Memory</SectionTitle>
      {METRIC_ROWS.map((row) => (
        <FilterRow key={row.label} row={row} filters={filters} onToggle={toggle} />
      ))}

      <SectionTitle>Namespace (default: all-namespace)</SectionTitle>
      <div className="px-2 pb-2">
        <input
          disabled
          placeholder="select namespace(s)"
          title="Not wired to the 3D scene yet"
          className="w-full cursor-not-allowed rounded border px-1.5 py-1 opacity-45"
          style={{ borderColor: 'var(--vpk-border)' }}
        />
      </div>

      <SectionTitle>Sound</SectionTitle>
      <label className="flex cursor-not-allowed items-center gap-2 px-2 py-1 pb-3 opacity-45" title="Not wired yet">
        <input type="checkbox" disabled />
        <span style={{ color: 'var(--vpk-fg)' }}>Play Sound (sound indicates resource was selected in view)</span>
      </label>

      <div className="p-2 pt-0">
        <button
          disabled
          title="Not wired yet"
          className="w-full cursor-not-allowed rounded px-2 py-1.5 font-medium text-white opacity-45"
          style={{ background: 'var(--vpk-rail-active-bg)' }}
        >
          Save current filter settings as default
        </button>
      </div>
    </div>
  );
}
