import type { CliEquivalent } from './cliEquivalents';
import { CommandBlock } from './CommandBlock';

/** "CLI Equivalent" popup — same modal shell as LogsModal/StatsModal (fixed overlay, centered card). Purely
 *  a static reference: no server round-trip, nothing here is executed by VpK itself (unlike the Training
 *  Course terminal, which really does run commands — this is just documentation for the user's own shell). */
export function CliEquivalentModal({ title, equivalent, onClose }: { title: string; equivalent: CliEquivalent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            CLI Equivalent — {title}
          </h2>
          <button onClick={onClose} className="cursor-pointer rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--vpk-border)' }}>
            Close
          </button>
        </div>

        <p className="mb-3 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
          {equivalent.intro}
        </p>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {equivalent.commands.map((c, i) => (
            <CommandBlock key={i} description={c.description} command={c.command} />
          ))}
        </div>

        <p className="mt-3 text-xs italic" style={{ color: 'var(--vpk-fg-muted)' }}>
          Replace &lt;placeholders&gt; with real names. Some commands assume{' '}
          <code className="font-mono" style={{ background: 'var(--vpk-bg)', border: '1px solid var(--vpk-border)', borderRadius: 3, padding: '0 3px' }}>
            jq
          </code>{' '}
          or a kubectl plugin (krew) is installed — these are starting points, not guaranteed one-liners for every cluster.
        </p>
      </div>
    </div>
  );
}
