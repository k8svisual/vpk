import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildGraph } from '../graph';
import { parseImageRef, projectContainerImages } from './containerImages';
import type { RawObject } from '../types';

describe('parseImageRef', () => {
  it('splits repoPath (registry + org path) from the final image-name segment', () => {
    expect(parseImageRef('quay.io/cp4mcm/cp4mcm-orchestrator-catalog:2.0.0')).toEqual({
      registry: 'quay.io',
      repoPath: 'quay.io/cp4mcm',
      imageName: 'cp4mcm-orchestrator-catalog',
      tag: '2.0.0',
      digest: undefined,
    });
  });

  it('parses a single-segment repository as repoPath=registry', () => {
    expect(parseImageRef('registry.k8s.io/etcd:3.5.16-0')).toEqual({
      registry: 'registry.k8s.io',
      repoPath: 'registry.k8s.io',
      imageName: 'etcd',
      tag: '3.5.16-0',
      digest: undefined,
    });
  });

  it('treats a bare image (no registry segment) as implicit docker.io', () => {
    expect(parseImageRef('nginx:1.27')).toEqual({
      registry: undefined,
      repoPath: 'docker.io',
      imageName: 'nginx',
      tag: '1.27',
      digest: undefined,
    });
  });

  it('parses a digest-pinned image with no tag', () => {
    const parsed = parseImageRef('registry.k8s.io/pause@sha256:abc123');
    expect(parsed.repoPath).toBe('registry.k8s.io');
    expect(parsed.imageName).toBe('pause');
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

  it('produces one row per container, including pod-template declarations from owning workloads', () => {
    // 8 pods (1 container each) + coredns Deployment + coredns ReplicaSet + kindnet DaemonSet + kube-proxy DaemonSet
    expect(usages.length).toBe(12);
    const repos = usages.map((u) => u.repoPath);
    expect([...repos].sort()).toEqual(repos);
  });

  it('groups coredns and kube-proxy under distinct repositories', () => {
    const coredns = usages.find((u) => u.resourceKind === 'Pod' && u.resourceName.startsWith('coredns-'));
    expect(coredns?.repoPath).toBe('registry.k8s.io/coredns');
    expect(coredns?.imageName).toBe('coredns');
    expect(coredns?.registry).toBe('registry.k8s.io');
    expect(coredns?.tag).toBe('v1.11.3');
  });

  it('records the same image under multiple kind branches for a Deployment-owned Pod', () => {
    const coredns = usages.filter((u) => u.imageName === 'coredns');
    const kinds = new Set(coredns.map((u) => u.resourceKind));
    expect(kinds).toEqual(new Set(['Pod', 'Deployment', 'ReplicaSet']));
  });
});
