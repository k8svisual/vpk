import { CheckCircle2, Circle, Loader2, RotateCw, TimerOff, X } from 'lucide-react';

/**
 * Student-opened, live/in-session view of every vpk-task's status (training-course.md design discussion: "the
 * student needs to be able to check progress ... maybe with a modal"). Deliberately not persisted — polling
 * itself only ever runs while this course tab is open (no background worker), so there is nothing meaningful
 * to show here after a reload that isn't already reflected by reopening the course; courseProgress.ts's
 * localStorage record (the Catalog's aggregate badge) is a separate, coarser concern this modal doesn't touch.
 * This is also where a timed-out task's re-poll is triggered, per the design discussion's explicit ask.
 */

export type TaskRuntimeStatus = 'idle' | 'in-progress' | 'polling' | 'complete' | 'timed-out';

export interface TaskProgressEntry {
  id: string;
  title: string;
  status: TaskRuntimeStatus;
}

const STATUS_META: Record<TaskRuntimeStatus, { icon: typeof Circle; label: string; color: string }> = {
  idle: { icon: Circle, label: 'Not started', color: 'var(--vpk-fg-muted)' },
  'in-progress': { icon: Circle, label: 'In progress', color: 'var(--vpk-accent)' },
  polling: { icon: Loader2, label: 'Checking…', color: 'var(--vpk-accent)' },
  complete: { icon: CheckCircle2, label: 'Complete', color: 'var(--vpk-status-ok)' },
  'timed-out': { icon: TimerOff, label: 'Paused — needs re-check', color: 'var(--vpk-status-error)' },
};

export function CourseProgressModal({ tasks, onRepoll, onClose }: { tasks: TaskProgressEntry[]; onRepoll: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded border p-4 shadow-2xl max-h-[80vh] overflow-auto"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-sm" style={{ color: 'var(--vpk-fg)' }}>
            Task progress
          </h2>
          <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--vpk-fg-muted)' }} title="Close">
            <X size={16} />
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            This course has no tasks with a Start/Complete lifecycle.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const meta = STATUS_META[t.status];
              const Icon = meta.icon;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--vpk-border)' }}>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Icon size={13} className={t.status === 'polling' ? 'animate-spin' : ''} style={{ color: meta.color, flexShrink: 0 }} />
                    <span className="truncate">{t.title}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span style={{ color: meta.color }}>{meta.label}</span>
                    {t.status === 'timed-out' && (
                      <button
                        onClick={() => onRepoll(t.id)}
                        className="flex items-center gap-1 rounded border px-1.5 py-0.5 cursor-pointer"
                        style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
                      >
                        <RotateCw size={10} />
                        Check again
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
