import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const VIEWPORT_MARGIN = 8;
const GAP = 6;
const SHOW_DELAY_MS = 150;

/**
 * Custom hover tooltip — the native `title` attribute's tooltip is too small to read comfortably, so nav rail
 * icons and header icon buttons (which have no visible label of their own) use this instead. Always measures
 * itself against the actual viewport before showing (not just "position below the anchor") and clamps/flips so
 * it never renders partially off-screen, which a fixed "always below, always centered" placement can't
 * guarantee near the screen's edges (the nav rail sits flush against the left edge, for one).
 */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleShow() {
    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
  }
  function hide() {
    if (showTimer.current) clearTimeout(showTimer.current);
    setVisible(false);
    setPos(null);
  }

  // Measures the anchor and the (already-rendered-but-invisible) tooltip, then places it — preferring below
  // and centered on the anchor, but flipping above if it would overflow the bottom, and clamping both axes so
  // it's always fully inside the viewport regardless of where the anchor sits.
  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !tipRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();

    let top = anchor.bottom + GAP;
    if (top + tip.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchor.top - tip.height - GAP; // flip above when there's no room below
    }
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - tip.height - VIEWPORT_MARGIN));

    let left = anchor.left + anchor.width / 2 - tip.width / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - tip.width - VIEWPORT_MARGIN));

    setPos({ top, left });
  }, [visible]);

  return (
    <span ref={anchorRef} className="flex" onMouseEnter={scheduleShow} onMouseLeave={hide} onFocus={scheduleShow} onBlur={hide}>
      {children}
      {visible && (
        <div
          ref={tipRef}
          role="tooltip"
          className="pointer-events-none fixed z-[200] max-w-[240px] whitespace-pre-line rounded px-2 py-1 text-xs shadow-lg"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
            background: 'var(--vpk-rail-bg)',
            color: 'var(--vpk-rail-fg-active)',
          }}
        >
          {label}
        </div>
      )}
    </span>
  );
}
