import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { getBinaryPath, setBinaryPath } from './commandApproval';
import { probeCli, probeStandalone, PROBE_STAGGER_MS, type CommandProbeOutcome } from './cliProbe';
import { CliPathFixer } from './CliPathFixer';
import { CommandResultModal } from './CommandResultModal';

type Status = 'checking' | 'ok' | 'missing';

/**
 * Per-binary "does this actually exist" tester for Settings' Additional standalone commands list (grep, jq,
 * curl, ... — whole extra binaries the terminal may run directly, see terminalAllowlist.ts/command.ts's
 * `extraBinaries`). Unlike VerbTester, there's no "verb" to validate here — a standalone tool has no lesson-
 * defined subcommand concept, and different tools disagree on what `--help` even means (some exit non-zero for
 * it, e.g. BSD grep on macOS), so exit code isn't a reliable pass/fail signal the way it is for a kubectl verb.
 * Status is purely "does it resolve" (cliProbe.ts's probeCli, same check CliPathFixer/VerbTester use); a
 * best-effort `<binary> --help` still runs afterward purely so "Details" has real output to show, but its exit
 * code never downgrades `status` — a non-zero exit from `--help` doesn't mean the binary is broken.
 *
 * Runs automatically on mount, same as VerbTester, and again on "Test".
 */
export function BinaryTester({
  name,
  colors,
  index = 0,
}: {
  name: string;
  colors: { border: string; fg: string; mutedFg: string; inputBg?: string; buttonBg?: string; errorFg: string; okFg: string };
  /** Row position — used only to stagger the auto-probe so many rows don't spawn at once. */
  index?: number;
}) {
  const [status, setStatus] = useState<Status>('checking');
  const [outcome, setOutcome] = useState<CommandProbeOutcome | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const aliveRef = useRef(true);
  const runIdRef = useRef(0);

  async function check() {
    const runId = ++runIdRef.current;
    setStatus('checking');
    setOutcome(null);
    const path = getBinaryPath(name) ?? name;
    const found = await probeCli(path);
    if (!aliveRef.current || runId !== runIdRef.current) return;
    if (!found) {
      setStatus('missing');
      return;
    }
    setStatus('ok');
    void probeStandalone(path).then((o) => {
      if (aliveRef.current && runId === runIdRef.current) setOutcome(o);
    });
  }

  useEffect(() => {
    aliveRef.current = true;
    const timer = setTimeout(() => void check(), index * PROBE_STAGGER_MS);
    return () => {
      aliveRef.current = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per `name` identity, not on every render of `check`
  }, [name]);

  const busy = status === 'checking';
  const overridePath = getBinaryPath(name);

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
        {status === 'ok' && <Check size={13} style={{ color: colors.okFg }} aria-label="Found" />}
        {status === 'missing' && <X size={13} style={{ color: colors.errorFg }} aria-label="Not found" />}
        {status === 'ok' && (
          <span className="text-[11px]" style={{ color: colors.okFg }}>
            Found{overridePath ? ` at ${overridePath}` : ' on PATH'}.
          </span>
        )}
        {status === 'missing' && (
          <span className="text-[11px]" style={{ color: colors.errorFg }}>
            Not found on PATH.
          </span>
        )}
        {status === 'ok' && outcome && (
          <button onClick={() => setShowDetails(true)} className="cursor-pointer text-[11px] underline" style={{ color: colors.mutedFg }}>
            Details
          </button>
        )}
      </div>
      {status === 'missing' && (
        <CliPathFixer
          cli={name}
          colors={colors}
          onResolved={(path) => {
            setBinaryPath(name, path);
            void check();
          }}
        />
      )}
      {showDetails && outcome && <CommandResultModal title={`${name} --help`} outcome={outcome} onClose={() => setShowDetails(false)} />}
    </div>
  );
}
