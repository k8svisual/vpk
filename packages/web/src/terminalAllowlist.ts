/**
 * Student-added extra verbs for the in-app terminal — layered ON TOP of whatever a lesson's own frontmatter
 * `allow` declares, not a replacement for it (see TerminalPane.tsx's `effectiveAllow`). Deliberately global,
 * not per-course/per-lesson (unlike commandApproval.ts's verb approvals) — this app assumes one student on
 * their own machine/cluster (single-tenant; see the deferred multi-tenant memory note), so there is no
 * meaningful "safe for THIS course but not that one" distinction to make for a verb the student themselves
 * chose to unlock. That single-tenant assumption is exactly why this is safe to expose as a plain student-
 * editable list at all — the original "blocked by default" policy layer exists to keep a lesson from
 * accidentally running something destructive on ITS OWN, not to stop a student from typing a command on their
 * own cluster they've deliberately decided to allow themselves.
 */

const KEY = 'vpk-terminal-extra-allow';

export function initialExtraAllowedVerbs(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return []; // localStorage can throw in locked-down/private-browsing contexts, or the JSON could be corrupt
  }
}

export function setStoredExtraAllowedVerbs(verbs: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(verbs));
  } catch {
    // best-effort — a failed write just means the extra verbs won't survive a reload, not worth surfacing
  }
}
