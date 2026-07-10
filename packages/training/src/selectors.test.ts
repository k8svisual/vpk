import { describe, expect, it } from 'vitest';
import { buildGraph, type RawObject } from '@vpk/core';
import { inventoryOf, inventoryOfObjects, resourcesInNamespace, selectResources } from './selectors';

const deploy: RawObject = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { uid: 'd1', name: 'web', namespace: 'student-a', labels: { app: 'web' } },
  spec: { replicas: 2 },
};
const svc: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 's1', name: 'web', namespace: 'student-a' },
  spec: { type: 'ClusterIP' },
};
const otherNsDeploy: RawObject = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { uid: 'd2', name: 'web', namespace: 'student-b' },
  spec: { replicas: 1 },
};

describe('selectResources', () => {
  const graph = buildGraph([deploy, svc, otherNsDeploy]);

  it('matches by kind within a namespace', () => {
    const found = selectResources(graph, 'student-a', { kind: 'Deployment' });
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe('web');
  });

  it('does not cross namespaces', () => {
    expect(selectResources(graph, 'student-a', { kind: 'Deployment' }).map((r) => r.namespace)).toEqual(['student-a']);
  });

  it('narrows by name', () => {
    expect(selectResources(graph, 'student-a', { kind: 'Deployment', name: 'nope' })).toHaveLength(0);
    expect(selectResources(graph, 'student-a', { kind: 'Deployment', name: 'web' })).toHaveLength(1);
  });

  it('narrows by labels (all must match)', () => {
    expect(selectResources(graph, 'student-a', { kind: 'Deployment', labels: { app: 'web' } })).toHaveLength(1);
    expect(selectResources(graph, 'student-a', { kind: 'Deployment', labels: { app: 'other' } })).toHaveLength(0);
  });
});

describe('resourcesInNamespace / inventoryOf', () => {
  const graph = buildGraph([deploy, svc, otherNsDeploy]);

  it('lists every real resource in a namespace, any kind', () => {
    expect(resourcesInNamespace(graph, 'student-a').map((r) => r.kind).sort()).toEqual(['Deployment', 'Service']);
  });

  it('counts by kind', () => {
    expect(inventoryOf(graph, 'student-a')).toEqual({ Deployment: 1, Service: 1 });
  });

  it('is empty for a namespace with nothing in it', () => {
    expect(inventoryOf(graph, 'nowhere')).toEqual({});
  });
});

describe('inventoryOfObjects', () => {
  it('counts kinds across a raw fixture manifest, ignoring objects with no kind', () => {
    const objs: RawObject[] = [{ kind: 'Deployment' }, { kind: 'Service' }, { kind: 'Service' }, {}];
    expect(inventoryOfObjects(objs)).toEqual({ Deployment: 1, Service: 2 });
  });
});
