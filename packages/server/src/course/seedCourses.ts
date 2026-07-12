import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { COURSE_ASSETS } from '../courseAssets.generated';

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
  for (const [relPath, embeddedPath] of entries) {
    const dest = join(targetDir, relPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(embeddedPath));
  }
}
