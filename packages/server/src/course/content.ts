import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLesson, type ParsedLesson } from '@vpk/training';

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

const here = dirname(fileURLToPath(import.meta.url));
// packages/server/src/course/content.ts -> v2/courses
const DEFAULT_COURSES_DIR = join(here, '../../../../courses');

function walkMarkdownFiles(dir: string): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
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
