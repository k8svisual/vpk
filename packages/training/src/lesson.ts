import { parse as parseYaml } from 'yaml';
import type { Strictness } from './types';

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
}

export type LessonBlockKind = 'detect' | 'setup' | 'check' | 'teardown' | 'quiz';

export interface LessonBlock {
  kind: LessonBlockKind;
  /** The block's fenced content, parsed as YAML. Shape depends on `kind` — validated by the caller, not
   *  here (see module doc comment). */
  data: unknown;
}

export type LessonSegment = { type: 'prose'; markdown: string } | { type: 'block'; block: LessonBlock };

export interface ParsedLesson {
  frontmatter: LessonFrontmatter;
  /** File order, prose and blocks interleaved — this is what lets a renderer show instruction prose right
   *  next to the block it introduces, rather than grouping all prose first and blocks after. */
  segments: LessonSegment[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const BLOCK_RE = /```vpk-(detect|setup|check|teardown|quiz)\r?\n([\s\S]*?)\r?\n```/g;

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
