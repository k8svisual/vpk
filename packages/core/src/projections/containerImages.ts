import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

export interface ParsedImageRef {
  registry?: string;
  repository: string;
  tag?: string;
  digest?: string;
}

/**
 * Parse an OCI image reference into registry/repository/tag/digest (DESIGN §6.10 Container Images view).
 * `registry.k8s.io/coredns/coredns:v1.11.3` -> registry=registry.k8s.io, repository=coredns/coredns, tag=v1.11.3.
 * A bare `nginx:1.27` has no registry (implicit docker.io) and repository=nginx.
 */
export function parseImageRef(image: string): ParsedImageRef {
  let rest = image;
  let digest: string | undefined;

  const atIdx = rest.indexOf('@');
  if (atIdx !== -1) {
    digest = rest.slice(atIdx + 1);
    rest = rest.slice(0, atIdx);
  }

  const firstSlash = rest.indexOf('/');
  const looksLikeRegistry = firstSlash !== -1 && (rest.slice(0, firstSlash).includes('.') || rest.slice(0, firstSlash).includes(':'));
  const registry = looksLikeRegistry ? rest.slice(0, firstSlash) : undefined;
  const afterRegistry = looksLikeRegistry ? rest.slice(firstSlash + 1) : rest;

  const lastColon = afterRegistry.lastIndexOf(':');
  const hasTag = lastColon !== -1 && !afterRegistry.slice(lastColon + 1).includes('/');
  const tag = hasTag ? afterRegistry.slice(lastColon + 1) : undefined;
  const repository = hasTag ? afterRegistry.slice(0, lastColon) : afterRegistry;

  return { registry, repository, tag, digest };
}

export interface ContainerImageUsage extends ParsedImageRef {
  image: string;
  podId: ResourceId;
  podName: string;
  namespace?: string;
  containerName: string;
  initContainer: boolean;
}

interface ContainerRaw {
  name?: string;
  image?: string;
}

/** Flat pod x container usage list, one row per container (DESIGN §6.10). Grouping (tree/table) is a view concern. */
export function projectContainerImages(graph: ResourceGraph): ContainerImageUsage[] {
  const usages: ContainerImageUsage[] = [];
  for (const pod of graph.nodes.values()) {
    if (pod.kind !== 'Pod') continue;
    const spec = pod.raw.spec as { containers?: ContainerRaw[]; initContainers?: ContainerRaw[] } | undefined;
    for (const c of spec?.containers ?? []) usages.push(toUsage(pod, c, false));
    for (const c of spec?.initContainers ?? []) usages.push(toUsage(pod, c, true));
  }
  return usages.sort((a, b) => a.repository.localeCompare(b.repository) || a.podName.localeCompare(b.podName));
}

function toUsage(pod: { id: ResourceId; name: string; namespace?: string }, c: ContainerRaw, initContainer: boolean): ContainerImageUsage {
  const image = c.image ?? '';
  return {
    ...parseImageRef(image),
    image,
    podId: pod.id,
    podName: pod.name,
    namespace: pod.namespace,
    containerName: c.name ?? '',
    initContainer,
  };
}
