/** Session-scoped (not persisted across browser restarts) — the splash plays once per tab session, not on
 *  every in-app navigation/reload within it, but does play again if you close the tab and open VpK fresh.
 *  sessionStorage rather than a plain module-level boolean specifically so a page reload (F5) within the same
 *  session doesn't replay it either — a module variable would reset on any reload, sessionStorage survives
 *  that and only clears when the tab/window actually closes. */
const SPLASH_PLAYED_KEY = 'vpk-splash-played';

export function hasPlayedSplashThisSession(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_PLAYED_KEY) === '1';
  } catch {
    return false; // sessionStorage can throw in locked-down/private-browsing contexts — fail open (play it)
  }
}

export function markSplashPlayed(): void {
  try {
    sessionStorage.setItem(SPLASH_PLAYED_KEY, '1');
  } catch {
    // best-effort — a failed write just means it might replay on the next reload, not worth surfacing
  }
}
