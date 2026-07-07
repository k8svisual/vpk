import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { buildGraph } from '@vpk/core';
import { captureCore } from './cliSource';
import { SECRET_DATA_UNAVAILABLE, CONFIGMAP_DATA_UNAVAILABLE } from '../redact';

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
    'captures a loadable Core snapshot: real Secret data kept by default, managedFields stripped, owner edges present',
    async () => {
      const { items, manifest } = await captureCore({ cli: ['kubectl'] });

      expect(items.length).toBeGreaterThan(30);
      expect(manifest.kinds).toBeGreaterThan(10);

      // no managedFields anywhere
      expect(items.every((o) => o.metadata?.managedFields === undefined)).toBe(true);

      // Secrets are always captured, and keepSecretData defaults to true — the real payload survives capture
      // untouched (whether it's shown later is a `/definition`-time display decision, not a capture one).
      const secret = items.find((o) => o.kind === 'Secret' && o.data);
      if (secret) {
        const values = Object.values((secret as { data: Record<string, string> }).data);
        expect(values.length).toBeGreaterThan(0);
        expect(values.every((v) => v !== SECRET_DATA_UNAVAILABLE)).toBe(true);
      }

      // loads into a graph with ownership edges
      const g = buildGraph(items);
      expect(g.nodes.size).toBeGreaterThan(30);
      expect(g.edges.some((e) => e.type === 'ownerReference')).toBe(true);
    },
    30_000,
  );

  it(
    'captures the same number of Secret objects whether or not keepSecretData is set — the flag only affects the payload',
    async () => {
      const [kept, discarded] = await Promise.all([
        captureCore({ cli: ['kubectl'], keepSecretData: true }),
        captureCore({ cli: ['kubectl'], keepSecretData: false }),
      ]);
      const keptSecrets = kept.items.filter((o) => o.kind === 'Secret');
      const discardedSecrets = discarded.items.filter((o) => o.kind === 'Secret');

      // Secrets themselves are never skipped based on the flag — only their payload is affected.
      expect(discardedSecrets.length).toBe(keptSecrets.length);

      const withPayload = discardedSecrets.find((o) => o.data);
      if (withPayload) {
        const values = Object.values((withPayload as { data: Record<string, string> }).data);
        expect(values.length).toBeGreaterThan(0);
        expect(values.every((v) => v === SECRET_DATA_UNAVAILABLE)).toBe(true);
      }
    },
    30_000,
  );

  it(
    'captures the same number of ConfigMap objects whether or not keepConfigMapData is set — the flag only affects the payload',
    async () => {
      const [kept, discarded] = await Promise.all([
        captureCore({ cli: ['kubectl'], keepConfigMapData: true }),
        captureCore({ cli: ['kubectl'], keepConfigMapData: false }),
      ]);
      const keptConfigMaps = kept.items.filter((o) => o.kind === 'ConfigMap');
      const discardedConfigMaps = discarded.items.filter((o) => o.kind === 'ConfigMap');

      expect(discardedConfigMaps.length).toBe(keptConfigMaps.length);

      const withPayload = discardedConfigMaps.find((o) => o.data);
      if (withPayload) {
        const values = Object.values((withPayload as { data: Record<string, string> }).data);
        expect(values.length).toBeGreaterThan(0);
        expect(values.every((v) => v === CONFIGMAP_DATA_UNAVAILABLE)).toBe(true);
      }
    },
    30_000,
  );
});
