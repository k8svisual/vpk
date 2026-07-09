const STORAGE_KEY = 'vpk-3d-fog-enabled';

/** The 3D view's depth-fog toggle (Settings) — off by default: fog is a genuine depth cue (see the "shaders"
 *  exploration in chat), but it also fades out distant objects, which could hide real data in a wide Field
 *  grid on a large cluster. Opt-in, same localStorage-only display-preference model as theme/fontSize. */
export function getStoredFogEnabled(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === 'true';
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts
  }
}

export function initialFogEnabled(): boolean {
  return getStoredFogEnabled() ?? false;
}

export function setStoredFogEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}
