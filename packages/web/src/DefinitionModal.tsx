import { useEffect, useMemo, useState } from 'react';
import CodeMirror, { EditorView, type Extension } from '@uiw/react-codemirror';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { vscodeLight, vscodeDark, vscodeLightInit } from '@uiw/codemirror-theme-vscode';
import { stringify, parseDocument, LineCounter } from 'yaml';
import type { Theme } from './theme';
import { KindIcon } from './StorageView';
import { iconUrlForKindOrUnknown } from './kindIcons';

export type FocusPath = (string | number)[];

// Forest/Ocean have no dedicated CodeMirror theme package — both are light-background app themes, so each
// re-tints vscodeLight's editor/gutter background to match that theme's own --vpk-surface/--vpk-bg (see
// index.css), keeping vscodeLight's syntax-highlighting token colors (proven readable) unchanged.
const vscodeForest = vscodeLightInit({ settings: { background: '#f7faf5', gutterBackground: '#eef3ea' } });
const vscodeOcean = vscodeLightInit({ settings: { background: '#f7fbfd', gutterBackground: '#eaf2f6' } });

function editorThemeFor(theme: Theme): Extension {
  switch (theme) {
    case 'dark':
      return vscodeDark;
    case 'forest':
      return vscodeForest;
    case 'ocean':
      return vscodeOcean;
    default:
      return vscodeLight;
  }
}

/** Line (1-based, matching CodeMirror) of `path` inside `yamlText`, or null if the path doesn't resolve or
 *  wasn't given — e.g. a Pod with no containers, or no explicit `focusPath` at all. */
function focusLineFor(yamlText: string, path: FocusPath | undefined): number | null {
  if (!path) return null;
  const lineCounter = new LineCounter();
  const doc = parseDocument(yamlText, { lineCounter });
  const node = doc.getIn(path, true) as { range?: [number, number, number] } | null;
  if (!node?.range) return null;
  return lineCounter.linePos(node.range[0]).line;
}

/**
 * Universal drill target (DESIGN §6.3/6.9): clicking any resource icon anywhere in the app opens this. Shows
 * the captured/trimmed raw object (no managedFields) as foldable, syntax-highlighted YAML in a VSCode-like
 * editor. Editable for scratch/copy purposes only — edits are never sent back to the snapshot or the cluster.
 * Opens at line 1 by default, full stop — no kind-based guessing about which field the reader wants. The only
 * thing that scrolls/selects a different line is the caller passing an explicit `focusPath` for a resource it
 * already knows the specific field of (Schematic's per-container rows or its Conditions area, Container
 * Images' searched-image row).
 * Esc / backdrop click closes it.
 */
