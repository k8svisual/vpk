import { useCallback, useEffect, useState } from 'react';
import { Boxes, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Scene3D } from './Scene3D';
import { SchematicView } from './SchematicView';
import { RbacView } from './RbacView';
import { EventsView } from './EventsView';
import { OwnerRefView } from './OwnerRefView';
import { SearchView } from './SearchView';
import { ContainerImagesView } from './ContainerImagesView';
import { DefinitionModal, type FocusPath } from './DefinitionModal';
import { ErrorBoundary } from './ErrorBoundary';
import { getStoredTheme, initialTheme } from './theme';
import { initialFogEnabled } from './fogSetting';
import { initialGridEnabled } from './gridSetting';

/**
 * A pop-out window showing the student's OWN cluster in one of the app's real, interactive views (3D or
 * Schematic), rendered from the ISOLATED course capture (server/src/course/graphic.ts) — never the global
 * snapshot the main app has loaded. Opened by a lesson's cluster-view launcher (LessonRunnerView) per the
 * lesson's `clusterViews:` frontmatter, at ?popout=clusterview&view=<id> (that param only picks which view
 * greets the student — the window can navigate to any of the seven below and back).
 *
 * Each pop-out is its own document, so a 3D view here is a fresh single-WebGL-context Scene3D with no conflict
 * with the main window's docked scene (the "one Scene3D per document" rule the singleton guards is per-document).
 * That's the whole point: the lesson + terminal stay in the main window while this shows — side-by-side — the
 * live cluster the student is building, kept isolated so their main-view exploration is never disturbed.
 *
 * Every view here reads course-scoped data endpoints (/course/graphic/scene/*, /course/graphic/resources, …)
 * via its own `courseData` switch — including DefinitionModal/SecretDecodeModal, so clicking a resource icon
 * anywhere opens its real definition read from the capture. `activeView` below is this window's OWN small nav
 * state (mirroring App.tsx's `view`, just scoped to the 7 destinations reachable from 3D/Schematic): every
 * cross-view action the main app supports from these two views — Schematic's "RBAC ▸" pill and "has Events"
 * badge, 3D's "View Schematic"/"View OwnerRef"/"Search"/"View Repository" buttons — swaps this SAME window
 * over rather than jumping to a view that doesn't exist here, and a "Return" pill always comes back.
 */

type PopoutView = 'cluster3d' | 'schematic' | 'rbac' | 'events' | 'ownerref' | 'search' | 'images';

const VIEW_LABEL: Record<PopoutView, string> = {
  cluster3d: '3D',
  schematic: 'Schematic',
  rbac: 'RBAC',
  events: 'Events',
  ownerref: 'OwnerRef',
  search: 'Search',
  images: 'Images',
};

// Theme/fog/grid are applied to <html> before render by main.tsx; Scene3D also needs the Theme *value* (Three.js
// materials aren't CSS), so read it the same way App does. Fixed for this window's lifetime — no settings UI here.
const theme = getStoredTheme() ?? initialTheme();
const fogEnabled = initialFogEnabled();
const gridEnabled = initialGridEnabled();

