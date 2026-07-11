import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { marked } from 'marked';
import { CheckCircle2, CircleAlert, Loader2, PanelBottom, PanelRight, Printer, Square, Terminal as TerminalIcon, XCircle } from 'lucide-react';
import { FlipClock } from './FlipClock';
import { initialCourseLayout, setStoredCourseLayout, type CourseLayout, type TerminalTheme } from './courseSettings';
import { markCourseStarted, updateCourseProgress } from './courseProgress';

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
}
type LessonBlockKind = 'detect' | 'setup' | 'check' | 'teardown' | 'quiz';
interface LessonBlock {
  kind: LessonBlockKind;
  data: unknown;
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
interface CommandResult {
  argv: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
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
  const [terminalWidth, setTerminalWidth] = useState(420);
  const [terminalHeight, setTerminalHeight] = useState(360);
  const [layout, setLayout] = useState<CourseLayout>(initialCourseLayout);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [checkStatuses, setCheckStatuses] = useState<Record<string, CheckStatus>>({});
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lessonScrollRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function toggleLayout() {
    setLayout((prev) => {
      const next = prev === 'row' ? 'column' : 'row';
      setStoredCourseLayout(next);
      return next;
    });
  }
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
    setStartTime(null);
    setCheckStatuses({});
    getJson<ParsedLesson>(`/course/lesson?id=${encodeURIComponent(activeLessonId)}`)
      .then((l) => {
        if (!cancelled) {
          setLesson(l);
          setStartTime(new Date());
          markCourseStarted(activeLessonId);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      cancelled = true;
    };
  }, [activeLessonId]);

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
          onPrint={() => setPrintModalOpen(true)}
          onStop={onStop}
        />
      )}
      <div ref={containerRef} className={`flex flex-1 min-h-0 mt-2 ${layout === 'column' ? 'flex-col' : ''}`}>
        <div ref={lessonScrollRef} className={`flex-1 overflow-auto ${layout === 'row' ? 'min-w-0 pr-1' : 'min-h-0'}`}>
          <LessonPane lesson={effectiveLesson} onCheckStatus={handleCheckStatus} />
        </div>
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
        <div className="shrink-0 no-print" style={layout === 'row' ? { width: terminalWidth } : { height: terminalHeight }}>
          <TerminalPane
            allow={effectiveLesson.frontmatter.allow ?? ['get']}
            cli={effectiveLesson.frontmatter.cli}
            theme={terminalTheme}
            fontSizePx={terminalFontSize}
            layout={layout}
            onToggleLayout={toggleLayout}
          />
        </div>
      </div>
      {printModalOpen && <PrintCourseModal onClose={() => setPrintModalOpen(false)} onPrint={printCourse} />}
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
  onPrint,
  onStop,
}: {
  title: string;
  startTime: Date;
  now: Date;
  estimatedMinutes?: number;
  /** Author opt-out (frontmatter `showCountdown: false`) — defaults to true. */
  showCountdown?: boolean;
  totalTasks: number;
  completedTasks: number;
  onPrint: () => void;
  onStop?: () => void;
}) {
  const stopTime = estimatedMinutes !== undefined ? new Date(startTime.getTime() + estimatedMinutes * 60_000) : null;
  const remainingMs = stopTime && showCountdown !== false ? stopTime.getTime() - now.getTime() : null;
  const overtime = remainingMs !== null && remainingMs < 0;
  const timeFmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

  return (
    <div className="border rounded px-3 py-2 flex items-center justify-between gap-4 text-xs shrink-0 no-print" style={panelStyle}>
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
        {totalTasks > 0 && (
          <span>
            {completedTasks}/{totalTasks} tasks
          </span>
        )}
      </div>
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

function LessonPane({ lesson, onCheckStatus }: { lesson: ParsedLesson; onCheckStatus: (id: string, status: CheckStatus) => void }) {
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
    <div className={`max-w-2xl space-y-4 pb-8 ${colors?.page ? 'p-3 rounded' : ''}`} style={docStyle}>
      <header>
        <h2 className="text-base font-semibold">{lesson.frontmatter.title}</h2>
        <div className="text-xs mt-1 flex gap-3" style={mutedStyle}>
          {lesson.frontmatter.difficulty !== undefined && <span>Difficulty {lesson.frontmatter.difficulty}</span>}
          {lesson.frontmatter.estimatedMinutes !== undefined && <span>~{lesson.frontmatter.estimatedMinutes} min</span>}
        </div>
      </header>
      {lesson.segments.map((segment, i) => (
        <LessonSegmentView key={i} segment={segment} lesson={lesson} onCheckStatus={onCheckStatus} />
      ))}
    </div>
  );
}

function LessonSegmentView({
  segment,
  lesson,
  onCheckStatus,
}: {
  segment: LessonSegment;
  lesson: ParsedLesson;
  onCheckStatus: (id: string, status: CheckStatus) => void;
}) {
  if (segment.type === 'prose') return <ProseBlock markdown={segment.markdown} questionBg={lesson.frontmatter.colors?.question} />;
  switch (segment.block.kind) {
    case 'detect':
      return <DetectCard cli={lesson.frontmatter.cli} />;
    case 'check':
      return <CheckCard block={segment.block} lesson={lesson} onStatusChange={onCheckStatus} />;
    case 'setup':
    case 'teardown':
    case 'quiz':
      return <PlaceholderCard kind={segment.block.kind} data={segment.block.data} />;
  }
}

function ProseBlock({ markdown, questionBg }: { markdown: string; questionBg?: string }) {
  const html = useMemo(() => marked.parse(markdown, { async: false }) as string, [markdown]);
  const style = questionBg ? { background: questionBg, padding: '0.5em 0.75em', borderRadius: 6 } : undefined;
  // Lesson content is authored/reviewed repo content, never student input — marked's default renderer
  // doesn't execute embedded scripts either way.
  return <div className="lesson-prose text-sm" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
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

  return (
    <div className="border rounded p-3 text-sm" style={panelStyle}>
      <div className="font-medium mb-1">Detected environment</div>
      {error && (
        <p className="text-xs" style={errorStyle}>
          {error}
        </p>
      )}
      {!facts && !error && (
        <p className="text-xs flex items-center gap-1" style={mutedStyle}>
          <Loader2 size={12} className="animate-spin" /> Probing…
        </p>
      )}
      {facts && (
        <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5" style={mutedStyle}>
          <dt>Context</dt>
          <dd>{facts.contextReachable ? (facts.contextName ?? 'reachable') : 'not reachable'}</dd>
          <dt>Provisioner</dt>
          <dd>{facts.provisioner ?? 'unknown'}</dd>
          <dt>Nodes</dt>
          <dd>
            {facts.nodes.ready}/{facts.nodes.total} Ready
          </dd>
          <dt>Server version</dt>
          <dd>{facts.serverVersion ?? 'unknown'}</dd>
          <dt>Multi-node capable</dt>
          <dd>{facts.capabilities.multiNode ? 'yes' : 'no — single node only'}</dd>
        </dl>
      )}
    </div>
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

  const icon =
    status === 'pass' ? (
      <CheckCircle2 size={15} style={{ color: 'var(--vpk-status-ok)' }} />
    ) : status === 'fail' ? (
      <XCircle size={15} style={errorStyle} />
    ) : status === 'error' ? (
      <CircleAlert size={15} style={errorStyle} />
    ) : running ? (
      <Loader2 size={15} className="animate-spin" style={mutedStyle} />
    ) : null;

  return (
    <div className="border rounded p-3 text-sm" style={panelStyle}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{data.describe ?? 'Check'}</span>
        </div>
        {running ? (
          <button onClick={cancel} className="text-xs px-2 py-1 rounded border cursor-pointer" style={panelStyle}>
            Cancel
          </button>
        ) : (
          <button onClick={() => void run()} className="text-xs px-2 py-1 rounded border cursor-pointer" style={panelStyle}>
            {status ? 'Run again' : 'Run check'}
          </button>
        )}
      </div>
      {latestResult && (
        <div className="text-xs mt-2 space-y-1">
          <div style={mutedStyle}>
            {latestResult.checks[0]?.summary} — {latestResult.level}
          </div>
          {latestResult.feedback.map((f, i) => (
            <div key={i} style={f.severity === 'blocker' ? errorStyle : mutedStyle}>
              {f.message}
            </div>
          ))}
        </div>
      )}
      {latest?.type === 'error' && (
        <p className="text-xs mt-2" style={errorStyle}>
          {latest.error}
        </p>
      )}
      {latest?.type === 'cancelled' && (
        <p className="text-xs mt-2" style={mutedStyle}>
          Cancelled.
        </p>
      )}
      {data.hint && !status && (
        <p className="text-xs mt-2 italic" style={mutedStyle}>
          {data.hint}
        </p>
      )}
    </div>
  );
}

/** vpk-setup/teardown/quiz blocks aren't automated yet (§12's fixture/lifecycle manager and §11's quiz engine
 *  are later slices) — Lesson Zero has none of these, so this never renders today, but a future lesson that
 *  DOES use one should degrade to a clearly-labeled placeholder rather than silently vanishing. */
function PlaceholderCard({ kind, data }: { kind: LessonBlockKind; data: unknown }) {
  const label = kind === 'setup' ? 'Setup' : kind === 'teardown' ? 'Teardown' : 'Quiz';
  return (
    <div className="border rounded p-3 text-xs" style={{ ...panelStyle, ...mutedStyle }}>
      <div className="font-medium mb-1">
        {label} <span className="italic">(not yet automated)</span>
      </div>
      <pre className="overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

interface HistoryEntry {
  line: string;
  result?: CommandResult;
  error?: string;
}

const TERMINAL_COLORS: Record<TerminalTheme, { bg: string; fg: string; border: string; mutedFg: string; inputBg: string; buttonBg: string; errorFg: string }> = {
  // var(--vpk-status-error) is tuned for the app's light surfaces — too dark to read on pure black, so the
  // terminal gets its own brighter red independent of the app-wide error color.
  dark: { bg: '#000000', fg: '#f5f5f5', border: '#6b6b6b', mutedFg: '#9a9a9a', inputBg: '#454545', buttonBg: '#6e6e6e', errorFg: '#ff6b6b' },
  light: { bg: '#ffffff', fg: '#111111', border: '#cccccc', mutedFg: '#555555', inputBg: '#f2f2f2', buttonBg: '#e2e2e2', errorFg: 'var(--vpk-status-error)' },
};

const CLEAR_COMMANDS = new Set(['clear', 'cls']);

function TerminalPane({
  allow,
  cli,
  theme,
  fontSizePx,
  layout,
  onToggleLayout,
}: {
  allow: string[];
  cli?: string[];
  theme: TerminalTheme;
  fontSizePx: number;
  layout: CourseLayout;
  onToggleLayout: () => void;
}) {
  const cliName = cli?.[0] ?? 'kubectl';
  const [line, setLine] = useState(`${cliName} get nodes`);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  // Shell-style Up/Down recall over PAST TYPED COMMANDS — kept in its own log, separate from `history` (the
  // visible transcript), so `clear`/`cls` can wipe the screen without erasing recall, matching real shells.
  // null = not currently browsing (the input holds whatever the student is actively typing); draftRef
  // preserves that in-progress text so pressing Down back past the oldest browsed entry restores it.
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const draftRef = useRef('');
  const colors = TERMINAL_COLORS[theme];

  async function run() {
    const cmd = line.trim();
    if (!cmd) return;
    setHistoryIndex(null);
    setCommandLog((p) => [...p, cmd]);
    if (CLEAR_COMMANDS.has(cmd.toLowerCase())) {
      setHistory([]);
      setLine('');
      return;
    }
    setRunning(true);
    try {
      const result = await postJson<CommandResult>('/course/command', { line: cmd, allow, cli: cli?.join(' ') });
      setHistory((p) => [...p, { line: cmd, result }]);
    } catch (e: unknown) {
      setHistory((p) => [...p, { line: cmd, error: String(e instanceof Error ? e.message : e) }]);
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void run();
      return;
    }
    if (e.key === 'ArrowUp') {
      if (commandLog.length === 0) return;
      e.preventDefault();
      if (historyIndex === null) {
        draftRef.current = line;
        setHistoryIndex(commandLog.length - 1);
        setLine(commandLog[commandLog.length - 1] ?? '');
      } else if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setLine(commandLog[historyIndex - 1] ?? '');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      if (historyIndex === null) return;
      e.preventDefault();
      if (historyIndex < commandLog.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setLine(commandLog[historyIndex + 1] ?? '');
      } else {
        setHistoryIndex(null);
        setLine(draftRef.current);
      }
    }
  }

  return (
    <div className="border rounded flex flex-col h-full" style={{ borderColor: colors.border, background: colors.bg, color: colors.fg }}>
      <div className="px-3 py-2 border-b flex items-center justify-between gap-1.5 text-xs font-medium" style={{ borderColor: colors.border }}>
        <span className="flex items-center gap-1.5">
          <TerminalIcon size={13} />
          Terminal
        </span>
        <button
          onClick={onToggleLayout}
          className="flex items-center gap-1 rounded border px-2 py-1 cursor-pointer"
          style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
          title={layout === 'row' ? 'Move course content above the terminal (wider terminal)' : 'Move course content back beside the terminal'}
        >
          {layout === 'row' ? <PanelBottom size={12} /> : <PanelRight size={12} />}
          {layout === 'row' ? 'Stack' : 'Side-by-side'}
        </button>
      </div>
      <p className="px-3 pt-2 text-xs" style={{ color: colors.mutedFg }}>
        Runs <code>{cliName}</code> only — allowed here: {allow.join(', ')}. For minikube/k3d/other cluster
        tools, use your own system terminal. ↑/↓ recall previous commands, <code>clear</code>/<code>cls</code>{' '}
        wipes the screen. Appearance, font size, and CLI are in Settings &gt; Education.
      </p>
      <div className="flex gap-2 p-2 border-b" style={{ borderColor: colors.border }}>
        <input
          value={line}
          onChange={(e) => {
            setHistoryIndex(null);
            setLine(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 rounded border font-mono"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg, fontSize: fontSizePx }}
        />
        <button
          onClick={() => void run()}
          disabled={running}
          className="text-xs px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed"
          style={{ borderColor: colors.border, background: colors.buttonBg, color: colors.fg }}
        >
          {running ? '…' : 'Run'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2 space-y-3 font-mono min-h-0" style={{ fontSize: fontSizePx }}>
        {[...history].reverse().map((entry, i) => (
          <div key={history.length - 1 - i}>
            <div className="font-semibold">$ {entry.line}</div>
            {entry.result && (
              <>
                <div style={{ color: colors.mutedFg }}>
                  exit {entry.result.exitCode ?? 'aborted'} ({entry.result.durationMs}ms)
                </div>
                {entry.result.stdout && <pre className="whitespace-pre-wrap">{entry.result.stdout}</pre>}
                {entry.result.stderr && (
                  <pre className="whitespace-pre-wrap" style={{ color: colors.errorFg }}>
                    {entry.result.stderr}
                  </pre>
                )}
              </>
            )}
            {entry.error && (
              <pre className="whitespace-pre-wrap" style={{ color: colors.errorFg }}>
                {entry.error}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
