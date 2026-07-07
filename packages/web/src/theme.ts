export type Theme = 'light' | 'dark' | 'forest' | 'ocean';

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'forest', label: 'Forest' },
  { value: 'ocean', label: 'Ocean' },
];

const STORAGE_KEY = 'vpk-theme';
const VALID = new Set<string>(THEMES.map((t) => t.value));

function isTheme(v: string | null): v is Theme {
  return v !== null && VALID.has(v);
}

/** DESIGN.md §Theming: a UI display preference, not server-enforced data-shaping behavior (unlike
 *  redactSecrets/snapshotDir in SettingsModal) — so this is deliberately localStorage-only, no /settings
 *  round-trip. Falls back to system preference (light/dark) on a first visit with nothing stored yet;
 *  forest/ocean are only ever reached by an explicit user choice. */
export function getStoredTheme(): Theme | null {
  try {
    return isTheme(localStorage.getItem(STORAGE_KEY)) ? (localStorage.getItem(STORAGE_KEY) as Theme) : null;
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts
  }
}

export function initialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/** Sets `data-theme` on <html> — every `var(--vpk-*)` consumer (client CSS, and server-rendered SVG once
 *  inlined into the DOM) picks it up immediately, with no rebuild or server round-trip. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}
