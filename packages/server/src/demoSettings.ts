import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pushLog } from './logBuffer';

/**
 * Persisted Demo Data screen configuration (bundle percents/patterns, per-Kind form values, Node
 * master/worker split, ...) — an opaque JSON blob as far as the server is concerned, since the shape is owned
 * by the web client (DemoDataView.tsx) and would otherwise need updating here every time a new bundle field
 * is added there. Saved to TWO places on every save so it's recoverable however you get back to it:
 *  - the app directory (alongside vpkconfig.json) — "whatever I was last using", independent of snapshot dir
 *  - the current snapshot directory's root — travels with that directory if you point a different app
 *    instance at it, or hand it to someone else
 */
export type DemoDataSettings = Record<string, unknown>;

const FILE_NAME = 'demo-data-settings.json';

export function demoSettingsAppPath(configPath: string): string {
  return join(configPath, '..', FILE_NAME);
}

export function demoSettingsSnapshotDirPath(snapshotDir: string): string {
  return join(snapshotDir, FILE_NAME);
}

export function saveDemoSettings(paths: string[], settings: DemoDataSettings): void {
  const json = JSON.stringify(settings, null, 2);
  for (const path of paths) writeFileSync(path, json);
}

/** Never throws — an absent file just reads back as `null` (nothing saved there yet — checked on every
 *  `/demo/settings` request, so this is far too common to log). A file that EXISTS but fails to parse is a
 *  different story and worth a trace. */
export function loadDemoSettings(path: string): DemoDataSettings | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as DemoDataSettings;
  } catch (e) {
    pushLog('warn', `Ignoring unreadable Demo Data settings at ${path}: ${String(e)}`);
    return null;
  }
}
