import { parse as parseYaml } from 'yaml';
import type { CommandExpect, Strictness } from './types';

/**
 * Lesson content format (redesign/training-course.md §6): markdown frontmatter + a handful of typed fenced
 * blocks (` ```vpk-detect/setup/check/teardown/quiz `), everything else plain prose. This module ONLY parses
 * structure — it extracts the frontmatter and each block's raw YAML into `unknown` data, but does NOT
 * validate that a `vpk-check` block's data is a well-formed Check, or resolve a `vpk-setup` block's fixture
 * path. Callers (the future lesson-engine step runner) own that validation, keeping this module a simple,
 * honest markdown->structure step — the same "small, focused module" shape as paths.ts/selectors.ts.
 */

export interface LessonFrontmatter {
  id: string;
  title: string;
  difficulty?: number;
  prereqs?: string[];
  estimatedMinutes?: number;
  timeMode?: 'advisory' | 'graded' | 'exam';
  sandbox?: string;
  answerKey?: string;
  passWhen?: 'functional' | 'conformant';
  floor?: Strictness;
  allow?: string[];
  /** True for a provisioning lesson (§9) — no student namespace exists yet, `sandbox` is meaningless. */
  provisioning?: boolean;
  /** How long a check keeps polling before giving up — maps straight onto RunStepLiveOptions.timeoutMs/
   *  pollMs. Most lessons don't need this (an instant, single-shot evaluation is the default everywhere in
   *  the check engine); a provisioning lesson waiting on `minikube start` to bring nodes up is the case that
   *  does. Milliseconds, matching RunStepLiveOptions — not a duration string, to avoid a second parser. */
  timeoutMs?: number;
  pollMs?: number;
  /** Which kubectl-compatible CLI this lesson's checks/commands target, as argv — e.g. `[kubectl]` (default,
   *  if omitted) or `[oc]`. Maps straight onto the existing per-request `cli` override already accepted by
   *  /course/check, /course/command, and /course/env (the same override capture/cliSource.ts's routes have
   *  always had) — a lesson just needs to STATE which CLI it was authored against, since some content is
   *  genuinely CLI-specific (OpenShift concepts like Route/Project/DeploymentConfig have no kubectl
   *  equivalent to fall back to). Two lessons covering the same topic for kubectl vs OpenShift are authored
   *  as separate lesson files with different `cli`, not one file branching on it. */
  cli?: string[];
  /** Optional per-lesson color overrides — any valid CSS color (hex, rgb(), var(), etc.), applied by the web
   *  renderer as CSS custom properties/inline backgrounds. All slots optional; an omitted slot falls back to
   *  the app's default theme. `page` colors the whole document background, `question` the prose/task text,
   *  `code` fenced example-code blocks, `answer` the Hint/Step-by-step `<details>` disclosures. Purely a
   *  presentation hint — this module doesn't validate the values are real colors, same as it doesn't
   *  validate any other frontmatter field (see module doc comment). */
  colors?: {
    page?: string;
    question?: string;
    code?: string;
    answer?: string;
  };
  /** Author opt-out for the Course view header's countdown clock — defaults to true (shown whenever
   *  estimatedMinutes is set). Set false to keep the time budget documented for planning purposes without
   *  putting a visibly ticking clock in front of the student. */
  showCountdown?: boolean;
}

export type LessonBlockKind = 'detect' | 'setup' | 'check' | 'teardown' | 'quiz' | 'task';

export interface LessonBlock {
  kind: LessonBlockKind;
  /** The block's fenced content, parsed as YAML. Shape depends on `kind` — validated by the caller, not
   *  here (see module doc comment). */
  data: unknown;
}

export type TaskCompletion = 'manual' | 'auto';

