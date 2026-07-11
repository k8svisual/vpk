const STORAGE_KEY = 'vpk-terminal-font-size';
export const TERMINAL_FONT_SIZE_MIN = 10;
export const TERMINAL_FONT_SIZE_MAX = 22;
const DEFAULT = 12;

/** The in-app terminal's own font size (px) — separate from the app-wide fontSize.ts scale, since the
 *  terminal's readability needs (dense command output, long lines) are independent of the rest of the UI.
 *  Same localStorage-only display-preference model as theme/fontSize. */
export function getStoredTerminalFontSize(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= TERMINAL_FONT_SIZE_MIN && n <= TERMINAL_FONT_SIZE_MAX ? n : null;
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts
  }
}

export function initialTerminalFontSize(): number {
  return getStoredTerminalFontSize() ?? DEFAULT;
}

export function setStoredTerminalFontSize(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(px));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}
