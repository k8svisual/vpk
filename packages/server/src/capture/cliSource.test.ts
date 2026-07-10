import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { buildGraph } from '@vpk/core';
import { captureCore, parseApiResourcesWide } from './cliSource';
import { SECRET_DATA_UNAVAILABLE, CONFIGMAP_DATA_UNAVAILABLE } from '../redact';

function clusterUp(): boolean {
  try {
    execSync('kubectl get --raw=/livez', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ocAvailable(): boolean {
  try {
    execSync('oc version --client', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('parseApiResourcesWide VERBS format', () => {
  // Real `kubectl api-resources -o wide` output (client 1.35 / server 1.32) — comma-joined, no brackets.
  const KUBECTL_MODERN = `NAME                                SHORTNAMES   APIVERSION                        NAMESPACED   KIND                               VERBS                                                        CATEGORIES
configmaps                          cm           v1                                true         ConfigMap                          create,delete,deletecollection,get,list,patch,update,watch
bindings                                         v1                                true         Binding                            create                                                       `;

  // Real `oc api-resources -o wide` output from oc v4.1.0 (client.GitVersion v4.1.0-201905191700, ~2019) —
  // bracketed, space-separated, and no CATEGORIES column at all. Captured live against a running cluster while
  // diagnosing this exact parsing gap (see cliSource.ts's own doc comment on parseApiResourcesWide).
  const OC_LEGACY = `NAME                                SHORTNAMES   APIGROUP                       NAMESPACED   KIND                               VERBS
configmaps                          cm                                          true         ConfigMap                          [create delete deletecollection get list patch update watch]
bindings                                                                        true         Binding                            [create]
componentstatuses                   cs                                          false        ComponentStatus                    [get list]`;

  it('parses the modern comma-joined VERBS format', () => {
    const resources = parseApiResourcesWide(KUBECTL_MODERN);
    // `bindings` only supports `create` (no `get`) — correctly excluded, same as the legacy-format test below.
    expect(resources.map((r) => r.name)).toEqual(['configmaps']);
  });

  it('parses the legacy bracketed, space-separated VERBS format (a real oc v4.1.0 client) without dropping every resource', () => {
    // Before the fix, `.split(',')` treated the whole bracketed string as ONE verb, `get` never matched, and
    // every resource — including get-able ones like ConfigMap — was silently dropped.
    const resources = parseApiResourcesWide(OC_LEGACY);
    expect(resources.map((r) => r.name)).toEqual(['componentstatuses', 'configmaps']);
    // `bindings` only supports `create` (no `get`) — correctly excluded either way, confirming this isn't
    // just "parse succeeds," it's "parse succeeds AND still filters correctly."
    expect(resources.map((r) => r.name)).not.toContain('bindings');
  });

  it('returns an empty list, not a throw, for unparseable input', () => {
    expect(parseApiResourcesWide('')).toEqual([]);
    expect(parseApiResourcesWide('just one line, no header match')).toEqual([]);
  });
});

describe.skipIf(!ocAvailable() || !clusterUp())('captureCore with a legacy oc client (live cluster)', () => {
  it(
    'captures a loadable snapshot via oc — confirms the VERBS-format fix end-to-end against a real old client, not just the parser fixture',
    async () => {
      const { items, manifest } = await captureCore({ cli: ['oc'] });
      expect(items.length).toBeGreaterThan(30);
      expect(manifest.kinds).toBeGreaterThan(10);
      const g = buildGraph(items);
      expect(g.nodes.size).toBeGreaterThan(30);
    },
    30_000,
  );
});

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
