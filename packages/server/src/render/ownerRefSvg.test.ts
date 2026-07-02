import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGraph, projectOwnerRef, type OwnerRefView } from '@vpk/core';
import { loadSnapshotFile } from '../snapshotFile';
import { renderOwnerRefSvg } from './ownerRefSvg';

describe('renderOwnerRefSvg', () => {
  it('emits an SVG with data-resource-id per node and one line per edge', () => {
    const view: OwnerRefView = {
      nodes: [
        { id: 'd1', kind: 'Deployment', apiVersion: 'apps/v1', name: 'app', labels: {}, annotations: {}, raw: {} },
        { id: 'r1', kind: 'ReplicaSet', apiVersion: 'apps/v1', name: 'app-rs', labels: {}, annotations: {}, raw: {} },
        { id: 'p1', kind: 'Pod', apiVersion: 'v1', name: 'app-pod', labels: {}, annotations: {}, raw: {} },
      ],
      edges: [
        { type: 'ownerReference', from: 'd1', to: 'r1' },
        { type: 'ownerReference', from: 'r1', to: 'p1' },
      ],
    };
    const svg = renderOwnerRefSvg(view);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('data-resource-id="d1"');
    expect(svg).toContain('data-resource-id="p1"');
    expect(svg).toContain('app-pod');
    expect(svg.match(/<line/g)?.length).toBe(2);
    expect(svg).toContain('var(--vpk-kind-deployment');
  });

  it('marks placeholder nodes and escapes text', () => {
    const view: OwnerRefView = {
      nodes: [{ id: 'x', kind: 'ReplicaSet', apiVersion: 'apps/v1', name: '', labels: {}, annotations: {}, raw: {}, placeholder: true }],
      edges: [],
    };
    const svg = renderOwnerRefSvg(view);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('&lt;not defined&gt;');
  });

  it('renders a real chain from the minikube fixture', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const g = buildGraph(loadSnapshotFile(join(here, '../../test/fixtures/minikube.snapshot.json')));
    const pod = [...g.nodes.values()].find(
      (r) =>
        r.kind === 'Pod' &&
        g.edges.some(
          (e) =>
            e.to === r.id &&
            g.nodes.get(e.from)?.kind === 'ReplicaSet' &&
            g.edges.some((e2) => e2.to === e.from && g.nodes.get(e2.from)?.kind === 'Deployment'),
        ),
    );
    expect(pod).toBeDefined();
    const svg = renderOwnerRefSvg(projectOwnerRef(g, { resourceId: pod!.id }));
    expect(svg).toContain('data-kind="Deployment"');
    expect(svg).toContain('data-kind="Pod"');
  });
});
