import { useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';

/**
 * Resolution UI for the course-start preflight (training-course.md design discussion, item #4's approval
 * flow): one row per (cli, verb) a vpk-task's auto-check wants to run that isn't yet usable — either the
 * binary itself doesn't resolve on this machine, or the verb hasn't been granted the SERVER-may-auto-run
 * permission (separate from the terminal's `allow`, see commandApproval.ts). Non-blocking by design — closing
 * this without resolving everything just leaves those tasks on their manual "Run check" fallback.
 */

export interface UnresolvedTaskCommand {
  taskId: string;
  taskTitle: string;
  cli: string;
  verb: string;
  /** null = still being probed when the panel opened. */
  binaryFound: boolean | null;
}

export function TaskApprovalPanel({
  items,
  onClose,
  onCheckPath,
  onApprove,
}: {
  items: UnresolvedTaskCommand[];
  onClose: () => void;
  /** Probes `path` as the cli binary; on success the caller persists it as the new global override and
   *  re-runs preflight (so this panel's `items` prop updates from the parent, not locally). */
  onCheckPath: (cli: string, path: string) => Promise<boolean>;
  onApprove: (cli: string, verb: string, scope: 'global' | 'course') => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded border p-4 shadow-2xl max-h-[80vh] overflow-auto"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-sm" style={{ color: 'var(--vpk-fg)' }}>
            Auto-validation setup
          </h2>
          <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--vpk-fg-muted)' }} title="Close">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--vpk-fg-muted)' }}>
          These tasks want to automatically run a command to check your work. Nothing here is required — any
          task you skip just falls back to its own manual "Run check" button.
        </p>
        {items.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            Everything's resolved.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <ApprovalRow key={`${item.taskId}-${item.cli}-${item.verb}`} item={item} onCheckPath={onCheckPath} onApprove={onApprove} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ApprovalRow({
  item,
  onCheckPath,
  onApprove,
}: {
  item: UnresolvedTaskCommand;
  onCheckPath: (cli: string, path: string) => Promise<boolean>;
  onApprove: (cli: string, verb: string, scope: 'global' | 'course') => void;
}) {
  const [path, setPath] = useState(item.cli);
  const [checking, setChecking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function check() {
    setChecking(true);
    setNotFound(false);
    try {
      const found = await onCheckPath(item.cli, path.trim());
      if (!found) setNotFound(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <li className="border rounded p-2 text-xs" style={{ borderColor: 'var(--vpk-border)' }}>
      <div className="font-medium mb-1">
        {item.taskTitle}: <code>{item.cli}</code> <code>{item.verb}</code>
      </div>
      {item.binaryFound === false ? (
        <div className="space-y-1">
          <p style={{ color: 'var(--vpk-status-error)' }}>
            "{item.cli}" wasn't found on this machine's PATH. Enter the full path to it, or install it first.
          </p>
          <div className="flex gap-1.5">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="flex-1 px-2 py-1 rounded border font-mono"
              style={{ borderColor: 'var(--vpk-border)' }}
              placeholder={`/usr/local/bin/${item.cli}`}
            />
            <button onClick={() => void check()} disabled={checking} className="rounded border px-2 py-1 cursor-pointer" style={{ borderColor: 'var(--vpk-border)' }}>
              {checking ? <Loader2 size={12} className="animate-spin" /> : 'Check'}
            </button>
          </div>
          {notFound && (
            <p style={{ color: 'var(--vpk-status-error)' }}>
              Still not found at that path.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} style={{ color: 'var(--vpk-status-ok)' }} />
          <span style={{ color: 'var(--vpk-fg-muted)' }}>Binary found. Allow the server to auto-run "{item.verb}"?</span>
          <button onClick={() => onApprove(item.cli, item.verb, 'course')} className="rounded border px-2 py-0.5 cursor-pointer" style={{ borderColor: 'var(--vpk-border)' }}>
            This course
          </button>
          <button onClick={() => onApprove(item.cli, item.verb, 'global')} className="rounded border px-2 py-0.5 cursor-pointer" style={{ borderColor: 'var(--vpk-border)' }}>
            All courses
          </button>
        </div>
      )}
    </li>
  );
}
