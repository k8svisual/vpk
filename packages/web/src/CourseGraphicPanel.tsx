import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Camera, CircleDot, Loader2, Network, RefreshCw, SquareArrowOutUpRight, TriangleAlert } from 'lucide-react';

/**
 * The Course view's embedded graphic panel — a live visualization of the STUDENT's own cluster, shown below
 * the terminal (opt-in per lesson via frontmatter `graphic:`). It captures the live cluster into an ISOLATED
 * server-side snapshot (see server/src/course/graphic.ts) that never touches the globally-loaded snapshot the
 * main views render, so a student can watch what they build in the course without disturbing anything they
 * were exploring elsewhere.
 *
 * Two views share the one capture, chosen by a tab toggle (`defaultView` sets which opens first, from the
 * lesson's `graphic:` frontmatter): "Schematic" renders one Pod's server-drawn Schematic SVG with a
 * namespace/pod picker (the capture defaults the picker to the newest Pod so "what you just deployed" surfaces
 * on top); "Wheel" renders the whole capture as a top-down 2D Cluster Wheel SVG. Both are server-drawn SVGs
 * (lightweight, unlike the singleton-WebGL 3D scene — which can't be mounted twice for this isolated capture,
 * so the Wheel is drawn flat instead; see server/src/render/wheelSvg.ts). Refreshes on demand (button) and
 * automatically when the parent bumps `refreshSignal` (a task/check passed) — but only once a first capture
 * exists, so a completed task never triggers a capture out of nowhere.
 */

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;

