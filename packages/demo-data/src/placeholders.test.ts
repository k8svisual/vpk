import { describe, it, expect } from 'vitest';
import { extractPlaceholders, fillTemplate, resolvePattern } from './placeholders';
import { DEMO_TEMPLATES } from './demoTemplates';
import type { RawObject } from '@vpk/core';

describe('extractPlaceholders', () => {
  it('finds every distinct {{placeholder}} in a template, deduplicated', () => {
    const template: RawObject = {
      metadata: { name: '{{name}}', namespace: '{{namespace}}' },
      spec: { nodeName: '{{nodeName}}', other: '{{namespace}}' },
    };
    expect(extractPlaceholders(template).sort()).toEqual(['name', 'namespace', 'nodeName'].sort());
  });

  it("covers every placeholder Node's template documents", () => {
    const found = new Set(extractPlaceholders(DEMO_TEMPLATES.Node as RawObject));
    for (const key of [
      'name', 'role', 'internalIP', 'cpuCapacity', 'cpuAllocatable', 'memCapacityKi', 'memAllocatableKi',
      'podCapacity', 'podAllocatable', 'ephemeralStorageCapacity', 'ephemeralStorageAllocatable', 'machineID',
      'systemUUID', 'bootID',
    ]) {
      expect(found.has(key)).toBe(true);
    }
  });

  it('returns an empty array for a template with no placeholders', () => {
    expect(extractPlaceholders({ kind: 'Foo' })).toEqual([]);
  });
});

describe('fillTemplate', () => {
  it('substitutes a placeholder appearing as a plain value', () => {
    const filled = fillTemplate({ metadata: { name: '{{name}}' } }, { name: 'demo-node-1' });
    expect(filled).toEqual({ metadata: { name: 'demo-node-1' } });
  });

  it('substitutes a placeholder appearing as an object KEY, not just a value', () => {
    const filled = fillTemplate({ labels: { 'node-role.kubernetes.io/{{role}}': '' } }, { role: 'worker' });
    expect(filled).toEqual({ labels: { 'node-role.kubernetes.io/worker': '' } });
  });

  it('fully fills the real Node template end to end (role label collapses to exactly one)', () => {
    const values = {
      name: 'demo-node-1',
      role: 'worker',
      internalIP: '10.0.0.1',
      cpuCapacity: '8',
      cpuAllocatable: '7500m',
      memCapacityKi: '16000000Ki',
      memAllocatableKi: '15000000Ki',
      podCapacity: '110',
      podAllocatable: '110',
      ephemeralStorageCapacity: '100000000',
      ephemeralStorageAllocatable: '95000000',
      machineID: 'aaaa',
      systemUUID: 'bbbb',
      bootID: 'cccc',
    };
    const filled = fillTemplate(DEMO_TEMPLATES.Node as RawObject, values) as {
      metadata: { name: string; labels: Record<string, string> };
      status: { addresses: { address: string; type: string }[]; capacity: { cpu: string } };
    };
    expect(filled.metadata.name).toBe('demo-node-1');
    expect(filled.metadata.labels['node-role.kubernetes.io/worker']).toBe('');
    expect(filled.metadata.labels['node-role.kubernetes.io/master']).toBeUndefined();
    expect(filled.status.addresses.find((a) => a.type === 'InternalIP')?.address).toBe('10.0.0.1');
    expect(filled.status.capacity.cpu).toBe('8');
  });

  it('throws instead of silently shipping a leftover {{placeholder}} when a value is missing', () => {
    expect(() => fillTemplate({ metadata: { name: '{{name}}' } }, {})).toThrow(/name/);
  });
});

