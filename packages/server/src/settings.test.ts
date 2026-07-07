import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSettings, type Settings } from './settings';

const dirs: string[] = [];
function tempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vpk-settings-'));
  dirs.push(dir);
  return join(dir, 'vpkconfig.json');
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('settings', () => {
  it('falls back to defaults when the config file does not exist', () => {
    const settings = loadSettings(tempConfigPath(), '/default/snapshots');
    expect(settings).toEqual({ snapshotDir: '/default/snapshots', redactSecrets: true, disablePullingSecrets: false });
  });

  it('falls back to defaults when the config file has invalid JSON, rather than throwing', () => {
    const path = tempConfigPath();
    saveSettings(path, { snapshotDir: '/x', redactSecrets: true, disablePullingSecrets: false });
    // Corrupt it after the fact.
    writeFileSync(path, '{ not valid json');
    expect(loadSettings(path, '/default')).toEqual({ snapshotDir: '/default', redactSecrets: true, disablePullingSecrets: false });
  });

  it('round-trips a saved settings object exactly', () => {
    const path = tempConfigPath();
    const settings: Settings = { snapshotDir: '/my/snaps', redactSecrets: false, disablePullingSecrets: true };
    saveSettings(path, settings);
    expect(loadSettings(path, '/default')).toEqual(settings);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(settings);
  });

  it('fills in individually missing fields from a partial file with defaults, not the whole-file default', () => {
    const path = tempConfigPath();
    saveSettings(path, { snapshotDir: '/only/this' } as Settings);
    expect(loadSettings(path, '/default')).toEqual({ snapshotDir: '/only/this', redactSecrets: true, disablePullingSecrets: false });
  });
});
