import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share2, Search, LayoutTemplate, Network, Shield, Database, Layers, Box, KeyRound, UserSearch, Settings as SettingsIcon, BarChart3, ScrollText, X, FlaskConical, AlertTriangle, Table2, NotebookPen, BookOpen, GraduationCap, TerminalSquare, Printer, CircleHelp } from 'lucide-react';
import { NavRail, type RailGroup, type RailItem } from './NavRail';
import { DemoDataView } from './DemoDataView';
import { LessonRunnerView } from './LessonRunnerView';
import { CourseCatalogView } from './CourseCatalogView';
import { TeacherView } from './TeacherView';
import { CliEquivalentModal } from './CliEquivalentModal';
import { CLI_EQUIVALENTS } from './cliEquivalents';
import { SearchView } from './SearchView';
import { NetworkView } from './NetworkView';
import { SecurityView } from './SecurityView';
import { StorageView } from './StorageView';
import { SchematicView } from './SchematicView';
import { OwnerRefView } from './OwnerRefView';
import { ResourcesView } from './ResourcesView';
import { RbacView } from './RbacView';
import { WhoCanView, EMPTY_WHOCAN_QUERY, type WhoCanQueryState } from './WhoCanView';
import { ContainerImagesView } from './ContainerImagesView';
import { EventsView } from './EventsView';
import { Scene3D } from './Scene3D';
import { ErrorBoundary } from './ErrorBoundary';
import { DefinitionModal, type FocusPath } from './DefinitionModal';
import { SettingsModal } from './SettingsModal';
import { StatsModal } from './StatsModal';
import { LogsModal } from './LogsModal';
import { StopConfirmModal } from './StopConfirmModal';
import { AboutModal } from './AboutModal';
import { HelpPanel } from './HelpPanel';
import { CaptureConfirmModal } from './CaptureConfirmModal';
import { NoSnapshotBanner } from './NoSnapshotBanner';
import { SplashScreen } from './SplashScreen';
import { hasPlayedSplashThisSession, markSplashPlayed } from './splashState';
import { initWindowStatePersistence } from './windowState';
import { Tooltip } from './Tooltip';
import { applyTheme, getStoredTheme, initialTheme, setStoredTheme, type Theme } from './theme';
import { initialFogEnabled, setStoredFogEnabled } from './fogSetting';
import { initialGridEnabled, setStoredGridEnabled } from './gridSetting';
import { initialShowCourse, initialShowCourseCatalog, initialShowTeacherTools, setStoredShowCourse, setStoredShowCourseCatalog, setStoredShowTeacherTools } from './navVisibility';
import { initialCliOverride, initialTerminalTheme, setStoredCliOverride, setStoredTerminalTheme, type TerminalTheme } from './courseSettings';
import { initialTerminalFontSize, setStoredTerminalFontSize } from './terminalFontSize';
import { setVendorIconOverrides, type VendorIconOverride } from './vendorIconOverrides';

interface Snapshots {
  dir: string;
  current: string;
  files: string[];
}

type ViewId =
  | 'cluster3d'
  | 'ownerref'
  | 'search'
  | 'network'
  | 'security'
  | 'rbac'
  | 'whocan'
  | 'storage'
  | 'schematic'
  | 'images'
  | 'events'
  | 'resources'
  | 'demo'
  | 'course'
  | 'catalog'
  | 'teacher';

/** Filters a nav group list down to visible items given the Settings > Education "show in menu" toggles —
 *  items not named here are always visible; `hiddenIds` only ever contains the Training group's 'course',
 *  'catalog', and/or 'teacher' when their toggles are off. A group left with zero items is dropped entirely
 *  rather than rendered as an empty header. */
