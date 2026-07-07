import { useEffect, useState } from 'react';
import { THEMES, type Theme } from './theme';

interface Settings {
  snapshotDir: string;
  redactSecrets: boolean;
  disablePullingSecrets: boolean;
}

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
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dir, setDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch('/settings')
      .then((r) => r.json() as Promise<Settings>)
      .then((s) => {
        setSettings(s);
        setDir(s.snapshotDir);
      });
  }, [open]);

  if (!open) return null;

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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
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

        {!settings ? (
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
        )}
      </div>
    </div>
  );
}
