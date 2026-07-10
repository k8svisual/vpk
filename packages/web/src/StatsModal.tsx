import { useEffect, useState, type ReactNode } from 'react';

interface Stats {
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    totalMemBytes: number;
    freeMemBytes: number;
    processMemoryBytes: number;
    uptimeSeconds: number;
  };
  application: {
    port: number;
    snapshotDir: string;
    currentSnapshot: string;
    redactSecrets: boolean;
    disablePullingSecrets: boolean;
    nodes: number;
    edges: number;
    deduped: number;
  };
  snapshotFile: {
    path: string;
    sizeBytes: number | null;
    manifest: unknown;
    kindCounts: Record<string, number>;
  };
}

function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function fmtUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}h ${m}m ${sec}s`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-medium" style={{ color: 'var(--vpk-rail-active-bg)' }}>
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: 'var(--vpk-fg-muted)' }}>{label}</span>
      <span className="break-all text-right" style={{ color: 'var(--vpk-fg)' }}>
        {value}
      </span>
    </div>
  );
}

/** Stats panel (DESIGN: "view all the system, application, and snapshot file statistics"). Fetches fresh from
 *  `/stats` every time it opens rather than caching — these numbers (memory, uptime, current snapshot) are
 *  exactly the kind that go stale the moment you look away. */
export function StatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!open) return;
    setStats(null);
    fetch('/stats')
      .then((r) => r.json() as Promise<Stats>)
      .then(setStats);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded border p-4 shadow-2xl"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            Statistics
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Close
          </button>
        </div>
        {!stats ? (
          <div className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            loading…
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-xs">
            <Section title="System">
              <Row label="Platform" value={`${stats.system.platform} (${stats.system.arch})`} />
              <Row label="Node version" value={stats.system.nodeVersion} />
              <Row
                label="Memory (process / free / total)"
                value={`${fmtBytes(stats.system.processMemoryBytes)} / ${fmtBytes(stats.system.freeMemBytes)} / ${fmtBytes(stats.system.totalMemBytes)}`}
              />
              <Row label="Uptime" value={fmtUptime(stats.system.uptimeSeconds)} />
            </Section>
            <Section title="Application">
              <Row label="Port" value={String(stats.application.port)} />
              <Row label="Snapshot directory" value={stats.application.snapshotDir} />
              <Row label="Current snapshot" value={stats.application.currentSnapshot} />
              <Row label="Redact Secrets" value={stats.application.redactSecrets ? 'on' : 'off'} />
              <Row label="Disable pulling Secrets" value={stats.application.disablePullingSecrets ? 'on' : 'off'} />
              <Row label="Resources / edges / deduped" value={`${stats.application.nodes} / ${stats.application.edges} / ${stats.application.deduped}`} />
            </Section>
            <Section title="Snapshot file">
              <Row label="Path" value={stats.snapshotFile.path} />
              <Row label="Size" value={fmtBytes(stats.snapshotFile.sizeBytes)} />
              {Object.entries(stats.snapshotFile.kindCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => (
                  <Row key={kind} label={kind} value={String(count)} />
                ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
