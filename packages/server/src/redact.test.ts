import { describe, it, expect } from 'vitest';
import type { RawObject } from '@vpk/core';
import { redactSecret, SECRET_DATA_UNAVAILABLE, redactConfigMap, CONFIGMAP_DATA_UNAVAILABLE } from './redact';

describe('redactSecret', () => {
  it('replaces every value in .data and .stringData with the "not available" message, keeping the keys', () => {
    const secret: RawObject = {
      kind: 'Secret',
      metadata: { name: 's', namespace: 'ns' },
      data: { password: 'aGVsbG8=', token: 'd29ybGQ=' },
      stringData: { note: 'plain text secret' },
    };
    const out = redactSecret(secret);
    expect(Object.keys(out.data as Record<string, string>).sort()).toEqual(['password', 'token']);
    expect(Object.values(out.data as Record<string, string>).every((v) => v === SECRET_DATA_UNAVAILABLE)).toBe(true);
    expect(out.stringData).toEqual({ note: SECRET_DATA_UNAVAILABLE });
  });

  it('is a no-op for anything that is not a Secret', () => {
    const configMap: RawObject = { kind: 'ConfigMap', data: { key: 'value' } };
    expect(redactSecret(configMap)).toBe(configMap);
  });

  it('handles a Secret with no .data/.stringData without crashing', () => {
    const secret: RawObject = { kind: 'Secret', metadata: { name: 'empty' } };
    expect(redactSecret(secret)).toEqual(secret);
  });
});

describe('redactConfigMap', () => {
  it('replaces every value in .data and .binaryData with the "not available" message, keeping the keys', () => {
    const cm: RawObject = {
      kind: 'ConfigMap',
      metadata: { name: 'cm', namespace: 'ns' },
      data: { 'app.conf': 'connection-string=...' },
      binaryData: { 'cert.der': 'aGVsbG8=' },
    };
    const out = redactConfigMap(cm);
    expect(out.data).toEqual({ 'app.conf': CONFIGMAP_DATA_UNAVAILABLE });
    expect(out.binaryData).toEqual({ 'cert.der': CONFIGMAP_DATA_UNAVAILABLE });
  });

  it('is a no-op for anything that is not a ConfigMap', () => {
    const secret: RawObject = { kind: 'Secret', data: { key: 'value' } };
    expect(redactConfigMap(secret)).toBe(secret);
  });

  it('handles a ConfigMap with no .data/.binaryData without crashing', () => {
    const cm: RawObject = { kind: 'ConfigMap', metadata: { name: 'empty' } };
    expect(redactConfigMap(cm)).toEqual(cm);
  });
});
