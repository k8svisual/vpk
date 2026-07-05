import { describe, it, expect } from 'vitest';
import { colorForKind, KIND_COLOR } from './kindColors';

describe('colorForKind', () => {
  it('returns the canonical color for a listed kind', () => {
    expect(colorForKind('Secret')).toBe(KIND_COLOR.Secret);
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

  it('keeps Endpoints and EndpointSlice in the same blue hue family as Service (network category)', () => {
    expect(hueOf(KIND_COLOR.Service as string) - hueOf(KIND_COLOR.Endpoints as string)).toBeLessThan(20);
    expect(hueOf(KIND_COLOR.Service as string) - hueOf(KIND_COLOR.EndpointSlice as string)).toBeLessThan(20);
  });
});

function hueOf(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
