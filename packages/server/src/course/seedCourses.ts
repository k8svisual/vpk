import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COURSE_ASSETS } from '../courseAssets.generated';
import { pushLog } from '../logBuffer';

/**
 * Copies the embedded seed course content (COURSE_ASSETS, populated by scripts/build-course-assets.ts ahead of
 * a compile — empty placeholder otherwise, see that generated file's own header) out to `targetDir`, a REAL,
 * writable directory. The embedded copies live at virtual `/$bunfs/` paths inside a compiled binary that can
 * never be written to (Teacher tools' save-lesson/upload-resource routes need real files), so the packaged app
 * needs its own on-disk copy the first time it runs — same idea as server.ts's snapshots-directory creation.
 *
 * Only ever acts when `targetDir` doesn't exist yet — an existing directory (including one a previous version
 * already seeded, or one the student has since edited/added to) is left completely alone, so this can never
 * clobber a student's own course edits on a later app update.
 */
export function extractSeedCourses(targetDir: string): void {
  if (existsSync(targetDir)) return;
  const entries = Object.entries(COURSE_ASSETS);
  if (entries.length === 0) return; // dev checkout, or a binary compiled without running build:course-assets first

  // Extract into a temp sibling and atomically rename on success, so the catalog appears all-or-nothing: a
  // crash or an unreadable asset mid-extraction leaves `targetDir` absent (the staging dir is discarded) and
  // the next launch retries — rather than stranding a half-populated ~/.vpk/courses that the existsSync guard
  // above would then skip forever. And the whole thing is wrapped: this runs as a module-load side effect of
  // content.ts, so an uncaught throw here would take down the entire server on startup — a failure must
  // degrade to an empty catalog plus a log line, not a boot crash.
  const stagingDir = `${targetDir}.seeding-${process.pid}`;
  try {
    for (const [relPath, embeddedPath] of entries) {
      const dest = join(stagingDir, relPath);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, readFileSync(embeddedPath));
    }
    renameSync(stagingDir, targetDir);
  } catch (e) {
    try {
      rmSync(stagingDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup — a leftover staging dir is harmless (targetDir still doesn't exist, so we retry)
    }
    pushLog('warn', `Could not seed courses into ${targetDir}: ${e instanceof Error ? e.message : String(e)} — the course catalog may be empty until this is resolved.`);
  }
}
