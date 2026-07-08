import type { TimelapseInterval, TimelapseChange } from './timelapse';
import { formatChangeTime } from './timelapse';
import { iconUrlForKind } from './kindIcons';

const SPEEDS = [0.5, 1, 2, 4];

/**
 * The Wheel view's timelapse transport — Play/Pause, Step Back/Forward, a live date/time readout, a
 * step-snapped scrubber, a speed control, and a "Changes" button, all together in one control cluster (per the
 * user's explicit ask) rather than split across a side panel. Docked bottom-center rather than FilterPanel's
 * left-side shell, since transport controls read more naturally as a horizontal bar than a list of rows. Only
 * mounted while timelapse is enabled — the enable toggle itself lives in the top button row alongside
 * Field/Wheel/Filter, not here.
 */
export function TimelapseControls({
  intervals,
  intervalIndex,
  onSetIntervalIndex,
  playing,
  onTogglePlaying,
  speed,
  onSetSpeed,
  changes,
  changesOpen,
  onToggleChanges,
  onSelectChange,
  filterOpen,
  onToggleFilter,
}: {
  intervals: TimelapseInterval[];
  intervalIndex: number;
  onSetIntervalIndex: (i: number) => void;
  playing: boolean;
  onTogglePlaying: () => void;
  speed: number;
  onSetSpeed: (s: number) => void;
  changes: TimelapseChange[];
  changesOpen: boolean;
  onToggleChanges: () => void;
  /** Opens the full source editor directly for this change's resource id — the Changes list skips the 3D
   *  scene's usual "small Properties popup first" step since the item is already unambiguously identified. */
  onSelectChange: (id: string) => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
}) {
  const current = intervals[intervalIndex];
  const atStart = intervalIndex <= 0;
  const atEnd = intervals.length === 0 || intervalIndex >= intervals.length - 1;

  return (
    <div
      className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded border px-2 py-1.5 text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
    >
      <button
        onClick={() => onSetIntervalIndex(Math.max(0, intervalIndex - 1))}
        disabled={atStart || intervals.length === 0}
        title="Step back"
        className="cursor-pointer rounded border px-1.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
      >
        ⏮
      </button>
      <button
        onClick={onTogglePlaying}
        disabled={intervals.length === 0}
        title={playing ? 'Pause' : 'Play'}
        className="cursor-pointer rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <button
        onClick={() => onSetIntervalIndex(Math.min(intervals.length - 1, intervalIndex + 1))}
        disabled={atEnd}
        title="Step forward"
        className="cursor-pointer rounded border px-1.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
      >
        ⏭
      </button>

      {/* Live date/time readout of the current interval — must stay visible and update on every
          play-tick/step/scrub, not a small aside, per the explicit UI requirement. */}
      <span className="min-w-32 text-center font-medium" style={{ color: 'var(--vpk-fg)' }}>
        {current ? current.label : '—'}
      </span>
      {/* "9 of 599" style position counter, 1-indexed for a human reader. */}
      <span style={{ color: 'var(--vpk-fg-muted)' }}>{intervals.length > 0 ? `${intervalIndex + 1} of ${intervals.length}` : '0 of 0'}</span>

      <input
        type="range"
        min={0}
        max={Math.max(0, intervals.length - 1)}
        step={1}
        value={intervalIndex}
        disabled={intervals.length === 0}
        onChange={(e) => onSetIntervalIndex(Number(e.target.value))}
        className="w-40"
      />

      <select
        value={speed}
        onChange={(e) => onSetSpeed(Number(e.target.value))}
        className="rounded border px-1 py-1"
        style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)', color: 'var(--vpk-fg)' }}
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      <button
        onClick={onToggleFilter}
        className="cursor-pointer rounded border px-2 py-1"
        style={{
          borderColor: 'var(--vpk-border)',
          background: filterOpen ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
          color: filterOpen ? '#fff' : 'var(--vpk-fg)',
        }}
      >
        Filter
      </button>

      <div className="relative">
        <button
          onClick={onToggleChanges}
          className="cursor-pointer rounded border px-2 py-1"
          style={{
            borderColor: 'var(--vpk-border)',
            background: changesOpen ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
            color: changesOpen ? '#fff' : 'var(--vpk-fg)',
          }}
        >
          Changes ({changes.length})
        </button>
        {changesOpen && (
          <div
            className="absolute bottom-full left-1/2 mb-1 max-h-64 w-72 -translate-x-1/2 overflow-y-auto rounded border text-xs shadow-lg"
            style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}
          >
            <div
              className="sticky top-0 border-b px-2 py-1.5 font-medium"
              style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
            >
              Changes this interval
            </div>
            {changes.length === 0 && (
              <div className="px-2 py-1.5" style={{ color: 'var(--vpk-fg-muted)' }}>
                Nothing changed.
              </div>
            )}
            <ul>
              {changes.map((c, i) => (
                <li key={`${c.id}-${c.action}-${i}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--vpk-border)' }}>
                  <button
                    onClick={() => onSelectChange(c.id)}
                    title="View source"
                    className="flex w-full cursor-pointer flex-col gap-0.5 px-2 py-1 text-left"
                    style={{ color: 'var(--vpk-fg)', background: 'transparent' }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <img src={iconUrlForKind(c.kind)} alt="" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="shrink-0" style={{ color: c.action === 'created' ? '#2e9e4f' : '#c0392b' }}>
                        {c.action}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2" style={{ color: 'var(--vpk-fg-muted)' }}>
                      <span className="truncate">{c.kind}</span>
                      <span className="shrink-0">{formatChangeTime(c.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