export function DefinitionModal({
  resourceId,
  focusPath,
  onClose,
  theme,
}: {
  resourceId: string | null;
  focusPath?: FocusPath;
  onClose: () => void;
  /** Picks the matching CodeMirror editor theme (see editorThemeFor above) — the app's 4 color themes are a
   *  separate CSS-variable mechanism (theme.ts) that a syntax-highlighted editor can't just inherit via var(),
   *  so this is passed down explicitly rather than read from some shared/global theme state. */
  theme: Theme;
}) {
  const [raw, setRaw] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  // State, not a ref: the underlying view is only created on a second, async commit (its container element
  // is attached via an internal setState), so a ref write there would happen after our own effect already
  // ran with a stale null — state re-renders us once the view actually exists.
  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    setRaw(null);
    setError(null);
    // no-store: whether Secret data comes back redacted depends on the live "Redact Secrets" setting, which
    // can be toggled between two views of the SAME id — a normally-cached GET would keep showing whichever
    // state was current the first time this id was ever fetched.
    fetch(`/definition?id=${encodeURIComponent(resourceId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: unknown) => setRaw(data))
      .catch((e: unknown) => setError(String(e)));
  }, [resourceId]);

  useEffect(() => {
    if (!resourceId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resourceId, onClose]);

  const { kind, apiVersion, title, subtitle, text, focusLine } = useMemo(() => {
    if (error) return { kind: undefined, apiVersion: undefined, title: 'Definition', subtitle: '', text: error, focusLine: null };
    if (!raw) return { kind: undefined, apiVersion: undefined, title: 'Definition', subtitle: '', text: '', focusLine: null };
    const obj = raw as { kind?: string; apiVersion?: string; metadata?: { name?: string; namespace?: string } };
    const name = obj.metadata?.name ?? resourceId ?? '';
    const yamlText = stringify(raw);
    return {
      kind: obj.kind,
      apiVersion: obj.apiVersion,
      title: obj.kind ?? 'Definition',
      subtitle: obj.metadata?.namespace ? `${obj.metadata.namespace} / ${name}` : name,
      text: yamlText,
      focusLine: focusLineFor(yamlText, focusPath),
    };
  }, [raw, error, resourceId, focusPath]);

  // "Explain" popover state — a kubectl-explain-style description of the resource's Kind (see server.ts's
  // /explain route and loadSnapshotExplains's own doc comment: capture doesn't populate this yet for any real
  // snapshot, so this almost always resolves to the "not captured" fallback message today; the plumbing is
  // here so it starts working the moment capture does write explains.json, no UI change needed then).
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  // A different resource (even a different instance of the SAME kind — no harm re-fetching) shouldn't show
  // the previous one's stale explanation text under the new title.
  useEffect(() => {
    setExplainOpen(false);
    setExplainText(null);
  }, [resourceId]);

  function toggleExplain() {
    if (explainOpen) {
      setExplainOpen(false);
      return;
    }
    setExplainOpen(true);
    if (explainText !== null || explainLoading || !kind) return;
    setExplainLoading(true);
    fetch(`/explain?kind=${encodeURIComponent(kind)}`)
      .then((r) => r.json() as Promise<{ kind: string; description: string | null }>)
      .then((d) => setExplainText(d.description ?? 'No description captured for this resource kind yet.'))
      .catch(() => setExplainText('Could not load an explanation for this resource kind.'))
      .finally(() => setExplainLoading(false));
  }

  useEffect(() => {
    if (!view || focusLine == null) return;
    if (focusLine < 1 || focusLine > view.state.doc.lines) return;
    const line = view.state.doc.line(focusLine);
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    });
  }, [view, text, focusLine]);

  if (!resourceId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-3xl flex-col shadow-2xl"
        style={{ background: 'var(--vpk-surface)' }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--vpk-border)' }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <KindIcon kind={title} size={20} iconSrc={iconUrlForKindOrUnknown(kind ?? '', apiVersion)} />
            <div className="min-w-0">
              <h2 className="truncate font-medium" style={{ color: 'var(--vpk-fg)' }}>
                {title}
              </h2>
              {subtitle && (
                <p className="truncate text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleExplain}
              disabled={!kind}
              aria-label="Explain"
              aria-expanded={explainOpen}
              className="rounded px-2 py-1 text-xs cursor-pointer disabled:cursor-default disabled:opacity-40"
              style={{
                border: '1px solid var(--vpk-border)',
                color: explainOpen ? 'var(--vpk-accent)' : 'var(--vpk-fg)',
                borderColor: explainOpen ? 'var(--vpk-accent)' : 'var(--vpk-border)',
              }}
            >
              Explain
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded px-2 py-1 text-xs cursor-pointer"
              style={{ border: '1px solid var(--vpk-border)', color: 'var(--vpk-fg)' }}
            >
              Close
            </button>
          </div>
        </div>
        {explainOpen && (
          <div className="border-b px-4 py-3 text-xs" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}>
            <div className="mb-1 font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
              {title}
            </div>
            <p style={{ color: 'var(--vpk-fg)', whiteSpace: 'pre-wrap' }}>{explainLoading ? 'Loading…' : explainText}</p>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {text ? (
            <CodeMirror
              value={text}
              height="100%"
              theme={editorThemeFor(theme)}
              extensions={[yamlLang()]}
              editable={true}
              onCreateEditor={setView}
              basicSetup={{ foldGutter: true, lineNumbers: true, highlightActiveLine: false }}
            />
          ) : (
            <div className="p-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              loading…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
