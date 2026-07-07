import { describe, it, expect } from 'vitest';
import { parseQuantity, parseCpuQuantity, formatBytes } from './quantity';

describe('parseQuantity', () => {
  it('parses binary suffixes', () => {
    expect(parseQuantity('10Gi')).toBe(10 * 1024 ** 3);
    expect(parseQuantity('500Mi')).toBe(500 * 1024 ** 2);
    expect(parseQuantity('1Ki')).toBe(1024);
  });

  it('parses decimal suffixes', () => {
    expect(parseQuantity('1G')).toBe(1e9);
    expect(parseQuantity('2k')).toBe(2000);
  });

  it('parses bare numbers', () => {
    expect(parseQuantity('42')).toBe(42);
  });

  it('returns undefined for empty/unparseable input', () => {
    expect(parseQuantity(undefined)).toBeUndefined();
    expect(parseQuantity('')).toBeUndefined();
    expect(parseQuantity('not-a-quantity')).toBeUndefined();
  });
});

describe('parseCpuQuantity', () => {
  it('parses millicore suffix', () => {
    expect(parseCpuQuantity('500m')).toBe(0.5);
    expect(parseCpuQuantity('1500m')).toBe(1.5);
  });

  it('parses bare core counts the same as parseQuantity', () => {
    expect(parseCpuQuantity('2')).toBe(2);
  });

  it('returns undefined for empty/unparseable input', () => {
    expect(parseCpuQuantity(undefined)).toBeUndefined();
    expect(parseCpuQuantity('')).toBeUndefined();
  });
});

describe('formatBytes', () => {
  it('scales to the appropriate unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(10 * 1024 ** 3)).toBe('10 GB');
  });

  it('handles missing input', () => {
    expect(formatBytes(undefined)).toBe('—');
  });
});
