import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info: 'var(--vpk-fg)',
  warn: 'var(--vpk-status-warn)',
  error: 'var(--vpk-status-error)',
};

const POLL_MS = 2000;

/** Server activity log (DESIGN follow-on: "add logging that can be viewed to understand what's going on in
 *  the application" — a capture stuck spinning with no visibility into why was the prompting case). Backed by
 *  a small in-memory ring buffer on the server (logBuffer.ts), covering startup, snapshot loads, and Capture's
 *  lifecycle (start/warnings/done/error/cancelled/validate) — NOT every request (scene/nodes etc. stay plain
 *  console.log, or this would be too noisy to read). Polls while open rather than a persistent connection,
 *  since this is a "check in on what happened" panel, not a real-time console. */
export function LogsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchLogs = () => {
      fetch('/logs')
        .then((r) => r.json() as Promise<{ logs: LogEntry[] }>)
        .then((d) => {
          if (!cancelled) setLogs(d.logs);
        })
        .catch(() => undefined);
    };
    fetchLogs();
    const id = setInterval(fetchLogs, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open]);

  useEffect(() => {
    if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs, autoScroll]);

  if (!open) return null;

  async function clearLogs() {
    await fetch('/logs', { method: 'DELETE' });
    setLogs([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Application Logs
          </h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
            <button
              onClick={() => void clearLogs()}
              className="cursor-pointer rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--vpk-border)' }}
            >
              Close
            </button>
          </div>
        </div>

        <p className="mb-2 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
          Server activity — startup, snapshot loads, and Capture (start/warnings/done/cancelled/errors). Updates
          every {POLL_MS / 1000}s while this is open.
        </p>

        <div
          ref={logRef}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto rounded border p-2 font-mono"
          style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-bg)', fontSize: 11, minHeight: 200 }}
        >
          {logs.length === 0 && <span style={{ color: 'var(--vpk-fg-muted)' }}>No log entries yet.</span>}
          {logs.map((l, i) => (
            <div key={i} style={{ color: LEVEL_COLOR[l.level] }}>
              <span style={{ color: 'var(--vpk-fg-muted)' }}>{new Date(l.time).toLocaleTimeString()}</span> [{l.level}] {l.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
