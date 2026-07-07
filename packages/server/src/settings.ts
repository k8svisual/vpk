import { readFileSync, writeFileSync } from 'node:fs';

/** Persisted, server-enforced app settings (DESIGN: settings that affect what data leaves the server — the
 *  snapshot directory and Secret handling — live here, not in browser-only state, since a client-side toggle
 *  can't stop raw data from crossing the wire in the first place). */
export interface Settings {
  snapshotDir: string;
  /** View-time, reversible: `/definition` shows the "not available" message instead of a Secret's real
   *  `.data`/`.stringData` values. The real values are still saved underneath (as long as
   *  `disablePullingSecrets` didn't discard them at capture time) — flipping this off reveals them again. */
  redactSecrets: boolean;
  /** Capture-time, PERMANENT: a Secret's own definition (kind, metadata, type) is always captured — this only
   *  controls whether its `.data`/`.stringData` payload is kept. When true, the payload is discarded before
   *  the snapshot is even written to disk, so `redactSecrets` has nothing left to reveal for these Secrets. */
  disablePullingSecrets: boolean;
}

const DEFAULTS: Pick<Settings, 'redactSecrets' | 'disablePullingSecrets'> = {
  redactSecrets: true,
  disablePullingSecrets: false,
};

/** Loads persisted settings from `configPath`, filling in defaults for anything missing/invalid. Never throws —
 *  an absent or corrupt config file degrades to defaults instead of crashing the server at startup. */
export function loadSettings(configPath: string, defaultSnapshotDir: string): Settings {
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<Settings>;
    return {
      snapshotDir: typeof raw.snapshotDir === 'string' && raw.snapshotDir ? raw.snapshotDir : defaultSnapshotDir,
      redactSecrets: typeof raw.redactSecrets === 'boolean' ? raw.redactSecrets : DEFAULTS.redactSecrets,
      disablePullingSecrets: typeof raw.disablePullingSecrets === 'boolean' ? raw.disablePullingSecrets : DEFAULTS.disablePullingSecrets,
    };
  } catch {
    return { snapshotDir: defaultSnapshotDir, ...DEFAULTS };
  }
}

export function saveSettings(configPath: string, settings: Settings): void {
  writeFileSync(configPath, JSON.stringify(settings, null, 2));
}
