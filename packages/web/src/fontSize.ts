export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

/** Percentage applied to <html>'s font-size — every Tailwind text-* class and any other rem-based sizing in
 *  the app scales off this root value, so one setting reaches the whole UI without touching individual
 *  components. 'medium' (100%) is the app's original, unscaled sizing. */
const SCALE: Record<FontSize, string> = {
  small: '87.5%',
  medium: '100%',
  large: '112.5%',
  xlarge: '125%',
};

export const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium (default)' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
];

const STORAGE_KEY = 'vpk-font-size';
const VALID = new Set<string>(FONT_SIZES.map((f) => f.value));

function isFontSize(v: string | null): v is FontSize {
  return v !== null && VALID.has(v);
}

/** A UI display preference, not server-enforced behavior — same localStorage-only model as theme.ts, applied
 *  before first render (see main.tsx) to avoid a flash of default-sized text. */
export function getStoredFontSize(): FontSize | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isFontSize(raw) ? raw : null;
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts
  }
}

export function initialFontSize(): FontSize {
  return getStoredFontSize() ?? 'medium';
}

/** Sets <html>'s font-size percentage — every rem-based size (Tailwind's text-xs/text-sm/... included)
 *  scales off this immediately, no rebuild or server round-trip. */
export function applyFontSize(size: FontSize): void {
  document.documentElement.style.fontSize = SCALE[size];
}

export function setStoredFontSize(size: FontSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}
