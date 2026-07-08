import { useCallback, useEffect, useState } from 'react';
import { Share2, Search, LayoutTemplate, Network, Shield, Database, Layers, Box, KeyRound, UserSearch, Settings as SettingsIcon, BarChart3, X, FlaskConical } from 'lucide-react';
import { NavRail, type RailGroup, type RailItem } from './NavRail';
import { DemoDataView } from './DemoDataView';
import { SearchView } from './SearchView';
import { NetworkView } from './NetworkView';
import { SecurityView } from './SecurityView';
import { StorageView } from './StorageView';
import { SchematicView } from './SchematicView';
import { OwnerRefView } from './OwnerRefView';
import { RbacView } from './RbacView';
import { WhoCanView, EMPTY_WHOCAN_QUERY, type WhoCanQueryState } from './WhoCanView';
import { ContainerImagesView } from './ContainerImagesView';
import { Scene3D } from './Scene3D';
import { ErrorBoundary } from './ErrorBoundary';
import { DefinitionModal, type FocusPath } from './DefinitionModal';
import { SettingsModal } from './SettingsModal';
import { StatsModal } from './StatsModal';
import { StopConfirmModal } from './StopConfirmModal';
import { AboutModal } from './AboutModal';
import { CaptureConfirmModal, type CaptureOptions } from './CaptureConfirmModal';
import { Tooltip } from './Tooltip';
import { applyTheme, getStoredTheme, initialTheme, setStoredTheme, type Theme } from './theme';

interface Snapshots {
  dir: string;
  current: string;
  files: string[];
}

type ViewId = 'cluster3d' | 'ownerref' | 'search' | 'network' | 'security' | 'rbac' | 'whocan' | 'storage' | 'schematic' | 'images' | 'demo';

const RAIL_GROUPS: RailGroup<ViewId>[] = [
  {
    title: 'Cluster',
    items: [
      { id: 'search', label: 'Search', icon: Search },
      { id: 'cluster3d', label: '3D Cluster', icon: Box },
    ],
  },
  {
    title: 'Explore',
    items: [{ id: 'schematic', label: 'Schematic', icon: LayoutTemplate }],
  },
  {
    title: 'Lenses',
    items: [
      { id: 'network', label: 'Network', icon: Network },
      { id: 'security', label: 'Security', icon: Shield },
      { id: 'rbac', label: 'RBAC', icon: KeyRound },
      { id: 'whocan', label: 'Who Can', icon: UserSearch },
      { id: 'storage', label: 'Storage', icon: Database },
      { id: 'ownerref', label: 'OwnerRef', icon: Share2 },
      { id: 'images', label: 'Images', icon: Layers },
    ],
  },
];

/** Pinned above the nav rail's own collapse/expand chevron, separate from the view groups above it — a
 *  cluster-testing tool that belongs to the app shell, not a "lens" onto loaded cluster data like the rest
 *  of the rail. */
const DEMO_DATA_ITEM: RailItem<ViewId> = { id: 'demo', label: 'Demo Data', icon: FlaskConical };

/** Screen title for the header's second row — one lookup shared with the nav rail's own labels, so the two
 *  never drift apart. */
const VIEW_LABELS: Record<ViewId, string> = Object.fromEntries(
  RAIL_GROUPS.flatMap((g) => g.items)
    .concat(DEMO_DATA_ITEM)
    .map((item) => [item.id, item.label]),
) as Record<ViewId, string>;

