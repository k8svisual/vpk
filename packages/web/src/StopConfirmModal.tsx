/** Confirms before the 'X' header button actually shuts the server down — a destructive, irreversible-from-
 *  this-tab action, so it gets a real confirm step rather than firing on a single click. */
export function StopConfirmModal({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <h2 className="mb-2 font-medium" style={{ color: 'var(--vpk-fg)' }}>
          Stop VpK?
        </h2>
        <p className="mb-4 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
          This shuts down the VpK server. You&apos;ll need to restart it to use the app again.
        </p>
        <div className="flex justify-end gap-2 text-xs">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-status-error)', color: 'var(--vpk-status-error)' }}
          >
            Stop server
          </button>
        </div>
      </div>
    </div>
  );
}
