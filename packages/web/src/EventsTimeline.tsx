import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

interface TimelineEvent {
  lastSeen?: string;
  type: 'Normal' | 'Warning';
  reason?: string;
}

interface Bucket {
  start: number;
  normal: number;
  warning: number;
  failed: number;
}

function bucketTotal(b: Bucket): number {
  return b.normal + b.warning + b.failed;
}

export type MessageCategory = 'Normal' | 'Warning' | 'Failed';

/** Real Kubernetes Events only carry two `type` values (Normal/Warning) — "Failed" here is a UI-level
 *  sub-category carved out of Warning by its `reason` text (FailedScheduling, FailedMount,
 *  ConfigMapCreateFailed, ...), since an actual failure reads as materially more urgent than a generic Warning
 *  (BackOff, Unhealthy, resync noise) and deserves its own color and its own filter — the Messages tab has an
 *  independent checkbox per category (Normal/Warning/Failed), so e.g. "Failed only" is a single click, not
 *  something you'd have to derive from a combined Warning toggle. */
export function messageCategory(e: { type: string; reason?: string }): MessageCategory {
  if (e.type !== 'Warning') return 'Normal';
  return e.reason && /fail/i.test(e.reason) ? 'Failed' : 'Warning';
}

/** Warning is yellow/amber (the app's existing --vpk-status-warn convention), not red — red is reserved for
 *  Failed, the more urgent sub-category, so the two don't compete for the same alarm color. */
export const CATEGORY_COLOR: Record<MessageCategory, string> = {
  Normal: 'var(--vpk-fg-muted, #9aa1a8)',
  Warning: 'var(--vpk-status-warn, #d4a017)',
  Failed: 'var(--vpk-status-error, #c0392b)',
};

const FIVE_MIN_MS = 5 * 60_000;
const WINDOW_STEP_MIN = 5;
const MIN_WINDOW_MIN = 5;
const MAX_WINDOW_MIN = 10080; // 1 week — a soft ceiling, not a hard requirement
/** Initial window: the whole span if it's small (a typical ~1hr-retention snapshot fits with no paging
 *  needed), else capped at 4 hours so a multi-day snapshot doesn't open on one enormous, mostly-empty view. */
const DEFAULT_WINDOW_CAP_MIN = 240;

function bucketize(events: TimelineEvent[], start: number, end: number): Bucket[] {
  const n = Math.max(1, Math.ceil((end - start) / FIVE_MIN_MS));
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => ({ start: start + i * FIVE_MIN_MS, normal: 0, warning: 0, failed: 0 }));
  for (const e of events) {
    if (!e.lastSeen) continue;
    const t = Date.parse(e.lastSeen);
    if (Number.isNaN(t) || t < start || t >= end) continue;
    const idx = Math.min(n - 1, Math.floor((t - start) / FIVE_MIN_MS));
    const b = buckets[idx] as Bucket;
    const cat = messageCategory(e);
    if (cat === 'Normal') b.normal++;
    else if (cat === 'Warning') b.warning++;
    else b.failed++;
  }
  return buckets;
}

/** Raw UTC ISO, matching the flat table's own "Last seen" column — no timezone conversion, so a label always
 *  means exactly what it says against the snapshot's own timestamps (no guessing the viewer's zone). */
export function formatBucketTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

const W = 800;
const H = 160;
const AXIS_H = 20;
const TOP_PAD = 30; // headroom for the center-time pill so it never overlaps the tallest bar
const MINI_H = 44;
const MINI_BINS = 120;

function formatCount(n: number): string {
  return n.toLocaleString();
}

/** Small caps "STAT" label + big value — the Start/End/Elapsed summary reads like a dashboard stat row. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--vpk-fg-muted)' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--vpk-fg)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

/** A colored dot + count + label — the header's Normal/Warning/Failed breakdown. */
function CategoryCount({ category, count }: { category: MessageCategory; count: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--vpk-fg-muted)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLOR[category], display: 'inline-block', flexShrink: 0 }} />
      <b style={{ color: 'var(--vpk-fg)', fontVariantNumeric: 'tabular-nums' }}>{count.toLocaleString()}</b> {category}
    </span>
  );
}

const barBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--vpk-surface, #fff)',
  color: 'var(--vpk-fg, #333)',
};

/**
 * Event volume timeline (Events view, Graph tab): a windowed, pageable histogram at a fixed 5-minute bucket
 * size (the resolution the flat message list is filtered to on click) rather than an auto-scaled overview —
 * the window width, position, and paging are all under direct user control (per the explicit ask for a scroll
 * bar, an interval-size control, and a scrub slider), not an automatic drill-down.
 *
 * Two position modes:
 *  - Manual (default): `windowStart` is local state, moved by the Back/Forward buttons (one windowMinutes
 *    page at a time) or the slider (jump anywhere in the full domain).
 *  - Synced (`syncEnabled`): position instead follows `syncedTime` — the timestamp of whatever message is
 *    scrolled to the top of the Messages tab's list (EventsView tracks this via a scroll listener) — and the
 *    manual controls are disabled, since there'd be two conflicting sources of truth for the window position.
 *
 * Stacked bars: grey = Normal, yellow = Warning, red = Failed (see messageCategory's doc comment).
 */
export function EventsTimeline({
  events,
  allEvents,
  onSelectWindow,
  namespaceOptions,
  namespaceFilter,
  onNamespaceFilterChange,
  syncEnabled,
  onSyncEnabledChange,
  syncedTime,
}: {
  /** What the chart/minimap/flanking-counts draw from — already filtered by the Messages tab's per-category
   *  (Normal/Warning/Failed) checkboxes. */
  events: TimelineEvent[];
  /** The SAME scope (namespace/pod) but WITHOUT those category checkboxes applied — used only for the
   *  header's Normal/Warning/Failed breakdown, which should always show the full picture regardless of which
   *  categories are currently hidden from the chart itself. */
  allEvents: TimelineEvent[];
  onSelectWindow: (start: number, end: number) => void;
  namespaceOptions: string[];
  namespaceFilter: string;
  onNamespaceFilterChange: (namespace: string) => void;
  /** "Keep the graph area in sync with the top message in the list" checkbox state — owned by EventsView
   *  since it also gates whether the Messages tab bothers tracking scroll at all. */
  syncEnabled: boolean;
  onSyncEnabledChange: (enabled: boolean) => void;
  /** The Messages tab's current top-of-viewport message time (ms epoch), or null if nothing's been scrolled
   *  yet this session / the Messages tab isn't mounted. Only consulted while syncEnabled. */
  syncedTime: number | null;
}) {
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [windowStart, setWindowStart] = useState<number | null>(null);
  const initialized = useRef(false);

  const times = events.map((e) => (e.lastSeen ? Date.parse(e.lastSeen) : NaN)).filter((t) => !Number.isNaN(t));
  const domain = times.length > 0 ? { min: Math.min(...times), max: Math.max(...times) } : null;
  const domainMin = domain?.min ?? 0;
  const domainMax = domain?.max ?? 0;

  // Pick a sensible initial window size/position once the domain is first known — never again after that, so
  // a later filter change (which can shrink/shift the domain) doesn't yank the view out from under the user.
  useEffect(() => {
    if (initialized.current || !domain) return;
    initialized.current = true;
    const spanMin = Math.max(MIN_WINDOW_MIN, Math.ceil((domain.max - domain.min) / 60_000 / WINDOW_STEP_MIN) * WINDOW_STEP_MIN);
    setWindowMinutes(Math.min(spanMin, DEFAULT_WINDOW_CAP_MIN));
    setWindowStart(domain.min);
  }, [domain]);

  // Density sparkline for the FULL domain (unlike the main chart's fixed 5-minute buckets, which only cover
  // the current window) — this is what makes the minimap answer "where am I relative to everything," not just
  // "what's near me." Memoized since it's an O(events) scan independent of window position/size, so there's no
  // reason to redo it on every Back/Forward click.
  const miniBins = useMemo<Bucket[]>(() => {
    if (!domain) return [];
    const span = Math.max(1, domain.max - domain.min);
    const binMs = span / MINI_BINS;
    const bins: Bucket[] = Array.from({ length: MINI_BINS }, (_, i) => ({ start: domain.min + i * binMs, normal: 0, warning: 0, failed: 0 }));
    for (const e of events) {
      if (!e.lastSeen) continue;
      const t = Date.parse(e.lastSeen);
      if (Number.isNaN(t) || t < domain.min || t > domain.max) continue;
      const idx = Math.min(MINI_BINS - 1, Math.floor((t - domain.min) / binMs));
      const b = bins[idx] as Bucket;
      const cat = messageCategory(e);
      if (cat === 'Normal') b.normal++;
      else if (cat === 'Warning') b.warning++;
      else b.failed++;
    }
    return bins;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, domainMin, domainMax]);

  const card: React.CSSProperties = {
    marginBottom: 12,
    padding: 16,
    borderRadius: 10,
    border: '1px solid var(--vpk-border)',
    background: 'var(--vpk-surface)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  if (!domain) {
    return (
      <div style={card}>
        <p style={{ fontSize: 12, color: 'var(--vpk-fg-muted)' }}>No timestamped Events to chart.</p>
      </div>
    );
  }

  const windowMs = windowMinutes * 60_000;
  const synced = syncEnabled && syncedTime != null;
  const effectiveStart = synced ? (syncedTime as number) - windowMs / 2 : (windowStart ?? domain.min);
  const alignedStart = Math.floor(effectiveStart / FIVE_MIN_MS) * FIVE_MIN_MS;
  const rangeEnd = alignedStart + windowMs;
  const centerTime = alignedStart + windowMs / 2;

  const buckets = bucketize(events, alignedStart, rangeEnd);
  const maxTotal = Math.max(1, ...buckets.map(bucketTotal));
  const barW = Math.max(1, W / buckets.length - 1);
  const chartH = H - AXIS_H - TOP_PAD;

  function clampStart(s: number): number {
    // Loose clamp — allowed to show empty space at either edge rather than hard-stopping exactly at the
    // domain's ends, so the window can still center on an event near the very start/end.
    const lo = domain!.min - windowMs;
    const hi = domain!.max;
    return Math.max(lo, Math.min(s, hi));
  }

  function handleBarClick(b: Bucket) {
    if (bucketTotal(b) === 0) return;
    onSelectWindow(b.start, b.start + FIVE_MIN_MS);
  }

  // Header breakdown — ALWAYS the full scope (allEvents), unaffected by the category checkboxes, so the
  // graph's own header shows the complete picture regardless of which categories are currently hidden.
  let normalTotal = 0;
  let warningTotal = 0;
  let failedTotal = 0;
  for (const e of allEvents) {
    const cat = messageCategory(e);
    if (cat === 'Normal') normalTotal++;
    else if (cat === 'Warning') warningTotal++;
    else failedTotal++;
  }

  // How many matching messages fall outside the current window, split by direction and category — the
  // flanking counts next to the minimap. A plain O(events) scan (not memoized): cheap relative to the render
  // cost of the rest of this component, and it needs alignedStart/rangeEnd, which move every Back/Forward
  // click anyway.
  let earlierCount = 0;
  let earlierWarnings = 0;
  let earlierFailed = 0;
  let laterCount = 0;
  let laterWarnings = 0;
  let laterFailed = 0;
  for (const e of events) {
    if (!e.lastSeen) continue;
    const t = Date.parse(e.lastSeen);
    if (Number.isNaN(t)) continue;
    const cat = messageCategory(e);
    if (t < alignedStart) {
      earlierCount++;
      if (cat === 'Warning') earlierWarnings++;
      else if (cat === 'Failed') earlierFailed++;
    } else if (t >= rangeEnd) {
      laterCount++;
      if (cat === 'Warning') laterWarnings++;
      else if (cat === 'Failed') laterFailed++;
    }
  }

  const domainSpan = Math.max(1, domain.max - domain.min);
  const miniMaxTotal = Math.max(1, ...miniBins.map(bucketTotal));
  const winX1 = Math.max(0, Math.min(W, ((alignedStart - domain.min) / domainSpan) * W));
  const winX2 = Math.max(0, Math.min(W, ((rangeEnd - domain.min) / domainSpan) * W));
  const positionStartPct = Math.round(((alignedStart - domain.min) / domainSpan) * 100);
  const positionEndPct = Math.round(((rangeEnd - domain.min) / domainSpan) * 100);

  function timeAtFraction(fraction: number): number {
    return domain!.min + Math.min(1, Math.max(0, fraction)) * domainSpan;
  }

  function handleMinimapPointer(e: React.MouseEvent<SVGSVGElement>) {
    if (synced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = timeAtFraction((e.clientX - rect.left) / rect.width);
    setWindowStart(clampStart(t - windowMs / 2));
  }

  const centerLabel = formatBucketTime(centerTime);
  const centerPillW = Math.max(120, centerLabel.length * 6.6 + 16);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 36, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Start" value={formatBucketTime(domain.min)} />
        <Stat label="End" value={formatBucketTime(domain.max)} />
        <Stat label="Elapsed" value={formatDuration(domain.max - domain.min)} />
      </div>

      <div style={{ height: 1, background: 'var(--vpk-border)', marginBottom: 14 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--vpk-fg)' }}>Event volume</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <CategoryCount category="Normal" count={normalTotal} />
          <CategoryCount category="Warning" count={warningTotal} />
          <CategoryCount category="Failed" count={failedTotal} />
        </div>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
          namespace
          <select
            value={namespaceFilter}
            onChange={(e) => onNamespaceFilterChange(e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--vpk-border)' }}
          >
            <option value="">All namespaces</option>
            {namespaceOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--vpk-fg)', marginLeft: 'auto' }}>
          <input type="checkbox" checked={syncEnabled} onChange={(e) => onSyncEnabledChange(e.target.checked)} />
          Keep in sync with the top message in the list
        </label>
      </div>

      {/* Control bar — a distinct recessed toolbar (not plain inline text) grouping paging, the interval
          size, and the slider together, since this whole row IS "the scroll interval" control. */}
      <div
        style={{
          display: synced ? 'block' : 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(128,128,128,0.08)',
          marginBottom: 10,
        }}
      >
        {synced ? (
          <p style={{ fontSize: 12, color: 'var(--vpk-fg-muted)', margin: 0 }}>
            Following the Messages tab — scroll there to move this window.
          </p>
        ) : syncEnabled ? (
          <p style={{ fontSize: 12, color: 'var(--vpk-fg-muted)', margin: 0 }}>
            Switch to Messages and scroll to position this window.
          </p>
        ) : (
          <>
            <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--vpk-border, #c9c9c9)' }}>
              <button onClick={() => setWindowStart((s) => clampStart((s ?? domain!.min) - windowMs))} title="Back one window" style={barBtn}>
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => setWindowStart((s) => clampStart((s ?? domain!.min) + windowMs))}
                title="Forward one window"
                style={{ ...barBtn, borderLeft: '1px solid var(--vpk-border, #c9c9c9)' }}
              >
                Forward <ChevronRight size={14} />
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--vpk-fg-muted)', fontWeight: 600 }}>
              skip interval
              <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--vpk-border, #c9c9c9)' }}>
                <button
                  onClick={() => setWindowMinutes((m) => Math.max(MIN_WINDOW_MIN, m - WINDOW_STEP_MIN))}
                  title="Shrink the window"
                  style={{ ...barBtn, padding: '6px 8px' }}
                >
                  <Minus size={13} />
                </button>
                <span
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--vpk-fg)',
                    minWidth: 68,
                    textAlign: 'center',
                    background: 'var(--vpk-surface)',
                    borderLeft: '1px solid var(--vpk-border, #c9c9c9)',
                    borderRight: '1px solid var(--vpk-border, #c9c9c9)',
                  }}
                >
                  {windowMinutes} min
                </span>
                <button
                  onClick={() => setWindowMinutes((m) => Math.min(MAX_WINDOW_MIN, m + WINDOW_STEP_MIN))}
                  title="Widen the window"
                  style={{ ...barBtn, padding: '6px 8px' }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </label>
          </>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        <line x1={0} y1={TOP_PAD + chartH} x2={W} y2={TOP_PAD + chartH} stroke="var(--vpk-border, #ccc)" />
        {/* Center marker — a thin vertical line at the window's midpoint, with its own time label in a pill
            directly above it (not off in the control row) so the "message in the middle" reading sits right
            where it points. */}
        <line x1={W / 2} y1={TOP_PAD} x2={W / 2} y2={TOP_PAD + chartH} stroke="#2a5db0" strokeDasharray="3 3" opacity={0.55} />
        <rect x={W / 2 - centerPillW / 2} y={4} width={centerPillW} height={20} rx={10} fill="#2a5db0" />
        <text x={W / 2} y={18} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
          {centerLabel}
        </text>
        {buckets.map((b) => {
          const i = Math.round((b.start - alignedStart) / FIVE_MIN_MS);
          const x = i * (W / buckets.length);
          const total = bucketTotal(b);
          const normalPx = (b.normal / maxTotal) * (chartH - 4);
          const warningPx = (b.warning / maxTotal) * (chartH - 4);
          const failedPx = (b.failed / maxTotal) * (chartH - 4);
          const baseline = TOP_PAD + chartH;
          return (
            <g key={b.start} onClick={() => handleBarClick(b)} style={{ cursor: total > 0 ? 'pointer' : 'default' }}>
              <title>
                {`${formatBucketTime(b.start)}\n${total} event${total === 1 ? '' : 's'}${b.warning ? ` · ${b.warning} Warning` : ''}${b.failed ? ` · ${b.failed} Failed` : ''}`}
              </title>
              <rect x={x} y={TOP_PAD} width={barW} height={chartH} fill="transparent" />
              {total > 0 && (
                <>
                  <rect x={x} y={baseline - normalPx} width={barW} height={normalPx} rx={1} fill={CATEGORY_COLOR.Normal} opacity={0.85} />
                  <rect x={x} y={baseline - normalPx - warningPx} width={barW} height={warningPx} rx={1} fill={CATEGORY_COLOR.Warning} />
                  <rect x={x} y={baseline - normalPx - warningPx - failedPx} width={barW} height={failedPx} rx={1} fill={CATEGORY_COLOR.Failed} />
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--vpk-fg-muted)' }}>
        <span>{formatBucketTime(alignedStart)}</span>
        <span>{formatBucketTime(rangeEnd)}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--vpk-fg-muted)', marginTop: 2 }}>click a bar to view those messages</p>

      {/* Position minimap — a density sparkline across the ENTIRE domain (not just the current window), with
          the current window highlighted as a proportional band. Answers "where am I, and how much am I
          seeing" at a glance: the band's position shows where, its WIDTH shows how much. Click or drag to jump
          anywhere. The flanking counts add the precise numbers a purely visual indicator can't. */}
      <div style={{ height: 1, background: 'var(--vpk-border)', margin: '14px 0 12px' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--vpk-fg-muted)' }}>
          Position in full range
        </span>
        <span style={{ fontSize: 11, color: 'var(--vpk-fg-muted)' }}>
          {positionStartPct}%–{positionEndPct}% of elapsed time
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--vpk-fg-muted)', whiteSpace: 'nowrap', minWidth: 108, textAlign: 'right', alignSelf: 'center' }}>
          <ChevronLeft size={11} style={{ verticalAlign: -1 }} />
          <b style={{ color: 'var(--vpk-fg)', fontSize: 13 }}> {formatCount(earlierCount)}</b> earlier
          {earlierWarnings > 0 && <div style={{ color: CATEGORY_COLOR.Warning }}>{formatCount(earlierWarnings)} Warning</div>}
          {earlierFailed > 0 && <div style={{ color: CATEGORY_COLOR.Failed }}>{formatCount(earlierFailed)} Failed</div>}
        </div>
        <svg
          viewBox={`0 0 ${W} ${MINI_H}`}
          width="100%"
          height={MINI_H}
          style={{
            display: 'block',
            flex: 1,
            borderRadius: 6,
            border: '1px solid var(--vpk-border)',
            background: 'rgba(128,128,128,0.06)',
            cursor: synced ? 'default' : 'pointer',
          }}
          onClick={handleMinimapPointer}
          onMouseMove={(e) => {
            if (e.buttons === 1) handleMinimapPointer(e);
          }}
        >
          {miniBins.map((b) => {
            const i = Math.round((b.start - domain.min) / (domainSpan / MINI_BINS));
            const x = i * (W / MINI_BINS);
            const bw = Math.max(1, W / MINI_BINS - 0.6);
            const normalPx = (b.normal / miniMaxTotal) * (MINI_H - 6);
            const warningPx = (b.warning / miniMaxTotal) * (MINI_H - 6);
            const failedPx = (b.failed / miniMaxTotal) * (MINI_H - 6);
            const baseline = MINI_H - 3;
            return (
              <g key={b.start}>
                {bucketTotal(b) > 0 && (
                  <>
                    <rect x={x} y={baseline - normalPx} width={bw} height={normalPx} fill={CATEGORY_COLOR.Normal} opacity={0.6} />
                    <rect x={x} y={baseline - normalPx - warningPx} width={bw} height={warningPx} fill={CATEGORY_COLOR.Warning} opacity={0.85} />
                    <rect x={x} y={baseline - normalPx - warningPx - failedPx} width={bw} height={failedPx} fill={CATEGORY_COLOR.Failed} opacity={0.95} />
                  </>
                )}
              </g>
            );
          })}
          {/* Current-window band — width IS the "how much am I seeing" signal, position is the "where". */}
          <rect
            x={Math.min(winX1, winX2)}
            y={0}
            width={Math.max(2.5, Math.abs(winX2 - winX1))}
            height={MINI_H}
            fill="#2a5db0"
            opacity={0.2}
            stroke="#2a5db0"
            strokeWidth={1.5}
          />
        </svg>
        <div style={{ fontSize: 11, color: 'var(--vpk-fg-muted)', whiteSpace: 'nowrap', minWidth: 108, alignSelf: 'center' }}>
          <b style={{ color: 'var(--vpk-fg)', fontSize: 13 }}>{formatCount(laterCount)}</b> later
          <ChevronRight size={11} style={{ verticalAlign: -1 }} />
          {laterWarnings > 0 && <div style={{ color: CATEGORY_COLOR.Warning }}>{formatCount(laterWarnings)} Warning</div>}
          {laterFailed > 0 && <div style={{ color: CATEGORY_COLOR.Failed }}>{formatCount(laterFailed)} Failed</div>}
        </div>
      </div>
      {!synced && <p style={{ fontSize: 10, color: 'var(--vpk-fg-muted)', marginTop: 4, textAlign: 'center' }}>click or drag to jump anywhere in the full range</p>}
    </div>
  );
}
