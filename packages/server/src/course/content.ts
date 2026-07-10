import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

/** Every lesson file under `coursesDir`, parsed. A file that fails to parse (malformed frontmatter/YAML) is
 *  skipped rather than failing the whole listing — one broken draft lesson shouldn't take down every other
 *  lesson's availability. */
export function listLessons(coursesDir: string = DEFAULT_COURSES_DIR): ParsedLesson[] {
  const lessons: ParsedLesson[] = [];
  for (const file of walkMarkdownFiles(coursesDir)) {
    try {
      lessons.push(parseLesson(readFileSync(file, 'utf8')));
    } catch {
      // malformed lesson file — skip it, don't take down every other lesson's availability
    }
  }
  return lessons;
}

export function findLessonById(id: string, coursesDir: string = DEFAULT_COURSES_DIR): ParsedLesson | null {
  return listLessons(coursesDir).find((l) => l.frontmatter.id === id) ?? null;
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
