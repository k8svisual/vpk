import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { buildGraph } from '@vpk/core';
import { captureCore } from './cliSource';

function clusterUp(): boolean {
  try {
    execSync('kubectl get --raw=/livez', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!clusterUp())('captureCore (live cluster)', () => {
  it(
    'captures a loadable Core snapshot: secrets redacted, managedFields stripped, owner edges present',
    async () => {
      const { items, manifest } = await captureCore({ cli: ['kubectl'] });

      expect(items.length).toBeGreaterThan(30);
      expect(manifest.kinds).toBeGreaterThan(10);

      // no managedFields anywhere
      expect(items.every((o) => o.metadata?.managedFields === undefined)).toBe(true);

      // secret values redacted (keys kept)
      const secret = items.find((o) => o.kind === 'Secret' && o.data);
      if (secret) {
        const values = Object.values((secret as { data: Record<string, string> }).data);
        expect(values.length).toBeGreaterThan(0);
        expect(values.every((v) => v === 'UkVEQUNURUQ=')).toBe(true);
      }

      // loads into a graph with ownership edges
      const g = buildGraph(items);
      expect(g.nodes.size).toBeGreaterThan(30);
      expect(g.edges.some((e) => e.type === 'ownerReference')).toBe(true);
    },
    30_000,
  );
});
