import { useState } from 'react';
import { Loader2 } from 'lucide-react';

async function probeCli(cli: string): Promise<boolean> {
  const res = await fetch('/course/probe-cli', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cli }) });
  const json = (await res.json()) as { found?: boolean };
  return json.found === true;
}

/**
 * Shared "this CLI binary isn't on PATH — point at it directly" fixer: a path field + Check button that
 * probes via /course/probe-cli (server-side `spawn` attempt, same probe TaskApprovalPanel's preflight already
 * uses — see server/src/course/command.ts's probeBinary). Used fresh by TerminalPane (the general terminal)
 * and SettingsModal (a proactive tester) — NOT wired into TaskApprovalPanel, which already has its own
 * working probe+persist flow via LessonRunnerView's checkBinaryPath/runPreflight chain; duplicating this UI
 * shape for two NEW call sites was worth it, rewiring a third already-working one wasn't.
 *
 * Purely a probe — persisting the resolved path (commandApproval.ts's setBinaryPath) is the caller's job via
 * `onResolved`, since each of the two consumers needs to react differently once resolved (re-enable the
 * terminal vs. just confirm success in Settings).
 */
export function CliPathFixer({
  cli,
  onResolved,
  colors,
}: {
  cli: string;
  onResolved: (path: string) => void;
  colors: { border: string; fg: string; mutedFg: string; inputBg?: string; buttonBg?: string; errorFg: string };
}) {
  const [path, setPath] = useState(cli);
  const [checking, setChecking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function check() {
    const trimmed = path.trim();
    if (!trimmed) return;
    setChecking(true);
    setNotFound(false);
    try {
      const found = await probeCli(trimmed);
      if (found) onResolved(trimmed);
      else setNotFound(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void check()}
          className="flex-1 rounded border px-2 py-1 font-mono text-xs"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg }}
          placeholder={`/usr/local/bin/${cli}`}
        />
        <button
          onClick={() => void check()}
          disabled={checking}
          className="cursor-pointer rounded border px-2 py-1 text-xs disabled:cursor-not-allowed"
          style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
        >
          {checking ? <Loader2 size={12} className="animate-spin" /> : 'Check'}
        </button>
      </div>
      {notFound && (
        <p className="text-xs" style={{ color: colors.errorFg }}>
          Still not found at that path.
        </p>
      )}
    </div>
  );
}
