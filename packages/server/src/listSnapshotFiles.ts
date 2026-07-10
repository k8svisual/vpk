import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pushLog } from './logBuffer';

/**
 * Snapshot files can sit flat in the configured directory, OR one level down in a per-capture subdirectory
 * (the legacy app's layout: `<snapshotDir>/<capture-name>/vpk.snapshot.json`) — real capture tooling drops each
 * run in its own timestamped folder rather than flattening everything into one directory, alongside a handful
 * of auxiliary JSON dumps (components.json, version.json, ...) that aren't loadable snapshots. Returns paths
 * relative to `dir` (e.g. `"aaa-mcm-2020-12-03/vpk.snapshot.json"` or `"minikube.snapshot.json"`), which is
 * exactly what `/load` already accepts and what `resolve()` in server.ts already joins against `snapshotDir`
 * — no changes needed there. Only recurses one level, matching that layout; a directory that's missing or
 * unreadable just contributes no entries rather than throwing.
 */
// The snapshot dropdown re-fetches /snapshots on every open (see App.tsx's refreshSnaps calls), so a broken
// snapshotDir would otherwise flood the log buffer with the same message on every click — logged once per
// distinct `dir` value instead, not once per call.
const warnedDirs = new Set<string>();

export function listSnapshotFiles(dir: string): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (!warnedDirs.has(dir)) {
      warnedDirs.add(dir);
      pushLog('warn', `Snapshot directory ${dir} is missing or unreadable: ${String(e)}`);
    }
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entry.name);
    } else if (entry.isDirectory()) {
      let nested: string[];
      try {
        // A real capture directory holds several auxiliary JSON dumps alongside the one that's actually
        // loadable (components.json, explains.json, readyz.json, version.json, ...) — only the snapshot
        // itself is offered, not every .json file the capture tool happened to also write here.
        nested = readdirSync(join(dir, entry.name)).filter((f) => f.endsWith('.snapshot.json'));
      } catch {
        nested = [];
      }
      for (const f of nested) files.push(join(entry.name, f));
    }
  }
  return files.sort();
}
