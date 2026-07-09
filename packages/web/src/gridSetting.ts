const STORAGE_KEY = 'vpk-3d-grid-enabled';

/** The 3D view's ground-grid floor toggle (Settings) — on by default (it's always been shown), same
 *  localStorage-only display-preference model as theme/fontSize/fogEnabled. */
export function getStoredGridEnabled(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === 'true';
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts
  }
}

export function initialGridEnabled(): boolean {
  return getStoredGridEnabled() ?? true;
}

export function setStoredGridEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}