describe('resolvePattern', () => {
  it('replaces {n} with the 1-based index, unbounded', () => {
    expect(resolvePattern('demo-node-{n}', 3)).toBe('demo-node-3');
    expect(resolvePattern('demo-node-{n}', 501)).toBe('demo-node-501');
  });

  it('passes a pattern with no tokens through unchanged', () => {
    expect(resolvePattern('worker', 3)).toBe('worker');
  });

  it('cycles a single range with an implicit step of 1, wrapping at the top', () => {
    // {50-200}: 151 distinct values (50..200 inclusive)
    expect(resolvePattern('{50-200}', 1)).toBe('50');
    expect(resolvePattern('{50-200}', 2)).toBe('51');
    expect(resolvePattern('{50-200}', 151)).toBe('200');
    expect(resolvePattern('{50-200}', 152)).toBe('50'); // wraps
    expect(resolvePattern('{50-200}', 303)).toBe('50'); // wraps again (2 full cycles)
  });

  it('cycles a range with an explicit step', () => {
    // {16-384,4}: 16, 20, 24, ..., 384 -> 93 distinct values
    expect(resolvePattern('{16-384,4}', 1)).toBe('16');
    expect(resolvePattern('{16-384,4}', 2)).toBe('20');
    expect(resolvePattern('{16-384,4}', 93)).toBe('384');
    expect(resolvePattern('{16-384,4}', 94)).toBe('16'); // wraps
  });

  it('embeds a resolved range inside surrounding literal text', () => {
    expect(resolvePattern('{16-384,4}m', 2)).toBe('20m');
  });

  it('walks a two-token pattern like an odometer — rightmost token fastest, carries into the left one', () => {
    // 10.0.{0-255}.{0-255}: 256 * 256 = 65536 combinations
    expect(resolvePattern('10.0.{0-255}.{0-255}', 1)).toBe('10.0.0.0');
    expect(resolvePattern('10.0.{0-255}.{0-255}', 2)).toBe('10.0.0.1');
    expect(resolvePattern('10.0.{0-255}.{0-255}', 256)).toBe('10.0.0.255');
    expect(resolvePattern('10.0.{0-255}.{0-255}', 257)).toBe('10.0.1.0'); // carry into the third octet
    expect(resolvePattern('10.0.{0-255}.{0-255}', 512)).toBe('10.0.1.255');
    expect(resolvePattern('10.0.{0-255}.{0-255}', 513)).toBe('10.0.2.0');
  });

  it('generates a fresh random UUID per call for {guid}, ignoring the index', () => {
    const a = resolvePattern('{guid}', 1);
    const b = resolvePattern('{guid}', 1);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(a).not.toBe(b);
  });

  it('throws on a malformed range token instead of silently passing it through', () => {
    expect(() => resolvePattern('{200-50}', 1)).toThrow(/Invalid range/);
    expect(() => resolvePattern('{notarange}', 1)).toThrow(/Unrecognized pattern token/);
  });

  it('{from-to,Random} draws a fresh uniformly-random integer in range each call, independent of index', () => {
    for (let i = 0; i < 50; i++) {
      const n = Number(resolvePattern('{1-10,Random}', 1));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
    }
    // Same index, different calls — not deterministic like a sequential range would be.
    const values = new Set(Array.from({ length: 30 }, () => resolvePattern('{1-10,Random}', 1)));
    expect(values.size).toBeGreaterThan(1);
  });

  it('a {from-to,Random} token does not participate in a sequential range odometer alongside it', () => {
    // The sequential {0-255} octet should still walk in lockstep with the index; the Random one is along
    // for the ride independently.
    const a = resolvePattern('10.0.{1-10,Random}.{0-255}', 1);
    const b = resolvePattern('10.0.{1-10,Random}.{0-255}', 2);
    expect(a.split('.')[3]).toBe('0');
    expect(b.split('.')[3]).toBe('1');
  });

  it('{image} generates a repo/name:tag reference from one of the three demo registries', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(resolvePattern('{image}', 1));
    for (const ref of seen) {
      expect(ref).toMatch(/^demo-registry-[abc]\.example\.com\/apps\/[a-z]+-[0-9a-f]+:[a-z0-9]+$/);
    }
    expect(seen.size).toBeGreaterThan(1); // extremely unlikely to collide 50 times if truly random
  });
});
