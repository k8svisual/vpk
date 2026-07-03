import { describe, it, expect } from 'vitest';
import { colorForKind, KIND_COLOR } from './kindColors';

describe('colorForKind', () => {
  it('returns the canonical color for a listed kind', () => {
    expect(colorForKind('ConfigMap')).toBe(KIND_COLOR.ConfigMap);
    expect(colorForKind('Service')).toBe(KIND_COLOR.Service);
  });

  it('returns a stable fallback color for an unlisted kind, not undefined', () => {
    const a = colorForKind('SomeCustomResource');
    const b = colorForKind('SomeCustomResource');
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('gives different unlisted kinds different fallback colors (not all collapsing to one gray)', () => {
    const colors = new Set(['Foo', 'Bar', 'Baz', 'Qux', 'Quux'].map(colorForKind));
    expect(colors.size).toBeGreaterThan(1);
  });
});
