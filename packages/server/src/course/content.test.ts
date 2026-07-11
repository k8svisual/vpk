import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { coursesDirExists, findLessonById, findLessonPath, listLessonFiles, listLessons, readLessonSource, saveLessonSource, validateLessonSource } from './content';

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

  it('listLessonFiles reports each entry\'s path relative to coursesDir', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    mkdirSync(join(dir, 'sub'), { recursive: true });
    writeFileSync(join(dir, 'sub', 'lesson.md'), '---\nid: sub-lesson\ntitle: Sub\n---\nbody');
    const entries = listLessonFiles(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe(join('sub', 'lesson.md'));
  });

  it('findLessonPath resolves an existing lesson id to its relative path', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    writeFileSync(join(dir, 'a.md'), '---\nid: findable\ntitle: Findable\n---\nbody');
    expect(findLessonPath('findable', dir)).toBe('a.md');
    expect(findLessonPath('nope', dir)).toBeNull();
  });
});

describe('readLessonSource / saveLessonSource', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips: save then read returns the exact source written', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    const source = '---\nid: rt\ntitle: Round Trip\n---\nSome body text.\n';
    const parsed = saveLessonSource('rt.md', source, dir);
    expect(parsed.frontmatter.id).toBe('rt');
    expect(readLessonSource('rt.md', dir)).toBe(source);
    expect(readFileSync(join(dir, 'rt.md'), 'utf8')).toBe(source);
  });

  it('creates parent directories for a brand-new nested lesson', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    saveLessonSource('course09/00-new.md', '---\nid: new-course\ntitle: New\n---\nbody', dir);
    expect(readLessonSource('course09/00-new.md', dir)).toContain('new-course');
  });

  it('rejects a save that would land outside coursesDir', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    expect(() => saveLessonSource('../escape.md', '---\nid: x\ntitle: X\n---\nbody', dir)).toThrow(/outside/);
  });

  it('rejects a non-.md path', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    expect(() => saveLessonSource('notes.txt', 'whatever', dir)).toThrow(/\.md/);
  });

  it('rejects invalid frontmatter WITHOUT touching a previously-good file on disk', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    const good = '---\nid: keep-me\ntitle: Keep Me\n---\noriginal body';
    saveLessonSource('keep.md', good, dir);
    expect(() => saveLessonSource('keep.md', 'no frontmatter at all', dir)).toThrow();
    expect(readLessonSource('keep.md', dir)).toBe(good);
  });

  it('readLessonSource throws for a file that does not exist', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    expect(() => readLessonSource('missing.md', dir)).toThrow();
  });
});

describe('validateLessonSource', () => {
  it('throws (structural) for malformed frontmatter — same as parseLesson', () => {
    expect(() => validateLessonSource('no frontmatter at all')).toThrow(/frontmatter/);
  });

  it('reports counts and no warnings for a well-formed lesson with a complete check block', () => {
    const source = [
      '---',
      'id: good-lesson',
      'title: Good Lesson',
      'estimatedMinutes: 10',
      '---',
      '',
      'Some intro prose.',
      '',
      '```vpk-check',
      'id: reachable',
      'describe: cluster is reachable',
      'kind: cluster',
      'assert: contextReachable',
      '```',
    ].join('\n');
    const result = validateLessonSource(source);
    expect(result.frontmatter.id).toBe('good-lesson');
    expect(result.counts).toEqual({ prose: 1, detect: 0, setup: 0, check: 1, teardown: 0, quiz: 0 });
    expect(result.warnings).toEqual([]);
  });

  it('warns when there are no check blocks at all', () => {
    const result = validateLessonSource('---\nid: x\ntitle: X\nestimatedMinutes: 5\n---\nJust prose, no checks.');
    expect(result.warnings).toContain('No vpk-check blocks — nothing in this lesson is automatically graded.');
  });

  it('warns when estimatedMinutes is missing', () => {
    const result = validateLessonSource('---\nid: x\ntitle: X\n---\nbody');
    expect(result.warnings.some((w) => w.includes('estimatedMinutes'))).toBe(true);
  });

  it('flags a check block missing required fields', () => {
    const source = ['---', 'id: x', 'title: X', 'estimatedMinutes: 5', '---', '', '```vpk-check', 'kind: inventory', '```'].join('\n');
    const result = validateLessonSource(source);
    expect(result.warnings.some((w) => w.includes('missing required field "id"'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('missing required field "describe"'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('needs a "namespace" field'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('needs an "expect" field'))).toBe(true);
  });

  it('flags an unknown check kind', () => {
    const source = ['---', 'id: x', 'title: X', 'estimatedMinutes: 5', '---', '', '```vpk-check', 'id: c', 'describe: d', 'kind: bogus', '```'].join('\n');
    const result = validateLessonSource(source);
    expect(result.warnings.some((w) => w.includes('unknown kind "bogus"'))).toBe(true);
  });

  it('does not flag a well-formed value check', () => {
    const source = [
      '---',
      'id: x',
      'title: X',
      'estimatedMinutes: 5',
      '---',
      '',
      '```vpk-check',
      'id: c',
      'describe: d',
      'kind: value',
      'namespace: default',
      'assert:',
      '  - { select: { kind: Service, name: s }, path: ".spec.ports[0].port", op: "==", value: 80 }',
      '```',
    ].join('\n');
    const result = validateLessonSource(source);
    expect(result.warnings).toEqual([]);
  });
});
