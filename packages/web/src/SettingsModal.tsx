import { useEffect, useState } from 'react';
import { THEMES, type Theme } from './theme';
import { FONT_SIZES, applyFontSize, getStoredFontSize, initialFontSize, setStoredFontSize, type FontSize } from './fontSize';
import { colorForKind } from './kindColors';
import { applyKindColorOverrides, getStoredKindColorOverrides, setStoredKindColorOverrides } from './kindColorOverrides';
import { PANES } from './FilterPanel';
import { getStoredApiGroupColorOverrides, setStoredApiGroupColorOverrides } from './apiGroupColorOverrides';
import { STRUCTURAL_COLORS, defaultStructuralColor, getStoredStructuralColorOverrides, setStoredStructuralColorOverrides, type StructuralColorKey } from './structuralColorOverrides';
import { VendorIconsPanel } from './VendorIconsPanel';
import { NetworkCatalogPanel } from './NetworkCatalogPanel';
import type { TerminalTheme } from './courseSettings';

interface Settings {
  snapshotDir: string;
  redactSecrets: boolean;
  disablePullingSecrets: boolean;
}

/** A picker row is either a real Kind (color comes from kindColorOverrides.ts, default from colorForKind) or a
 *  "structural" 3D-Wheel-only element with no backing Kubernetes resource at all (color comes from
 *  structuralColorOverrides.ts instead — see that file's own doc comment for why it's a separate system). */
type ColorRowEntry = { kind: string } | { structural: StructuralColorKey };

/** Groups KIND_COLOR's ~30 kinds (plus a couple of structural rows slotted into the group they visually belong
 *  with — CSI Ring alongside real Storage kinds) for the picker below. Matches the section comments already in
 *  kindColors.ts (Workload/Network/Storage/RBAC/...), so the grouping stays obviously in sync with that file
 *  rather than being a second, driftable classification. The trailing "Control Plane" group is entirely
 *  structural — see its `note`. */
const KIND_GROUPS: { title: string; entries: ColorRowEntry[]; note?: string }[] = [
  { title: 'Workload', entries: ['Pod', 'Node', 'Namespace', 'Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'].map((kind) => ({ kind })) },
  {
    title: 'Network',
    entries: ['Service', 'Endpoints', 'EndpointSlice', 'Ingress', 'HTTPRoute', 'Route', 'Gateway', 'GatewayClass'].map((kind) => ({ kind })),
  },
  { title: 'Security', entries: ['Secret', 'ServiceAccount'].map((kind) => ({ kind })) },
  {
    title: 'Storage',
    entries: [
      ...['PersistentVolumeClaim', 'PersistentVolume', 'StorageClass', 'VolumeAttachment', 'CSINode', 'CSIDriver'].map((kind) => ({ kind })),
      { structural: 'csiRing' as const },
    ],
  },
  { title: 'RBAC', entries: ['Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding'].map((kind) => ({ kind })) },
  { title: 'Events', entries: ['Event'].map((kind) => ({ kind })) },
  {
    title: 'Control Plane',
    note: 'Not real Kubernetes resources — synthetic elements the 3D Wheel draws to visualize cluster infrastructure (there’s no "Control Plane" object to `kubectl get`).',
    entries: STRUCTURAL_COLORS.filter((s) => s.key !== 'csiRing').map((s) => ({ structural: s.key })),
  },
];

const STRUCTURAL_LABEL: Record<StructuralColorKey, string> = Object.fromEntries(STRUCTURAL_COLORS.map((s) => [s.key, s.label])) as Record<
  StructuralColorKey,
  string
>;

type SettingsTab = 'snapshot' | 'ui' | 'colors' | 'icons' | 'network' | 'course';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'snapshot', label: 'Snapshot' },
  { key: 'ui', label: 'UI' },
  { key: 'colors', label: 'Colors' },
  { key: 'icons', label: 'Vendor Icons' },
  { key: 'network', label: 'Network Identification' },
  { key: 'course', label: 'Course' },
];

const TERMINAL_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 22];

/**
 * Settings dialog (DESIGN: the previous version's snapshot-directory config + secret-handling toggles, ported
 * forward). Every field here except Appearance is enforced server-side, not just a display preference — the
 * snapshot directory controls what `/snapshots` lists, and the Secret toggles control what `/capture` fetches
 * and what `/definition` returns, so saving posts straight to `/settings` rather than caching anything
 * client-side. Appearance (color theme) is the one exception — a personal display preference, not data-
 * shaping server behavior, so it's localStorage-only (DESIGN.md §Theming) and applies instantly with no
 * `/settings` round-trip; it's rendered outside the `!settings` loading gate below since it needs no fetch.
 * Controlled for theme (App.tsx owns the state, since DefinitionModal also needs it for its editor theme —
 * see DefinitionModal.tsx's editorThemeFor) rather than this modal keeping its own local copy.
 */
