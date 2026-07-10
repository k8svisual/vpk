import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { marked } from 'marked';
import { CheckCircle2, CircleAlert, Loader2, Moon, Sun, Terminal as TerminalIcon, XCircle } from 'lucide-react';

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

// No lesson catalog/picker UI yet (§13's GET /course/lessons exists server-side but nothing consumes it) —
// this is the one lesson that exists, hardcoded until that's built.
const LESSON_ID = 'getting-started-00-cluster';

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

export function LessonRunnerView() {
  const [lesson, setLesson] = useState<ParsedLesson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<ParsedLesson>(`/course/lesson?id=${encodeURIComponent(LESSON_ID)}`)
      .then((l) => {
        if (!cancelled) setLesson(l);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto pr-1">
        <LessonPane lesson={lesson} />
      </div>
      <div className="w-[420px] shrink-0">
        <TerminalPane allow={lesson.frontmatter.allow ?? ['get']} cli={lesson.frontmatter.cli} />
      </div>
    </div>
  );
}

function LessonPane({ lesson }: { lesson: ParsedLesson }) {
  return (
    <div className="max-w-2xl space-y-4 pb-8">
      <header>
        <h2 className="text-base font-semibold">{lesson.frontmatter.title}</h2>
        <div className="text-xs mt-1 flex gap-3" style={mutedStyle}>
          {lesson.frontmatter.difficulty !== undefined && <span>Difficulty {lesson.frontmatter.difficulty}</span>}
          {lesson.frontmatter.estimatedMinutes !== undefined && <span>~{lesson.frontmatter.estimatedMinutes} min</span>}
        </div>
      </header>
      {lesson.segments.map((segment, i) => (
        <LessonSegmentView key={i} segment={segment} lesson={lesson} />
      ))}
    </div>
  );
}

function LessonSegmentView({ segment, lesson }: { segment: LessonSegment; lesson: ParsedLesson }) {
  if (segment.type === 'prose') return <ProseBlock markdown={segment.markdown} />;
  switch (segment.block.kind) {
    case 'detect':
      return <DetectCard cli={lesson.frontmatter.cli} />;
    case 'check':
      return <CheckCard block={segment.block} lesson={lesson} />;
    case 'setup':
    case 'teardown':
    case 'quiz':
      return <PlaceholderCard kind={segment.block.kind} data={segment.block.data} />;
  }
}

function ProseBlock({ markdown }: { markdown: string }) {
  const html = useMemo(() => marked.parse(markdown, { async: false }) as string, [markdown]);
  // Lesson content is authored/reviewed repo content, never student input — marked's default renderer
  // doesn't execute embedded scripts either way.
  return <div className="lesson-prose text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
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
function CheckCard({ block, lesson }: { block: LessonBlock; lesson: ParsedLesson }) {
  const data = block.data as CheckBlockData;
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<CheckStreamEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const latest = events.length > 0 ? events[events.length - 1] : undefined;
  const latestResult = latest && latest.type !== 'error' && latest.type !== 'cancelled' ? latest.result : undefined;

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

  const status = latest?.type === 'error' ? 'error' : latest?.type === 'cancelled' ? 'cancelled' : latestResult?.status;
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

type TerminalTheme = 'dark' | 'light';

const TERMINAL_COLORS: Record<TerminalTheme, { bg: string; fg: string; border: string; mutedFg: string; inputBg: string }> = {
  dark: { bg: '#000000', fg: '#f5f5f5', border: '#333333', mutedFg: '#9a9a9a', inputBg: '#111111' },
  light: { bg: '#ffffff', fg: '#111111', border: '#cccccc', mutedFg: '#555555', inputBg: '#f2f2f2' },
};

const CLEAR_COMMANDS = new Set(['clear', 'cls']);

function TerminalPane({ allow, cli }: { allow: string[]; cli?: string[] }) {
  const cliName = cli?.[0] ?? 'kubectl';
  const [line, setLine] = useState(`${cliName} get nodes`);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [theme, setTheme] = useState<TerminalTheme>('dark');
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
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={theme === 'dark' ? 'Switch to light terminal' : 'Switch to dark terminal'}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg }}
        >
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
      <p className="px-3 pt-2 text-xs" style={{ color: colors.mutedFg }}>
        Runs <code>{cliName}</code> only — allowed here: {allow.join(', ')}. For minikube/k3d/other cluster
        tools, use your own system terminal. ↑/↓ recall previous commands, <code>clear</code>/<code>cls</code>{' '}
        wipes the screen.
      </p>
      <div className="flex gap-2 p-2 border-b" style={{ borderColor: colors.border }}>
        <input
          value={line}
          onChange={(e) => {
            setHistoryIndex(null);
            setLine(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 text-xs px-2 py-1 rounded border font-mono"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg }}
        />
        <button
          onClick={() => void run()}
          disabled={running}
          className="text-xs px-2 py-1 rounded border cursor-pointer disabled:cursor-not-allowed"
          style={{ borderColor: colors.border, background: colors.inputBg, color: colors.fg }}
        >
          {running ? '…' : 'Run'}
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2 space-y-3 text-xs font-mono min-h-0">
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
                  <pre className="whitespace-pre-wrap" style={errorStyle}>
                    {entry.result.stderr}
                  </pre>
                )}
              </>
            )}
            {entry.error && (
              <pre className="whitespace-pre-wrap" style={errorStyle}>
                {entry.error}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
