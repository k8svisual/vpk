const STORAGE_KEY = 'vpk-apigroup-color-overrides';

/** Per-API-group (really per-"pane" — Workload/Networking/Storage/.../ThirdParty, see FilterPanel's `PANES`
 *  and @vpk/core's controlPlane.ts PANE_COLORS) color overrides for the 3D Wheel's resource planes — the
 *  sphere per Kind AND the near-transparent wall behind it share this one color (see Scene3D's PlaneWall,
 *  which renders the same color at opacity 0.3). localStorage-only, same personal-display-preference model as
 *  kindColorOverrides.ts, and for the same reason (Three.js can't resolve CSS vars) there's no CSS custom
 *  property path here at all — resolveApiGroupColor is the only consumer, called wherever a plane's default
 *  color would otherwise be used (Scene3D's wheel remap, FilterPanel's legend swatch). */
export function getStoredApiGroupColorOverrides(): Record<string, string> {
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

export function setStoredApiGroupColorOverrides(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}

/** The resolved color for a pane, honoring the stored override. `fallback` is normally the caller's own
 *  already-known default (PANE_COLORS' value via FilterPanel's `PANES`), avoiding a second copy of that
 *  palette just for this one call site. */
export function resolveApiGroupColor(name: string, fallback: string): string {
  const overrides = getStoredApiGroupColorOverrides();
  return overrides[name] || fallback;
}
