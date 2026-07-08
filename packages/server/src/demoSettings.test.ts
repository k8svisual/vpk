import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoSettingsAppPath, demoSettingsSnapshotDirPath, saveDemoSettings, loadDemoSettings } from './demoSettings';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vpk-demo-settings-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('demoSettingsAppPath / demoSettingsSnapshotDirPath', () => {
  it('places the app-directory file next to the given configPath, not inside it', () => {
    const configPath = join(tempDir(), 'vpkconfig.json');
    expect(demoSettingsAppPath(configPath)).toBe(join(configPath, '..', 'demo-data-settings.json'));
  });

  it('places the snapshot-directory file at the root of the given snapshotDir', () => {
    const snapshotDir = tempDir();
    expect(demoSettingsSnapshotDirPath(snapshotDir)).toBe(join(snapshotDir, 'demo-data-settings.json'));
  });
});

describe('saveDemoSettings / loadDemoSettings', () => {
  it('returns null when nothing has been saved there yet, rather than throwing', () => {
    expect(loadDemoSettings(join(tempDir(), 'demo-data-settings.json'))).toBeNull();
  });

  it('round-trips a saved settings blob exactly', () => {
    const path = join(tempDir(), 'demo-data-settings.json');
    const blob = { bundleNamespace: 'default', pvcPercent: 15, kindForms: { Node: { count: 10, values: { role: 'worker' } } } };
    saveDemoSettings([path], blob);
    expect(loadDemoSettings(path)).toEqual(blob);
  });

  it('writes to every given path', () => {
    const pathA = join(tempDir(), 'a.json');
    const pathB = join(tempDir(), 'b.json');
    saveDemoSettings([pathA, pathB], { foo: 'bar' });
    expect(existsSync(pathA)).toBe(true);
    expect(existsSync(pathB)).toBe(true);
    expect(loadDemoSettings(pathA)).toEqual({ foo: 'bar' });
    expect(loadDemoSettings(pathB)).toEqual({ foo: 'bar' });
  });

  it('returns null for corrupt JSON rather than throwing', () => {
    const dir = tempDir();
    const path = join(dir, 'demo-data-settings.json');
    saveDemoSettings([path], { ok: true });
    // Corrupt it after the fact.
    writeFileSync(path, '{ not valid json');
    expect(loadDemoSettings(path)).toBeNull();
  });
});
