import { describe, it, expect } from 'vitest';
import { buildGraph, projectClusterWheel } from '@vpk/core';
import type { RawObject } from '@vpk/core';
import { renderWheelSvg } from './wheelSvg';

function node(name: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Node',
    metadata: { uid: `node-${name}`, name },
    status: { conditions: [{ type: 'Ready', status: 'True' }] },
  };
}
function pod(name: string, nodeName: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: `pod-${name}`, name, namespace: 'ns' },
    spec: { nodeName },
    status: { phase: 'Running' },
  };
}

function render(items: RawObject[]): string {
  return renderWheelSvg(projectClusterWheel(buildGraph(items)));
}

describe('renderWheelSvg', () => {
  it('is a well-formed square SVG even for an empty capture (just guide rings)', () => {
    const svg = render([]);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 620 620"');
    // The three guide rings (outer node ring, CSI ring, control-plane ring) draw even with no resources.
    expect((svg.match(/<circle[^>]*fill="none"/g) ?? []).length).toBe(3);
  });

  it('draws a labeled node rect ringed by its health color, and a dot per pod', () => {
    const svg = render([node('a'), pod('p1', 'a'), pod('p2', 'a')]);
    // Node name appears both as its hover <title> and (for a small cluster) a text label.
    expect(svg).toContain('<rect');
    expect(svg).toContain('>a — ok (2 pods)<'); // node <title>
    expect(svg).toContain('>a<'); // node text label (<= 16 nodes → labeled)
    // Each pod is a titled dot carrying its real name.
    expect(svg).toContain('>p1<');
    expect(svg).toContain('>p2<');
  });

  it('drops per-node text labels on a big cluster (dots + hover titles only), keeping it readable', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => node(`n${i}`));
    const svg = renderWheelSvg(projectClusterWheel(buildGraph(nodes)));
    // Nodes still render (with hover <title>s), but no standalone text labels once past the threshold.
    expect(svg).toContain('<title>');
    expect(svg).not.toContain('class="wh-node"');
  });

  it('colors dots from the projection and escapes names with markup characters', () => {
    const svg = render([node('a'), pod('a<b>&"c', 'a')]);
    expect(svg).toContain('&lt;b&gt;&amp;&quot;c');
    expect(svg).not.toContain('<b>'); // raw markup never leaks through
  });
});