export function ClusterViewPopout() {
  const params = new URLSearchParams(window.location.search);
  const initialView: PopoutView = params.get('view') === 'schematic' ? 'schematic' : 'cluster3d';
  const cliParam = params.get('cli');
  const cli = cliParam ? cliParam.split(',').filter(Boolean) : undefined;

  // This window's own small nav state — see the module doc comment above.
  const [activeView, setActiveView] = useState<PopoutView>(initialView);

  // captureVersion doubles as every view's snapshotKey: bumping it after a (re)capture makes Scene3D refetch
  // /course/graphic/scene/* and remounts the key={snapshotKey} views below, so "Refresh" reflects what the
  // student just changed no matter which of the seven views is currently showing.
  const [captureVersion, setCaptureVersion] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scene3D's selection ring is a controlled prop; the pop-out owns that state (App owns it in the main app).
  const [selected, setSelected] = useState<string | null>(null);
  // SchematicView's namespace→Pod picker selection is likewise a controlled prop set the pop-out owns here.
  const [schemNs, setSchemNs] = useState('');
  const [schemPod, setSchemPod] = useState('');
  // DefinitionModal's target for every view except 3D (see editorOpen below for that one) — clicking a
  // resource icon (or "view" inside an aggregate list) sets this, matching App.tsx's own selectResource/
  // DefinitionModal wiring for the main app. Shared across Schematic/RBAC/Events/OwnerRef/Search/Images since
  // only one of them is ever mounted at a time.
  const [defId, setDefId] = useState<string | null>(null);
  const [defFocusPath, setDefFocusPath] = useState<FocusPath | undefined>(undefined);

  function openDefinition(id: string, focusPath?: FocusPath) {
    setDefId(id);
    setDefFocusPath(focusPath);
  }

  // DefinitionModal's target for the 3D view — Scene3D's onOpenEditor takes no id (it opens an editor for
  // whichever node is already `selected`), so this is a plain flag read together with `selected` at render
  // time below, exactly matching App.tsx's own modalOpen/selected pair — NOT read inside the onOpenEditor
  // callback itself, since Scene3D's Timelapse "jump straight to editor" row fires onSelect and onOpenEditor
  // back-to-back in the same handler, and `selected` wouldn't have committed yet if read there.
  const [editorOpen, setEditorOpen] = useState(false);

  // Set when the Schematic's "RBAC ▸" pill is clicked — matching App.tsx's rbacSaId/viewRbacFromSchematic pair.
  // Cleared on return. Always returns to Schematic (there's no Security/WhoCan view here to have come from).
  const [rbacSaId, setRbacSaId] = useState<string | null>(null);
  function returnFromRbac() {
    setRbacSaId(null);
    setActiveView('schematic');
  }

  // Set when the Schematic's purple "has Events" corner badge is clicked — matching App.tsx's eventsPodFilter/
  // viewEventsFromSchematic pair. Always returns to Schematic.
  const [eventsFilter, setEventsFilter] = useState<{ namespace: string; podName: string; podId: string } | null>(null);
  function returnFromEvents() {
    setEventsFilter(null);
    setActiveView('schematic');
  }

  // 3D's "View Schematic" button (Pod cards only) takes no id either — same reasoning as editorOpen above, so
  // this reads `selected` via an effect keyed on the transition INTO 'schematic', not inline in the handler.
  // schematicPodId only actually reaches SchematicView when schematicFrom3D is true (SchematicView's own
  // effectivePodId ignores the `podId` prop otherwise, in favor of the manual namespace/Pod picker) — matching
  // App.tsx's own schematicPodId/schematicFrom3D pair exactly, including passing it unconditionally below.
  const [schematicFrom3D, setSchematicFrom3D] = useState(false);
  const [schematicPodId, setSchematicPodId] = useState<string | null>(null);
  useEffect(() => {
    if (activeView === 'schematic') setSchematicPodId(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately `activeView`-only, see comment above
  }, [activeView]);
  function viewSchematicFrom3D() {
    setSchematicFrom3D(true);
    setActiveView('schematic');
  }
  function returnFrom3DSchematic() {
    setSchematicFrom3D(false);
    setActiveView('cluster3d');
  }

  // 3D's "View OwnerRef" button DOES pass an explicit id (PropertiesPanel already knows which resource it's
  // showing), so no capture-effect needed — unlike schematicPodId above. Always returns to 3D.
  const [ownerRefFocusId, setOwnerRefFocusId] = useState<string | null>(null);
  function viewOwnerRefFrom3D(id: string) {
    setOwnerRefFocusId(id);
    setActiveView('ownerref');
  }
  function returnFrom3DOwnerRef() {
    setOwnerRefFocusId(null);
    setActiveView('cluster3d');
  }

  // 3D's resource-pane sphere "Search" button — scopes to a Kind, explicit param, no capture-effect needed.
  const [searchScopeKind, setSearchScopeKind] = useState<string | null>(null);
  function searchKindFrom3D(kind: string) {
    setSearchScopeKind(kind);
    setActiveView('search');
  }
  function returnFrom3DSearch() {
    setSearchScopeKind(null);
    setActiveView('cluster3d');
  }

  // 3D's image-registry stack "View Repository" button — scopes to a registry hostname, explicit param.
  const [imagesRegistryFilter, setImagesRegistryFilter] = useState<string | null>(null);
  function viewRepositoryFrom3D(registry: string) {
    setImagesRegistryFilter(registry);
    setActiveView('images');
  }
  function returnFrom3DImages() {
    setImagesRegistryFilter(null);
    setActiveView('cluster3d');
  }

  useEffect(() => {
    document.title = `VpK — Your cluster (${VIEW_LABEL[activeView]})`;
  }, [activeView]);

  const capture = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const res = await fetch('/course/graphic/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cli: cli?.join(' ') }),
      });
      const json = (await res.json()) as { capturedAt?: string; error?: string };
      if (json && typeof json === 'object' && 'error' in json && json.error) throw new Error(json.error);
      setCaptureVersion((v) => v + 1);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setCapturing(false);
    }
  }, [cli]);

  // On mount: adopt an existing capture if one's already on the server (the student may have opened another
  // cluster view already), otherwise capture now so the window has something to show without a manual click.
  useEffect(() => {
    let cancelled = false;
    fetch('/course/graphic/state')
      .then((r) => r.json() as Promise<{ capturedAt: string | null }>)
      .then((s) => {
        if (cancelled) return;
        if (s?.capturedAt) setCaptureVersion((v) => v + 1);
        else void capture();
      })
      .catch(() => {
        if (!cancelled) void capture();
      });
    return () => {
      cancelled = true;
    };
    // Mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapshotKey = String(captureVersion);
  const ready = captureVersion > 0;

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}>
      <div
        className="px-3 py-1.5 border-b flex items-center justify-between gap-2 text-xs shrink-0"
        style={{ borderColor: 'var(--vpk-border)' }}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Boxes size={13} />
          Your cluster — {VIEW_LABEL[activeView]}
        </span>
        <span className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1" style={{ color: 'var(--vpk-status-error)' }}>
              <TriangleAlert size={12} />
              {error}
            </span>
          )}
          <button
            onClick={() => void capture()}
            disabled={capturing}
            className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)', background: 'var(--vpk-surface)' }}
            title="Re-capture your live cluster — reflects what you've changed in the terminal"
          >
            {capturing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </span>
      </div>
      <div className="flex-1 min-h-0 relative">
        {!ready ? (
          <div className="h-full flex items-center justify-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            <Loader2 size={13} className="animate-spin" /> Capturing your cluster…
          </div>
        ) : activeView === 'cluster3d' ? (
          <ErrorBoundary
            fallback={(err) => (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                <span style={{ color: 'var(--vpk-fg)' }}>3D view couldn't start — your browser or environment doesn't support WebGL.</span>
                <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>{err.message}</span>
              </div>
            )}
          >
            <Scene3D
              courseData
              initialMode="wheel"
              active
              snapshotKey={snapshotKey}
              selected={selected}
              onSelect={setSelected}
              onDeselect={() => setSelected(null)}
              onOpenEditor={() => setEditorOpen(true)}
              onViewSchematic={viewSchematicFrom3D}
              onViewOwnerRef={viewOwnerRefFrom3D}
              onSearchKind={searchKindFrom3D}
              onViewRepository={viewRepositoryFrom3D}
              theme={theme}
              fogEnabled={fogEnabled}
              gridEnabled={gridEnabled}
            />
          </ErrorBoundary>
        ) : activeView === 'schematic' ? (
          <div className="h-full overflow-auto p-3">
            <SchematicView
              key={snapshotKey}
              courseData
              podId={schematicPodId}
              onSelect={openDefinition}
              onViewRbac={(saId) => {
                setRbacSaId(saId);
                setActiveView('rbac');
              }}
              onViewEvents={(namespace, podName, podId) => {
                setEventsFilter({ namespace, podName, podId });
                setActiveView('events');
              }}
              onReturn={schematicFrom3D ? returnFrom3DSchematic : undefined}
              manualNamespace={schemNs}
              onManualNamespaceChange={setSchemNs}
              manualPodId={schemPod}
              onManualPodIdChange={setSchemPod}
            />
          </div>
        ) : activeView === 'rbac' ? (
          <div className="h-full overflow-auto p-3">
            <RbacView
              key={snapshotKey}
              courseData
              initialSaId={rbacSaId ?? undefined}
              onSelect={openDefinition}
              onReturn={returnFromRbac}
              returnLabel="← Return to Schematic"
            />
          </div>
        ) : activeView === 'events' ? (
          <div className="h-full overflow-auto p-3">
            <EventsView
              key={snapshotKey}
              courseData
              initialNamespace={eventsFilter?.namespace}
              initialPodName={eventsFilter?.podName}
              initialPodId={eventsFilter?.podId}
              onSelect={openDefinition}
              onReturn={returnFromEvents}
            />
          </div>
        ) : activeView === 'ownerref' ? (
          <div className="h-full overflow-auto p-3">
            <OwnerRefView
              key={snapshotKey}
              courseData
              focusId={ownerRefFocusId}
              onSelect={openDefinition}
              onReturn={returnFrom3DOwnerRef}
              snapshotKey={snapshotKey}
            />
          </div>
        ) : activeView === 'search' ? (
          <div className="h-full overflow-auto p-3">
            <SearchView
              key={snapshotKey}
              courseData
              initialKind={searchScopeKind ?? undefined}
              onSelect={openDefinition}
              onReturn={returnFrom3DSearch}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto p-3">
            <ContainerImagesView
              key={snapshotKey}
              courseData
              initialRegistry={imagesRegistryFilter ?? undefined}
              onSelect={openDefinition}
              onReturn={returnFrom3DImages}
            />
          </div>
        )}
      </div>
      <DefinitionModal
        resourceId={activeView === 'cluster3d' ? (editorOpen ? selected : null) : defId}
        focusPath={activeView === 'cluster3d' ? undefined : defFocusPath}
        onClose={() => (activeView === 'cluster3d' ? setEditorOpen(false) : setDefId(null))}
        theme={theme}
        courseData
      />
    </div>
  );
}
