import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderLessonHtml } from './lessonMarkdown';
import {
  CheckCircle2,
  ListChecks,
  Loader2,
  Play,
  Printer,
  Square,
  Terminal as TerminalIcon,
  TriangleAlert,
  X,
} from 'lucide-react';
import { FlipClock } from './FlipClock';
import { TerminalPane } from './TerminalPane';
import { initialCourseLayout, setStoredCourseLayout, type CourseLayout, type TerminalTheme } from './courseSettings';
import { markCourseStarted, updateCourseProgress } from './courseProgress';
import { approveCommand, getBinaryPath, isCommandApproved, setBinaryPath } from './commandApproval';
import { ToastStack, type ToastItem } from './Toast';
import { CourseProgressModal, type TaskProgressEntry, type TaskRuntimeStatus } from './CourseProgressModal';
import { TaskApprovalPanel, type UnresolvedTaskCommand } from './TaskApprovalPanel';

/**
 * The real lesson/terminal experience (redesign/training-course.md §5/§6), superseding CourseSmokeView now
 * that the underlying wiring is proven. Split layout — lesson content left, terminal right — kept as two
 * independent components (LessonPane/TerminalPane) laid out side by side by the container, specifically so a
 * future layout preference (stacked, drawer, student's choice) is a different arrangement of the same two
 * pieces, not a rewrite.
 *
 * Local wire-shape types (thin-client convention — @vpk/web never imports @vpk/core or @vpk/training).
 */

interface LessonFrontmatter {
  id: string;
  title: string;
  difficulty?: number;
  estimatedMinutes?: number;
  provisioning?: boolean;
  passWhen?: 'functional' | 'conformant';
  floor?: 'loose' | 'standard' | 'strict' | 'pinned';
  allow?: string[];
  timeoutMs?: number;
  pollMs?: number;
  cli?: string[];
  colors?: { page?: string; question?: string; code?: string; answer?: string };
  /** Author opt-out for the header's countdown clock — defaults to true (shown whenever estimatedMinutes is
   *  set). Set to false to keep the time BUDGET documented in the lesson without putting a visibly ticking
   *  clock in front of the student (some courses want the estimate for planning purposes only, not pressure). */
  showCountdown?: boolean;
  /** Author opt-out for the terminal's delete confirmation — defaults to true. Set false for delete-heavy
   *  courses so the student isn't prompted on every delete (see TerminalPane's confirmDelete prop). */
  confirmDelete?: boolean;
}
type LessonBlockKind = 'detect' | 'setup' | 'check' | 'teardown' | 'quiz' | 'task';
interface LessonBlock {
  kind: LessonBlockKind;
  data: unknown;
}
interface CommandExpect {
  path?: string;
  op: '==' | '>=' | '<=' | 'matches' | 'contains';
  value: unknown;
}
type TaskCompletion = 'manual' | 'auto';
interface LessonTaskData {
  id: string;
  describe?: string;
  completion: TaskCompletion;
  estimatedMinutes?: number;
  check?: { cli?: string[]; verb: string; args?: string[]; expect: CommandExpect };
  hint?: string;
}
type LessonSegment = { type: 'prose'; markdown: string } | { type: 'block'; block: LessonBlock };
interface ParsedLesson {
  frontmatter: LessonFrontmatter;
  segments: LessonSegment[];
}

interface ClusterFacts {
  contextReachable: boolean;
  contextName?: string;
  serverVersion?: string;
  nodes: { total: number; ready: number };
  provisioner?: string;
  capabilities: { multiNode: boolean };
}
interface StepResult {
  status: 'pass' | 'fail';
  level: string;
  checks: Array<{ id: string; functional: string; conformance: string; summary: string }>;
  feedback: Array<{ severity: 'blocker' | 'difference' | 'tip'; message: string }>;
}
type CheckStreamEvent = { type: 'progress' | 'done'; result: StepResult } | { type: 'error'; error: string } | { type: 'cancelled' };
type CheckStatus = 'pass' | 'fail' | 'error' | 'cancelled' | undefined;

// Falls back to Lesson Zero when no id is passed in — preserves the old hardcoded-single-lesson behavior for
// any caller that doesn't care which lesson (and keeps the view usable before the Course Catalog picks one).
const DEFAULT_LESSON_ID = 'getting-started-00-cluster';

const panelStyle = { borderColor: 'var(--vpk-border)' } as const;
const mutedStyle = { color: 'var(--vpk-fg-muted)' } as const;
const errorStyle = { color: 'var(--vpk-status-error)' } as const;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json()) as T | { error: string };
  if (json && typeof json === 'object' && 'error' in json) throw new Error((json as { error: string }).error);
  return json as T;
}

const TERMINAL_MIN_WIDTH = 280;
const TERMINAL_MAX_WIDTH = 900;
const LESSON_MIN_WIDTH = 280;
const TERMINAL_MIN_HEIGHT = 160;
const TERMINAL_MAX_HEIGHT = 900;
const LESSON_MIN_HEIGHT = 160;
/** Background poll cadence for an armed auto-completion task — matches the terminal-friendly ~few-second
 *  cadence liveCheck.ts's DEFAULT_POLL_MS already uses server-side for a different polling case. */
const TASK_POLL_MS = 4000;
/** A task's polling gives up after estimatedMinutes * this multiplier (training-course.md design discussion:
 *  "use course duration, add 25%") — applied per-task, not to the whole course's estimate, since a task's own
 *  `estimatedMinutes` is what actually bounds how long that ONE command should reasonably take to pass. */
const TASK_TIMEOUT_MULTIPLIER = 1.25;
const DEFAULT_TASK_ESTIMATE_MINUTES = 5;

