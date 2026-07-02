import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph, projectOwnerRef } from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '../test/fixtures/minikube.snapshot.json');

describe('ownerRef on real data (minikube fixture)', () => {
  it('resolves a Deployment → ReplicaSet → Pod chain', () => {
    const g = buildGraph(loadSnapshotFile(fixture));
    const parentKinds = (id: string) =>
      g.edges
        .filter((e) => e.type === 'ownerReference' && e.to === id)
        .map((e) => g.nodes.get(e.from));

    // find any Pod whose owner is a ReplicaSet whose owner is a Deployment
    let podId: string | undefined;
    for (const pod of [...g.nodes.values()].filter((r) => r.kind === 'Pod')) {
      const rs = parentKinds(pod.id).find((r) => r?.kind === 'ReplicaSet');
      if (rs && parentKinds(rs.id).some((r) => r?.kind === 'Deployment')) {
        podId = pod.id;
        break;
      }
    }
    expect(podId).toBeDefined();

    const kinds = projectOwnerRef(g, { resourceId: podId as string }).nodes.map((n) => n.kind);
    expect(kinds).toContain('Pod');
    expect(kinds).toContain('ReplicaSet');
    expect(kinds).toContain('Deployment');
  });
});

const BIG = '/Users/bob/temp/snapshots/aaa-mcm-2020-12-03-17h-16m-31s/vpk.snapshot.json';
describe('ownerRef scale (local only)', () => {
  it.skipIf(!existsSync(BIG))('builds many owner edges for the 85 MB snapshot', () => {
    const owner = buildGraph(loadSnapshotFile(BIG)).edges.filter((e) => e.type === 'ownerReference');
    expect(owner.length).toBeGreaterThan(1000);
  });
});
