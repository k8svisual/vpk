import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { parseLesson, type ParsedLesson } from '@vpk/training';
import { extractSeedCourses } from './seedCourses';

/**
 * Lesson content lookup — reads authored markdown lesson files off disk (redesign/training-course.md §6/§13's
 * `GET /course/:id`) and parses them via @vpk/training's parseLesson. Deliberately a linear directory scan by
 * frontmatter `id`, not an indexed catalog: with a handful of lesson files this is instant and needs no
 * caching/invalidation, and it means editing a lesson's content on disk is picked up on the very next
 * request — no server restart, matching how a course author would actually iterate. A real catalog manifest
 * (courses -> modules -> lessons, ordering, prereqs) is explicitly a later slice (§15's "catalog/progress
 * store"); this is only ever asked "find me the lesson with this id."
 *
 * Also owns the Teacher-tools write path (saveLessonSource) — the one other MUTATING exception alongside the
 * check-runner's command policy (see DESIGN.md §1's signed-off exception), scoped to writing *.md files back
 * under `coursesDir` only.
 */

// import.meta.url resolves to a virtual /$bunfs/... path inside a `bun build --compile` standalone binary —
// a plain relative join off it (the old, dev-only behavior below) resolves to nothing real once compiled, the
// same class of bug server.ts's own defaultSnapshot/customIconsDir already had to work around. Anchored to the
// user's home directory for the same reasons server.ts's runtimeDir is: stable regardless of where the binary
// currently sits, survives it moving, and is a real writable location (unlike the read-only embedded seed
// content itself) that Teacher tools can actually save lessons/resources into.
const isCompiledBinary = import.meta.url.includes('$bunfs');
const here = dirname(fileURLToPath(import.meta.url));
// Dev: four levels up from packages/server/src/course/ reaches the repo root's courses/ dir. Compiled: a
// writable ~/.vpk/courses (see the comment above), seeded on first run below.
export const DEFAULT_COURSES_DIR = isCompiledBinary ? join(homedir(), '.vpk', 'courses') : join(here, '../../../../courses');
// First-run-only: seeds the packaged app's writable courses directory from the binary's embedded copy (see
// seedCourses.ts) so a fresh install ships with the same courses/ content as a dev checkout, not an empty
// catalog. A no-op in dev (DEFAULT_COURSES_DIR already exists as the real repo folder) and a no-op on every
// run after the first (extractSeedCourses never touches an already-existing directory).
if (isCompiledBinary) extractSeedCourses(DEFAULT_COURSES_DIR);

function walkMarkdownFiles(dir: string): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    // Skip each course's own `resources/` folder — uploaded resources can be `.md` too (see course/
    // resources.ts's CONTENT_TYPES), and now that they live inside the course tree a markdown resource with
    // frontmatter would otherwise be scanned and shown as a bogus lesson in the catalog.
    if (entry.isDirectory() && entry.name === 'resources') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

export interface LessonFileEntry {
  /** Relative to `coursesDir`, e.g. "course02/00-using-oc.md" — the id a Teacher-tools edit/save round-trip
   *  addresses a file by, since a lesson's frontmatter `id` isn't guaranteed unique until it's actually saved
   *  (a brand-new draft has no id collision to check against a file that doesn't exist yet). */
  path: string;
  lesson: ParsedLesson;
}

/** Every lesson file under `coursesDir`, parsed, with its path relative to `coursesDir`. A file that fails to
 *  parse (malformed frontmatter/YAML) is skipped rather than failing the whole listing — one broken draft
 *  lesson shouldn't take down every other lesson's availability. */
export function listLessonFiles(coursesDir: string = DEFAULT_COURSES_DIR): LessonFileEntry[] {
  const entries: LessonFileEntry[] = [];
  for (const file of walkMarkdownFiles(coursesDir)) {
    try {
      entries.push({ path: relative(coursesDir, file), lesson: parseLesson(readFileSync(file, 'utf8')) });
    } catch {
      // malformed lesson file — skip it, don't take down every other lesson's availability
    }
  }
  return entries;
}

export function listLessons(coursesDir: string = DEFAULT_COURSES_DIR): ParsedLesson[] {
  return listLessonFiles(coursesDir).map((e) => e.lesson);
}

