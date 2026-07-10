import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { coursesDirExists, findLessonById, listLessons } from './content';

describe('listLessons / findLessonById against the real courses/ directory', () => {
  it('finds the real, authored Lesson Zero by id', () => {
    const lesson = findLessonById('getting-started-00-cluster');
    expect(lesson).not.toBeNull();
    expect(lesson?.frontmatter.title).toBe('Get a Cluster Running');
  });

  it('returns null for an id that does not exist', () => {
    expect(findLessonById('nope-does-not-exist')).toBeNull();
  });

  it('lists at least the one real lesson', () => {
    expect(listLessons().length).toBeGreaterThanOrEqual(1);
  });

  it('reports the real courses directory as existing', () => {
    expect(coursesDirExists()).toBe(true);
  });
});

describe('listLessons / findLessonById against a synthetic directory', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('walks nested subdirectories', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    const nested = join(dir, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'lesson.md'), '---\nid: nested-lesson\ntitle: Nested\n---\nbody');
    expect(findLessonById('nested-lesson', dir)?.frontmatter.title).toBe('Nested');
  });

  it('skips a malformed lesson file rather than failing the whole listing', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    writeFileSync(join(dir, 'broken.md'), 'no frontmatter here at all');
    writeFileSync(join(dir, 'good.md'), '---\nid: good-lesson\ntitle: Good\n---\nbody');
    const lessons = listLessons(dir);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.frontmatter.id).toBe('good-lesson');
  });

  it('returns an empty list, not a throw, for a directory that does not exist', () => {
    expect(listLessons('/nowhere/does/not/exist')).toEqual([]);
  });

  it('coursesDirExists is false for a missing directory', () => {
    expect(coursesDirExists('/nowhere/does/not/exist')).toBe(false);
  });
});
