import { useEffect, useState } from 'react';

interface Settings {
  disablePullingSecrets: boolean;
}

export interface CaptureOptions {
  keepSecretData: boolean;
  keepConfigMapData: boolean;
  /** The kubectl-compatible CLI command to run this capture with (e.g. "oc" for OpenShift, or "kubectl
   *  --context foo") — space-split into an argv array server-side, same convention as the server's own
   *  VPK_CLI env var default. Omitted (empty/whitespace-only) falls back to that server default. */
  cli?: string;
}

/**
 * Confirms before "Capture from cluster" actually runs — a live cluster read that writes a new snapshot file
 * — and lets the user choose, per capture, whether to permanently discard Secret and/or ConfigMap payloads
 * (both can carry sensitive data: Secrets always, ConfigMaps often via embedded certs/connection strings).
 * The Secrets checkbox defaults from the persisted "Disable pulling Secrets" setting so the modal doesn't
 * silently override a preference already set in Settings; ConfigMaps have no such persisted setting, so it
 * defaults unchecked (keep data, matching captureCore's own default).
 */
export function CaptureConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (opts: CaptureOptions) => void;
}) {
  const [redactSecrets, setRedactSecrets] = useState(false);
  const [redactConfigMaps, setRedactConfigMaps] = useState(false);
  const [cliCommand, setCliCommand] = useState('kubectl');

  useEffect(() => {
    if (!open) return;
    fetch('/settings')
      .then((r) => r.json() as Promise<Settings>)
      .then((s) => setRedactSecrets(s.disablePullingSecrets))
      .catch(() => undefined);
    setRedactConfigMaps(false);
    setCliCommand('kubectl');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <h2 className="mb-2 font-medium" style={{ color: 'var(--vpk-fg)' }}>
          Capture from cluster?
        </h2>
        <p className="mb-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
          Reads the current cluster (using the kubectl-compatible CLI below) and saves it as a new snapshot.
          Objects are always captured either way — the checkboxes only control whether their data payload is kept.
        </p>

        <div className="mb-4 flex flex-col gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span style={{ color: 'var(--vpk-fg)' }}>CLI command</span>
            <input
              value={cliCommand}
              onChange={(e) => setCliCommand(e.target.value)}
              placeholder="kubectl"
              className="rounded border px-1.5 py-1"
              style={{ borderColor: 'var(--vpk-border)' }}
            />
            <span style={{ color: 'var(--vpk-fg-muted)' }}>e.g. &quot;oc&quot; for OpenShift, or &quot;kubectl --context foo&quot;</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={redactSecrets} onChange={(e) => setRedactSecrets(e.target.checked)} />
            <span style={{ color: 'var(--vpk-fg)' }}>
              Redact Secrets — permanently discard every Secret&apos;s <code>data</code>/<code>stringData</code> at
              capture time.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={redactConfigMaps} onChange={(e) => setRedactConfigMaps(e.target.checked)} />
            <span style={{ color: 'var(--vpk-fg)' }}>
              Redact ConfigMap data — permanently discard every ConfigMap&apos;s <code>data</code>/
              <code>binaryData</code> at capture time.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 text-xs">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm({ keepSecretData: !redactSecrets, keepConfigMapData: !redactConfigMaps, cli: cliCommand.trim() || undefined })
            }
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
