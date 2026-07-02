import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildGraph } from '../graph';
import { parseImageRef, projectContainerImages } from './containerImages';
import type { RawObject } from '../types';

describe('parseImageRef', () => {
  it('parses a multi-segment repository with an explicit registry and tag', () => {
    expect(parseImageRef('registry.k8s.io/coredns/coredns:v1.11.3')).toEqual({
      registry: 'registry.k8s.io',
      repository: 'coredns/coredns',
      tag: 'v1.11.3',
      digest: undefined,
    });
  });

  it('parses a single-segment repository', () => {
    expect(parseImageRef('registry.k8s.io/etcd:3.5.16-0')).toEqual({
      registry: 'registry.k8s.io',
      repository: 'etcd',
      tag: '3.5.16-0',
      digest: undefined,
    });
  });

  it('treats a bare image (no registry segment) as implicit docker.io', () => {
    expect(parseImageRef('nginx:1.27')).toEqual({ registry: undefined, repository: 'nginx', tag: '1.27', digest: undefined });
  });

  it('parses a digest-pinned image with no tag', () => {
    const parsed = parseImageRef('registry.k8s.io/pause@sha256:abc123');
    expect(parsed.repository).toBe('pause');
    expect(parsed.digest).toBe('sha256:abc123');
    expect(parsed.tag).toBeUndefined();
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../../../server/test/fixtures/minikube.snapshot.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { items: RawObject[] };

describe('projectContainerImages (real minikube fixture)', () => {
  const graph = buildGraph(fixture.items);
  const usages = projectContainerImages(graph);

  it('produces one row per pod container, sorted by repository', () => {
    expect(usages.length).toBe(8); // 8 pods, 1 container each in this fixture
    const repos = usages.map((u) => u.repository);
    expect([...repos].sort()).toEqual(repos);
  });

  it('groups coredns and kube-proxy under distinct repositories', () => {
    const coredns = usages.find((u) => u.podName.startsWith('coredns-'));
    expect(coredns?.repository).toBe('coredns/coredns');
    expect(coredns?.registry).toBe('registry.k8s.io');
    expect(coredns?.tag).toBe('v1.11.3');
  });
});
