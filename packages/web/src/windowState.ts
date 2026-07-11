/**
 * Best-effort browser window position/size persistence across launches. IMPORTANT LIMITATION: browsers only
 * let a page move/resize the window via `window.resizeTo`/`moveTo` if that window was opened BY SCRIPT (e.g.
 * `window.open(...)`) — a normal tab a user typed a URL into or clicked a bookmark for silently ignores these
 * calls (most browsers no-op rather than throw). This still attempts it on every load and saves on every
 * unload regardless, since there's no reliable way to detect "will this actually work" ahead of time, and it
 * degrades harmlessly (a no-op) rather than doing anything wrong when it can't.
 */

export interface WindowBounds {
  width: number;
  height: number;
  x: number;
  y: number;
}

const KEY = 'vpk-window-bounds';

export function getStoredWindowBounds(): WindowBounds | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WindowBounds>;
    if (
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number'
    ) {
      return null;
    }
    return { width: parsed.width, height: parsed.height, x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function saveCurrentWindowBounds(): void {
  try {
    const bounds: WindowBounds = {
      width: window.outerWidth,
      height: window.outerHeight,
      x: window.screenX,
      y: window.screenY,
    };
    localStorage.setItem(KEY, JSON.stringify(bounds));
  } catch {
    // best-effort — a failed write just means the next launch won't restore, not worth surfacing
  }
}

/** Call once on app mount. Applies any stored bounds (no-ops in a normal tab, per the module doc comment
 *  above) and arms a listener to persist the CURRENT bounds when the tab closes/navigates away, so "next
 *  launch" always reflects wherever the window most recently was — not just where it started this session. */
export function initWindowStatePersistence(): void {
  const stored = getStoredWindowBounds();
  if (stored) {
    try {
      window.resizeTo(stored.width, stored.height);
      window.moveTo(stored.x, stored.y);
    } catch {
      // some browsers throw instead of silently ignoring — either way, nothing more to do here
    }
  }
  window.addEventListener('beforeunload', saveCurrentWindowBounds);
}
