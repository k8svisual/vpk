import { describe, expect, it } from 'vitest';
import { deriveRequiredPaths, pathExists, pathValues } from './paths';

describe('pathExists', () => {
  it('finds a simple nested scalar', () => {
    expect(pathExists({ spec: { replicas: 3 } }, '.spec.replicas')).toBe(true);
  });

  it('is false when an intermediate segment is missing', () => {
    expect(pathExists({ spec: {} }, '.spec.replicas')).toBe(false);
  });

  it('treats an empty string as not meaningfully present', () => {
    expect(pathExists({ spec: { name: '' } }, '.spec.name')).toBe(false);
  });

  it('treats 0 and false as present (not empty)', () => {
    expect(pathExists({ spec: { replicas: 0 } }, '.spec.replicas')).toBe(true);
    expect(pathExists({ spec: { enabled: false } }, '.spec.enabled')).toBe(true);
  });

  it('wildcard requires the array non-empty AND every element to satisfy the rest of the path', () => {
    const obj = { spec: { template: { spec: { containers: [{ image: 'nginx' }, { image: 'redis' }] } } } };
    expect(pathExists(obj, '.spec.template.spec.containers[*].image')).toBe(true);
  });

  it('wildcard fails when ANY element is missing the field, not just when all are', () => {
    const obj = { spec: { template: { spec: { containers: [{ image: 'nginx' }, { name: 'sidecar' }] } } } };
    expect(pathExists(obj, '.spec.template.spec.containers[*].image')).toBe(false);
  });

  it('wildcard over an empty array is false', () => {
    expect(pathExists({ spec: { containers: [] } }, '.spec.containers[*].image')).toBe(false);
  });

  it('accepts a path without a leading dot', () => {
    expect(pathExists({ spec: { replicas: 3 } }, 'spec.replicas')).toBe(true);
  });
});

describe('pathValues', () => {
  it('returns a single-element array for a scalar path', () => {
    expect(pathValues({ spec: { replicas: 3 } }, '.spec.replicas')).toEqual([3]);
  });

  it('fans out over a wildcard', () => {
    const obj = { spec: { containers: [{ image: 'a' }, { image: 'b' }] } };
    expect(pathValues(obj, '.spec.containers[*].image')).toEqual(['a', 'b']);
  });

  it('returns an empty array when the path does not resolve', () => {
    expect(pathValues({ spec: {} }, '.spec.replicas')).toEqual([]);
  });
});

describe('deriveRequiredPaths', () => {
  it('walks .spec into leaf paths, turning arrays into [*] wildcards', () => {
    const obj = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'web' },
      spec: {
        replicas: 3,
        selector: { matchLabels: { app: 'web' } },
        template: { spec: { containers: [{ name: 'web', image: 'nginx:1.25' }] } },
      },
    };
    const paths = deriveRequiredPaths(obj);
    expect(paths).toContain('.spec.replicas');
    expect(paths).toContain('.spec.selector.matchLabels.app');
    expect(paths).toContain('.spec.template.spec.containers[*].name');
    expect(paths).toContain('.spec.template.spec.containers[*].image');
  });

  it('never derives from metadata or status', () => {
    const obj = { kind: 'Pod', metadata: { name: 'x', labels: { a: 'b' } }, status: { phase: 'Running' }, spec: { nodeName: 'n1' } };
    const paths = deriveRequiredPaths(obj);
    expect(paths).toEqual(['.spec.nodeName']);
  });

  it('returns [] when spec is absent or not an object', () => {
    expect(deriveRequiredPaths({ kind: 'Namespace', metadata: { name: 'ns' } })).toEqual([]);
  });

  it('skips empty-string leaves and empty containers in the reference itself', () => {
    const obj = { spec: { note: '', tags: [], extra: {}, replicas: 1 } };
    expect(deriveRequiredPaths(obj)).toEqual(['.spec.replicas']);
  });
});
