export type CourseStatus = 'not-started' | 'in-progress' | 'completed';

export interface CourseProgress {
  status: CourseStatus;
  completedTasks: number;
  totalTasks: number;
  /** epoch ms of the last time this record changed — not currently surfaced in the UI, kept for a future
   *  "last worked on" display without needing a format change later. */
  updatedAt: number;
}

const KEY_PREFIX = 'vpk-course-progress:';

/** Per-student course progress (redesign ask: never-started / started / completed, shown in the Catalog, with
 *  an explicit Stop button to pause without finishing). localStorage-only, same as every other personal
 *  display preference in this app — there's no multi-user/auth concept here, so "per student" really means
 *  "per browser profile", which is what localStorage already gives for free. Keyed by lesson id (not path),
 *  matching how the rest of the Course/Catalog code already identifies a lesson. */
function keyFor(lessonId: string): string {
  return KEY_PREFIX + lessonId;
}

export function getCourseProgress(lessonId: string): CourseProgress | null {
  try {
    const raw = localStorage.getItem(keyFor(lessonId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CourseProgress>;
    if (parsed.status !== 'not-started' && parsed.status !== 'in-progress' && parsed.status !== 'completed') return null;
    return {
      status: parsed.status,
      completedTasks: typeof parsed.completedTasks === 'number' ? parsed.completedTasks : 0,
      totalTasks: typeof parsed.totalTasks === 'number' ? parsed.totalTasks : 0,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null; // localStorage can throw in locked-down/private-browsing contexts, or hold corrupt JSON
  }
}

function setCourseProgress(lessonId: string, progress: CourseProgress): void {
  try {
    localStorage.setItem(keyFor(lessonId), JSON.stringify(progress));
  } catch {
    // best-effort — a failed write just means status won't survive a reload, not worth surfacing
  }
}

/** Called once a lesson finishes loading — marks it in-progress if this is the first time it's been opened.
 *  Does NOT downgrade an already-completed course back to in-progress just because the student reopened it
 *  to review; only evaluateProgress (driven by actual check results) can move a course out of 'completed'. */
export function markCourseStarted(lessonId: string): void {
  const existing = getCourseProgress(lessonId);
  if (existing) return;
  setCourseProgress(lessonId, { status: 'in-progress', completedTasks: 0, totalTasks: 0, updatedAt: Date.now() });
}

/** Called whenever a lesson's derived completedTasks/totalTasks changes (check pass/fail/re-run) — the
 *  single source of truth for status is "does the current check state add up to fully complete", not a
 *  one-way ratchet, so re-running a previously-passing check that now fails correctly reverts a course from
 *  'completed' back to 'in-progress'. */
export function updateCourseProgress(lessonId: string, completedTasks: number, totalTasks: number): void {
  const status: CourseStatus = totalTasks > 0 && completedTasks >= totalTasks ? 'completed' : 'in-progress';
  setCourseProgress(lessonId, { status, completedTasks, totalTasks, updatedAt: Date.now() });
}
