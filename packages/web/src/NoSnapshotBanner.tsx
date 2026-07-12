import { Info } from 'lucide-react';

/**
 * Every view except Demo Data (which generates its own synthetic data and needs no capture) is completely
 * inert with zero snapshot files available — there's nothing to select, nothing to browse. Rather than let
 * each view separately show its own confusing "no data" empty state in that situation, this replaces the
 * whole view with one impossible-to-miss instruction. Deliberately louder than the app's other EmptyState
 * prompts (bigger icon, bold heading) — those assume data exists and you just haven't picked something yet;
 * this means there is currently nothing to pick at all. Informational (accent color), not a warning — an
 * empty snapshot directory on first run isn't an error condition, just a "here's what to do next" nudge.
 */
export function NoSnapshotBanner({ dir, onCapture }: { dir: string; onCapture: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <Info size={36} style={{ color: 'var(--vpk-accent)' }} />
      <p className="text-base font-semibold" style={{ color: 'var(--vpk-fg)' }}>
        No snapshot loaded yet
      </p>
      <p className="max-w-sm text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>
        There's nothing to show until you select a snapshot or capture one from a live cluster.
        {dir && (
          <>
            {' '}
            Looked for snapshot files in <code>{dir}</code> and found none — change this under Settings &gt;
            Snapshot if that's not where yours live.
          </>
        )}
      </p>
      <button
        onClick={onCapture}
        className="cursor-pointer rounded border px-3 py-1.5 text-sm font-medium"
        style={{ borderColor: 'var(--vpk-accent)', color: 'var(--vpk-accent)' }}
      >
        Capture from cluster
      </button>
    </div>
  );
}
