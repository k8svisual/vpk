import { X } from 'lucide-react';
import type { CommandProbeResult } from './cliProbe';

/**
 * Full stdout/stderr/exit-code (or a raw failure message) for one command run — a centered modal rather than
 * cramming it into whatever small inline space triggered it (a Settings tester row, a terminal transcript
 * line), since real CLI error output is often multi-line and gets truncated or hard to read squeezed under a
 * button. Shared by VerbTester/BinaryTester's "Details" button and TerminalPane's transcript, so there's one
 * look for "here's exactly what ran and what it said" across the app.
 */
export function CommandResultModal({
  title,
  outcome,
  onClose,
}: {
  title: string;
  outcome: { result: CommandProbeResult } | { error: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex w-full max-w-lg flex-col gap-2 rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            {title}
          </h3>
          <button onClick={onClose} className="flex shrink-0 cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--vpk-border)' }}>
            <X size={12} />
            Close
          </button>
        </div>
        <div className="flex-1 overflow-auto rounded border p-2 font-mono text-xs" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)' }}>
          {'error' in outcome ? (
            <pre className="whitespace-pre-wrap" style={{ color: 'var(--vpk-status-error)' }}>
              {outcome.error}
            </pre>
          ) : (
            <>
              <div className="mb-1" style={{ color: 'var(--vpk-fg-muted)' }}>
                $ {outcome.result.argv.join(' ')}
              </div>
              <div className="mb-1" style={{ color: 'var(--vpk-fg-muted)' }}>
                exit {outcome.result.exitCode ?? 'aborted'}
              </div>
              {outcome.result.stdout && <pre className="whitespace-pre-wrap" style={{ color: 'var(--vpk-fg)' }}>{outcome.result.stdout}</pre>}
              {outcome.result.stderr && (
                <pre className="whitespace-pre-wrap" style={{ color: 'var(--vpk-status-error)' }}>
                  {outcome.result.stderr}
                </pre>
              )}
              {!outcome.result.stdout && !outcome.result.stderr && <span style={{ color: 'var(--vpk-fg-muted)' }}>(no output)</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
