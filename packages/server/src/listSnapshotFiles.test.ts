import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSnapshotFiles } from './listSnapshotFiles';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vpk-snapshots-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('listSnapshotFiles', () => {
  it('lists flat .json files directly in the directory', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'minikube.snapshot.json'), '{}');
    writeFileSync(join(dir, 'notes.txt'), 'ignore me');
    expect(listSnapshotFiles(dir)).toEqual(['minikube.snapshot.json']);
  });

  it('finds .json files one level down in per-capture subdirectories', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'aaa-mcm-2020-12-03'));
    writeFileSync(join(dir, 'aaa-mcm-2020-12-03', 'vpk.snapshot.json'), '{}');
    mkdirSync(join(dir, 'bbb-cluster-2021-01-01'));
    writeFileSync(join(dir, 'bbb-cluster-2021-01-01', 'vpk.snapshot.json'), '{}');
    expect(listSnapshotFiles(dir)).toEqual(['aaa-mcm-2020-12-03/vpk.snapshot.json', 'bbb-cluster-2021-01-01/vpk.snapshot.json']);
  });

  it('combines flat files and subdirectory files together, sorted', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'minikube.snapshot.json'), '{}');
    mkdirSync(join(dir, 'aaa-capture'));
    writeFileSync(join(dir, 'aaa-capture', 'vpk.snapshot.json'), '{}');
    expect(listSnapshotFiles(dir)).toEqual(['aaa-capture/vpk.snapshot.json', 'minikube.snapshot.json']);
  });

  it('ignores an empty subdirectory and a subdirectory with no .json files', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'empty'));
    mkdirSync(join(dir, 'no-json'));
    writeFileSync(join(dir, 'no-json', 'readme.md'), 'nope');
    expect(listSnapshotFiles(dir)).toEqual([]);
  });

  it('excludes a capture directory\'s auxiliary JSON dumps, keeping only the actual snapshot', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'aaa-mcm-2020-12-03'));
    for (const f of ['components.json', 'explains.json', 'readyz.json', 'version.json']) {
      writeFileSync(join(dir, 'aaa-mcm-2020-12-03', f), '{}');
    }
    writeFileSync(join(dir, 'aaa-mcm-2020-12-03', 'vpk.snapshot.json'), '{}');
    expect(listSnapshotFiles(dir)).toEqual(['aaa-mcm-2020-12-03/vpk.snapshot.json']);
  });

  it('does not recurse more than one level deep', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'capture', 'nested'), { recursive: true });
    writeFileSync(join(dir, 'capture', 'nested', 'vpk.snapshot.json'), '{}');
    expect(listSnapshotFiles(dir)).toEqual([]);
  });

  it('returns an empty list for a directory that does not exist, rather than throwing', () => {
    expect(listSnapshotFiles('/nonexistent/path/for/sure')).toEqual([]);
  });
});
