import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

export interface ParsedImageRef {
  registry?: string;
  /** Registry + org path, EXCLUDING the final image-name segment, e.g. `quay.io/cp4mcm` (Container Images "Repository"). */
  repoPath: string;
  /** Final path segment only, e.g. `cp4mcm-orchestrator-catalog` (Container Images "Image", combined with tag/digest by the view). */
  imageName: string;
  tag?: string;
  digest?: string;
}

/**
 * Parse an OCI image reference into repoPath/imageName/tag/digest (DESIGN §6.10 Container Images view).
 * `quay.io/cp4mcm/cp4mcm-orchestrator-catalog:2.0.0` -> repoPath=quay.io/cp4mcm, imageName=cp4mcm-orchestrator-catalog, tag=2.0.0.
 * A bare `nginx:1.27` has no registry segment (implicit docker.io) so repoPath=docker.io, imageName=nginx.
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
  const pathNoTag = hasTag ? afterRegistry.slice(0, lastColon) : afterRegistry;

  const fullPath = registry ? `${registry}/${pathNoTag}` : pathNoTag;
  const lastSlash = fullPath.lastIndexOf('/');
  const repoPath = lastSlash !== -1 ? fullPath.slice(0, lastSlash) : 'docker.io';
  const imageName = lastSlash !== -1 ? fullPath.slice(lastSlash + 1) : fullPath;

  return { registry, repoPath, imageName, tag, digest };
}

/** Workload kinds whose pod template (spec.template.spec) declares images, independent of any running Pod. */
const TEMPLATED_WORKLOAD_KINDS = new Set(['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job']);

export interface ContainerImageUsage extends ParsedImageRef {
  image: string;
  resourceId: ResourceId;
  resourceName: string;
  /** Kind of the object whose pod-template (or, for a literal Pod, own spec) declared this container. */
  resourceKind: string;
  namespace?: string;
  /** The actual Namespace object's id, when that namespace exists as a resource in this snapshot — lets a
   *  caller open ITS definition (not just display its name), same idea as `resourceId` for the container's
   *  own resource. Absent for cluster-scoped usages, or if the Namespace object itself wasn't captured. */
  namespaceId?: ResourceId;
  containerName: string;
  initContainer: boolean;
  /** Index within its `containers`/`initContainers` array — lets a caller build a FocusPath straight to this
   *  container's node in the raw resource (see DefinitionModal's FocusPath), without re-deriving it by name. */
  containerIndex: number;
}

interface ContainerRaw {
  name?: string;
  image?: string;
}

interface PodSpecRaw {
  containers?: ContainerRaw[];
  initContainers?: ContainerRaw[];
}

/**
 * Flat resource x container usage list, one row per container (DESIGN §6.10). A container image is recorded
 * for every distinct object that declares it — a literal running Pod AND the Deployment/ReplicaSet/etc. whose
 * pod template names the same image — so the same image can show multiple "kind" branches per namespace.
 * Grouping (tree/table) is a view concern.
 */
export function projectContainerImages(graph: ResourceGraph): ContainerImageUsage[] {
  // OpenShift exposes every Namespace as a Project too (project.openshift.io/v1) — literally the same etcd
  // object, sharing its real uid — so normalize's uid-based dedup keeps only ONE of the two kind views per
  // namespace (whichever a snapshot happened to list last), never both. Accept either so the lookup still
  // resolves regardless of which view survived.
  const namespaceIds = new Map<string, ResourceId>();
  for (const r of graph.nodes.values()) if (r.kind === 'Namespace' || r.kind === 'Project') namespaceIds.set(r.name, r.id);

  const usages: ContainerImageUsage[] = [];
  for (const resource of graph.nodes.values()) {
    let spec: PodSpecRaw | undefined;
    if (resource.kind === 'Pod') {
      spec = resource.raw.spec as PodSpecRaw | undefined;
    } else if (TEMPLATED_WORKLOAD_KINDS.has(resource.kind)) {
      spec = (resource.raw.spec as { template?: { spec?: PodSpecRaw } } | undefined)?.template?.spec;
    } else if (resource.kind === 'CronJob') {
      spec = (resource.raw.spec as { jobTemplate?: { spec?: { template?: { spec?: PodSpecRaw } } } } | undefined)?.jobTemplate?.spec
        ?.template?.spec;
    } else {
      continue;
    }
    const namespaceId = resource.namespace ? namespaceIds.get(resource.namespace) : undefined;
    (spec?.containers ?? []).forEach((c, i) => usages.push(toUsage(resource, namespaceId, c, false, i)));
    (spec?.initContainers ?? []).forEach((c, i) => usages.push(toUsage(resource, namespaceId, c, true, i)));
  }
  return usages.sort(
    (a, b) =>
      a.repoPath.localeCompare(b.repoPath) ||
      a.imageName.localeCompare(b.imageName) ||
      (a.namespace ?? '').localeCompare(b.namespace ?? '') ||
      a.resourceKind.localeCompare(b.resourceKind) ||
      a.resourceName.localeCompare(b.resourceName),
  );
}

function toUsage(
  resource: { id: ResourceId; kind: string; name: string; namespace?: string },
  namespaceId: ResourceId | undefined,
  c: ContainerRaw,
  initContainer: boolean,
  containerIndex: number,
): ContainerImageUsage {
  const image = c.image ?? '';
  return {
    ...parseImageRef(image),
    image,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceKind: resource.kind,
    namespace: resource.namespace,
    namespaceId,
    containerName: c.name ?? '',
    initContainer,
    containerIndex,
  };
}
