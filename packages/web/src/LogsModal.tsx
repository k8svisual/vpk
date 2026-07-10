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

/** Browser-only facts the server has no way to know — merged into the downloaded diagnostic bundle
 *  alongside the server's own `/diagnostics` response. Same fields the legacy app's "About" system-info
 *  panel showed (Browser name/version/agent, Browser Heap total/used/limit) — name/version parsing is the
 *  same hand-rolled `navigator.userAgent` string-matching the legacy app used (no UA-parsing library existed
 *  there either, and modern browsers increasingly freeze/generalize their UA strings anyway, so a proper
 *  parser wouldn't meaningfully out-perform this). `performance.memory` is Chrome-only — every other browser
 *  just omits the three heap fields entirely rather than reporting fake zeros. */
const BROWSER_PATTERNS: [name: string, pattern: RegExp][] = [
  ['Edge', /Edg\/([\d.]+)/],
  ['Opera', /OPR\/([\d.]+)/],
  ['Chrome', /Chrome\/([\d.]+)/],
  ['Firefox', /Firefox\/([\d.]+)/],
  ['Safari', /Version\/([\d.]+).*Safari/],
];

function collectBrowserInfo(): Record<string, unknown> {
  const ua = navigator.userAgent;
  let name = navigator.appName;
  let version = `${parseFloat(navigator.appVersion)}`;
  for (const [candidateName, pattern] of BROWSER_PATTERNS) {
    const m = pattern.exec(ua);
    if (m) {
      name = candidateName;
      version = m[1] ?? version;
      break;
    }
  }

  const info: Record<string, unknown> = {
    browserName: name,
    browserVersion: version,
    userAgent: ua,
    theme: document.documentElement.getAttribute('data-theme') ?? 'light',
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
  const mem = (performance as Performance & { memory?: { totalJSHeapSize: number; usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (mem) {
    info.browserHeapTotalBytes = mem.totalJSHeapSize;
    info.browserHeapUsedBytes = mem.usedJSHeapSize;
    info.browserHeapLimitBytes = mem.jsHeapSizeLimit;
  }
  return info;
}

/** Server activity log (DESIGN follow-on: "add logging that can be viewed to understand what's going on in
 *  the application" — a capture stuck spinning with no visibility into why was the prompting case). Backed by
 *  a small in-memory ring buffer on the server (logBuffer.ts), covering startup, snapshot loads, and Capture's
 *  lifecycle (start/warnings/done/error/cancelled/validate) — NOT every request (scene/nodes etc. stay plain
 *  console.log, or this would be too noisy to read). Polls while open rather than a persistent connection,
 *  since this is a "check in on what happened" panel, not a real-time console. */
export function LogsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [downloading, setDownloading] = useState(false);
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

  // Server-known facts (system/runtime, settings, snapshot metadata, last capture, logs) fetched fresh, then
  // merged with browser-only facts the server can't see — one JSON file, attachable straight to a bug report.
  // Deliberately never includes captured resource contents (Secrets, ConfigMaps, anything from the snapshot
  // itself) — see server.ts's /diagnostics route doc comment for why.
  async function downloadDiagnostics() {
    setDownloading(true);
    try {
      const server = await (await fetch('/diagnostics')).json();
      const bundle = { ...server, browser: collectBrowserInfo() };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vpk-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // best-effort — a failed diagnostics fetch shouldn't itself need diagnosing via a modal error state
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
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
              onClick={() => void downloadDiagnostics()}
              disabled={downloading}
              className="cursor-pointer rounded border px-2 py-1 text-xs disabled:cursor-default disabled:opacity-50"
              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
            >
              {downloading ? 'Preparing…' : 'Download Diagnostics'}
            </button>
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
