import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteResourceFile,
  ensureCourseResourceDir,
  findResourceReferences,
  listCourseResourceDirs,
  listResourceFiles,
  readResourceFile,
  renameResourceFile,
  saveResourceFile,
} from './resources';

describe('ensureCourseResourceDir / listCourseResourceDirs', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('creates the course subdirectory, idempotently', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    ensureCourseResourceDir(dir, 'course05');
    expect(existsSync(join(dir, 'course05'))).toBe(true);
    expect(() => ensureCourseResourceDir(dir, 'course05')).not.toThrow();
  });

  it('lists every course directory that has one, even if empty', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    ensureCourseResourceDir(dir, 'course02');
    ensureCourseResourceDir(dir, 'course05');
    expect(listCourseResourceDirs(dir)).toEqual(['course02', 'course05']);
  });

  it('returns an empty list, not a throw, for a resources directory that does not exist', () => {
    expect(listCourseResourceDirs('/nowhere/does/not/exist')).toEqual([]);
  });

  it('rejects a course name that would escape the resources directory', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    expect(() => ensureCourseResourceDir(dir, '../escape')).toThrow();
    expect(() => ensureCourseResourceDir(dir, 'a/b')).toThrow();
  });
});

describe('saveResourceFile / listResourceFiles / readResourceFile', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a small file, base64-encoded', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    const original = 'hello resource file';
    const b64 = Buffer.from(original, 'utf8').toString('base64');
    const saved = saveResourceFile(dir, 'course02', 'notes.txt', b64);
    expect(saved.name).toBe('notes.txt');
    expect(saved.size).toBe(Buffer.byteLength(original));

    const { data, contentType } = readResourceFile(dir, 'course02', 'notes.txt');
    expect(data.toString('utf8')).toBe(original);
    expect(contentType).toBe('text/plain');
  });

  it('guesses content type from the extension', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    saveResourceFile(dir, 'course02', 'diagram.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'));
    expect(readResourceFile(dir, 'course02', 'diagram.png').contentType).toBe('image/png');
  });

  it('lists files sorted by name with size/mtime', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    saveResourceFile(dir, 'course02', 'b.txt', Buffer.from('bb').toString('base64'));
    saveResourceFile(dir, 'course02', 'a.txt', Buffer.from('a').toString('base64'));
    const files = listResourceFiles(dir, 'course02');
    expect(files.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(files[1]?.size).toBe(2);
  });

  it('creates the course directory automatically on first upload', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    saveResourceFile(dir, 'brand-new', 'x.txt', Buffer.from('x').toString('base64'));
    expect(listResourceFiles(dir, 'brand-new').map((f) => f.name)).toEqual(['x.txt']);
  });

  it('returns an empty list for a course with no resources yet', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    expect(listResourceFiles(dir, 'nope')).toEqual([]);
  });

  it('rejects a filename that would escape the course directory', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    expect(() => saveResourceFile(dir, 'course02', '../escape.txt', Buffer.from('x').toString('base64'))).toThrow();
  });
});

describe('deleteResourceFile / renameResourceFile', () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('deletes a file', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    saveResourceFile(dir, 'course02', 'gone.txt', Buffer.from('x').toString('base64'));
    deleteResourceFile(dir, 'course02', 'gone.txt');
    expect(listResourceFiles(dir, 'course02')).toEqual([]);
  });

  it('deleting a file that does not exist is a no-op, not a throw', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    ensureCourseResourceDir(dir, 'course02');
    expect(() => deleteResourceFile(dir, 'course02', 'never-existed.txt')).not.toThrow();
  });

  it('renames a file, preserving its content', () => {
    dir = mkdtempSync(join(tmpdir(), 'vpk-resources-'));
    saveResourceFile(dir, 'course02', 'old.txt', Buffer.from('content').toString('base64'));
    const renamed = renameResourceFile(dir, 'course02', 'old.txt', 'new.txt');
    expect(renamed.name).toBe('new.txt');
    expect(listResourceFiles(dir, 'course02').map((f) => f.name)).toEqual(['new.txt']);
    expect(readResourceFile(dir, 'course02', 'new.txt').data.toString('utf8')).toBe('content');
  });
});

describe('findResourceReferences', () => {
  let coursesDir: string;
  afterEach(() => {
    if (coursesDir) rmSync(coursesDir, { recursive: true, force: true });
  });

  it('finds a lesson under the matching course directory that mentions the filename', () => {
    coursesDir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    mkdirSync(join(coursesDir, 'course02'), { recursive: true });
    writeFileSync(
      join(coursesDir, 'course02', '00-lesson.md'),
      '---\nid: x\ntitle: X\n---\nSee ![diagram](/course-resources/course02/diagram.png) for details.',
    );
    expect(findResourceReferences('course02', 'diagram.png', coursesDir)).toEqual(['course02/00-lesson.md']);
  });

  it('returns an empty list when no lesson mentions the filename', () => {
    coursesDir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    mkdirSync(join(coursesDir, 'course02'), { recursive: true });
    writeFileSync(join(coursesDir, 'course02', '00-lesson.md'), '---\nid: x\ntitle: X\n---\nNo images here.');
    expect(findResourceReferences('course02', 'diagram.png', coursesDir)).toEqual([]);
  });

  it('does not match a lesson under a DIFFERENT course directory, even if it mentions the same filename', () => {
    coursesDir = mkdtempSync(join(tmpdir(), 'vpk-courses-'));
    mkdirSync(join(coursesDir, 'course02'), { recursive: true });
    mkdirSync(join(coursesDir, 'course03'), { recursive: true });
    writeFileSync(join(coursesDir, 'course02', '00-lesson.md'), '---\nid: x\ntitle: X\n---\nbody');
    writeFileSync(join(coursesDir, 'course03', '00-lesson.md'), '---\nid: y\ntitle: Y\n---\nSee diagram.png here.');
    expect(findResourceReferences('course02', 'diagram.png', coursesDir)).toEqual([]);
  });
});
