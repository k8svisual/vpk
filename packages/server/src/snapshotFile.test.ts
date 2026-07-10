import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalize } from '@vpk/core';
import { toItems, loadSnapshotFile, loadSnapshotExplains } from './snapshotFile';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '../test/fixtures');

describe('snapshot file loading', () => {
  it('reads the new {manifest, items[]} format', () => {
    const items = loadSnapshotFile(join(fixtures, 'minikube.snapshot.json'));
    expect(items.length).toBeGreaterThan(50);
    expect(items.every((o) => typeof o.kind === 'string')).toBe(true);
  });

  it('reads the legacy {fnum: obj} format via Object.values', () => {
    const legacy = {
      '1000': { kind: 'Pod', metadata: { name: 'a' } },
      '1001': { kind: 'Service', metadata: { name: 'b' } },
    };
    expect(toItems(legacy)).toHaveLength(2);
  });

  it('ignores non-object values in a legacy map', () => {
    expect(toItems({ note: 'x', '1000': { kind: 'Pod' } })).toHaveLength(1);
  });

  it('end-to-end: fixture loads and normalizes', () => {
    const { nodes } = normalize(loadSnapshotFile(join(fixtures, 'minikube.snapshot.json')));
    expect(nodes.size).toBeGreaterThan(50);
  });
});

describe('loadSnapshotExplains', () => {
  function tempSnapshotDir(): string {
    return mkdtempSync(join(tmpdir(), 'vpk-explains-test-'));
  }

  it("returns {} when neither the snapshot's inline explains nor a sidecar explains.json exists", () => {
    const dir = tempSnapshotDir();
    const path = join(dir, 'vpk.snapshot.json');
    writeFileSync(path, JSON.stringify({ manifest: {}, items: [] }));
    expect(loadSnapshotExplains(path)).toEqual({});
    rmSync(dir, { recursive: true, force: true });
  });

  it('prefers the inline explains field over a sidecar explains.json when both are present', () => {
    const dir = tempSnapshotDir();
    const path = join(dir, 'vpk.snapshot.json');
    writeFileSync(path, JSON.stringify({ manifest: {}, items: [], explains: { Pod: 'inline description' } }));
    writeFileSync(join(dir, 'explains.json'), JSON.stringify({ Pod: 'sidecar description' }));
    expect(loadSnapshotExplains(path)).toEqual({ Pod: 'inline description' });
    rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to a sidecar explains.json (flat {Kind: description} shape) when the snapshot has no inline explains', () => {
    const dir = tempSnapshotDir();
    const path = join(dir, 'vpk.snapshot.json');
    writeFileSync(path, JSON.stringify({ manifest: {}, items: [] }));
    writeFileSync(join(dir, 'explains.json'), JSON.stringify({ Pod: 'a pod is...', Service: 'a service is...' }));
    expect(loadSnapshotExplains(path)).toEqual({ Pod: 'a pod is...', Service: 'a service is...' });
    rmSync(dir, { recursive: true, force: true });
  });

  it('also accepts a sidecar explains.json wrapped in an { explains: {...} } shape', () => {
    const dir = tempSnapshotDir();
    const path = join(dir, 'vpk.snapshot.json');
    writeFileSync(path, JSON.stringify({ manifest: {}, items: [] }));
    writeFileSync(join(dir, 'explains.json'), JSON.stringify({ explains: { Pod: 'wrapped description' } }));
    expect(loadSnapshotExplains(path)).toEqual({ Pod: 'wrapped description' });
    rmSync(dir, { recursive: true, force: true });
  });

  it('ignores a malformed sidecar explains.json rather than throwing', () => {
    const dir = tempSnapshotDir();
    const path = join(dir, 'vpk.snapshot.json');
    writeFileSync(path, JSON.stringify({ manifest: {}, items: [] }));
    writeFileSync(join(dir, 'explains.json'), 'not valid json{{{');
    expect(loadSnapshotExplains(path)).toEqual({});
    rmSync(dir, { recursive: true, force: true });
  });
});

// Scale check against the real 85 MB legacy snapshot — skipped in CI (file not present there).
const BIG = '/Users/bob/temp/snapshots/aaa-mcm-2020-12-03-17h-16m-31s/vpk.snapshot.json';
describe('scale (local only)', () => {
  it.skipIf(!existsSync(BIG))('loads + normalizes the 85 MB legacy snapshot, deduping redundant objects', () => {
    const items = loadSnapshotFile(BIG);
    const { nodes, deduped } = normalize(items);
    expect(items.length).toBeGreaterThan(11000); // ~11,319 raw items
    expect(nodes.size).toBeGreaterThan(10000); // ~10,695 distinct identities
    expect(deduped).toBeGreaterThan(500); // legacy snapshot double-stores Namespaces/ImageStreams/etc.
    expect(items.length - deduped).toBe(nodes.size); // accounting adds up
  });
});
