/**
 * Student-added extra verbs (and, separately, extra whole binaries) for the in-app terminal — layered ON TOP
 * of whatever a lesson's own frontmatter `allow`/`cli` declares, not a replacement for it (see
 * TerminalPane.tsx's `effectiveAllow`/`effectiveExtraBinaries`). Deliberately global, not per-course/per-lesson
 * (unlike commandApproval.ts's verb approvals) — this app assumes one student on their own machine/cluster
 * (single-tenant; see the deferred multi-tenant memory note), so there is no meaningful "safe for THIS course
 * but not that one" distinction to make for something the student themselves chose to unlock. That single-
 * tenant assumption is exactly why this is safe to expose as a plain student-editable list at all — the
 * original "blocked by default" policy layer exists to keep a lesson from accidentally running something
 * destructive on ITS OWN, not to stop a student from typing a command on their own cluster they've
 * deliberately decided to allow themselves.
 *
 * Two separate lists, not one, because they mean different things to server/src/course/command.ts's
 * checkCommandPolicy: extra VERBS still only apply to the lesson's own `cli` (kubectl/oc) and stay gated by
 * whatever verb rules that CLI has (delete-Node, mutating -A, ...), while extra BINARIES (grep, jq, curl, ...)
 * are trusted as a whole different program with no verb concept at all — see CommandPolicy's own doc comment
 * for exactly what that second list bypasses.
 */

const VERBS_KEY = 'vpk-terminal-extra-allow';
const BINARIES_KEY = 'vpk-terminal-extra-binaries';

function readStringList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return []; // localStorage can throw in locked-down/private-browsing contexts, or the JSON could be corrupt
  }
}

function writeStringList(key: string, values: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // best-effort — a failed write just means the list won't survive a reload, not worth surfacing
  }
}

export function initialExtraAllowedVerbs(): string[] {
  return readStringList(VERBS_KEY);
}

export function setStoredExtraAllowedVerbs(verbs: string[]): void {
  writeStringList(VERBS_KEY, verbs);
}

export function initialExtraAllowedBinaries(): string[] {
  return readStringList(BINARIES_KEY);
}

export function setStoredExtraAllowedBinaries(binaries: string[]): void {
  writeStringList(BINARIES_KEY, binaries);
}