export function App() {
  const [view, setView] = useState<ViewId>('ownerref');
  const [snaps, setSnaps] = useState<Snapshots>({ dir: '', current: '', files: [] });
  const [selected, setSelected] = useState<string | null>(null);
  // The Pod SchematicView actually renders — captured from `selected` only at the moment the user navigates
  // INTO the Schematic view (see the effect below), then left alone. Every icon inside the diagram itself
  // (ConfigMap, PV, RoleBinding, the owner chain, ...) also calls selectResource to open ITS OWN editor,
  // which reassigns `selected` to that (usually non-Pod) id — without this separate, frozen copy, that would
  // re-trigger SchematicView's fetch for a non-Pod id, 404, and leave a stale "not found" error visible
  // underneath as soon as the editor closes.
  const [schematicPodId, setSchematicPodId] = useState<string | null>(null);
  // Set only by Schematic's per-container rows and its Phase/Conditions area — an explicit path DefinitionModal
  // jumps straight to instead of the Pod's generic default field. Reset to undefined on every OTHER selection
  // path (selectResource's default param, and explicitly in select3D) so it can never leak onto an unrelated
  // resource's editor view.
  const [focusPath, setFocusPath] = useState<FocusPath | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Owned here (not inside SettingsModal) because DefinitionModal also needs the current theme, to pick a
  // matching CodeMirror editor theme (see DefinitionModal.tsx's editorThemeFor) — main.tsx already applied
  // the initial theme before this component ever mounted, so this just tracks it for both consumers.
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? initialTheme());

  function changeTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    setStoredTheme(next);
  }
  const [statsOpen, setStatsOpen] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [captureConfirmOpen, setCaptureConfirmOpen] = useState(false);
  const [stopped, setStopped] = useState(false);
  // Set only when Search was entered via a 3D resource-pane sphere's "Search" button — drives both the Kind
  // pre-filter AND whether Search shows a "Return to 3D view" pill, so a normal nav-rail visit to Search
  // behaves exactly as it did before (no stray scope, no button back to a view the user was never in).
  const [searchScope, setSearchScope] = useState<{ kind: string } | null>(null);
  // Same idea as `searchScope`, for Schematic: only set when entered via the 3D Properties popup's
  // "View Schematic" button, so a normal nav-rail visit to Schematic gets no stray "Return" pill either.
  const [schematicFrom3D, setSchematicFrom3D] = useState(false);
  // Same pattern again, for OwnerRef: set only via a 3D Properties popup's "View OwnerRef" button — while set,
  // OwnerRefView fetches `/ownerref?id=` for that one resource instead of showing its own manual Namespace→
  // Resource picker. Cleared by Return, same as searchScope/schematicFrom3D.
  const [ownerRefFocusId, setOwnerRefFocusId] = useState<string | null>(null);
  // Same pattern again, for Images: set only via the 3D Properties popup's image-registry "View Repository"
  // button, scoping the Container Images page to that registry hostname and showing its own "Return" pill.
  const [imagesRegistryFilter, setImagesRegistryFilter] = useState<string | null>(null);
  // Same pattern for RBAC, with two scoped entry points: the Schematic's "RBAC ▸" pill hands over the Pod's
  // ServiceAccount id, the Security view's "diagram" pill hands over a subject identity (User/Group subjects
  // have no resource id). `rbacFrom` remembers which view to Return to. A nav-rail visit starts unscoped.
  const [rbacSaId, setRbacSaId] = useState<string | null>(null);
  const [rbacSubject, setRbacSubject] = useState<{ kind: string; name: string; namespace?: string } | null>(null);
  const [rbacFrom, setRbacFrom] = useState<'schematic' | 'security' | 'whocan' | null>(null);
  // Held here (not in WhoCanView) so a query survives the round-trip out to a subject's RBAC diagram and back
  // — WhoCanView unmounts on navigation like every other non-3D view.
  const [whoCanQuery, setWhoCanQuery] = useState<WhoCanQueryState>(EMPTY_WHOCAN_QUERY);
  const [namespaces, setNamespaces] = useState<string[]>([]);

  const refreshSnaps = useCallback(
    () => fetch('/snapshots').then((r) => r.json() as Promise<Snapshots>).then(setSnaps),
    [],
  );

  const refreshNamespaces = useCallback(
    () => fetch('/namespaces').then((r) => r.json() as Promise<string[]>).then(setNamespaces),
    [],
  );

  // Deliberately depends on `view` ALONE — re-capturing `selected` only on the transition INTO 'schematic',
  // not on every later change to `selected` while already there (see schematicPodId's own comment above).
  useEffect(() => {
    if (view === 'schematic') setSchematicPodId(selected);
  }, [view]);

  // Runs once on mount — refreshSnaps/refreshNamespaces are stable callbacks (empty dep arrays).
  useEffect(() => {
    void refreshSnaps();
    void refreshNamespaces();
  }, [refreshSnaps, refreshNamespaces]);

  async function post(path: string, body: unknown) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async function onSelectSnapshot(file: string) {
    setBusy('loading…');
    await post('/load', { path: file });
    await Promise.all([refreshSnaps(), refreshNamespaces()]);
    setOwnerRefFocusId(null); // a resource id focused before this snapshot swap is almost certainly stale now
    setSelected(null);
    setModalOpen(false);
    setBusy('');
  }

  async function onCapture(opts: CaptureOptions) {
    setCaptureConfirmOpen(false);
    setBusy('capturing from cluster…');
    const res = (await post('/capture', opts)) as { snapshot?: string; error?: string };
    await Promise.all([refreshSnaps(), refreshNamespaces()]);
    setOwnerRefFocusId(null);
    setBusy(res.error ? `error: ${res.error}` : '');
  }

  function selectResource(id: string, path?: FocusPath) {
    setSelected(id);
    setFocusPath(path);
    setModalOpen(true);
  }

  // 3D clicks show the small Properties popup first (matching the legacy app), not the full editor —
  // Scene3D opens the editor only when that popup's own "View source" button is clicked. Explicitly clears
  // any stale Schematic focusPath so a later "View source" here can't land on some earlier, unrelated field.
  function select3D(id: string) {
    setSelected(id);
    setFocusPath(undefined);
  }

  // A resource-pane sphere's Properties popup routes here — there's no single instance to open (the sphere
  // stands for a whole Kind), so this hands off to Search instead, scoped to that Kind.
  function searchKind(kind: string) {
    setSearchScope({ kind });
    setView('search');
  }

  function returnFrom3DSearch() {
    setSearchScope(null);
    setView('cluster3d');
  }

  function viewSchematicFrom3D() {
    setSchematicFrom3D(true);
    setView('schematic');
  }

  function returnFrom3DSchematic() {
    setSchematicFrom3D(false);
    setView('cluster3d');
  }

  function viewOwnerRefFrom3D(id: string) {
    setOwnerRefFocusId(id);
    setView('ownerref');
  }

  function returnFrom3DOwnerRef() {
    setOwnerRefFocusId(null);
    setView('cluster3d');
  }

  // The image-registry stack's Properties popup routes here — there's no single instance to open (the
  // cylinder stands for every image reference under that registry hostname), so this hands off to Container
  // Images instead, scoped to it.
  function viewRepositoryFrom3D(registry: string) {
    setImagesRegistryFilter(registry);
    setView('images');
  }

  function returnFrom3DImages() {
    setImagesRegistryFilter(null);
    setView('cluster3d');
  }

  function viewRbacFromSchematic(saId: string) {
    setRbacSaId(saId);
    setRbacSubject(null);
    setRbacFrom('schematic');
    setView('rbac');
  }

  function viewRbacFromSubject(from: 'security' | 'whocan', subject: { kind: string; name: string; namespace?: string }) {
    setRbacSubject(subject);
    setRbacSaId(null);
    setRbacFrom(from);
    setView('rbac');
  }

  function returnFromRbac() {
    const dest = rbacFrom === 'security' ? 'security' : rbacFrom === 'whocan' ? 'whocan' : 'schematic';
    setRbacSaId(null);
    setRbacSubject(null);
    setRbacFrom(null);
    setView(dest);
  }

  const rbacReturnLabel =
    rbacFrom === 'security' ? '← Return to Security' : rbacFrom === 'whocan' ? '← Return to Who Can' : '← Return to Schematic';

  // Render the "stopped" screen from already-loaded client code BEFORE the fetch even resolves — the server
  // exits shortly after responding, so waiting on the response first could race a connection that's already
  // gone.
  function onConfirmStop() {
    setConfirmStopOpen(false);
    setStopped(true);
    void fetch('/shutdown', { method: 'POST' }).catch(() => {});
  }

  if (stopped) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}>
        <div className="text-center">
          <p className="text-lg font-medium">VpK has been stopped.</p>
          <p className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            You can close this tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen font-sans text-sm"
      style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
    >
      <NavRail
        groups={RAIL_GROUPS}
        active={view}
        onSelect={setView}
        onAbout={() => setAboutOpen(true)}
        footerItem={DEMO_DATA_ITEM}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header
          className="flex items-center gap-3 border-b px-3 py-2 flex-wrap"
          style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}
        >
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            snapshot
            <select
              value={snaps.current}
              onChange={(e) => void onSelectSnapshot(e.target.value)}
              // Re-reads the snapshot directory fresh every time this is opened (not just once at mount) —
              // onMouseDown fires before the browser paints its native option list, onFocus covers opening via
              // keyboard (Tab then Enter/Space) instead of a mouse click. Both are cheap, idempotent local
              // reads, so firing from both on the same interaction is harmless.
              onMouseDown={() => void refreshSnaps()}
              onFocus={() => void refreshSnaps()}
              className="rounded border px-1 py-0.5"
              style={{ borderColor: 'var(--vpk-field-border)' }}
            >
              {snaps.files.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setCaptureConfirmOpen(true)}
            disabled={!!busy}
            className="rounded border px-2 py-1 text-xs cursor-pointer disabled:cursor-default disabled:opacity-50"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Capture from cluster
          </button>
          <span className="text-xs" style={{ color: 'var(--vpk-status-error)' }}>
            {busy}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip label="Settings">
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                className="flex cursor-pointer items-center rounded border p-1.5"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
              >
                <SettingsIcon size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Statistics">
              <button
                onClick={() => setStatsOpen(true)}
                aria-label="Statistics"
                className="flex cursor-pointer items-center rounded border p-1.5"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
              >
                <BarChart3 size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Stop the VpK server">
              <button
                onClick={() => setConfirmStopOpen(true)}
                aria-label="Stop the VpK server"
                className="flex cursor-pointer items-center rounded border p-1.5"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-status-error)' }}
              >
                <X size={15} />
              </button>
            </Tooltip>
          </div>
        </header>
        <div
          className="flex items-center gap-3 border-b px-3 py-1.5"
          style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--vpk-fg)' }}>
            {VIEW_LABELS[view]}
          </span>
        </div>

        <div className="flex flex-1 min-h-0">
          <main className={`flex-1 overflow-auto ${view === 'cluster3d' ? '' : 'p-3'}`}>
            {/* Scene3D stays mounted (visibility toggle inside) so there's at most one WebGL context ever.
                Wrapped in an ErrorBoundary since react-three-fiber's Canvas throws when WebGL can't be
                created (e.g. a sandboxed/headless browser) — without one, that error has no boundary to stop
                at and unmounts the entire App, blanking every view, not just this one. */}
            <ErrorBoundary
              fallback={(error) => (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center"
                  style={{ display: view === 'cluster3d' ? 'flex' : 'none' }}
                >
                  <span style={{ color: 'var(--vpk-fg)' }}>3D Cluster view couldn't start — your browser or environment doesn't support WebGL.</span>
                  <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>{error.message}</span>
                </div>
              )}
            >
              <Scene3D
                active={view === 'cluster3d'}
                onSelect={select3D}
                selected={selected}
                onOpenEditor={() => setModalOpen(true)}
                onViewSchematic={viewSchematicFrom3D}
                onViewOwnerRef={viewOwnerRefFrom3D}
                onSearchKind={searchKind}
                onViewRepository={viewRepositoryFrom3D}
                snapshotKey={snaps.current}
              />
            </ErrorBoundary>
            {view === 'ownerref' && (
              <OwnerRefView
                focusId={ownerRefFocusId}
                onSelect={selectResource}
                onReturn={ownerRefFocusId ? returnFrom3DOwnerRef : undefined}
                snapshotKey={snaps.current}
              />
            )}
            {/* key={snaps.current} on every view below (except Scene3D, which must stay mounted for its one
                WebGL context, and OwnerRefView/DemoDataView, which manage snapshot/shared-state transitions
                themselves) forces a full unmount+remount on snapshot switch. Without it, each view's
                fetch-on-mount effect has no dependency on which snapshot is loaded, so switching snapshots
                while that view is already open left it silently showing the PREVIOUS snapshot's data. */}
            {view === 'search' && (
              <SearchView
                key={snaps.current}
                onSelect={selectResource}
                initialKind={searchScope?.kind}
                onReturn={searchScope ? returnFrom3DSearch : undefined}
              />
            )}
            {view === 'network' && <NetworkView key={snaps.current} namespaces={namespaces} onSelect={selectResource} />}
            {view === 'security' && (
              <SecurityView key={snaps.current} onSelect={selectResource} onViewRbac={(s) => viewRbacFromSubject('security', s)} />
            )}
            {view === 'whocan' && (
              <WhoCanView
                key={snaps.current}
                query={whoCanQuery}
                onQueryChange={setWhoCanQuery}
                onSelect={selectResource}
                onViewRbac={(s) => viewRbacFromSubject('whocan', s)}
              />
            )}
            {view === 'storage' && <StorageView key={snaps.current} onSelect={selectResource} />}
            {view === 'schematic' && (
              <SchematicView
                key={snaps.current}
                podId={schematicPodId}
                onSelect={selectResource}
                onViewRbac={viewRbacFromSchematic}
                onReturn={schematicFrom3D ? returnFrom3DSchematic : undefined}
              />
            )}
            {view === 'rbac' && (
              <RbacView
                key={snaps.current}
                initialSaId={rbacSaId ?? undefined}
                initialSubject={rbacSubject ?? undefined}
                onSelect={selectResource}
                onReturn={rbacFrom ? returnFromRbac : undefined}
                returnLabel={rbacReturnLabel}
              />
            )}
            {view === 'images' && (
              <ContainerImagesView
                key={snaps.current}
                onSelect={selectResource}
                initialRegistry={imagesRegistryFilter ?? undefined}
                onReturn={imagesRegistryFilter ? returnFrom3DImages : undefined}
              />
            )}
            {view === 'demo' && <DemoDataView />}
          </main>
        </div>
      </div>

      <DefinitionModal
        resourceId={modalOpen ? selected : null}
        focusPath={modalOpen ? focusPath : undefined}
        onClose={() => setModalOpen(false)}
        theme={theme}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => void refreshSnaps()}
        theme={theme}
        onThemeChange={changeTheme}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <StopConfirmModal open={confirmStopOpen} onCancel={() => setConfirmStopOpen(false)} onConfirm={onConfirmStop} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CaptureConfirmModal
        open={captureConfirmOpen}
        onCancel={() => setCaptureConfirmOpen(false)}
        onConfirm={(opts) => void onCapture(opts)}
      />
    </div>
  );
}
