import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { probeCli } from './cliProbe';

/** How long the ✓ stays visible before `onResolved` fires — some callers react to onResolved by immediately
 *  hiding this whole component (TerminalPane's not-found box disappears the instant binaryFound flips true),
 *  so without a pause the checkmark would never actually get painted — a status change that vanishes before
 *  it's visible isn't feedback. */
const RESOLVED_DELAY_MS = 700;

type CheckStatus = 'idle' | 'checking' | 'found' | 'not-found';

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
  colors: { border: string; fg: string; mutedFg: string; inputBg?: string; buttonBg?: string; errorFg: string; okFg: string };
}) {
  const [path, setPath] = useState(cli);
  const [status, setStatus] = useState<CheckStatus>('idle');
  // The success delay must not outlive the component: if this unmounts inside the 700ms window for a reason
  // other than the resolve itself (the Settings modal or terminal popout closes), the timer would otherwise
  // still fire onResolved — persisting a binary path for a fix the user was abandoning. Clear it on unmount.
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
    };
  }, []);

  async function check() {
    const trimmed = path.trim();
    if (!trimmed) return;
    setStatus('checking');
    const found = await probeCli(trimmed);
    if (!aliveRef.current) return;
    if (found) {
      setStatus('found');
      resolveTimer.current = setTimeout(() => onResolved(trimmed), RESOLVED_DELAY_MS);
    } else {
      setStatus('not-found');
    }
  }

  const busy = status === 'checking' || status === 'found';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void check()}
          disabled={busy}
          className="flex-1 rounded border px-2 py-1 font-mono text-xs disabled:opacity-70"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg }}
          placeholder={`/usr/local/bin/${cli}`}
        />
        <button
          onClick={() => void check()}
          disabled={busy}
          className="cursor-pointer rounded border px-2 py-1 text-xs disabled:cursor-not-allowed"
          style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
        >
          {status === 'checking' ? <Loader2 size={12} className="animate-spin" /> : 'Check'}
        </button>
        {status === 'found' && <Check size={15} style={{ color: colors.okFg }} aria-label="Found" />}
        {status === 'not-found' && <X size={15} style={{ color: colors.errorFg }} aria-label="Not found" />}
      </div>
      {status === 'found' && (
        <p className="text-xs" style={{ color: colors.okFg }}>
          Found — this command works.
        </p>
      )}
      {status === 'not-found' && (
        <p className="text-xs" style={{ color: colors.errorFg }}>
          Still not found at that path.
        </p>
      )}
    </div>
  );
}
