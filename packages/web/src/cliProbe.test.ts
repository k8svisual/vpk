import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeCli, probeStandalone } from './cliProbe';

// These lock in the fix for the "a server hiccup permanently freezes the CLI-fix UI" bug: the probe primitives
// must RESOLVE (to false / an error outcome), never reject — a rejection left the testers stuck on "checking…".

function fakeResponse(init: { ok?: boolean; status?: number; json: () => unknown }): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => init.json(),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('probeCli — never rejects', () => {
  it('resolves false when fetch rejects (server unreachable)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(probeCli('kubectl')).resolves.toBe(false);
  });

  it('resolves false on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 500, json: () => ({}) })));
    await expect(probeCli('kubectl')).resolves.toBe(false);
  });

  it('resolves false when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ json: () => { throw new SyntaxError('not json'); } })));
    await expect(probeCli('kubectl')).resolves.toBe(false);
  });

  it('resolves true when found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ json: () => ({ found: true }) })));
    await expect(probeCli('kubectl')).resolves.toBe(true);
  });
});

describe('runProbeCommand (via probeStandalone) — never rejects', () => {
  it('returns a reachability error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const out = await probeStandalone('grep');
    expect(out.ok).toBe(false);
    expect('error' in out && out.error).toContain('Could not reach');
  });

  it('returns an error outcome (not a throw) on a non-JSON 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 500, json: () => { throw new SyntaxError('html'); } })));
    const out = await probeStandalone('grep');
    expect(out.ok).toBe(false);
    expect('error' in out && out.error).toContain('500');
  });

  it('reports the server error field when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 403, json: () => ({ error: 'not allowed' }) })));
    const out = await probeStandalone('grep');
    expect(out).toEqual({ ok: false, error: 'not allowed' });
  });

  it('maps exit 0 to ok:true with the full result', async () => {
    const result = { argv: ['grep', '--help'], stdout: 'usage', stderr: '', exitCode: 0 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ json: () => result })));
    const out = await probeStandalone('grep');
    expect(out).toEqual({ ok: true, result });
  });
});
