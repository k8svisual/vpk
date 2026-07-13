import { useCallback, useEffect, useState } from 'react';
import { Boxes, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Scene3D } from './Scene3D';
import { SchematicView } from './SchematicView';
import { ErrorBoundary } from './ErrorBoundary';
import { getStoredTheme, initialTheme } from './theme';
import { initialFogEnabled } from './fogSetting';
import { initialGridEnabled } from './gridSetting';

/**
 * A pop-out window showing the student's OWN cluster in one of the app's real, interactive views (3D or
 * Schematic), rendered from the ISOLATED course capture (server/src/course/graphic.ts) — never the global
 * snapshot the main app has loaded. Opened by a lesson's cluster-view launcher (LessonRunnerView) per the
 * lesson's `clusterViews:` frontmatter, at ?popout=clusterview&view=<id>.
 *
 * Each pop-out is its own document, so a 3D view here is a fresh single-WebGL-context Scene3D with no conflict
 * with the main window's docked scene (the "one Scene3D per document" rule the singleton guards is per-document).
 * That's the whole point: the lesson + terminal stay in the main window while this shows — side-by-side — the
 * live cluster the student is building, kept isolated so their main-view exploration is never disturbed.
 *
 * The view reads course-scoped data endpoints (/course/graphic/scene/*, /course/graphic/resources, …) via each
 * component's `courseData` switch. Some cross-view actions (open editor, jump to RBAC/Events) are no-ops here —
 * this window is a focused, read-only look at the capture, not the full app shell.
 */

type ClusterViewId = 'cluster3d' | 'schematic';

// Theme/fog/grid are applied to <html> before render by main.tsx; Scene3D also needs the Theme *value* (Three.js
// materials aren't CSS), so read it the same way App does. Fixed for this window's lifetime — no settings UI here.
const theme = getStoredTheme() ?? initialTheme();
const fogEnabled = initialFogEnabled();
const gridEnabled = initialGridEnabled();
const noop = (): void => {};

export function ClusterViewPopout() {
  const params = new URLSearchParams(window.location.search);
  const view: ClusterViewId = params.get('view') === 'schematic' ? 'schematic' : 'cluster3d';
  const cliParam = params.get('cli');
  const cli = cliParam ? cliParam.split(',').filter(Boolean) : undefined;

  // captureVersion doubles as the view's snapshotKey: bumping it after a (re)capture makes Scene3D refetch
  // /course/graphic/scene/* and remounts SchematicView, so "Refresh" reflects what the student just changed.
  const [captureVersion, setCaptureVersion] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scene3D's selection ring is a controlled prop; the pop-out owns that state (App owns it in the main app).
  const [selected, setSelected] = useState<string | null>(null);
  // SchematicView's namespace→Pod picker selection is likewise a controlled prop set the pop-out owns here.
  const [schemNs, setSchemNs] = useState('');
  const [schemPod, setSchemPod] = useState('');

  useEffect(() => {
    document.title = `VpK — Your cluster (${view === 'schematic' ? 'Schematic' : '3D'})`;
  }, [view]);

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
          Your cluster — {view === 'schematic' ? 'Schematic' : '3D'}
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
        ) : view === 'cluster3d' ? (
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
              onOpenEditor={noop}
              onViewSchematic={noop}
              onViewOwnerRef={noop}
              onSearchKind={noop}
              onViewRepository={noop}
              theme={theme}
              fogEnabled={fogEnabled}
              gridEnabled={gridEnabled}
            />
          </ErrorBoundary>
        ) : (
          <div className="h-full overflow-auto p-3">
            <SchematicView
              key={snapshotKey}
              courseData
              podId={null}
              onSelect={noop}
              manualNamespace={schemNs}
              onManualNamespaceChange={setSchemNs}
              manualPodId={schemPod}
              onManualPodIdChange={setSchemPod}
            />
          </div>
        )}
      </div>
    </div>
  );
}
