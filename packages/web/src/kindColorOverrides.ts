import { KIND_COLOR, cssKind } from './kindColors';

const STORAGE_KEY = 'vpk-kind-color-overrides';

/** Per-kind color overrides for the 3D Wheel / OwnerRef / Network diagrams / icon badges (Settings' color
 *  picker) — localStorage-only, same as Theme (see theme.ts's own doc comment): a personal display
 *  preference, not server-enforced data-shaping behavior. Unlike Theme, though, server-rendered SVGs DO need
 *  to react to it — that works because those SVGs already embed `var(--vpk-kind-<kind>, <default>)` (see
 *  core's cssKindVar) instead of a baked hex, so setting the CSS custom property client-side re-colors
 *  already-inlined SVG markup instantly, no server round-trip needed. The one exception is the 3D Wheel
 *  (Three.js can't resolve CSS variables) — Scene3D remaps its fetched wheel items' colors through
 *  resolveKindColor() below right after fetch, using this same stored map. */
export function getStoredKindColorOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {}; // localStorage/JSON can throw in locked-down contexts or on corrupt data
  }
}

export function setStoredKindColorOverrides(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}

/** Sets/clears `--vpk-kind-<kind>` on <html> for every kind VpK knows about (not just the overridden ones —
 *  a kind reset back to default needs its property actually removed, not left stale from a previous call). */
export function applyKindColorOverrides(overrides: Record<string, string>): void {
  const root = document.documentElement;
  for (const kind of Object.keys(KIND_COLOR)) {
    const prop = `--vpk-kind-${cssKind(kind)}`;
    if (overrides[kind]) root.style.setProperty(prop, overrides[kind]);
    else root.style.removeProperty(prop);
  }
}

/** The actual resolved hex for a kind, honoring the stored override — for the ONE consumer that can't use a
 *  CSS var (Three.js's material colors in the 3D Wheel). `fallback` is normally the server's own already-
 *  computed default color for that kind (from the /scene/wheel payload), avoiding a second, potentially
 *  out-of-sync copy of the default palette just for this one call site. */
export function resolveKindColor(kind: string, fallback: string): string {
  const overrides = getStoredKindColorOverrides();
  return overrides[kind] || fallback;
}