export function SettingsModal({
  open,
  onClose,
  onSaved,
  theme,
  onThemeChange,
  fogEnabled,
  onFogEnabledChange,
  gridEnabled,
  onGridEnabledChange,
  showCourseCatalog,
  onShowCourseCatalogChange,
  showTeacherTools,
  onShowTeacherToolsChange,
  courseCliOverride,
  onCourseCliOverrideChange,
  terminalTheme,
  onTerminalThemeChange,
  terminalFontSize,
  onTerminalFontSizeChange,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  /** The 3D view's depth-fog toggle — same "App.tsx owns it, this modal just reads/writes" pattern as theme,
   *  since Scene3D needs it directly (Three.js fog isn't CSS). */
  fogEnabled: boolean;
  onFogEnabledChange: (next: boolean) => void;
  /** The 3D view's ground-grid floor toggle — same pattern as fogEnabled. */
  gridEnabled: boolean;
  onGridEnabledChange: (next: boolean) => void;
  /** Whether the Training group's "Catalog" nav item shows up — same pattern as fogEnabled; App.tsx needs it
   *  directly to decide what to pass NavRail. */
  showCourseCatalog: boolean;
  onShowCourseCatalogChange: (next: boolean) => void;
  /** Same pattern, for the Training group's "Teacher" (course create/edit) nav item. */
  showTeacherTools: boolean;
  onShowTeacherToolsChange: (next: boolean) => void;
  /** Overrides which kubectl-compatible CLI the in-app terminal/DetectCard/CheckCard run, regardless of a
   *  lesson's own frontmatter `cli` — empty string means "no override, use the lesson's own cli". Same
   *  pattern as fogEnabled; LessonRunnerView needs it directly. */
  courseCliOverride: string;
  onCourseCliOverrideChange: (next: string) => void;
  /** The in-app terminal's dark/light display — same pattern as fogEnabled, moved here from an in-terminal
   *  button (see courseSettings.ts's doc comment). */
  terminalTheme: TerminalTheme;
  onTerminalThemeChange: (next: TerminalTheme) => void;
  /** The in-app terminal's font size (px) — same pattern, moved here from in-terminal +/- buttons. */
  terminalFontSize: number;
  onTerminalFontSizeChange: (next: number) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dir, setDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Kind color overrides are localStorage-only (see kindColorOverrides.ts), not part of the server-persisted
  // `settings` above — re-read fresh every time the modal opens rather than kept in sync continuously, same
  // as `dir`/`settings` themselves.
  const [kindOverrides, setKindOverrides] = useState<Record<string, string>>({});
  // Same idea as kindOverrides, one level up: colors for the 3D Wheel's 10 resource "planes" (API-group
  // buckets — Workload/Networking/Storage/.../ThirdParty), each rendered as a sphere per Kind plus a
  // near-transparent wall behind it (see apiGroupColorOverrides.ts's own doc comment).
  const [apiGroupOverrides, setApiGroupOverrides] = useState<Record<string, string>>({});
  // Same idea again, for the 3D Wheel's non-Kind-backed "structural" elements (Control Plane ring/components,
  // CSI ring, ...) — see structuralColorOverrides.ts's own doc comment for why these need a third system.
  const [structuralOverrides, setStructuralOverrides] = useState<Record<string, string>>({});
  // Same localStorage-only, instant-apply model as theme — see fontSize.ts's own doc comment.
  const [fontSize, setFontSize] = useState<FontSize>(initialFontSize);
  const [tab, setTab] = useState<SettingsTab>('snapshot');

  useEffect(() => {
    if (!open) return;
    setTab('snapshot');
    setError(null);
    fetch('/settings')
      .then((r) => r.json() as Promise<Settings>)
      .then((s) => {
        setSettings(s);
        setDir(s.snapshotDir);
      });
    setKindOverrides(getStoredKindColorOverrides());
    setApiGroupOverrides(getStoredApiGroupColorOverrides());
    setStructuralOverrides(getStoredStructuralColorOverrides());
    setFontSize(getStoredFontSize() ?? 'medium');
  }, [open]);

  if (!open) return null;

  function setKindColor(kind: string, hex: string) {
    const next = { ...kindOverrides, [kind]: hex };
    setKindOverrides(next);
    setStoredKindColorOverrides(next);
    applyKindColorOverrides(next); // instant — every server SVG already re-themes off the CSS var this sets
  }

  function resetKindColor(kind: string) {
    const next = { ...kindOverrides };
    delete next[kind];
    setKindOverrides(next);
    setStoredKindColorOverrides(next);
    applyKindColorOverrides(next);
  }

  function changeFontSize(next: FontSize) {
    setFontSize(next);
    applyFontSize(next);
    setStoredFontSize(next);
  }

  function resetAllKindColors() {
    setKindOverrides({});
    setStoredKindColorOverrides({});
    applyKindColorOverrides({});
  }

  // No CSS-var apply step here (unlike setKindColor/resetKindColor above) — the 3D Wheel's resource planes
  // are the ONLY thing these colors affect, and Three.js material colors are plain JS values, not CSS; the
  // Wheel picks the new color up on its next /scene/wheel fetch (remapPlaneColors in Scene3D.tsx), same
  // fetch-time-only limitation kind colors already have there.
  function setApiGroupColor(name: string, hex: string) {
    const next = { ...apiGroupOverrides, [name]: hex };
    setApiGroupOverrides(next);
    setStoredApiGroupColorOverrides(next);
  }

  function resetApiGroupColor(name: string) {
    const next = { ...apiGroupOverrides };
    delete next[name];
    setApiGroupOverrides(next);
    setStoredApiGroupColorOverrides(next);
  }

  function resetAllApiGroupColors() {
    setApiGroupOverrides({});
    setStoredApiGroupColorOverrides({});
  }

  // Same fetch-time-only limitation as setApiGroupColor above — the Wheel picks these up on its next
  // /scene/wheel fetch (remapStructuralColors in Scene3D.tsx).
  function setStructuralColor(key: StructuralColorKey, hex: string) {
    const next = { ...structuralOverrides, [key]: hex };
    setStructuralOverrides(next);
    setStoredStructuralColorOverrides(next);
  }

  function resetStructuralColor(key: StructuralColorKey) {
    const next = { ...structuralOverrides };
    delete next[key];
    setStructuralOverrides(next);
    setStoredStructuralColorOverrides(next);
  }

  function resetAllStructuralColors() {
    setStructuralOverrides({});
    setStoredStructuralColorOverrides({});
  }

  async function save(next: Partial<Settings>) {
    setSaving(true);
    setError(null);
    const r = await fetch('/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(next),
    });
    const body = (await r.json()) as Settings & { error?: string };
    setSaving(false);
    if (!r.ok) {
      setError(body.error ?? 'failed to save');
      return;
    }
    setSettings(body);
    setDir(body.snapshotDir);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex w-full max-w-2xl flex-col rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', maxHeight: '85vh' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Close
          </button>
        </div>

        <div className="mb-3 flex gap-1 border-b" style={{ borderColor: 'var(--vpk-border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="-mb-px cursor-pointer border-b-2 px-3 py-1.5 text-xs"
              style={{
                borderColor: tab === t.key ? 'var(--vpk-accent)' : 'transparent',
                color: tab === t.key ? 'var(--vpk-accent)' : 'var(--vpk-fg-muted)',
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col overflow-y-auto pr-1">
        {tab === 'ui' && (
          <>
            <label className="mb-4 flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--vpk-fg-muted)' }}>Appearance</span>
              <select
                value={theme}
                onChange={(e) => onThemeChange(e.target.value as Theme)}
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              >
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-4 flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--vpk-fg-muted)' }}>Font Size</span>
              <select
                value={fontSize}
                onChange={(e) => changeFontSize(e.target.value as FontSize)}
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              >
                {FONT_SIZES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-2 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={fogEnabled} onChange={(e) => onFogEnabledChange(e.target.checked)} />
              <span style={{ color: 'var(--vpk-fg)' }}>
                Depth fog (3D view) — fades distant objects toward the backdrop for a stronger sense of depth in the
                Field and Wheel views. Off by default: on a very large cluster this can fade out distant Field-view
                nodes.
              </span>
            </label>

            <label className="mb-4 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={gridEnabled} onChange={(e) => onGridEnabledChange(e.target.checked)} />
              <span style={{ color: 'var(--vpk-fg)' }}>
                Grid floor (3D view) — the ground grid under the Field and Wheel views. Sized to always extend past
                every node/item currently shown.
              </span>
            </label>

            <label className="mb-2 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={showCourseCatalog} onChange={(e) => onShowCourseCatalogChange(e.target.checked)} />
              <span style={{ color: 'var(--vpk-fg)' }}>
                Show Course Catalog in menu — the Training group's course picker. On by default.
              </span>
            </label>

            <label className="mb-4 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={showTeacherTools} onChange={(e) => onShowTeacherToolsChange(e.target.checked)} />
              <span style={{ color: 'var(--vpk-fg)' }}>
                Show Teacher tools in menu — the Training group's course create/edit screen. On by default.
              </span>
            </label>
          </>
        )}

        {tab === 'colors' && (
          <>
            <div className="mb-4 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
                  Kind Colors
                </span>
                <button
                  onClick={() => {
                    resetAllKindColors();
                    resetAllStructuralColors();
                  }}
                  disabled={Object.keys(kindOverrides).length === 0 && Object.keys(structuralOverrides).length === 0}
                  className="cursor-pointer rounded border px-2 py-0.5 text-[11px] disabled:cursor-default disabled:opacity-40"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                >
                  Reset all
                </button>
              </div>
              <p style={{ color: 'var(--vpk-fg-muted)' }}>
                Colors used by the 3D Wheel, OwnerRef/Network diagrams, and icon badges — changes apply instantly.
              </p>
              <div className="flex flex-col gap-2 rounded border p-2" style={{ borderColor: 'var(--vpk-border)', maxHeight: 260, overflowY: 'auto' }}>
                {KIND_GROUPS.map((group) => (
                  <div key={group.title} className="rounded p-1.5" style={{ background: 'var(--vpk-bg)' }}>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vpk-fg-muted)' }}>
                      {group.title}
                    </div>
                    {group.note && (
                      <p className="mb-1 text-[10px] italic" style={{ color: 'var(--vpk-fg-muted)' }}>
                        {group.note}
                      </p>
                    )}
                    <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: '1fr auto auto' }}>
                      {group.entries.map((entry) => {
                        if ('structural' in entry) {
                          const overridden = structuralOverrides[entry.structural];
                          return (
                            <div key={entry.structural} className="col-span-3 grid grid-cols-subgrid items-center py-0.5">
                              <span style={{ color: 'var(--vpk-fg)' }}>
                                {STRUCTURAL_LABEL[entry.structural]}
                                {!group.note && (
                                  <span className="ml-1 text-[10px] italic" style={{ color: 'var(--vpk-fg-muted)' }}>
                                    (not a real resource)
                                  </span>
                                )}
                              </span>
                              <input
                                type="color"
                                value={overridden ?? defaultStructuralColor(entry.structural)}
                                onChange={(e) => setStructuralColor(entry.structural, e.target.value)}
                                className="h-5 w-8 cursor-pointer rounded border p-0"
                                style={{ borderColor: 'var(--vpk-border)' }}
                                title={`${STRUCTURAL_LABEL[entry.structural]} color`}
                              />
                              <button
                                onClick={() => resetStructuralColor(entry.structural)}
                                disabled={!overridden}
                                className="cursor-pointer rounded border px-1.5 text-[10px] disabled:cursor-default disabled:opacity-0"
                                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                              >
                                reset
                              </button>
                            </div>
                          );
                        }
                        const kind = entry.kind;
                        const overridden = kindOverrides[kind];
                        return (
                          <div key={kind} className="col-span-3 grid grid-cols-subgrid items-center py-0.5">
                            <span style={{ color: 'var(--vpk-fg)' }}>{kind}</span>
                            <input
                              type="color"
                              value={overridden ?? colorForKind(kind)}
                              onChange={(e) => setKindColor(kind, e.target.value)}
                              className="h-5 w-8 cursor-pointer rounded border p-0"
                              style={{ borderColor: 'var(--vpk-border)' }}
                              title={`${kind} color`}
                            />
                            <button
                              onClick={() => resetKindColor(kind)}
                              disabled={!overridden}
                              className="cursor-pointer rounded border px-1.5 text-[10px] disabled:cursor-default disabled:opacity-0"
                              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                            >
                              reset
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
                  API Group Colors (3D Wheel)
                </span>
                <button
                  onClick={resetAllApiGroupColors}
                  disabled={Object.keys(apiGroupOverrides).length === 0}
                  className="cursor-pointer rounded border px-2 py-0.5 text-[11px] disabled:cursor-default disabled:opacity-40"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                >
                  Reset all
                </button>
              </div>
              <p style={{ color: 'var(--vpk-fg-muted)' }}>
                Colors the 3D Wheel's resource planes (Workload, Networking, RBAC, ...) — each Kind's sphere uses the
                color at full strength, the plane wall behind it at near-transparent. Applies on the Wheel's next
                load.
              </p>
              <div className="flex flex-col gap-3 rounded border p-2" style={{ borderColor: 'var(--vpk-border)', maxHeight: 260, overflowY: 'auto' }}>
                <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  {PANES.map((p) => {
                    const overridden = apiGroupOverrides[p.name];
                    return (
                      <div key={p.name} className="col-span-3 grid grid-cols-subgrid items-center py-0.5">
                        <span style={{ color: 'var(--vpk-fg)' }}>{p.label}</span>
                        <input
                          type="color"
                          value={overridden ?? p.color}
                          onChange={(e) => setApiGroupColor(p.name, e.target.value)}
                          className="h-5 w-8 cursor-pointer rounded border p-0"
                          style={{ borderColor: 'var(--vpk-border)' }}
                          title={`${p.name} color`}
                        />
                        <button
                          onClick={() => resetApiGroupColor(p.name)}
                          disabled={!overridden}
                          className="cursor-pointer rounded border px-1.5 text-[10px] disabled:cursor-default disabled:opacity-0"
                          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                        >
                          reset
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'icons' && <VendorIconsPanel />}

        {tab === 'network' && <NetworkCatalogPanel />}

        {tab === 'course' && (
          <>
            <label className="mb-4 flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--vpk-fg-muted)' }}>Terminal CLI override</span>
              <select
                value={courseCliOverride}
                onChange={(e) => onCourseCliOverrideChange(e.target.value)}
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              >
                <option value="">Auto (use each lesson's own cli)</option>
                <option value="kubectl">Always kubectl</option>
                <option value="oc">Always oc</option>
              </select>
              <span style={{ color: 'var(--vpk-fg-muted)' }}>
                Forces the in-app terminal (and its environment/check probes) to run this CLI regardless of what a
                lesson authored — useful if you only have <code>oc</code> installed and hit "Only 'kubectl' commands
                are allowed here" on a kubectl-authored lesson. oc is a documented superset of kubectl for every verb
                these lessons use, so switching the binary doesn't relax which verbs are allowed.
              </span>
            </label>

            <label className="mb-4 flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--vpk-fg-muted)' }}>Terminal appearance</span>
              <select
                value={terminalTheme}
                onChange={(e) => onTerminalThemeChange(e.target.value as TerminalTheme)}
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              >
                <option value="dark">Dark (black background)</option>
                <option value="light">Light (white background)</option>
              </select>
            </label>

            <label className="mb-2 flex flex-col gap-1 text-xs">
              <span style={{ color: 'var(--vpk-fg-muted)' }}>Terminal font size</span>
              <select
                value={terminalFontSize}
                onChange={(e) => onTerminalFontSizeChange(Number(e.target.value))}
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              >
                {TERMINAL_FONT_SIZES.map((px) => (
                  <option key={px} value={px}>
                    {px}px
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {tab === 'snapshot' &&
          (!settings ? (
            <div className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              loading…
            </div>
          ) : (
            <div className="flex flex-col gap-4 text-xs">
              <label className="flex flex-col gap-1">
                <span style={{ color: 'var(--vpk-fg-muted)' }}>Snapshot directory</span>
                <div className="flex gap-2">
                  <input
                    value={dir}
                    onChange={(e) => setDir(e.target.value)}
                    className="flex-1 rounded border px-2 py-1"
                    style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
                  />
                  <button
                    disabled={saving || dir === settings.snapshotDir}
                    onClick={() => void save({ snapshotDir: dir })}
                    className="cursor-pointer rounded border px-2 py-1 disabled:cursor-default disabled:opacity-50"
                    style={{ borderColor: 'var(--vpk-border)' }}
                  >
                    Save
                  </button>
                </div>
              </label>

              <div className="flex flex-col gap-2">
                <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
                  Secrets
                </span>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={settings.redactSecrets}
                    disabled={saving}
                    onChange={(e) => void save({ redactSecrets: e.target.checked })}
                  />
                  <span style={{ color: 'var(--vpk-fg)' }}>
                    Redact Secrets — show &quot;Secret data is not available to view&quot; instead of the real values in the
                    definition viewer. The real data is still saved underneath; toggle this off to view it.
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={settings.disablePullingSecrets}
                    disabled={saving}
                    onChange={(e) => void save({ disablePullingSecrets: e.target.checked })}
                  />
                  <span style={{ color: 'var(--vpk-fg)' }}>
                    Disable pulling Secrets — Secret objects are still captured (name, type, metadata), but their data is
                    permanently discarded at capture time and never saved, regardless of the Redact setting above.
                  </span>
                </label>
              </div>

              {error && <div style={{ color: 'var(--vpk-status-error)' }}>{error}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