export function findLessonById(id: string, coursesDir: string = DEFAULT_COURSES_DIR): ParsedLesson | null {
  return listLessonFiles(coursesDir).find((e) => e.lesson.frontmatter.id === id)?.lesson ?? null;
}

/** The on-disk path (relative to `coursesDir`) of the lesson with this frontmatter id — what the Teacher
 *  editor needs to open an EXISTING lesson for editing, as opposed to `saveLessonSource`'s path for a new
 *  one, which the author chooses. */
export function findLessonPath(id: string, coursesDir: string = DEFAULT_COURSES_DIR): string | null {
  return listLessonFiles(coursesDir).find((e) => e.lesson.frontmatter.id === id)?.path ?? null;
}

/** True if `coursesDir` exists at all — lets a caller distinguish "no courses directory configured yet" from
 *  "directory exists but is empty" without treating both as the same silent zero-lessons case. */
export function coursesDirExists(coursesDir: string = DEFAULT_COURSES_DIR): boolean {
  try {
    return statSync(coursesDir).isDirectory();
  } catch {
    return false;
  }
}

/** Resolves `relativePath` under `coursesDir` and refuses anything that would land outside it (a `../` escape
 *  attempt) or that isn't a `.md` file — the Teacher-tools save endpoint is the one place this server accepts
 *  a caller-chosen filesystem path, so it's the one place that needs this guard. */
function resolveLessonPath(coursesDir: string, relativePath: string): string {
  if (!relativePath.endsWith('.md')) throw new Error('Lesson files must end in ".md".');
  const root = resolve(coursesDir);
  const full = resolve(root, relativePath);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`Refusing to write outside the courses directory: "${relativePath}".`);
  }
  return full;
}

/** Raw markdown source for the Teacher editor to load into its textarea — deliberately unparsed (editing
 *  happens on the authored text, not a reconstructed-from-AST round-trip that could reformat content the
 *  author didn't touch). */
export function readLessonSource(relativePath: string, coursesDir: string = DEFAULT_COURSES_DIR): string {
  return readFileSync(resolveLessonPath(coursesDir, relativePath), 'utf8');
}

/** Writes `source` to `relativePath` under `coursesDir` (creating parent directories for a brand-new lesson),
 *  after confirming it parses — a save that would corrupt the lesson format is rejected instead of landing on
 *  disk, so a broken edit never overwrites a previously-good file. Returns the parsed lesson so the caller
 *  (the save route) can hand the editor back a confirmed id/title without a second read. */
export function saveLessonSource(relativePath: string, source: string, coursesDir: string = DEFAULT_COURSES_DIR): ParsedLesson {
  const full = resolveLessonPath(coursesDir, relativePath);
  const parsed = parseLesson(source); // throws on invalid frontmatter — propagates to the route as a 400
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, source, 'utf8');
  return parsed;
}

export interface LessonValidationResult {
  frontmatter: ParsedLesson['frontmatter'];
  counts: Record<'prose' | 'detect' | 'setup' | 'check' | 'teardown' | 'quiz', number>;
  /** Non-fatal problems — the lesson still parsed and will load, but something about it likely won't work as
   *  the author intended (a check block missing a field its kind needs, no checks at all, ...). Structural
   *  problems (bad frontmatter, an unclosed fence) aren't warnings — parseLesson throws for those, and the
   *  route surfaces that as a 400 instead, since there's no lesson to report counts/warnings ABOUT. */
  warnings: string[];
}

const PURE_CHECK_KINDS = new Set(['cluster', 'inventory', 'fields', 'value']);
const LIVE_CHECK_KINDS = new Set(['command', 'probe', 'callback']);

/** Structural + light content validation for the Teacher editor's "Validate" button — a dry run that never
 *  writes anything (see saveLessonSource for the write path). parseLesson already catches malformed
 *  frontmatter/YAML/unclosed fences (thrown, not a warning — see LessonValidationResult's doc comment); this
 *  adds the next layer down: does each vpk-check block have the fields ITS OWN kind actually needs to
 *  evaluate. Deliberately duck-typed against `unknown` rather than importing @vpk/training's Check union and
 *  doing a full structural match — a lesson author needs "you're missing `namespace`", not a TypeScript
 *  discriminated-union error dump. */
