import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { DEFAULT_COURSES_DIR, listLessonFiles } from './content';

/**
 * Course-resources: images, sample files, anything a lesson links to that isn't itself lesson markdown. Live
 * INSIDE the course's own directory under `coursesDir` (content.ts's `DEFAULT_COURSES_DIR`), one `resources/`
 * subfolder per course (course02/00-using-oc.md -> resources live under `<coursesDir>/course02/resources/`) —
 * the same "course" identity a lesson's own path already carries, so Teacher tools can derive the resources
 * subdirectory from whichever lesson is open without a second naming scheme, and a course's content + assets
 * travel together as one folder (copy/zip/back up a course, get everything). Previously a separately
 * configured directory (Settings > Education's `courseResourcesDir`) — folded into the course's own tree since
 * there was never a real reason for the two to live apart, and a second directory setting was one more thing
 * to configure before Teacher tools worked at all. Every write here (upload/rename/delete) resolves through
 * `resolveResourceDirPath`'s traversal guard, same discipline as content.ts's `resolveLessonPath` for lesson
 * files.
 */

export interface ResourceFileEntry {
  name: string;
  size: number;
  mtimeMs: number;
}

function resolveResourceDirPath(coursesDir: string, course: string): string {
  if (!course || course.includes('/') || course.includes('\\') || course === '.' || course === '..') {
    throw new Error(`Invalid course directory name: "${course}".`);
  }
  return resolve(coursesDir, course, 'resources');
}

function resolveResourceFilePath(coursesDir: string, course: string, name: string): string {
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new Error(`Invalid file name: "${name}".`);
  }
  const dir = resolveResourceDirPath(coursesDir, course);
  const full = resolve(dir, name);
  if (full !== dir && !full.startsWith(dir + sep)) {
    throw new Error(`Refusing to touch a path outside the course's resource directory: "${name}".`);
  }
  return full;
}

/** Creates the course's resource subdirectory if it doesn't already exist — called both explicitly (Teacher's
 *  "New" course flow, so the folder exists the moment a course is created, before the student ever uploads
 *  anything) and defensively on every upload (idempotent, so an upload never fails just because the eager
 *  create step was skipped somehow). */
export function ensureCourseResourceDir(coursesDir: string, course: string): void {
  mkdirSync(resolveResourceDirPath(coursesDir, course), { recursive: true });
}

/** Every file directly inside a course's resource subdirectory (no nested folders — one flat bucket per
 *  course keeps the Resources panel and the reference-search below simple). Returns `[]` for a course with no
 *  resources yet (including one whose directory doesn't exist), not a throw — same "absent is normal, not
 *  exceptional" stance as content.ts's directory walks. */
export function listResourceFiles(coursesDir: string, course: string): ResourceFileEntry[] {
  const dir = resolveResourceDirPath(coursesDir, course);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => {
      try {
        return statSync(join(dir, n)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
  return names
    .map((name) => {
      const st = statSync(join(dir, name));
      return { name, size: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Decodes `dataBase64` and writes it as `name` under the course's resource directory, creating the directory
 *  first if needed. Overwrites an existing file of the same name (the Resources panel's own "replace" case;
 *  the caller is responsible for confirming that's what the user wants — this function doesn't guess). */
export function saveResourceFile(coursesDir: string, course: string, name: string, dataBase64: string): ResourceFileEntry {
  ensureCourseResourceDir(coursesDir, course);
  const full = resolveResourceFilePath(coursesDir, course, name);
  const buf = Buffer.from(dataBase64, 'base64');
  writeFileSync(full, buf);
  const st = statSync(full);
  return { name, size: st.size, mtimeMs: st.mtimeMs };
}

export function deleteResourceFile(coursesDir: string, course: string, name: string): void {
  rmSync(resolveResourceFilePath(coursesDir, course, name), { force: true });
}

export function renameResourceFile(coursesDir: string, course: string, oldName: string, newName: string): ResourceFileEntry {
  const oldFull = resolveResourceFilePath(coursesDir, course, oldName);
  const newFull = resolveResourceFilePath(coursesDir, course, newName);
  renameSync(oldFull, newFull);
  const st = statSync(newFull);
  return { name: newName, size: st.size, mtimeMs: st.mtimeMs };
}

/** Raw bytes + a best-guess content-type, for the static-serving route — deliberately a small hand-rolled
 *  extension table rather than a mime-type dependency, since course resources are a handful of predictable
 *  kinds (images, text/yaml/json samples), not arbitrary uploads needing full MIME coverage. */
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

export function readResourceFile(coursesDir: string, course: string, name: string): { data: Buffer; contentType: string } {
  const full = resolveResourceFilePath(coursesDir, course, name);
  return { data: readFileSync(full), contentType: CONTENT_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream' };
}

/** Which lesson files (relative paths, under `coursesDir`) mention `filename` anywhere in their raw source —
 *  a plain substring search, not a real link-syntax parser, since an author might reference a resource via a
 *  markdown image, a raw HTML `<img>`, or just a filename mentioned in prose ("see diagram.png"); all of
 *  those are worth warning about before a delete, and a substring match catches all of them at the cost of
 *  occasionally over-warning (a filename that happens to appear in unrelated prose) — over-warning before a
 *  delete is the safe direction to be wrong in. Scoped to lessons under the matching course subdirectory
 *  only, not the whole courses tree, since a resource named the same as one in a different course is a
 *  coincidence, not a real reference. */
export function findResourceReferences(course: string, filename: string, coursesDir: string = DEFAULT_COURSES_DIR): string[] {
  return listLessonFiles(coursesDir)
    .filter((entry) => entry.path === course || entry.path.startsWith(course + '/') || entry.path.startsWith(course + '\\'))
    .filter((entry) => lessonSourceMentions(coursesDir, entry.path, filename))
    .map((entry) => entry.path);
}

function lessonSourceMentions(coursesDir: string, relativePath: string, filename: string): boolean {
  try {
    return readFileSync(join(coursesDir, relativePath), 'utf8').includes(filename);
  } catch {
    return false;
  }
}
