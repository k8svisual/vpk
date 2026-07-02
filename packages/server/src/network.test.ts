import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph } from '@vpk/core';
import { loadSnapshotFile } from './snapshotFile';
import { listNetworkServices } from './network';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, '../test/fixtures/minikube.snapshot.json');

describe('listNetworkServices', () => {
  it('produces lean DTOs with no raw payload', () => {
    const graph = buildGraph(loadSnapshotFile(fixture));
    const cards = listNetworkServices(graph, 'kube-system');
    const kubeDns = cards.find((c) => c.name === 'kube-dns');
    expect(kubeDns?.pods.length).toBe(2);
    for (const card of cards) {
      expect('raw' in card).toBe(false);
      for (const pod of card.pods) expect('raw' in pod).toBe(false);
    }
  });
});
