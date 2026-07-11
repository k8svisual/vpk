/**
 * A SECOND, separate trust grant from the terminal's `allow` list (courseSettings.ts's cliOverride/terminal
 * settings are a display preference; this is a real permission) — approving that the SERVER may auto-run a
 * specific verb on its own initiative for a vpk-task's command-check, without a student typing it in the
 * moment. localStorage-only, same single-tenant-per-browser model as the rest of this app (see the training
 * course design discussion: this assumes one VpK server per student, not a shared/hosted instance — see
 * memory note on the deferred teacher-hosted multi-tenant model for why that assumption matters here).
 *
 * Two independent stores, deliberately different scopes:
 *  - Verb approvals: scoped either to one course or "all courses" (the student's choice each time), since
 *    approving a command in one course's context says nothing about whether the SAME verb is safe to
 *    auto-run in a completely different course's task.
 *  - Binary paths: always global and remembered forever, regardless of scope — where `oc` lives on this
 *    machine has nothing to do with which course asked for it, so there is no per-course path store at all.
 */

export interface CommandApproval {
  cli: string;
  verb: string;
  /** 'global' or a specific course id (the lesson id's course/group prefix — see App.tsx/CourseCatalogView's
   *  own grouping convention). */
  scope: 'global' | string;
}

const APPROVALS_KEY = 'vpk-command-approvals';
const BINARY_PATHS_KEY = 'vpk-command-binary-paths';

function readApprovals(): CommandApproval[] {
  try {
    const raw = localStorage.getItem(APPROVALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CommandApproval[]) : [];
  } catch {
    return [];
  }
}

function writeApprovals(list: CommandApproval[]): void {
  try {
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(list));
  } catch {
    // best-effort — a failed write just means the grant won't survive a reload, not worth surfacing
  }
}

export function isCommandApproved(courseId: string, cli: string, verb: string): boolean {
  return readApprovals().some((a) => a.cli === cli && a.verb === verb && (a.scope === 'global' || a.scope === courseId));
}

export function approveCommand(courseId: string, cli: string, verb: string, scope: 'global' | 'course'): void {
  const key = scope === 'global' ? 'global' : courseId;
  const list = readApprovals();
  if (list.some((a) => a.cli === cli && a.verb === verb && a.scope === key)) return;
  list.push({ cli, verb, scope: key });
  writeApprovals(list);
}

function readBinaryPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BINARY_PATHS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The resolved path/override for `cli` (e.g. `oc` -> `/usr/local/bin/oc`), if the student has ever supplied
 *  one — null means "no override on file," NOT "not found" (a `cli` with no override is assumed to resolve by
 *  its bare name until a preflight probe says otherwise). */
export function getBinaryPath(cli: string): string | null {
  return readBinaryPaths()[cli] ?? null;
}

export function setBinaryPath(cli: string, path: string): void {
  try {
    const paths = readBinaryPaths();
    paths[cli] = path;
    localStorage.setItem(BINARY_PATHS_KEY, JSON.stringify(paths));
  } catch {
    // best-effort
  }
}

/** Reverts `cli` back to "no override on file" — e.g. Settings' proactive tester, if a previously-saved path
 *  stops being correct (the binary moved) and the student would rather fall back to bare-name PATH resolution
 *  than overwrite it with another absolute path. */
export function clearBinaryPath(cli: string): void {
  try {
    const paths = readBinaryPaths();
    delete paths[cli];
    localStorage.setItem(BINARY_PATHS_KEY, JSON.stringify(paths));
  } catch {
    // best-effort
  }
}