/** `vpk-task` block shape (training-course.md design discussion, item #4) — a completable unit with its own
 *  Start/Complete lifecycle, additive alongside the existing bare `vpk-check` blocks (which keep working
 *  exactly as before, single "Run check" button, no lifecycle). `completion: 'manual'` gets Start + Complete
 *  buttons where Complete is self-attested (an attached `check`, if any, only annotates a hint, never gates
 *  it); `completion: 'auto'` gets a Start button that arms background polling of `check` until it passes or
 *  `estimatedMinutes * 1.25` elapses, per-task rather than reusing the course's overall estimate — see
 *  LessonRunnerView.tsx's TaskCard/task-runtime logic, which owns polling and is the only consumer of this
 *  shape (this module still just parses structure, per the module doc comment — it does not validate this
 *  data any more than it validates a `vpk-check` block's). */
export interface LessonTaskData {
  id: string;
  describe?: string;
  completion: TaskCompletion;
  /** Required for `completion: 'auto'` polling's timeout math; unused for 'manual'. */
  estimatedMinutes?: number;
  check?: {
    cli?: string[];
    verb: string;
    args?: string[];
    expect: CommandExpect;
  };
  hint?: string;
}

export type LessonSegment = { type: 'prose'; markdown: string } | { type: 'block'; block: LessonBlock };

export interface ParsedLesson {
  frontmatter: LessonFrontmatter;
  /** File order, prose and blocks interleaved — this is what lets a renderer show instruction prose right
   *  next to the block it introduces, rather than grouping all prose first and blocks after. */
  segments: LessonSegment[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const BLOCK_RE = /```vpk-(detect|setup|check|teardown|quiz|task)\r?\n([\s\S]*?)\r?\n```/g;

function parseFrontmatter(raw: string): LessonFrontmatter {
  const parsed = parseYaml(raw);
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Lesson frontmatter must be a YAML mapping.');
  }
  const fm = parsed as Record<string, unknown>;
  if (typeof fm.id !== 'string' || !fm.id) throw new Error('Lesson frontmatter is missing required field "id".');
  if (typeof fm.title !== 'string' || !fm.title) throw new Error('Lesson frontmatter is missing required field "title".');
  return fm as unknown as LessonFrontmatter;
}

function parseBlockData(kind: LessonBlockKind, raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return parseYaml(trimmed);
  } catch (e) {
    throw new Error(`Malformed vpk-${kind} block: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Parses one lesson markdown file into frontmatter + an ordered list of prose/block segments. Throws on
 *  missing/malformed frontmatter or an unparseable block's YAML — a lesson author gets a clear error at
 *  authoring time rather than the step runner discovering a bad block mid-lesson. */
export function parseLesson(source: string): ParsedLesson {
  const fmMatch = FRONTMATTER_RE.exec(source);
  if (!fmMatch) throw new Error('Lesson file must start with a "---" frontmatter block.');
  const frontmatter = parseFrontmatter(fmMatch[1] ?? '');
  const body = source.slice(fmMatch[0].length);

  const segments: LessonSegment[] = [];
  let cursor = 0;
  BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(body))) {
    const prose = body.slice(cursor, match.index);
    if (prose.trim()) segments.push({ type: 'prose', markdown: prose.trim() });
    const kind = match[1] as LessonBlockKind;
    const data = parseBlockData(kind, match[2] ?? '');
    segments.push({ type: 'block', block: { kind, data } });
    cursor = match.index + match[0].length;
  }
  const trailing = body.slice(cursor);
  if (trailing.trim()) segments.push({ type: 'prose', markdown: trailing.trim() });

  return { frontmatter, segments };
}

/** Convenience accessor — every block of a given kind, in file order. A lesson may have more than one of the
 *  same kind (e.g. two `vpk-check` blocks for two separate assertions within one step). */
export function blocksOfKind(lesson: ParsedLesson, kind: LessonBlockKind): LessonBlock[] {
  return lesson.segments.filter((s): s is Extract<LessonSegment, { type: 'block' }> => s.type === 'block' && s.block.kind === kind).map((s) => s.block);
}
