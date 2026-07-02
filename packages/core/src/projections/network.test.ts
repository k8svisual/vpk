import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildGraph } from '../graph';
import { projectNetworkServicesToPods } from './network';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../server/test/fixtures/minikube.snapshot.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { items: unknown[] };

describe('projectNetworkServicesToPods', () => {
  const graph = buildGraph(fixture.items as never);

  it('joins the kube-dns Service to its CoreDNS pods via Endpoints targetRef', () => {
    const cards = projectNetworkServicesToPods(graph, 'kube-system');
    const kubeDns = cards.find((c) => c.service.name === 'kube-dns');
    expect(kubeDns).toBeDefined();
    expect(kubeDns?.clusterIp).toBe('10.96.0.10');
    expect(kubeDns?.pods.length).toBe(2);
    expect(kubeDns?.pods.every((p) => p.pod.kind === 'Pod')).toBe(true);
    expect(kubeDns?.pods.every((p) => p.ready)).toBe(true);
    expect(kubeDns?.pods[0]?.nodeIp).toBeDefined();
  });

  it('returns a Service with no backing pods as an empty-pods card (not dropped)', () => {
    const cards = projectNetworkServicesToPods(graph, 'default');
    const kubernetes = cards.find((c) => c.service.name === 'kubernetes');
    expect(kubernetes).toBeDefined();
    expect(kubernetes?.pods).toEqual([]);
  });

  it('filters by namespace and sorts by service name', () => {
    const all = projectNetworkServicesToPods(graph);
    expect(all.length).toBeGreaterThanOrEqual(2);
    const names = all.map((c) => c.service.name);
    expect([...names].sort()).toEqual(names);
  });
});
