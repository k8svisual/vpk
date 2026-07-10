import { useEffect, useRef, useState } from 'react';
import { VpkIcon } from './VpkIcon';

interface Settings {
  disablePullingSecrets: boolean;
}

/** One line of the server's streamed progress log — either a coarse phase notice or a per-kind result. */
type ProgressLine = { message: string } | { kind: string; namespaced: boolean; count: number } | { kind: string; namespaced: boolean; warning: string };

type Step = 'form' | 'running' | 'done' | 'error' | 'cancelled';

const inputStyle: React.CSSProperties = { borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)', color: 'var(--vpk-fg)' };

/**
 * Confirms before "Capture from cluster" actually runs — a live cluster read that writes a new snapshot
 * directory — collects a base name (prefixed to the timestamped directory name) and a free-text description
 * (saved alongside the snapshot as desc.json), then drives the capture itself and shows its progress live:
 * the server streams one NDJSON line per resource kind as it's fetched (see server.ts's /capture route),
 * which this renders as a running status list, ending in a summary + Close button once done.
 */
export function CaptureConfirmModal({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once the capture completes successfully (while the modal stays open showing the summary) — lets
   *  App.tsx refresh the snapshot list/namespaces without needing to also own this modal's lifecycle. */
  onCaptured: () => void;
}) {
  const [step, setStep] = useState<Step>('form');
  const [baseName, setBaseName] = useState('');
  const [description, setDescription] = useState('');
  const [redactSecrets, setRedactSecrets] = useState(false);
  const [redactConfigMaps, setRedactConfigMaps] = useState(false);
  const [cliCommand, setCliCommand] = useState('kubectl');
  const [scope, setScope] = useState<'core' | 'all'>('core');
  const [lines, setLines] = useState<ProgressLine[]>([]);
  const [summary, setSummary] = useState<{ snapshot: string; nodes: number; items: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{ ok: boolean; message: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // Backs the Cancel button — aborting this fetch closes the request socket, which the server reads as "stop
  // and kill the in-flight kubectl/CLI subprocess" (see server.ts's /capture route). Also lets startCapture's
  // catch block tell "user clicked Cancel" apart from a real network failure (both surface as an AbortError/
  // thrown fetch rejection) via `cancelledRef`.
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setBaseName('');
    setDescription('');
    setLines([]);
    setSummary(null);
    setError(null);
    setValidating(false);
    setValidateResult(null);
    fetch('/settings')
      .then((r) => r.json() as Promise<Settings>)
      .then((s) => setRedactSecrets(s.disablePullingSecrets))
      .catch(() => undefined);
    setRedactConfigMaps(false);
    setCliCommand('kubectl');
    setScope('core');
  }, [open]);

  // Keep the log scrolled to the newest line as it streams in.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  if (!open) return null;

  async function startCapture() {
    setStep('running');
    setLines([]);
    setError(null);
    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          baseName: baseName.trim(),
          description,
          keepSecretData: !redactSecrets,
          keepConfigMapData: !redactConfigMaps,
          cli: cliCommand.trim() || undefined,
          scope,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('no response stream');
      const decoder = new TextDecoder();
      let buf = '';
      // NDJSON: the server writes one JSON object per line as each resource kind (or phase notice) completes,
      // ending with a {type:'done'|'error'|'cancelled',...} line — split on newlines as chunks arrive rather
      // than waiting for the whole response, since the whole point is showing status WHILE the capture runs.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          const evt = JSON.parse(line) as
            | { type: 'phase'; message: string }
            | { type: 'progress'; kind: string; namespaced: boolean; count: number }
            | { type: 'warning'; kind: string; namespaced: boolean; error: string }
            | { type: 'done'; ok: true; snapshot: string; nodes: number; items: number }
            | { type: 'error'; error: string }
            | { type: 'cancelled' };
          if (evt.type === 'phase') setLines((p) => [...p, { message: evt.message }]);
          else if (evt.type === 'progress') setLines((p) => [...p, { kind: evt.kind, namespaced: evt.namespaced, count: evt.count }]);
          else if (evt.type === 'warning') setLines((p) => [...p, { kind: evt.kind, namespaced: evt.namespaced, warning: evt.error }]);
          else if (evt.type === 'done') {
            setSummary({ snapshot: evt.snapshot, nodes: evt.nodes, items: evt.items });
            setStep('done');
            onCaptured();
          } else if (evt.type === 'error') {
            setError(evt.error);
            setStep('error');
          } else if (evt.type === 'cancelled') {
            setStep('cancelled');
          }
        }
      }
    } catch (e: unknown) {
      if (cancelledRef.current) {
        setStep('cancelled');
      } else {
        setError(String(e));
        setStep('error');
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancelCapture() {
    cancelledRef.current = true;
    // Tells the server to actually kill the in-flight kubectl/CLI subprocess (see server.ts's /capture/cancel
    // — the request socket closing isn't a reliable enough signal for that on its own). Aborting our own
    // fetch below just stops US from waiting on a response that may now take a moment to arrive as the
    // in-flight subprocess is torn down.
    void fetch('/capture/cancel', { method: 'POST' });
    abortRef.current?.abort();
  }

  async function validateCliCommand() {
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await fetch('/capture/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cli: cliCommand.trim() || undefined }),
      });
      const result = (await res.json()) as { ok: boolean; located: boolean; message: string };
      setValidateResult({ ok: result.ok, message: result.message });
    } catch (e: unknown) {
      setValidateResult({ ok: false, message: String(e) });
    } finally {
      setValidating(false);
    }
  }

  const dismissible = step === 'form' || step === 'done' || step === 'error' || step === 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={dismissible ? onClose : undefined} />
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded border shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        {/* Branded banner — same VpK mark as the About dialog, but as a header bar rather than a centered
            splash, so this reads as "a VpK operation" rather than a generic browser-style confirm box. */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'linear-gradient(135deg, var(--vpk-accent), var(--vpk-rail-bg))' }}
        >
          <VpkIcon size={36} className="rounded shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: '#fff' }}>
              Capture from Cluster
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Reads the current cluster and saves it as a new snapshot
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 text-xs">
          {step === 'form' && (
            <>
              <p style={{ color: 'var(--vpk-fg-muted)' }}>
                Objects are always captured either way — the checkboxes only control whether their data payload is
                kept.
              </p>

              <label className="flex flex-col gap-0.5">
                <span style={{ color: 'var(--vpk-fg)' }}>Snapshot name</span>
                <input
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder="e.g. staging-before-upgrade"
                  className="rounded border px-1.5 py-1"
                  style={inputStyle}
                />
                <span style={{ color: 'var(--vpk-fg-muted)' }}>
                  Saved as <code>{(baseName.trim() || 'capture').replace(/[^a-zA-Z0-9_.-]/g, '_')}-YYYY-MM-DD-HHh-MMm-SSs/</code>
                </span>
              </label>

              <label className="flex flex-col gap-0.5">
                <span style={{ color: 'var(--vpk-fg)' }}>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What is this snapshot for?"
                  className="rounded border px-1.5 py-1"
                  style={inputStyle}
                />
                <span style={{ color: 'var(--vpk-fg-muted)' }}>Saved as desc.json alongside the snapshot.</span>
              </label>

              <label className="flex flex-col gap-0.5">
                <span style={{ color: 'var(--vpk-fg)' }}>CLI command</span>
                <div className="flex gap-1.5">
                  <input
                    value={cliCommand}
                    onChange={(e) => {
                      setCliCommand(e.target.value);
                      setValidateResult(null);
                    }}
                    placeholder="kubectl"
                    className="flex-1 rounded border px-1.5 py-1"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => void validateCliCommand()}
                    disabled={validating}
                    className="cursor-pointer rounded border px-2 py-1 whitespace-nowrap disabled:cursor-default disabled:opacity-50"
                    style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
                  >
                    {validating ? 'Checking…' : 'Validate'}
                  </button>
                </div>
                <span style={{ color: 'var(--vpk-fg-muted)' }}>e.g. &quot;oc&quot; for OpenShift, or &quot;kubectl --context foo&quot;</span>
                {validateResult && (
                  <span style={{ color: validateResult.ok ? 'var(--vpk-status-ok)' : 'var(--vpk-status-error)' }}>
                    {validateResult.ok ? '✓' : '✗'} {validateResult.message}
                  </span>
                )}
              </label>

              <div className="flex flex-col gap-1">
                <span style={{ color: 'var(--vpk-fg)' }}>Resource scope</span>
                <label className="flex items-start gap-2">
                  <input type="radio" name="capture-scope" checked={scope === 'core'} onChange={() => setScope('core')} />
                  <span style={{ color: 'var(--vpk-fg)' }}>
                    Core resources — the curated set VpK understands best (Pods, Deployments, Services,
                    RBAC, Storage, …).
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="capture-scope" checked={scope === 'all'} onChange={() => setScope('all')} />
                  <span style={{ color: 'var(--vpk-fg)' }}>
                    All discoverable resources — every kind the cluster reports as readable, including
                    CRDs. Can be much slower on clusters with many CRDs.
                  </span>
                </label>
              </div>

              <label className="flex items-start gap-2">
                <input type="checkbox" checked={redactSecrets} onChange={(e) => setRedactSecrets(e.target.checked)} />
                <span style={{ color: 'var(--vpk-fg)' }}>
                  Redact Secrets — permanently discard every Secret&apos;s <code>data</code>/<code>stringData</code>{' '}
                  at capture time.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={redactConfigMaps} onChange={(e) => setRedactConfigMaps(e.target.checked)} />
                <span style={{ color: 'var(--vpk-fg)' }}>
                  Redact ConfigMap data — permanently discard every ConfigMap&apos;s <code>data</code>/
                  <code>binaryData</code> at capture time.
                </span>
              </label>

              <div className="mt-1 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="cursor-pointer rounded border px-2 py-1"
                  style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void startCapture()}
                  className="cursor-pointer rounded border px-2 py-1"
                  style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}
                >
                  Capture
                </button>
              </div>
            </>
          )}

          {(step === 'running' || step === 'done' || step === 'error' || step === 'cancelled') && (
            <>
              <div className="flex items-center gap-2">
                {step === 'running' && (
                  <span
                    className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2"
                    style={{ borderColor: 'var(--vpk-accent)', borderTopColor: 'transparent' }}
                  />
                )}
                <span style={{ color: 'var(--vpk-fg)' }}>
                  {step === 'running' && 'Capturing…'}
                  {step === 'done' && 'Capture complete.'}
                  {step === 'error' && 'Capture failed.'}
                  {step === 'cancelled' && 'Capture cancelled.'}
                </span>
              </div>

              <div
                ref={logRef}
                className="flex flex-col gap-0.5 rounded border p-2 font-mono"
                style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)', maxHeight: 220, overflowY: 'auto', fontSize: 11 }}
              >
                {lines.length === 0 && <span style={{ color: 'var(--vpk-fg-muted)' }}>starting…</span>}
                {lines.map((l, i) => {
                  if (!('kind' in l)) {
                    return (
                      <span key={i} style={{ color: 'var(--vpk-fg-muted)' }}>
                        {l.message}
                      </span>
                    );
                  }
                  if ('warning' in l) {
                    return (
                      <span key={i} style={{ color: 'var(--vpk-fg-muted)' }} title={l.warning}>
                        <span style={{ color: 'var(--vpk-status-warn)' }}>⚠</span> {l.kind}
                        {l.namespaced ? '' : ' (cluster-scoped)'} — skipped
                      </span>
                    );
                  }
                  return (
                    <span key={i} style={{ color: 'var(--vpk-fg)' }}>
                      <span style={{ color: 'var(--vpk-status-ok)' }}>✓</span> {l.kind}
                      {l.namespaced ? '' : ' (cluster-scoped)'} — {l.count}
                    </span>
                  );
                })}
              </div>

              {summary && (
                <p style={{ color: 'var(--vpk-fg)' }}>
                  Saved <code>{summary.snapshot}</code> — {summary.items} objects, {summary.nodes} resolved.
                  {(() => {
                    const skipped = lines.filter((l): l is { kind: string; namespaced: boolean; warning: string } => 'warning' in l).length;
                    return skipped > 0 ? (
                      <span style={{ color: 'var(--vpk-status-warn)' }}>
                        {' '}
                        {skipped} kind{skipped === 1 ? '' : 's'} skipped (see log above).
                      </span>
                    ) : null;
                  })()}
                </p>
              )}
              {error && <p style={{ color: 'var(--vpk-status-error)' }}>{error}</p>}

              <div className="mt-1 flex justify-end gap-2">
                {step === 'running' && (
                  <button
                    onClick={cancelCapture}
                    className="cursor-pointer rounded border px-2 py-1"
                    style={{ borderColor: 'var(--vpk-status-error)', color: 'var(--vpk-status-error)' }}
                  >
                    Cancel
                  </button>
                )}
                {(step === 'error' || step === 'cancelled') && (
                  <button
                    onClick={() => setStep('form')}
                    className="cursor-pointer rounded border px-2 py-1"
                    style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
                  >
                    Try Again
                  </button>
                )}
                {dismissible && (
                  <button
                    onClick={onClose}
                    className="cursor-pointer rounded border px-2 py-1"
                    style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}
                  >
                    Close
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
