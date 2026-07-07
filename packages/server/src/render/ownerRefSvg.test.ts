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
    expect(svg).not.toContain('#ff3b30'); // no focusId passed — no node should get the halo
  });

  it('draws a bold halo around the focus node only, when a focusId is given', () => {
    const view: OwnerRefView = {
      nodes: [
        { id: 'd1', kind: 'Deployment', apiVersion: 'apps/v1', name: 'app', labels: {}, annotations: {}, raw: {} },
        { id: 'p1', kind: 'Pod', apiVersion: 'v1', name: 'app-pod', labels: {}, annotations: {}, raw: {} },
      ],
      edges: [{ type: 'ownerReference', from: 'd1', to: 'p1' }],
    };
    const svg = renderOwnerRefSvg(view, 'p1');
    // Exactly one halo rect (the focus node's own <g> comes first in doc order for d1, then p1's halo+rect).
    const haloMatches = [...svg.matchAll(/stroke="#ff3b30"/g)];
    // One halo rect (stroke-width 4) + one bold rect stroke (stroke-width 3) = 2 uses of the focus color.
    expect(haloMatches.length).toBe(2);
    const p1Group = /<g class="orf-node" data-resource-id="p1"[^]*?<\/g>/.exec(svg)?.[0] ?? '';
    const d1Group = /<g class="orf-node" data-resource-id="d1"[^]*?<\/g>/.exec(svg)?.[0] ?? '';
    expect(p1Group).toContain('#ff3b30');
    expect(d1Group).not.toContain('#ff3b30');
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
    const svg = renderOwnerRefSvg(projectOwnerRef(g, { resourceId: pod!.id }), pod!.id);
    expect(svg).toContain('data-kind="Deployment"');
    expect(svg).toContain('data-kind="Pod"');
    const podGroup = new RegExp(`<g class="orf-node" data-resource-id="${pod!.id}"[^]*?</g>`).exec(svg)?.[0] ?? '';
    expect(podGroup).toContain('#ff3b30');
  });
});
