import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { getBinaryPath, setBinaryPath } from './commandApproval';
import { probeCli, probeVerb, type CommandProbeOutcome } from './cliProbe';
import { CliPathFixer } from './CliPathFixer';
import { CommandResultModal } from './CommandResultModal';

type Status = 'checking' | 'ok' | 'verb-bad' | 'cli-missing';

/**
 * Per-verb "does this actually work" tester for Settings' Additional terminal commands list — a verb typed
 * there was previously just a string with no feedback until it either worked or didn't, mid-lesson. This runs
 * `<cli> <verb> --help` through the terminal's own command runner (cliProbe.ts's probeVerb) and reports
 * whether the CLI recognizes it. Probes the CLI binary itself first (cliProbe.ts's probeCli, same check
 * CliPathFixer uses) so "not found" and "not a real verb" show as two different, actionable states instead of
 * one opaque failure — the former offers CliPathFixer inline right here rather than sending the student to the
 * separate Terminal CLI path section to make the same connection themselves. A failing verb also gets a
 * "Details" button opening CommandResultModal with the full stdout/stderr/exit code — the one-line summary
 * next to the button is often a truncated first line of a much longer real error.
 *
 * Runs automatically on mount — opening Settings (or adding a new command) shows live status with no click
 * needed — and again any time "Test" is pressed, e.g. right after fixing a path below.
 */
export function VerbTester({
  verb,
  cli,
  colors,
}: {
  verb: string;
  /** Bare CLI name to test against (e.g. 'kubectl') — resolved through any stored path override before
   *  probing, same as the terminal itself does. */
  cli: string;
  colors: { border: string; fg: string; mutedFg: string; inputBg?: string; buttonBg?: string; errorFg: string; okFg: string };
}) {
  const [status, setStatus] = useState<Status>('checking');
  const [outcome, setOutcome] = useState<CommandProbeOutcome | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function check() {
    setStatus('checking');
    setOutcome(null);
    const path = getBinaryPath(cli) ?? cli;
    const found = await probeCli(path);
    if (!found) {
      setStatus('cli-missing');
      return;
    }
    const result = await probeVerb(path, verb);
    setOutcome(result);
    setStatus(result.ok ? 'ok' : 'verb-bad');
  }

  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per (cli, verb) identity, not on every render of `check`
  }, [cli, verb]);

  const busy = status === 'checking';
  const detail = outcome && !outcome.ok ? ('error' in outcome ? outcome.error : outcome.result.stderr.split('\n').find((l) => l.trim())?.trim()) : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => void check()}
          disabled={busy}
          className="cursor-pointer rounded border px-2 py-0.5 text-[11px] disabled:cursor-default"
          style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : 'Test'}
        </button>
        {status === 'ok' && <Check size={13} style={{ color: colors.okFg }} aria-label="Works" />}
        {(status === 'verb-bad' || status === 'cli-missing') && <X size={13} style={{ color: colors.errorFg }} aria-label="Failed" />}
        {status === 'ok' && (
          <span className="text-[11px]" style={{ color: colors.okFg }}>
            Works — recognized by {cli}.
          </span>
        )}
        {status === 'verb-bad' && (
          <>
            <span className="text-[11px]" style={{ color: colors.errorFg }}>
              {detail || `${cli} doesn't recognize "${verb}".`}
            </span>
            <button onClick={() => setShowDetails(true)} className="cursor-pointer text-[11px] underline" style={{ color: colors.mutedFg }}>
              Details
            </button>
          </>
        )}
        {status === 'cli-missing' && (
          <span className="text-[11px]" style={{ color: colors.errorFg }}>
            {cli} isn't on PATH.
          </span>
        )}
      </div>
      {status === 'cli-missing' && (
        <CliPathFixer
          cli={cli}
          colors={colors}
          onResolved={(path) => {
            setBinaryPath(cli, path);
            void check();
          }}
        />
      )}
      {showDetails && outcome && (
        <CommandResultModal title={`Test result: ${cli} ${verb} --help`} outcome={outcome} onClose={() => setShowDetails(false)} />
      )}
    </div>
  );
}