export function LessonRunnerView({
  lessonId,
  cliOverride,
  terminalTheme,
  terminalFontSize,
  onStop,
}: {
  lessonId?: string;
  /** Empty string means "no override, use the lesson's own frontmatter cli" — see courseSettings.ts. */
  cliOverride?: string;
  terminalTheme: TerminalTheme;
  terminalFontSize: number;
  /** "Stop" button in the header — pauses the course (progress is already saved continuously via
   *  courseProgress.ts, so there's nothing extra to persist here) and navigates away. App.tsx owns where
   *  "away" means, since that's nav-rail/view state this component doesn't have access to. */
  onStop?: () => void;
}) {
  const [lesson, setLesson] = useState<ParsedLesson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Set instead of attempting the hardcoded DEFAULT_LESSON_ID when the Course nav item is opened directly
  // (not via a Catalog selection) and the catalog is genuinely empty — a "here's what to do" screen with a
  // still-usable terminal, rather than a raw 404 for a lesson id that was never going to exist.
  const [catalogEmpty, setCatalogEmpty] = useState<{ coursesDir: string } | null>(null);
  const [terminalWidth, setTerminalWidth] = useState(420);
  const [terminalHeight, setTerminalHeight] = useState(360);
  const [layout, setLayout] = useState<CourseLayout>(initialCourseLayout);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [checkStatuses, setCheckStatuses] = useState<Record<string, CheckStatus>>({});
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [taskRuntime, setTaskRuntime] = useState<Record<string, TaskRuntimeStatus>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [unresolvedTasks, setUnresolvedTasks] = useState<UnresolvedTaskCommand[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [approvalPanelOpen, setApprovalPanelOpen] = useState(false);
  // Whether the terminal is currently living in its own window instead of the embedded pane below — see
  // popOutTerminal/bringTerminalBack. The popup Window object itself lives in a ref (not state — it's a
  // mutable handle, re-rendering on its own identity changing would be pointless) so the close-detection poll
  // and the unmount cleanup can both reach it without threading it through props.
  const [terminalPoppedOut, setTerminalPoppedOut] = useState(false);
  const terminalPopupRef = useRef<Window | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lessonScrollRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const toastIdRef = useRef(0);
  const taskStartedAtRef = useRef<Record<string, number>>({});
  const pollTimersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  function pushToast(message: string) {
    const id = ++toastIdRef.current;
    setToasts((p) => [...p, { id, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  }

  function clearTaskTimer(id: string) {
    const timer = pollTimersRef.current[id];
    if (timer) {
      clearInterval(timer);
      delete pollTimersRef.current[id];
    }
  }

  function taskCli(task: LessonTaskData): string[] {
    return task.check?.cli ?? (cliOverride ? [cliOverride] : lesson?.frontmatter.cli) ?? ['kubectl'];
  }

  // getBinaryPath's saved override previously only fed runPreflight's "is it found" check (so the banner
  // stopped nagging) — it was never actually substituted into what got SPAWNED, so a student who'd resolved a
  // path here would still hit the exact same ENOENT the override was supposed to fix. Same bug, same fix as
  // TerminalPane.tsx's resolveLeadingCli, just simpler here: /course/task-check builds its own argv from a
  // structured verb+args (not a typed line to tokenize), so the `cli` field IS argv[0..n] directly — no
  // leading-token rewrite needed, just resolve it before sending.
  function resolvedTaskCli(task: LessonTaskData): string[] {
    const arr = taskCli(task);
    const bin = arr[0];
    if (!bin) return arr;
    const override = getBinaryPath(bin);
    return override ? [override, ...arr.slice(1)] : arr;
  }

  async function pollOnce(task: LessonTaskData) {
    if (!task.check || !lesson) return;
    const deadlineMs = (task.estimatedMinutes ?? DEFAULT_TASK_ESTIMATE_MINUTES) * 60_000 * TASK_TIMEOUT_MULTIPLIER;
    const startedAt = taskStartedAtRef.current[task.id] ?? Date.now();
    try {
      const res = await postJson<{ passed: boolean }>('/course/task-check', {
        verb: task.check.verb,
        args: task.check.args,
        cli: resolvedTaskCli(task).join(' '),
        allow: lesson.frontmatter.allow ?? [],
        expect: task.check.expect,
      });
      if (res.passed) {
        clearTaskTimer(task.id);
        setTaskRuntime((p) => ({ ...p, [task.id]: 'complete' }));
        pushToast(`✓ Task complete: ${task.describe ?? task.id}`);
        return;
      }
    } catch {
      // Transient error (cluster hiccup, brief unreachability) — treated as "not passed yet" rather than a
      // hard stop, since a polling loop that gives up on the first blip would defeat the point of polling.
    }
    if (Date.now() - startedAt >= deadlineMs) {
      clearTaskTimer(task.id);
      setTaskRuntime((p) => ({ ...p, [task.id]: 'timed-out' }));
      pushToast(`"${task.describe ?? task.id}" is taking longer than expected — check Progress to re-check when ready.`);
    }
  }

  function armPolling(task: LessonTaskData) {
    clearTaskTimer(task.id);
    taskStartedAtRef.current[task.id] = Date.now();
    setTaskRuntime((p) => ({ ...p, [task.id]: 'polling' }));
    void pollOnce(task);
    pollTimersRef.current[task.id] = setInterval(() => void pollOnce(task), TASK_POLL_MS);
  }

  function startTask(task: LessonTaskData) {
    if (task.completion === 'auto' && task.check) armPolling(task);
    else setTaskRuntime((p) => ({ ...p, [task.id]: 'in-progress' }));
  }

  function completeTaskManually(task: LessonTaskData) {
    setTaskRuntime((p) => ({ ...p, [task.id]: 'complete' }));
  }

  function repollTask(task: LessonTaskData) {
    armPolling(task);
  }

  async function checkBinaryPath(cli: string, path: string): Promise<boolean> {
    const res = await postJson<{ found: boolean }>('/course/probe-cli', { cli: path });
    if (res.found) {
      setBinaryPath(cli, path);
      void runPreflight();
    }
    return res.found;
  }

  function approveTaskCommand(cli: string, verb: string, scope: 'global' | 'course') {
    approveCommand(activeLessonId, cli, verb, scope);
    void runPreflight();
  }

  // Course-start preflight (training-course.md design discussion, item #4): for every auto-completion task's
  // command-check, confirm the binary resolves and the verb has been granted the separate "server may
  // auto-run this" permission (commandApproval.ts) BEFORE the task is ever armed — never blocks entering the
  // course (per the explicit design decision), just informs the banner/approval panel of what's unresolved.
  async function runPreflight() {
    if (!lesson) return;
    const tasks = lesson.segments
      .filter((s): s is Extract<LessonSegment, { type: 'block' }> => s.type === 'block' && s.block.kind === 'task')
      .map((s) => s.block.data as LessonTaskData)
      .filter((t) => t.completion === 'auto' && t.check);
    const results = await Promise.all(
      tasks.map(async (task) => {
        const cliArr = taskCli(task);
        const cliBinary = cliArr[0] ?? 'kubectl';
        const verb = task.check?.verb ?? '';
        const override = getBinaryPath(cliBinary);
        const binaryFound = override ? true : (await postJson<{ found: boolean }>('/course/probe-cli', { cli: cliBinary }).catch(() => ({ found: false }))).found;
        const approved = isCommandApproved(activeLessonId, cliBinary, verb);
        if (binaryFound && approved) return null;
        const item: UnresolvedTaskCommand = { taskId: task.id, taskTitle: task.describe ?? task.id, cli: cliBinary, verb, binaryFound };
        return item;
      }),
    );
    setUnresolvedTasks(results.filter((r): r is UnresolvedTaskCommand => r !== null));
  }

  function toggleLayout() {
    setLayout((prev) => {
      const next = prev === 'row' ? 'column' : 'row';
      setStoredCourseLayout(next);
      return next;
    });
  }

  // Opens TerminalPopout.tsx (see main.tsx's ?popout=terminal branch) in a real separate window at the SAME
  // origin/bundle, rather than a portal into a blank window — that gets the popup the exact CSS/theme the
  // main window has for free. allow/cli come from the lesson itself (not `effectiveLesson`, which isn't
  // computed yet at this point in the function body — same override logic, just inlined).
  function popOutTerminal() {
    if (!lesson) return;
    const allow = lesson.frontmatter.allow ?? ['get'];
    const cli = cliOverride ? [cliOverride] : lesson.frontmatter.cli;
    const params = new URLSearchParams({ popout: 'terminal', allow: allow.join(',') });
    if (cli && cli.length > 0) params.set('cli', cli.join(','));
    if (lesson.frontmatter.confirmDelete === false) params.set('confirmDelete', '0');
    const popup = window.open(`${window.location.pathname}?${params.toString()}`, 'vpk-course-terminal', 'width=640,height=560');
    if (!popup) {
      pushToast("Pop-up blocked — allow pop-ups for this site to open a separate terminal window.");
      return;
    }
    terminalPopupRef.current = popup;
    setTerminalPoppedOut(true);
  }

  function bringTerminalBack() {
    terminalPopupRef.current?.close();
    terminalPopupRef.current = null;
    // Return to a 50/50 split of the pane (the student can then drag the divider to their liking) rather than
    // restoring whatever width the terminal had before it popped out — the pop-out gave the lesson the full
    // width, so coming back to an even split is the least surprising reset.
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      if (layout === 'row') {
        const max = Math.min(TERMINAL_MAX_WIDTH, rect.width - LESSON_MIN_WIDTH);
        setTerminalWidth(Math.max(TERMINAL_MIN_WIDTH, Math.min(max, Math.round(rect.width / 2))));
      } else {
        const max = Math.min(TERMINAL_MAX_HEIGHT, rect.height - LESSON_MIN_HEIGHT);
        setTerminalHeight(Math.max(TERMINAL_MIN_HEIGHT, Math.min(max, Math.round(rect.height / 2))));
      }
    }
    setTerminalPoppedOut(false);
  }

  // Polls rather than listening for a popup-side event — closing a window doesn't reliably fire anything
  // observable from the OPENER side (no 'close' event, and cross-window 'beforeunload' isn't guaranteed), so
  // `.closed` is the standard way to notice. Only runs while actually popped out.
  useEffect(() => {
    if (!terminalPoppedOut) return;
    const interval = setInterval(() => {
      if (terminalPopupRef.current?.closed) {
        terminalPopupRef.current = null;
        setTerminalPoppedOut(false);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [terminalPoppedOut]);

  // Closes the popup if the Course view itself unmounts (navigating away, clicking Stop) — otherwise the
  // terminal window is orphaned, still open but with no lesson left for "bring it back" to return it to.
  useEffect(() => {
    return () => terminalPopupRef.current?.close();
  }, []);

  const activeLessonId = lessonId ?? DEFAULT_LESSON_ID;

  // Forces every <details> (Hint/Step-by-step) open before printing when answers are wanted — relying on
  // CSS alone is unreliable here, since browsers disagree about whether a COLLAPSED <details> prints its
  // content at all. The no-answers case instead hides <details> entirely via the vpk-print-no-answers body
  // class (see index.css's @media print block), since there's nothing to force open in that case.
  function printCourse(includeAnswers: boolean) {
    setPrintModalOpen(false);
    const root = lessonScrollRef.current;
    const detailsEls = root ? Array.from(root.querySelectorAll('details')) : [];
    const originalOpen = detailsEls.map((d) => d.open);
    if (includeAnswers) detailsEls.forEach((d) => (d.open = true));
    document.body.classList.toggle('vpk-print-no-answers', !includeAnswers);
    const restore = () => {
      detailsEls.forEach((d, i) => (d.open = originalOpen[i] ?? false));
      document.body.classList.remove('vpk-print-no-answers');
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    // Deferred a tick so the DOM mutations above (details.open, body class) are painted before the browser
    // snapshots the page for print — calling window.print() synchronously right after them is sometimes too
    // early.
    setTimeout(() => window.print(), 50);
  }

  useEffect(() => {
    let cancelled = false;
    setLesson(null);
    setLoadError(null);
    setCatalogEmpty(null);
    setStartTime(null);
    setCheckStatuses({});
    setTaskRuntime({});
    setUnresolvedTasks([]);
    setBannerDismissed(false);
    Object.values(pollTimersRef.current).forEach(clearInterval);
    pollTimersRef.current = {};
    taskStartedAtRef.current = {};

    async function load() {
      if (!lessonId) {
        // Opened directly from the nav rail, not a Catalog selection — check the catalog before falling back
        // to the hardcoded DEFAULT_LESSON_ID, so a genuinely empty courses/ directory gets a graceful "add
        // content here" screen (with a still-usable terminal) instead of a raw 404 for a lesson id that was
        // never going to exist.
        try {
          const catalog = await getJson<{ lessons: unknown[]; coursesDir: string }>('/course/lessons');
          if (cancelled) return;
          if (catalog.lessons.length === 0) {
            setCatalogEmpty({ coursesDir: catalog.coursesDir });
            return;
          }
        } catch {
          // Catalog check itself failed — fall through to the normal lesson-load attempt/error below, so
          // whatever's actually wrong (server unreachable, etc.) still surfaces via loadError.
        }
      }
      try {
        const l = await getJson<ParsedLesson>(`/course/lesson?id=${encodeURIComponent(activeLessonId)}`);
        if (!cancelled) {
          setLesson(l);
          setStartTime(new Date());
          markCourseStarted(activeLessonId);
        }
      } catch (e: unknown) {
        if (!cancelled) setLoadError(String(e instanceof Error ? e.message : e));
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [activeLessonId, lessonId]);

  // Runs the preflight once the lesson has actually loaded (needs its task blocks/frontmatter) — separate
  // effect from the load effect above since `lesson` isn't set synchronously there.
  useEffect(() => {
    if (lesson) void runPreflight();
    // runPreflight closes over `lesson` itself; re-running on every state change it touches would just re-run
    // the same probes needlessly — only a genuinely new lesson should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  // Stops any in-flight background polling when the component unmounts (e.g. Stop button navigates away) —
  // without this, a poll interval armed on one lesson would keep firing /course/task-check requests after the
  // student has already left it.
  useEffect(() => {
    return () => {
      Object.values(pollTimersRef.current).forEach(clearInterval);
      pollTimersRef.current = {};
    };
  }, []);

  // The countdown clock ticks off wall time — a plain `setInterval` (not a check-poll cadence) is the
  // right primitive since it only drives a display, never anything server-side.
  useEffect(() => {
    if (!startTime) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const totalTasks = useMemo(() => (lesson ? lesson.segments.filter((s) => s.type === 'block' && s.block.kind === 'check').length : 0), [lesson]);
  const completedTasks = useMemo(() => Object.values(checkStatuses).filter((s) => s === 'pass').length, [checkStatuses]);

  // vpk-task blocks (Start/Complete lifecycle) are a SEPARATE progress concept from the totalTasks/
  // completedTasks pair above (which stays scoped to vpk-check blocks, unchanged, matching what
  // courseProgress.ts's Catalog badge already tracks) — surfaced only in the Progress modal, not merged into
  // the header's X/Y counter.
  const lessonTaskBlocks = useMemo(
    () =>
      lesson
        ? lesson.segments
            .filter((s): s is Extract<LessonSegment, { type: 'block' }> => s.type === 'block' && s.block.kind === 'task')
            .map((s) => s.block.data as LessonTaskData)
        : [],
    [lesson],
  );
  const taskProgressEntries: TaskProgressEntry[] = useMemo(
    () => lessonTaskBlocks.map((t) => ({ id: t.id, title: t.describe ?? t.id, status: taskRuntime[t.id] ?? 'idle' })),
    [lessonTaskBlocks, taskRuntime],
  );

  // Progress tracking (Catalog's status badge) — reacts to actual check results, not just "was this lesson
  // opened", so re-running a check that now fails correctly moves a course back out of 'completed'. Gated on
  // hasRunCheckRef so simply REOPENING an already-completed lesson doesn't blow its status away: checkStatuses
  // always starts empty on mount (nothing here remembers a PAST check run across a reload), so completedTasks
  // is transiently 0 until the student actually runs something — without this guard, that transient 0 would
  // race ahead of any real interaction and downgrade 'completed' straight back to 'in-progress (0/N)'.
  const hasRunCheckRef = useRef(false);
  useEffect(() => {
    hasRunCheckRef.current = false;
  }, [activeLessonId]);
  useEffect(() => {
    if (!lesson || !hasRunCheckRef.current) return;
    updateCourseProgress(activeLessonId, completedTasks, totalTasks);
  }, [activeLessonId, lesson, completedTasks, totalTasks]);
  const handleCheckStatus = useCallback((id: string, status: CheckStatus) => {
    // CheckCard fires this once on mount with status===undefined (nothing has run yet) — only a REAL
    // pass/fail/error/cancelled result counts as "the student actually did something" for the
    // hasRunCheckRef guard above.
    if (status !== undefined) hasRunCheckRef.current = true;
    setCheckStatuses((p) => (p[id] === status ? p : { ...p, [id]: status }));
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (layout === 'row') {
        const max = Math.min(TERMINAL_MAX_WIDTH, rect.width - LESSON_MIN_WIDTH);
        setTerminalWidth(Math.min(max, Math.max(TERMINAL_MIN_WIDTH, rect.right - e.clientX)));
      } else {
        const max = Math.min(TERMINAL_MAX_HEIGHT, rect.height - LESSON_MIN_HEIGHT);
        setTerminalHeight(Math.min(max, Math.max(TERMINAL_MIN_HEIGHT, rect.bottom - e.clientY)));
      }
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [layout]);

  function startResize() {
    draggingRef.current = true;
    document.body.style.cursor = layout === 'row' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  if (catalogEmpty) {
    return (
      <div className="flex h-full min-h-0 gap-4">
        <div className="flex w-72 shrink-0 flex-col justify-center gap-2 text-sm">
          <p className="font-medium" style={{ color: 'var(--vpk-fg)' }}>
            No courses yet
          </p>
          <p style={mutedStyle}>
            Add lesson markdown files under <code>{catalogEmpty.coursesDir}</code> and reopen this view to see them
            in the Catalog.
          </p>
          <p style={mutedStyle}>In the meantime, the terminal on the right still works on its own.</p>
        </div>
        <div className="min-h-0 flex-1">
          <TerminalPane allow={['get', 'describe', 'logs', 'explain', 'top', 'events']} theme={terminalTheme} fontSizePx={terminalFontSize} />
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <p className="text-sm" style={errorStyle}>
        {loadError}
      </p>
    );
  }
  if (!lesson) {
    return (
      <p className="text-sm" style={mutedStyle}>
        Loading lesson…
      </p>
    );
  }

  // Applies the Settings > Course CLI override (if any) uniformly to LessonPane (DetectCard/CheckCard) and
  // TerminalPane, by overriding it once on a shallow-copied lesson rather than threading a second `cli` prop
  // through every consumer — see courseSettings.ts's doc comment on why oc/kubectl swap is safe here.
  const effectiveLesson: ParsedLesson = cliOverride
    ? { ...lesson, frontmatter: { ...lesson.frontmatter, cli: [cliOverride] } }
    : lesson;

  return (
    <div className="flex flex-col h-full min-h-0">
      {startTime && now && (
        <CourseHeader
          title={lesson.frontmatter.title}
          startTime={startTime}
          now={now}
          estimatedMinutes={lesson.frontmatter.estimatedMinutes}
          showCountdown={lesson.frontmatter.showCountdown}
          totalTasks={totalTasks}
          completedTasks={completedTasks}
          hasTasks={lessonTaskBlocks.length > 0}
          onPrint={() => setPrintModalOpen(true)}
          onStop={onStop}
          onOpenProgress={() => setProgressModalOpen(true)}
        />
      )}
      {unresolvedTasks.length > 0 && !bannerDismissed && (
        <div
          className="border rounded px-3 py-2 flex items-center justify-between gap-2 text-xs mt-2 shrink-0 no-print"
          style={{ borderColor: 'var(--vpk-status-error)' }}
        >
          <span className="flex items-center gap-1.5" style={errorStyle}>
            <TriangleAlert size={13} />
            {unresolvedTasks.length} task{unresolvedTasks.length === 1 ? '' : 's'} can't auto-validate yet — full
            functionality isn't available.
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <button onClick={() => setApprovalPanelOpen(true)} className="rounded border px-2 py-1 cursor-pointer" style={panelStyle}>
              Configure
            </button>
            <button onClick={() => setBannerDismissed(true)} className="cursor-pointer" style={mutedStyle} title="Dismiss for now">
              <X size={14} />
            </button>
          </span>
        </div>
      )}
      <div ref={containerRef} className={`flex flex-1 min-h-0 mt-2 ${layout === 'column' ? 'flex-col' : ''}`}>
        <div ref={lessonScrollRef} className={`flex-1 overflow-auto ${layout === 'row' ? 'min-w-0 pr-1' : 'min-h-0'}`}>
          <LessonPane
            lesson={effectiveLesson}
            onCheckStatus={handleCheckStatus}
            taskRuntime={taskRuntime}
            onStartTask={startTask}
            onCompleteTask={completeTaskManually}
          />
        </div>
        {!terminalPoppedOut && (
          <div
            onMouseDown={startResize}
            role="separator"
            aria-orientation={layout === 'row' ? 'vertical' : 'horizontal'}
            title="Drag to resize"
            className={`shrink-0 group flex items-center justify-center no-print ${layout === 'row' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'}`}
          >
            <div
              className={layout === 'row' ? 'w-px h-full group-hover:w-0.5 transition-[width]' : 'h-px w-full group-hover:h-0.5 transition-[height]'}
              style={{ background: 'var(--vpk-border)' }}
            />
          </div>
        )}
        <div
          className="shrink-0 no-print"
          // Popped out, there's nothing to drag-resize (the terminal isn't rendering here at all) — a small
          // fixed footprint for the placeholder card instead of the full terminalWidth/terminalHeight is what
          // actually gives the lesson pane the extra room this feature is for.
          style={terminalPoppedOut ? (layout === 'row' ? { width: 210 } : { height: 64 }) : layout === 'row' ? { width: terminalWidth } : { height: terminalHeight }}
        >
          {terminalPoppedOut ? (
            <div
              className="h-full flex flex-col items-center justify-center gap-1.5 border rounded p-2 text-center"
              style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
            >
              <TerminalIcon size={14} />
              <span className="text-xs">Terminal is open in a separate window</span>
              <button
                onClick={bringTerminalBack}
                className="rounded border px-2 py-1 text-xs cursor-pointer"
                style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
              >
                Bring it back
              </button>
            </div>
          ) : (
            <TerminalPane
              allow={effectiveLesson.frontmatter.allow ?? ['get']}
              cli={effectiveLesson.frontmatter.cli}
              confirmDelete={effectiveLesson.frontmatter.confirmDelete}
              theme={terminalTheme}
              fontSizePx={terminalFontSize}
              layout={layout}
              onToggleLayout={toggleLayout}
              onPopOut={popOutTerminal}
            />
          )}
        </div>
      </div>
      {printModalOpen && <PrintCourseModal onClose={() => setPrintModalOpen(false)} onPrint={printCourse} />}
      {progressModalOpen && (
        <CourseProgressModal
          tasks={taskProgressEntries}
          onRepoll={(id) => {
            const task = lessonTaskBlocks.find((t) => t.id === id);
            if (task) repollTask(task);
          }}
          onClose={() => setProgressModalOpen(false)}
        />
      )}
      {approvalPanelOpen && (
        <TaskApprovalPanel items={unresolvedTasks} onClose={() => setApprovalPanelOpen(false)} onCheckPath={checkBinaryPath} onApprove={approveTaskCommand} />
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}

function CourseHeader({
  title,
  startTime,
  now,
  estimatedMinutes,
  showCountdown,
  totalTasks,
  completedTasks,
  hasTasks,
  onPrint,
  onStop,
  onOpenProgress,
}: {
  title: string;
  startTime: Date;
  now: Date;
  estimatedMinutes?: number;
  /** Author opt-out (frontmatter `showCountdown: false`) — defaults to true. */
  showCountdown?: boolean;
  totalTasks: number;
  completedTasks: number;
  hasTasks: boolean;
  onPrint: () => void;
  onStop?: () => void;
  onOpenProgress: () => void;
}) {
  const stopTime = estimatedMinutes !== undefined ? new Date(startTime.getTime() + estimatedMinutes * 60_000) : null;
  const remainingMs = stopTime && showCountdown !== false ? stopTime.getTime() - now.getTime() : null;
  const overtime = remainingMs !== null && remainingMs < 0;
  const timeFmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="border rounded shrink-0 no-print overflow-hidden" style={panelStyle}>
    <div className="px-3 py-2 flex items-center justify-between gap-4 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm truncate">{title}</span>
        <button
          onClick={onPrint}
          className="flex items-center gap-1 rounded border px-2 py-1 shrink-0 cursor-pointer"
          style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
          title="Print this course"
        >
          <Printer size={12} />
          Print
        </button>
        {hasTasks && (
          <button
            onClick={onOpenProgress}
            className="flex items-center gap-1 rounded border px-2 py-1 shrink-0 cursor-pointer"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
            title="See every task's status"
          >
            <ListChecks size={12} />
            Progress
          </button>
        )}
        {onStop && (
          <button
            onClick={onStop}
            className="flex items-center gap-1 rounded border px-2 py-1 shrink-0 cursor-pointer"
            style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}
            title="Stop/pause this course — progress is saved, resume anytime from the Catalog"
          >
            <Square size={11} />
            Stop
          </button>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0" style={mutedStyle}>
        <span>Start {startTime.toLocaleTimeString([], timeFmt)}</span>
        {stopTime && <span>Stop {stopTime.toLocaleTimeString([], timeFmt)}</span>}
        {remainingMs !== null && <FlipClock totalMs={Math.abs(remainingMs)} danger={overtime} label={overtime ? 'over' : 'left'} />}
      </div>
    </div>
    {totalTasks > 0 && (
      <div className="px-3 pb-2">
        <div style={{ height: 6, borderRadius: 99, background: 'var(--vpk-bg)', overflow: 'hidden', border: '1px solid var(--vpk-border)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--vpk-status-ok)', borderRadius: 99, transition: 'width 0.3s ease' }} />
        </div>
        <div className="mt-1" style={{ fontSize: 11, color: 'var(--vpk-fg-muted)' }}>
          {completedTasks} of {totalTasks} check{totalTasks === 1 ? '' : 's'} passed
        </div>
      </div>
    )}
    </div>
  );
}

/** With/without-answers choice before printing — deliberately its own tiny modal rather than a native
 *  confirm()/two-button pair, since "which of two named actions" reads more clearly as two labeled buttons
 *  in a dialog than as an OK/Cancel with the semantics baked into the message text. */
function PrintCourseModal({ onClose, onPrint }: { onClose: () => void; onPrint: (includeAnswers: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded border p-4 shadow-2xl" style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)' }}>
        <h2 className="mb-3 font-medium text-sm" style={{ color: 'var(--vpk-fg)' }}>
          Print course
        </h2>
        <p className="mb-4 text-xs" style={mutedStyle}>
          Hints and Step-by-step answers can be included or left out — useful for handing a printed copy to a
          student without giving the answers away.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onPrint(true)}
            className="rounded border px-3 py-2 text-xs cursor-pointer text-left"
            style={panelStyle}
          >
            Print with answers
          </button>
          <button
            onClick={() => onPrint(false)}
            className="rounded border px-3 py-2 text-xs cursor-pointer text-left"
            style={panelStyle}
          >
            Print without answers
          </button>
          <button onClick={onClose} className="rounded border px-3 py-2 text-xs cursor-pointer text-left" style={{ ...panelStyle, ...mutedStyle }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonPane({
  lesson,
  onCheckStatus,
  taskRuntime,
  onStartTask,
  onCompleteTask,
}: {
  lesson: ParsedLesson;
  onCheckStatus: (id: string, status: CheckStatus) => void;
  taskRuntime: Record<string, TaskRuntimeStatus>;
  onStartTask: (task: LessonTaskData) => void;
  onCompleteTask: (task: LessonTaskData) => void;
}) {
  const colors = lesson.frontmatter.colors;
  // Page background is an explicit inline style (only added when authored, so unstyled lessons render
  // exactly as before); code/answer are CSS custom properties consumed by .lesson-prose in index.css, with
  // var() fallbacks to the existing theme colors — the raw HTML from `marked` (pre/details) has no React
  // props to thread a color through directly, but it does inherit ancestor custom properties.
  const docStyle: Record<string, string> = {};
  if (colors?.page) docStyle.background = colors.page;
  if (colors?.code) docStyle['--lesson-code-bg'] = colors.code;
  if (colors?.answer) docStyle['--lesson-answer-bg'] = colors.answer;

  return (
    <div className={`space-y-5 pb-8 ${colors?.page ? 'p-3 rounded' : ''}`} style={docStyle}>
      <header>
        <h2 className="text-base font-semibold">{lesson.frontmatter.title}</h2>
        <div className="text-xs mt-1 flex gap-3" style={mutedStyle}>
          {lesson.frontmatter.difficulty !== undefined && <span>Difficulty {lesson.frontmatter.difficulty}</span>}
          {lesson.frontmatter.estimatedMinutes !== undefined && <span>~{lesson.frontmatter.estimatedMinutes} min</span>}
        </div>
      </header>
      {lesson.segments.map((segment, i) => (
        <LessonSegmentView
          key={i}
          segment={segment}
          lesson={lesson}
          onCheckStatus={onCheckStatus}
          taskRuntime={taskRuntime}
          onStartTask={onStartTask}
          onCompleteTask={onCompleteTask}
        />
      ))}
    </div>
  );
}

function LessonSegmentView({
  segment,
  lesson,
  onCheckStatus,
  taskRuntime,
  onStartTask,
  onCompleteTask,
}: {
  segment: LessonSegment;
  lesson: ParsedLesson;
  onCheckStatus: (id: string, status: CheckStatus) => void;
  taskRuntime: Record<string, TaskRuntimeStatus>;
  onStartTask: (task: LessonTaskData) => void;
  onCompleteTask: (task: LessonTaskData) => void;
}) {
  if (segment.type === 'prose') return <ProseBlock markdown={segment.markdown} questionBg={lesson.frontmatter.colors?.question} />;
  switch (segment.block.kind) {
    case 'detect':
      return <DetectCard cli={lesson.frontmatter.cli} />;
    case 'check':
      return <CheckCard block={segment.block} lesson={lesson} onStatusChange={onCheckStatus} />;
    case 'task': {
      const data = segment.block.data as LessonTaskData;
      return <TaskCard data={data} status={taskRuntime[data.id] ?? 'idle'} onStart={() => onStartTask(data)} onCompleteManual={() => onCompleteTask(data)} />;
    }
    case 'setup':
    case 'teardown':
    case 'quiz':
      return <PlaceholderCard kind={segment.block.kind} data={segment.block.data} />;
  }
}

function ProseBlock({ markdown, questionBg }: { markdown: string; questionBg?: string }) {
  // renderLessonHtml sanitizes the rendered HTML — see lessonMarkdown.ts for why lesson content is untrusted.
  const html = useMemo(() => renderLessonHtml(markdown), [markdown]);
  const style = questionBg ? { background: questionBg, padding: '0.5em 0.75em', borderRadius: 6 } : undefined;
  return <div className="lesson-prose text-sm" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Shared block-card grammar ────────────────────────────────────────────────────────────────────────────
// Every lesson block (environment readout, check, task) renders as one BlockCard: a colored left stripe + a
// type chip + a status pill, so a student reads WHAT a block is and WHERE it stands before reading a word.
// A "tone" is just a base theme color; the soft chip/pill background is derived from it with color-mix so it
// tracks every VpK theme (light/dark/solarized/etc.) instead of hard-coding a second palette per state.
interface CardTone {
  /** Solid color for the stripe + pill dot + chip/pill text. */
  base: string;
  /** Translucent-tinted fill for the chip and pill, derived from `base`. */
  soft: string;
}
function toneOf(base: string): CardTone {
  return { base, soft: `color-mix(in srgb, ${base} 14%, var(--vpk-surface))` };
}
const TONE_ENV = toneOf('var(--vpk-accent)');
const TONE_TASK = toneOf('var(--vpk-status-warn)');
const TONE_IDLE = toneOf('var(--vpk-status-unknown)');
const TONE_OK = toneOf('var(--vpk-status-ok)');
const TONE_ERR = toneOf('var(--vpk-status-error)');

function StatusPill({ label, tone }: { label: string; tone: CardTone }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold shrink-0"
      style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10.5, padding: '2px 9px', color: tone.base, background: tone.soft }}
    >
      <span className="rounded-full" style={{ width: 6, height: 6, background: tone.base }} />
      {label}
    </span>
  );
}

function CardButton({ onClick, children, variant = 'default' }: { onClick: () => void; children: ReactNode; variant?: 'default' | 'primary' }) {
  const style =
    variant === 'primary'
      ? { background: 'var(--vpk-accent)', color: 'var(--vpk-accent-fg)', border: '1px solid transparent' }
      : { background: 'var(--vpk-bg)', color: 'var(--vpk-fg)', border: '1px solid var(--vpk-border)' };
  return (
    <button
      onClick={onClick}
      className="shrink-0 cursor-pointer inline-flex items-center gap-1"
      style={{ fontSize: 12.5, fontWeight: 550, padding: '5px 11px', borderRadius: 7, whiteSpace: 'nowrap', ...style }}
    >
      {children}
    </button>
  );
}

/** The one card shell all lesson blocks route through — stripe (`tone.base`) + type chip + title + optional
 *  status pill + optional action, over an optional body separated by a hairline rule. `pillTone` defaults to
 *  the card tone so a Check whose stripe already encodes its result doesn't need to repeat the color. */
function BlockCard({
  chip,
  tone,
  title,
  pill,
  pillTone,
  action,
  children,
}: {
  chip: string;
  tone: CardTone;
  title: ReactNode;
  pill?: string;
  pillTone?: CardTone;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--vpk-surface)', border: '1px solid var(--vpk-border)', borderLeft: `3px solid ${tone.base}` }}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span
          className="uppercase font-semibold rounded shrink-0"
          style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, letterSpacing: '0.06em', padding: '2px 7px', color: tone.base, background: tone.soft }}
        >
          {chip}
        </span>
        <span className="font-medium flex-1 min-w-0" style={{ fontSize: 14, letterSpacing: '-0.005em' }}>
          {title}
        </span>
        {pill && <StatusPill label={pill} tone={pillTone ?? tone} />}
        {action}
      </div>
      {children && (
        <div className="px-3.5 pb-3 pt-2.5" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--vpk-fg-muted)', borderTop: '1px solid var(--vpk-border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** The first real consumer of a vpk-detect block's RUNTIME behavior — until now the block existed only as
 *  authored content with nothing reading it. Scoped to what /course/env actually returns (reachability,
 *  provisioner, node count, server version, multiNode capability); it does NOT probe for the specific
 *  binaries a lesson's `tools:` list names (minikube/k3d/microk8s aren't independently detectable server-side
 *  yet — see env.ts's own doc comment on why provisioner detection is context-name-based, not a live binary
 *  probe). The block's authored `tools` list is aspirational until that exists. */
function DetectCard({ cli }: { cli?: string[] }) {
  const [facts, setFacts] = useState<ClusterFacts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    postJson<ClusterFacts>('/course/env', { cli: cli?.join(' ') })
      .then((f) => {
        if (!cancelled) setFacts(f);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      cancelled = true;
    };
    // Mount-once — `cli` is fixed for the one lesson this page ever loads (no lesson switcher yet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pill = error ? 'Unreachable' : !facts ? 'Probing…' : facts.contextReachable ? 'Reachable' : 'Unreachable';
  const pillTone = error ? TONE_ERR : !facts ? TONE_IDLE : facts.contextReachable ? TONE_OK : TONE_ERR;
  const nodesGood = facts ? facts.nodes.ready === facts.nodes.total && facts.nodes.total > 0 : false;
  const okStyle = { color: 'var(--vpk-status-ok)', fontWeight: 600 } as const;

  return (
    <BlockCard chip="Environment" tone={TONE_ENV} title="Detected environment" pill={pill} pillTone={pillTone}>
      {error && <p style={errorStyle}>{error}</p>}
      {!facts && !error && (
        <p className="flex items-center gap-1.5" style={mutedStyle}>
          <Loader2 size={13} className="animate-spin" /> Probing the cluster…
        </p>
      )}
      {facts && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <dt style={{ color: 'var(--vpk-fg-muted)' }}>Context</dt>
          <dd className="m-0" style={{ color: 'var(--vpk-fg)' }}>{facts.contextReachable ? (facts.contextName ?? 'reachable') : 'not reachable'}</dd>
          <dt style={{ color: 'var(--vpk-fg-muted)' }}>Provisioner</dt>
          <dd className="m-0" style={{ color: 'var(--vpk-fg)' }}>{facts.provisioner ?? 'unknown'}</dd>
          <dt style={{ color: 'var(--vpk-fg-muted)' }}>Nodes</dt>
          <dd className="m-0" style={nodesGood ? okStyle : { color: 'var(--vpk-fg)' }}>
            {facts.nodes.ready}/{facts.nodes.total} Ready
          </dd>
          <dt style={{ color: 'var(--vpk-fg-muted)' }}>Server version</dt>
          <dd className="m-0" style={{ color: 'var(--vpk-fg)' }}>{facts.serverVersion ?? 'unknown'}</dd>
          <dt style={{ color: 'var(--vpk-fg-muted)' }}>Multi-node capable</dt>
          <dd className="m-0" style={facts.capabilities.multiNode ? okStyle : { color: 'var(--vpk-fg)' }}>
            {facts.capabilities.multiNode ? 'yes' : 'no — single node only'}
          </dd>
        </dl>
      )}
    </BlockCard>
  );
}

interface CheckBlockData {
  id?: string;
  describe?: string;
  hint?: string;
  [key: string]: unknown;
}

/** One vpk-check block, independently runnable. Lesson Zero's two check blocks (nodes ready, then context
 *  reachable) are modeled as two SEPARATE, ungated cards on purpose — there's no explicit "step" boundary
 *  construct in the lesson format yet (flagged in the Lesson Zero content commit as an open question for the
 *  step-runner), so each check block simply gets its own card rather than the UI inventing a grouping the
 *  format doesn't express. */
function CheckCard({ block, lesson, onStatusChange }: { block: LessonBlock; lesson: ParsedLesson; onStatusChange: (id: string, status: CheckStatus) => void }) {
  const data = block.data as CheckBlockData;
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<CheckStreamEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const latest = events.length > 0 ? events[events.length - 1] : undefined;
  const latestResult = latest && latest.type !== 'error' && latest.type !== 'cancelled' ? latest.result : undefined;
  const status: CheckStatus = latest?.type === 'error' ? 'error' : latest?.type === 'cancelled' ? 'cancelled' : latestResult?.status;

  useEffect(() => {
    if (data.id) onStatusChange(data.id, status);
    // onStatusChange is a stable useCallback from the parent — depending on it would be redundant, and the
    // parent dedupes no-op updates anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data.id]);

  async function run() {
    setRunning(true);
    setEvents([]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/course/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          checks: [data],
          policy: { strictness: lesson.frontmatter.floor ?? 'loose', passWhen: lesson.frontmatter.passWhen ?? 'functional', floor: lesson.frontmatter.floor ?? 'loose' },
          timeoutMs: lesson.frontmatter.timeoutMs,
          pollMs: lesson.frontmatter.pollMs,
          cli: lesson.frontmatter.cli?.join(' '),
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('no response stream');
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          setEvents((p) => [...p, JSON.parse(line) as CheckStreamEvent]);
        }
      }
    } catch (e: unknown) {
      // An intentional Cancel click aborts the fetch, which surfaces here as a generic stream-reader
      // exception ("BodyStreamBuffer was aborted") rather than anything naming the cancellation — check the
      // controller's own signal to tell "the student cancelled this" apart from a genuine error, and report
      // the former as 'cancelled' rather than a scary raw exception string.
      if (controller.signal.aborted) setEvents((p) => [...p, { type: 'cancelled' }]);
      else setEvents((p) => [...p, { type: 'error', error: String(e instanceof Error ? e.message : e) }]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function cancel() {
    void fetch('/course/check/cancel', { method: 'POST' });
    abortRef.current?.abort();
  }

  // Stripe + pill both encode the check's result (grey when not run, green pass, red fail/error) so state
  // reads across the room; "Running…" borrows the accent so an in-flight check is visibly distinct from idle.
  const { tone, pillLabel } =
    status === 'pass'
      ? { tone: TONE_OK, pillLabel: 'Passed' }
      : status === 'fail'
        ? { tone: TONE_ERR, pillLabel: 'Failed' }
        : status === 'error'
          ? { tone: TONE_ERR, pillLabel: 'Error' }
          : status === 'cancelled'
            ? { tone: TONE_IDLE, pillLabel: 'Cancelled' }
            : running
              ? { tone: TONE_ENV, pillLabel: 'Running…' }
              : { tone: TONE_IDLE, pillLabel: 'Not run' };

  const action = running ? (
    <CardButton onClick={cancel}>Cancel</CardButton>
  ) : (
    <CardButton onClick={() => void run()} variant={status ? 'default' : 'primary'}>
      {status ? 'Run again' : 'Run check'}
    </CardButton>
  );

  const hasBody = Boolean(latestResult || latest?.type === 'error' || latest?.type === 'cancelled' || (data.hint && !status));

  return (
    <BlockCard chip="Check" tone={tone} title={data.describe ?? 'Check'} pill={pillLabel} action={action}>
      {hasBody && (
        <div className="space-y-1.5">
          {latestResult && (
            <>
              <div>
                {latestResult.checks[0]?.summary} — {latestResult.level}
              </div>
              {latestResult.feedback.map((f, i) => (
                <div key={i} className="flex gap-2" style={f.severity === 'blocker' ? errorStyle : undefined}>
                  <span
                    className="rounded-full shrink-0"
                    style={{ width: 6, height: 6, marginTop: 6, background: f.severity === 'blocker' ? 'var(--vpk-status-error)' : 'var(--vpk-status-unknown)' }}
                  />
                  <span>{f.message}</span>
                </div>
              ))}
            </>
          )}
          {latest?.type === 'error' && <p style={errorStyle}>{latest.error}</p>}
          {latest?.type === 'cancelled' && <p>Cancelled.</p>}
          {data.hint && !status && (
            <p className="italic" style={{ color: 'var(--vpk-fg-muted)' }}>
              {data.hint}
            </p>
          )}
        </div>
      )}
    </BlockCard>
  );
}

/** One vpk-task block — a completable unit with a Start/Complete lifecycle, additive alongside vpk-check's
 *  existing single "Run check" button (which is untouched by this). `completion: 'manual'` gets Start +
 *  Complete, where Complete is self-attested (an attached `check`, if any, is evaluated on demand elsewhere —
 *  see LessonRunnerView's task-runtime section — but never gates this button). `completion: 'auto'` gets just
 *  Start, which arms LessonRunnerView's background polling; this component itself owns no fetch/poll logic at
 *  all — it's purely a view onto the `status` its parent already computed, so the Course Progress modal and
 *  this card can never disagree about a task's state. */
function TaskCard({
  data,
  status,
  onStart,
  onCompleteManual,
}: {
  data: LessonTaskData;
  status: TaskRuntimeStatus;
  onStart: () => void;
  onCompleteManual: () => void;
}) {
  // The stripe stays the Task type-color (violet-ish warn) regardless of state — a task is always a task; the
  // PILL carries where it stands. Only 'complete' flips the stripe green as a done affordance.
  const stripeTone = status === 'complete' ? TONE_OK : TONE_TASK;
  const { pillLabel, pillTone } =
    status === 'complete'
      ? { pillLabel: 'Complete', pillTone: TONE_OK }
      : status === 'polling'
        ? { pillLabel: 'Checking…', pillTone: TONE_TASK }
        : status === 'timed-out'
          ? { pillLabel: 'Paused', pillTone: TONE_ERR }
          : status === 'in-progress'
            ? { pillLabel: 'In progress', pillTone: TONE_TASK }
            : { pillLabel: 'Ready', pillTone: TONE_IDLE };

  const action =
    status === 'idle' ? (
      <CardButton onClick={onStart} variant="primary">
        <Play size={12} />
        Start
      </CardButton>
    ) : status === 'in-progress' ? (
      <CardButton onClick={onCompleteManual}>
        <CheckCircle2 size={12} />
        Complete
      </CardButton>
    ) : undefined;

  const bodyText =
    status === 'polling'
      ? 'Checking in the background — this completes on its own once the command passes.'
      : status === 'timed-out'
        ? 'Taking longer than expected — open Progress to re-check when ready.'
        : data.hint && status === 'idle'
          ? data.hint
          : undefined;

  return (
    <BlockCard chip="Task" tone={stripeTone} title={data.describe ?? data.id} pill={pillLabel} pillTone={pillTone} action={action}>
      {bodyText && (
        <p className={status === 'idle' ? 'italic' : undefined} style={status === 'timed-out' ? errorStyle : undefined}>
          {bodyText}
        </p>
      )}
    </BlockCard>
  );
}

/** vpk-setup/teardown/quiz blocks aren't automated yet (§12's fixture/lifecycle manager and §11's quiz engine
 *  are later slices) — Lesson Zero has none of these, so this never renders today, but a future lesson that
 *  DOES use one should degrade to a clearly-labeled placeholder rather than silently vanishing. */
function PlaceholderCard({ kind, data }: { kind: LessonBlockKind; data: unknown }) {
  const label = kind === 'setup' ? 'Setup' : kind === 'teardown' ? 'Teardown' : 'Quiz';
  return (
    <BlockCard chip={label} tone={TONE_IDLE} title="Not yet automated" pill="Pending" pillTone={TONE_IDLE}>
      <pre className="overflow-auto m-0" style={{ fontSize: 12 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </BlockCard>
  );
}