function filterRailGroups(groups: RailGroup<ViewId>[], hiddenIds: ReadonlySet<ViewId>): RailGroup<ViewId>[] {
  return groups.map((g) => ({ ...g, items: g.items.filter((it) => !hiddenIds.has(it.id)) })).filter((g) => g.items.length > 0);
}

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
      { id: 'events', label: 'Events', icon: AlertTriangle },
      { id: 'resources', label: 'Resources', icon: Table2 },
    ],
  },
  // Training Course mode (redesign/training-course.md) — the opt-in mutating exception to VpK's read-only
  // stance (see DESIGN.md §1's signed-off exception). Catalog/Teacher visibility is a per-user Settings > UI
  // toggle (see filterRailGroups/navVisibility.ts) — this array always includes both, unconditionally, so
  // VIEW_LABELS/VIEW_ICONS below stay correct even when a toggle hides the nav item itself.
  {
    title: 'Training',
    items: [
      { id: 'catalog', label: 'Catalog', icon: BookOpen },
      { id: 'course', label: 'Course', icon: NotebookPen },
      { id: 'teacher', label: 'Teacher', icon: GraduationCap },
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
/** Same lookup, for the title row's icon — the nav rail already carries one per view, so this is free
 *  reinforcement of "you are here" rather than a second place that can drift out of sync with it. */
const VIEW_ICONS: Record<ViewId, RailItem<ViewId>['icon']> = Object.fromEntries(
  RAIL_GROUPS.flatMap((g) => g.items)
    .concat(DEMO_DATA_ITEM)
    .map((item) => [item.id, item.icon]),
) as Record<ViewId, RailItem<ViewId>['icon']>;

export function App() {
  const [view, setView] = useState<ViewId>('ownerref');
  const [showSplash, setShowSplash] = useState(() => !hasPlayedSplashThisSession());
  const [snaps, setSnaps] = useState<Snapshots>({ dir: '', current: '', files: [] });
  // False until the first /snapshots fetch resolves — gates the "none found" empty-state so it doesn't flash
  // during the brief pre-fetch window when `snaps` is still its empty initial value.
  const [snapsLoaded, setSnapsLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // The Pod SchematicView actually renders — captured from `selected` only at the moment the user navigates
  // INTO the Schematic view (see the effect below), then left alone. Every icon inside the diagram itself
  // (ConfigMap, PV, RoleBinding, the owner chain, ...) also calls selectResource to open ITS OWN editor,
  // which reassigns `selected` to that (usually non-Pod) id — without this separate, frozen copy, that would
  // re-trigger SchematicView's fetch for a non-Pod id, 404, and leave a stale "not found" error visible
  // underneath as soon as the editor closes.
  const [schematicPodId, setSchematicPodId] = useState<string | null>(null);
  // Schematic's manual Namespace→Pod picker selection (used when Schematic is entered directly, not via 3D)
  // — owned here, not as SchematicView's own local state, so a round-trip through RBAC (the "▸" pill) or
  // Events (the purple badge) and back doesn't wipe the picker and leave the schematic blank. See
  // SchematicView's manualNamespace/manualPodId prop doc comments for the full story.
  const [schematicManualNamespace, setSchematicManualNamespace] = useState('');
  const [schematicManualPodId, setSchematicManualPodId] = useState('');
  // Set only by Schematic's per-container rows and its Phase/Conditions area — an explicit path DefinitionModal
  // jumps straight to instead of the Pod's generic default field. Reset to undefined on every OTHER selection
  // path (selectResource's default param, and explicitly in select3D) so it can never leak onto an unrelated
  // resource's editor view.
  const [focusPath, setFocusPath] = useState<FocusPath | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cliHelpOpen, setCliHelpOpen] = useState(false);
  // Owned here (not inside SettingsModal) because DefinitionModal also needs the current theme, to pick a
  // matching CodeMirror editor theme (see DefinitionModal.tsx's editorThemeFor) — main.tsx already applied
  // the initial theme before this component ever mounted, so this just tracks it for both consumers.
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? initialTheme());

  function changeTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    setStoredTheme(next);
  }
  // Same reasoning as theme — Scene3D needs it directly (Three.js fog isn't CSS), so it's tracked here rather
  // than owned inside SettingsModal.
  const [fogEnabled, setFogEnabled] = useState<boolean>(initialFogEnabled);

  function changeFogEnabled(next: boolean) {
    setFogEnabled(next);
    setStoredFogEnabled(next);
  }
  const [gridEnabled, setGridEnabled] = useState<boolean>(initialGridEnabled);

  function changeGridEnabled(next: boolean) {
    setGridEnabled(next);
    setStoredGridEnabled(next);
  }
  // Same reasoning as fog/grid — the nav rail needs it directly to decide which items to render, so it's
  // tracked here rather than owned inside SettingsModal.
  const [showCourse, setShowCourse] = useState<boolean>(initialShowCourse);
  const [showCourseCatalog, setShowCourseCatalog] = useState<boolean>(initialShowCourseCatalog);
  const [showTeacherTools, setShowTeacherTools] = useState<boolean>(initialShowTeacherTools);

  function changeShowCourse(next: boolean) {
    setShowCourse(next);
    setStoredShowCourse(next);
  }
  function changeShowCourseCatalog(next: boolean) {
    setShowCourseCatalog(next);
    setStoredShowCourseCatalog(next);
  }
  function changeShowTeacherTools(next: boolean) {
    setShowTeacherTools(next);
    setStoredShowTeacherTools(next);
  }
  // The Course Catalog's current pick — undefined means "use LessonRunnerView's own default" (Lesson Zero),
  // so the Course view stays usable even if the student never visits the Catalog at all.
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>(undefined);
  // Course-mode terminal/CLI preferences — same "App.tsx owns it, instant apply, no /settings round-trip"
  // pattern as theme/fog/grid (see courseSettings.ts/terminalFontSize.ts doc comments for why each exists).
  const [courseCliOverride, setCourseCliOverride] = useState<string>(initialCliOverride);
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>(initialTerminalTheme);
  const [terminalFontSize, setTerminalFontSize] = useState<number>(initialTerminalFontSize);

  function changeCourseCliOverride(next: string) {
    setCourseCliOverride(next);
    setStoredCliOverride(next);
  }
  function changeTerminalTheme(next: TerminalTheme) {
    setTerminalTheme(next);
    setStoredTerminalTheme(next);
  }
  function changeTerminalFontSize(next: number) {
    setTerminalFontSize(next);
    setStoredTerminalFontSize(next);
  }
  const hiddenNavIds = useMemo(() => {
    const ids = new Set<ViewId>();
    if (!showCourse) ids.add('course');
    if (!showCourseCatalog) ids.add('catalog');
    if (!showTeacherTools) ids.add('teacher');
    return ids;
  }, [showCourse, showCourseCatalog, showTeacherTools]);
  const [statsOpen, setStatsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
  // Same pattern again, for Events: the Schematic's purple "has Events" corner badge hands over the Pod's
  // namespace + name + id — the id lets EventsView match this EXACT Pod object (not just any Pod sharing its
  // name, which the badge's own count doesn't include either — see EventsView's initialPodId doc comment).
  const [eventsPodFilter, setEventsPodFilter] = useState<{ namespace: string; podName: string; podId: string } | null>(null);
  // Held here (not in WhoCanView) so a query survives the round-trip out to a subject's RBAC diagram and back
  // — WhoCanView unmounts on navigation like every other non-3D view.
  const [whoCanQuery, setWhoCanQuery] = useState<WhoCanQueryState>(EMPTY_WHOCAN_QUERY);
  const [namespaces, setNamespaces] = useState<string[]>([]);

  const refreshSnaps = useCallback(
    () =>
      fetch('/snapshots')
        .then((r) => r.json() as Promise<Snapshots>)
        .then((s) => {
          setSnaps(s);
          setSnapsLoaded(true);
        }),
    [],
  );
  // No snapshot files exist in the configured directory at all — every view (other than Demo Data, which
  // needs no capture) is gated behind NoSnapshotBanner in that case, since there's genuinely nothing any of
  // them could show. True only briefly on first mount too, before the initial /snapshots fetch resolves.
  const noSnapshots = snaps.files.length === 0;

  const refreshNamespaces = useCallback(
    () => fetch('/namespaces').then((r) => r.json() as Promise<string[]>).then(setNamespaces),
    [],
  );

  // Deliberately depends on `view` ALONE — re-capturing `selected` only on the transition INTO 'schematic',
  // not on every later change to `selected` while already there (see schematicPodId's own comment above).
  useEffect(() => {
    if (view === 'schematic') setSchematicPodId(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately `view`-only, see comment above
  }, [view]);

  // Close the CLI Equivalent popup on navigation — otherwise switching views while it's open would leave it
  // showing commands for whichever view was active when it opened, not the one now on screen.
  useEffect(() => {
    setCliHelpOpen(false);
  }, [view]);

  // Runs once on mount — refreshSnaps/refreshNamespaces are stable callbacks (empty dep arrays).
  useEffect(() => {
    void refreshSnaps();
    void refreshNamespaces();
  }, [refreshSnaps, refreshNamespaces]);

  // Best-effort window position/size restore + persistence (windowState.ts's own doc comment covers why this
  // silently no-ops in a normal browser tab) — mount-once, nothing here depends on component state.
  useEffect(() => {
    initWindowStatePersistence();
  }, []);

  // Vendor-icon overrides (Settings > Vendor Icons) live server-side, not localStorage — see
  // vendorIconOverrides.ts's own doc comment — so every icon lookup on this side needs this fetched once up
  // front, unlike the CSS-variable color overrides that apply synchronously from localStorage in main.tsx.
  useEffect(() => {
    fetch('/vendor-icons')
      .then((r) => r.json() as Promise<{ overrides: VendorIconOverride[] }>)
      .then((d) => setVendorIconOverrides(d.overrides))
      .catch(() => {});
  }, []);

  // If the student is currently ON the Catalog or Teacher view and then turns its "show in menu" toggle off
  // in Settings, that view is no longer reachable via the nav rail — fall back to the plain Course view
  // rather than leaving them stranded on a screen with no way back to it.
  useEffect(() => {
    // Falls back to plain Course when Catalog/Teacher gets hidden, UNLESS Course itself is also hidden, in
    // which case there's no Training-group view left to land on — go to the app's own initial default.
    const courseFallback: ViewId = showCourse ? 'course' : 'ownerref';
    if (view === 'course' && !showCourse) setView('ownerref');
    if (view === 'catalog' && !showCourseCatalog) setView(courseFallback);
    if (view === 'teacher' && !showTeacherTools) setView(courseFallback);
  }, [view, showCourse, showCourseCatalog, showTeacherTools]);

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
    // Schematic's manual picker state is lifted up (see schematicManualNamespace's own comment) specifically
    // so it survives an RBAC/Events round-trip — but that means it no longer auto-clears on unmount either, so
    // a snapshot swap has to reset it explicitly or a Pod id from the OLD snapshot would linger in the picker.
    setSchematicManualNamespace('');
    setSchematicManualPodId('');
    setBusy('');
  }

  // The capture itself (including its live progress stream) is owned by CaptureConfirmModal now — it stays
  // open showing a summary + Close button once done (per the explicit ask), rather than closing immediately
  // the way the old fire-and-forget /capture POST did. This just refreshes app state once that succeeds.
  async function onCaptured() {
    await Promise.all([refreshSnaps(), refreshNamespaces()]);
    setOwnerRefFocusId(null);
    setSchematicManualNamespace('');
    setSchematicManualPodId('');
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

  function viewEventsFromSchematic(namespace: string, podName: string, podId: string) {
    setEventsPodFilter({ namespace, podName, podId });
    setView('events');
  }

  function returnFromEventsToSchematic() {
    setEventsPodFilter(null);
    setView('schematic');
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
      {showSplash && (
        <SplashScreen
          onDone={() => {
            markSplashPlayed();
            setShowSplash(false);
          }}
        />
      )}
      <NavRail
        groups={filterRailGroups(RAIL_GROUPS, hiddenNavIds)}
        active={view}
        onSelect={setView}
        onAbout={() => setAboutOpen(true)}
        footerItem={DEMO_DATA_ITEM}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header
          className="flex items-center gap-3 border-b px-3 py-2 flex-wrap no-print"
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
            {snapsLoaded && noSnapshots && (
              <span style={{ color: 'var(--vpk-status-error)' }}>none found in {snaps.dir || '(no directory configured)'}</span>
            )}
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
            <Tooltip label="Help">
              <button
                onClick={() => setHelpOpen(true)}
                aria-label="Help"
                className="flex cursor-pointer items-center rounded border p-1.5"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
              >
                <CircleHelp size={15} />
              </button>
            </Tooltip>
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
            <Tooltip label="Logs">
              <button
                onClick={() => setLogsOpen(true)}
                aria-label="Logs"
                className="flex cursor-pointer items-center rounded border p-1.5"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
              >
                <ScrollText size={15} />
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
          className="flex items-center gap-2 border-b px-3 py-2.5 no-print"
          style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}
        >
          {(() => {
            const ViewIcon = VIEW_ICONS[view];
            return <ViewIcon size={16} style={{ color: 'var(--vpk-fg-muted)' }} />;
          })()}
          <span className="text-sm font-semibold" style={{ color: 'var(--vpk-fg)' }}>
            {VIEW_LABELS[view]}
          </span>
          {CLI_EQUIVALENTS[view] && (
            <button
              onClick={() => setCliHelpOpen(true)}
              className="ml-1 flex items-center gap-1 rounded border px-2 py-1 text-xs cursor-pointer"
              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
              title="Show an equivalent kubectl/CLI command for this view"
            >
              <TerminalSquare size={12} />
              CLI Equivalent
            </button>
          )}
          {/* The Course view has its own Print button (with/without answers) in its header instead — this
              generic one just does window.print() on whatever's currently rendered, which isn't the right
              semantics for lesson content. */}
          {view !== 'course' && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded border px-2 py-1 text-xs cursor-pointer"
              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
              title="Print this view"
            >
              <Printer size={12} />
              Print
            </button>
          )}
        </div>

        <div className="flex flex-1 min-h-0">
          <main className={`relative flex-1 overflow-auto ${view === 'cluster3d' ? '' : 'p-3'}`}>
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
                onDeselect={() => setSelected(null)}
                selected={selected}
                onOpenEditor={() => setModalOpen(true)}
                onViewSchematic={viewSchematicFrom3D}
                onViewOwnerRef={viewOwnerRefFrom3D}
                onSearchKind={searchKind}
                onViewRepository={viewRepositoryFrom3D}
                snapshotKey={snaps.current}
                theme={theme}
                fogEnabled={fogEnabled}
                gridEnabled={gridEnabled}
              />
              {/* Nothing else on this page can show anything real with zero snapshot files available — an
                  absolutely-positioned overlay rather than conditionally unmounting Scene3D itself, since that
                  component has to stay mounted at all times (see its own comment above) for the single WebGL
                  context invariant. */}
              {view === 'cluster3d' && noSnapshots && (
                <div className="absolute inset-0" style={{ background: 'var(--vpk-bg)' }}>
                  <NoSnapshotBanner dir={snaps.dir} onCapture={() => setCaptureConfirmOpen(true)} />
                </div>
              )}
            </ErrorBoundary>
            {/* Every other view is entirely gated on a snapshot existing — Demo Data and the Training group
                (Catalog/Course/Teacher) are the exceptions: Demo Data generates its own synthetic data and
                needs no capture at all, and Training's own content (lessons, the terminal, course authoring)
                has nothing to do with which cluster snapshot happens to be loaded. */}
            {view !== 'cluster3d' && view !== 'demo' && view !== 'catalog' && view !== 'course' && view !== 'teacher' && noSnapshots ? (
              <NoSnapshotBanner dir={snaps.dir} onCapture={() => setCaptureConfirmOpen(true)} />
            ) : (
              <>
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
                    onViewEvents={viewEventsFromSchematic}
                    onReturn={schematicFrom3D ? returnFrom3DSchematic : undefined}
                    manualNamespace={schematicManualNamespace}
                    onManualNamespaceChange={setSchematicManualNamespace}
                    manualPodId={schematicManualPodId}
                    onManualPodIdChange={setSchematicManualPodId}
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
                {view === 'events' && (
                  <EventsView
                    key={snaps.current}
                    onSelect={selectResource}
                    initialNamespace={eventsPodFilter?.namespace}
                    initialPodName={eventsPodFilter?.podName}
                    initialPodId={eventsPodFilter?.podId}
                    onReturn={eventsPodFilter ? returnFromEventsToSchematic : undefined}
                  />
                )}
                {view === 'resources' && <ResourcesView key={snaps.current} onSelect={selectResource} />}
              </>
            )}
            {view === 'demo' && <DemoDataView />}
            {view === 'catalog' && (
              <CourseCatalogView
                onSelect={(id) => {
                  setSelectedLessonId(id);
                  setView('course');
                }}
              />
            )}
            {view === 'course' && (
              <LessonRunnerView
                lessonId={selectedLessonId}
                cliOverride={courseCliOverride}
                terminalTheme={terminalTheme}
                terminalFontSize={terminalFontSize}
                onStop={() => setView(showCourseCatalog ? 'catalog' : 'ownerref')}
              />
            )}
            {view === 'teacher' && <TeacherView />}
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
        fogEnabled={fogEnabled}
        onFogEnabledChange={changeFogEnabled}
        gridEnabled={gridEnabled}
        onGridEnabledChange={changeGridEnabled}
        showCourse={showCourse}
        onShowCourseChange={changeShowCourse}
        showCourseCatalog={showCourseCatalog}
        onShowCourseCatalogChange={changeShowCourseCatalog}
        showTeacherTools={showTeacherTools}
        onShowTeacherToolsChange={changeShowTeacherTools}
        courseCliOverride={courseCliOverride}
        onCourseCliOverrideChange={changeCourseCliOverride}
        terminalTheme={terminalTheme}
        onTerminalThemeChange={changeTerminalTheme}
        terminalFontSize={terminalFontSize}
        onTerminalFontSizeChange={changeTerminalFontSize}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      <LogsModal open={logsOpen} onClose={() => setLogsOpen(false)} />
      {cliHelpOpen && CLI_EQUIVALENTS[view] && (
        <CliEquivalentModal title={VIEW_LABELS[view]} equivalent={CLI_EQUIVALENTS[view]} onClose={() => setCliHelpOpen(false)} />
      )}
      <StopConfirmModal open={confirmStopOpen} onCancel={() => setConfirmStopOpen(false)} onConfirm={onConfirmStop} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        screen={view}
        screenLabel={VIEW_LABELS[view]}
        screenIcons={VIEW_ICONS}
        hiddenScreens={hiddenNavIds}
      />
      <CaptureConfirmModal
        open={captureConfirmOpen}
        onClose={() => setCaptureConfirmOpen(false)}
        onCaptured={() => void onCaptured()}
      />
    </div>
  );
}