export function validateLessonSource(source: string): LessonValidationResult {
  const lesson = parseLesson(source);
  const counts = { prose: 0, detect: 0, setup: 0, check: 0, teardown: 0, quiz: 0, task: 0 };
  const warnings: string[] = [];
  for (const segment of lesson.segments) {
    if (segment.type === 'prose') {
      counts.prose++;
      continue;
    }
    counts[segment.block.kind]++;
    if (segment.block.kind === 'check') warnings.push(...validateCheckBlock(segment.block.data));
    if (segment.block.kind === 'task') warnings.push(...validateTaskBlock(segment.block.data));
  }
  if (counts.check === 0) warnings.push('No vpk-check blocks — nothing in this lesson is automatically graded.');
  if (lesson.frontmatter.estimatedMinutes === undefined) {
    warnings.push("No estimatedMinutes set — the Course view's header countdown clock won't show for this lesson.");
  }
  return { frontmatter: lesson.frontmatter, counts, warnings };
}

function validateCheckBlock(data: unknown): string[] {
  if (data === undefined || data === null || typeof data !== 'object') {
    return ['A vpk-check block is empty or not a YAML mapping — expected at least id, describe, and kind.'];
  }
  const d = data as Record<string, unknown>;
  const label = typeof d.id === 'string' && d.id ? `"${d.id}"` : '(missing id)';
  const problems: string[] = [];
  if (typeof d.id !== 'string' || !d.id) problems.push(`Check ${label}: missing required field "id".`);
  if (typeof d.describe !== 'string' || !d.describe) problems.push(`Check ${label}: missing required field "describe".`);
  if (typeof d.kind !== 'string' || !d.kind) {
    problems.push(`Check ${label}: missing required field "kind".`);
    return problems;
  }
  if (!PURE_CHECK_KINDS.has(d.kind) && !LIVE_CHECK_KINDS.has(d.kind)) {
    problems.push(`Check ${label}: unknown kind "${d.kind}" — expected one of cluster, inventory, fields, value, command, probe, callback.`);
    return problems;
  }
  if (d.kind === 'cluster') {
    if (d.assert === undefined) problems.push(`Check ${label}: kind "cluster" needs an "assert" field.`);
  } else if (d.kind === 'inventory' || d.kind === 'fields') {
    if (typeof d.namespace !== 'string' || !d.namespace) problems.push(`Check ${label}: kind "${d.kind}" needs a "namespace" field.`);
    if (d.expect === undefined) problems.push(`Check ${label}: kind "${d.kind}" needs an "expect" field.`);
  } else if (d.kind === 'value') {
    if (typeof d.namespace !== 'string' || !d.namespace) problems.push(`Check ${label}: kind "value" needs a "namespace" field.`);
    if (!Array.isArray(d.assert) || d.assert.length === 0) problems.push(`Check ${label}: kind "value" needs a non-empty "assert" list.`);
  }
  return problems;
}

function validateTaskBlock(data: unknown): string[] {
  if (data === undefined || data === null || typeof data !== 'object') {
    return ['A vpk-task block is empty or not a YAML mapping — expected at least id and completion.'];
  }
  const d = data as Record<string, unknown>;
  const label = typeof d.id === 'string' && d.id ? `"${d.id}"` : '(missing id)';
  const problems: string[] = [];
  if (typeof d.id !== 'string' || !d.id) problems.push(`Task ${label}: missing required field "id".`);
  if (d.completion !== 'manual' && d.completion !== 'auto') problems.push(`Task ${label}: "completion" must be "manual" or "auto".`);
  if (d.completion === 'auto' && typeof d.estimatedMinutes !== 'number') {
    problems.push(`Task ${label}: completion "auto" needs a numeric "estimatedMinutes" (used for the polling timeout).`);
  }
  if (d.check !== undefined) {
    const c = d.check as Record<string, unknown>;
    if (typeof c.verb !== 'string' || !c.verb) problems.push(`Task ${label}: "check.verb" is required when "check" is set.`);
    if (c.expect === undefined || typeof c.expect !== 'object') problems.push(`Task ${label}: "check.expect" is required when "check" is set.`);
  } else if (d.completion === 'auto') {
    problems.push(`Task ${label}: completion "auto" needs a "check" to poll — otherwise nothing can ever mark it complete.`);
  }
  return problems;
}
