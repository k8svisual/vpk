/** Self-dismissing, non-blocking notifications (training-course.md design discussion: task auto-complete
 *  shouldn't require a click to acknowledge). Purely presentational — LessonRunnerView owns the toast list
 *  and the ~5s removal timers; this just renders whatever's currently in it. */
export interface ToastItem {
  id: number;
  message: string;
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 no-print" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded border px-3 py-2 text-xs shadow-lg"
          style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