interface PodRef {
  id: string;
  name: string;
  namespace?: string;
}
interface GraphicState {
  capturedAt: string | null;
  pods: PodRef[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

export type GraphicView = 'schematic' | 'wheel';

export function CourseGraphicPanel({
  cli,
  refreshSignal,
  onPopOut,
  defaultView = 'schematic',
}: {
  cli?: string[];
  refreshSignal?: number;
  onPopOut?: () => void;
  defaultView?: GraphicView;
}) {
  const [view, setView] = useState<GraphicView>(defaultView);
  const [pods, setPods] = useState<PodRef[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [wheelSvg, setWheelSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // A capture persists on the server across panel remounts (and pop-out), so on mount we adopt whatever's
  // already there rather than forcing the student to re-capture just because they navigated away and back.
  useEffect(() => {
    let cancelled = false;
    getJson<GraphicState>('/course/graphic/state')
      .then((s) => {
        if (cancelled) return;
        setCapturedAt(s.capturedAt);
        setPods(s.pods);
        setSelectedId((prev) => prev || s.pods[0]?.id || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Mount-once — the panel doesn't switch lessons in place.
  }, []);

  const capture = useCallback(async () => {
    setCapturing(true);
    setError(null);
    try {
      const s = await postJson<GraphicState>('/course/graphic/capture', { cli: cli?.join(' ') });
      if (!aliveRef.current) return;
      setCapturedAt(s.capturedAt);
      setPods(s.pods);
      // Keep the student's current pod selection if it's still present after the re-capture; otherwise fall
      // back to the newest Pod (first in the server's newest-first order).
      setSelectedId((prev) => (prev && s.pods.some((p) => p.id === prev) ? prev : s.pods[0]?.id ?? ''));
    } catch (e) {
      if (aliveRef.current) setError(String(e instanceof Error ? e.message : e));
    } finally {
      if (aliveRef.current) setCapturing(false);
    }
  }, [cli]);

  // Auto-recapture when the parent signals a task/check passed — gated on an existing capture so it augments a
  // panel the student already opened rather than springing a first capture on them unprompted.
  const lastSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === lastSignalRef.current) return;
    lastSignalRef.current = refreshSignal;
    if (capturedAt && !capturing) void capture();
  }, [refreshSignal, capturedAt, capturing, capture]);

  // Re-fetch the SVG whenever the selected pod (or the capture behind it) changes.
  useEffect(() => {
    if (!selectedId) {
      setSvg(null);
      return;
    }
    let cancelled = false;
    fetch(`/course/graphic/schematic.svg?id=${encodeURIComponent(selectedId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('render failed');
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setSvg(text);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, capturedAt]);

  // Re-fetch the Wheel SVG (the whole capture, no per-Pod id) whenever a capture lands. Fetched only once the
  // Wheel tab has been opened, so a Schematic-first lesson doesn't render the wheel it never shows — but once
  // fetched it keeps up with every re-capture, matching the schematic.
  const wheelSeenRef = useRef(false);
  if (view === 'wheel') wheelSeenRef.current = true;
  useEffect(() => {
    if (!capturedAt || !wheelSeenRef.current) {
      if (!capturedAt) setWheelSvg(null);
      return;
    }
    let cancelled = false;
    fetch('/course/graphic/wheel.svg')
      .then(async (r) => {
        if (!r.ok) throw new Error('render failed');
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setWheelSvg(text);
      })
      .catch(() => {
        if (!cancelled) setWheelSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [view, capturedAt]);

  return (
    <div className="border rounded flex flex-col h-full min-h-0" style={{ ...panelStyle, background: 'var(--vpk-surface)' }}>
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2 text-xs shrink-0" style={panelStyle}>
        <span className="flex items-center gap-2 font-medium min-w-0">
          <span className="flex items-center gap-1.5 shrink-0">
            <Boxes size={13} />
            Your cluster
          </span>
          {/* Both views read the SAME capture — this just picks which is on screen (the singleton-WebGL 3D
              scene can't be embedded here, so the Wheel is a server-drawn top-down SVG; see wheelSvg.ts). */}
          <span className="flex items-center rounded border overflow-hidden shrink-0" style={panelStyle}>
            {(['schematic', 'wheel'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center gap-1 px-2 py-1 cursor-pointer"
                style={{
                  background: view === v ? 'var(--vpk-accent, #2f6df6)' : 'var(--vpk-bg)',
                  color: view === v ? '#fff' : 'var(--vpk-fg-muted)',
                }}
                title={v === 'schematic' ? "One Pod's schematic" : 'Top-down Cluster Wheel'}
              >
                {v === 'schematic' ? <Network size={12} /> : <CircleDot size={12} />}
                {v === 'schematic' ? 'Schematic' : 'Wheel'}
              </button>
            ))}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {view === 'schematic' && pods.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded border px-1.5 py-1 max-w-[11rem] cursor-pointer"
              style={{ ...panelStyle, background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              title="Which Pod's schematic to show"
            >
              {pods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namespace ? `${p.namespace}/${p.name}` : p.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => void capture()}
            disabled={capturing}
            className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer disabled:cursor-not-allowed"
            style={{ ...panelStyle, background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
            title="Capture your live cluster and render it — this does not affect the snapshot the main views show"
          >
            {capturing ? <Loader2 size={12} className="animate-spin" /> : capturedAt ? <RefreshCw size={12} /> : <Camera size={12} />}
            {capturedAt ? 'Refresh' : 'Capture'}
          </button>
          {onPopOut && (
            <button
              onClick={onPopOut}
              className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer"
              style={{ ...panelStyle, background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' }}
              title="Open the graphic in its own window, freeing full width for the lesson"
            >
              <SquareArrowOutUpRight size={12} />
              Pop out
            </button>
          )}
        </span>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {error ? (
          <div className="p-3 text-xs flex items-start gap-1.5" style={errorStyle}>
            <TriangleAlert size={13} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : !capturedAt ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Boxes size={22} style={mutedStyle} />
            <p className="text-xs max-w-xs" style={mutedStyle}>
              Capture your live cluster to see it here — an isolated snapshot that won't change what the main views show.
            </p>
          </div>
        ) : capturing && !(view === 'wheel' ? wheelSvg : svg) ? (
          <div className="h-full flex items-center justify-center gap-1.5 text-xs" style={mutedStyle}>
            <Loader2 size={13} className="animate-spin" /> Capturing…
          </div>
        ) : view === 'wheel' ? (
          wheelSvg ? (
            <div className="course-graphic-svg p-2" dangerouslySetInnerHTML={{ __html: wheelSvg }} />
          ) : (
            <div className="h-full flex items-center justify-center gap-1.5 text-xs" style={mutedStyle}>
              <Loader2 size={13} className="animate-spin" /> Rendering wheel…
            </div>
          )
        ) : svg ? (
          <div className="course-graphic-svg p-2" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="h-full flex items-center justify-center p-4 text-center text-xs" style={mutedStyle}>
            {pods.length === 0 ? 'No Pods in the capture yet.' : 'Select a Pod to see its schematic.'}
          </div>
        )}
      </div>
    </div>
  );
}
