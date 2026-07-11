import { useEffect, useRef, useState } from 'react';

/**
 * A retro split-flap digital clock — purely a display widget (eye candy for CourseHeader's countdown), no
 * state of its own beyond the current/previous digit needed to animate a flip. Each digit renders a static
 * layer showing the CURRENT value plus a transient "flap" layer showing the PREVIOUS value mid-rotation; the
 * flap rotates away (backface hidden) to reveal the already-correct static layer beneath, which reads as a
 * real physical flip without needing to choreograph two separate half-flips.
 */

function pad2(n: number): string {
  return Math.max(0, Math.min(99, n)).toString().padStart(2, '0');
}

function FlipDigit({ value }: { value: string }) {
  const [displayed, setDisplayed] = useState(value);
  const [prev, setPrev] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === displayed) return;
    setPrev(displayed);
    setDisplayed(value);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setPrev(null), 320);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [value, displayed]);

  return (
    <span className="flip-digit">
      <span className="flip-digit__static">{displayed}</span>
      {prev !== null && (
        <span key={prev} className="flip-digit__flap">
          {prev}
        </span>
      )}
    </span>
  );
}

export function FlipClock({ totalMs, danger, label }: { totalMs: number; danger?: boolean; label?: string }) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const [h1, h2] = pad2(hh).split('');
  const [m1, m2] = pad2(mm).split('');
  const [s1, s2] = pad2(ss).split('');

  return (
    <span className="flex items-center gap-1.5" aria-label={`${pad2(hh)}:${pad2(mm)}:${pad2(ss)} ${label ?? ''}`}>
      <span className={`flip-clock${danger ? ' flip-clock--danger' : ''}`} aria-hidden="true">
        <FlipDigit value={h1 ?? '0'} />
        <FlipDigit value={h2 ?? '0'} />
        <span className="flip-clock__colon">:</span>
        <FlipDigit value={m1 ?? '0'} />
        <FlipDigit value={m2 ?? '0'} />
        <span className="flip-clock__colon">:</span>
        <FlipDigit value={s1 ?? '0'} />
        <FlipDigit value={s2 ?? '0'} />
      </span>
      {label && (
        <span className="text-xs" style={danger ? { color: 'var(--vpk-status-error)' } : { color: 'var(--vpk-fg-muted)' }}>
          {label}
        </span>
      )}
    </span>
  );
}
