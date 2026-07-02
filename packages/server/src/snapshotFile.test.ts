import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalize } from '@vpk/core';
import { toItems, loadSnapshotFile } from './snapshotFile';

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
