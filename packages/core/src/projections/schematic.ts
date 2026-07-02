import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

interface ContainerRaw {
  name?: string;
  image?: string;
  envFrom?: { configMapRef?: { name?: string }; secretRef?: { name?: string } }[];
  env?: { valueFrom?: { configMapKeyRef?: { name?: string }; secretKeyRef?: { name?: string } } }[];
}
interface ContainerStatusRaw {
  name?: string;
  ready?: boolean;
  restartCount?: number;
  state?: { running?: unknown; waiting?: { reason?: string }; terminated?: { reason?: string } };
}
interface VolumeRaw {
  configMap?: { name?: string };
  secret?: { secretName?: string };
  persistentVolumeClaim?: { claimName?: string };
  projected?: { sources?: { configMap?: { name?: string }; secret?: { name?: string } }[] };
}
interface ConditionRaw {
  type?: string;
  status?: string;
}

export interface SchematicContainer {
  name: string;
  image?: string;
  ready?: boolean;
  restartCount?: number;
  stateLabel?: string;
}
export interface SchematicRef {
  id: ResourceId;
  name: string;
  kind: string;
}
export interface SchematicOwnerLink {
  id: ResourceId;
  kind: string;
  name: string;
}

export interface PodSchematic {
  pod: Resource;
  phase?: string;
  conditions: ConditionRaw[];
  containers: SchematicContainer[];
  initContainers: SchematicContainer[];
  /** Root -> immediate parent (the Pod itself is not included). */
  ownerChain: SchematicOwnerLink[];
  generatorLabel?: string;
  config: { configMaps: SchematicRef[]; secrets: SchematicRef[] };
  network: { services: SchematicRef[] };
  /** pvcs -> their bound pvs -> those pvs' storage classes (DESIGN §6.9 pvc<-pv<-sc chain). */
  storage: { pvcs: SchematicRef[]; pvs: SchematicRef[]; storageClasses: SchematicRef[] };
  security: { serviceAccount?: SchematicRef };
}

function stateLabel(state: ContainerStatusRaw['state']): string | undefined {
  if (!state) return undefined;
  if (state.running) return 'Running';
  if (state.terminated) return state.terminated.reason ?? 'Terminated';
  if (state.waiting) return state.waiting.reason ?? 'Waiting';
  return undefined;
}

function toContainers(specList: ContainerRaw[], statusList: ContainerStatusRaw[]): SchematicContainer[] {
  const statusByName = new Map(statusList.map((s) => [s.name, s]));
  return specList.map((c) => {
    const status = c.name ? statusByName.get(c.name) : undefined;
    return {
      name: c.name ?? '',
      image: c.image,
      ready: status?.ready,
      restartCount: status?.restartCount,
      stateLabel: stateLabel(status?.state),
    };
  });
}

/**
 * Per-Pod schematic (DESIGN §6.9): the 2D twin of the 3D single-node view. Central pod status + adaptive
 * functional groups (Config/Network/Storage/Security) + the owner/generator chain. Only populated groups
 * carry entries — the view layer decides whether to render an empty group at all.
 */
export function projectPodSchematic(graph: ResourceGraph, podId: ResourceId): PodSchematic | undefined {
  const pod = graph.nodes.get(podId);
  if (!pod || pod.kind !== 'Pod') return undefined;

  const spec = pod.raw.spec as
    | { containers?: ContainerRaw[]; initContainers?: ContainerRaw[]; volumes?: VolumeRaw[]; serviceAccountName?: string }
    | undefined;
  const status = pod.raw.status as
    | { phase?: string; conditions?: ConditionRaw[]; containerStatuses?: ContainerStatusRaw[]; initContainerStatuses?: ContainerStatusRaw[] }
    | undefined;

  const byNsKindName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) byNsKindName.set(`${r.namespace ?? ''}|${r.kind}|${r.name}`, r);
  const lookup = (kind: string, name: string): Resource | undefined =>
    byNsKindName.get(`${pod.namespace ?? ''}|${kind}|${name}`);

  const configMaps = new Map<string, SchematicRef>();
  const secrets = new Map<string, SchematicRef>();
  const addRef = (map: Map<string, SchematicRef>, kind: string, name?: string) => {
    if (!name || map.has(name)) return;
    const r = lookup(kind, name);
    map.set(name, { id: r?.id ?? `${kind}/${name}`, name, kind });
  };

  for (const v of spec?.volumes ?? []) {
    addRef(configMaps, 'ConfigMap', v.configMap?.name);
    addRef(secrets, 'Secret', v.secret?.secretName);
    for (const src of v.projected?.sources ?? []) {
      addRef(configMaps, 'ConfigMap', src.configMap?.name);
      addRef(secrets, 'Secret', src.secret?.name);
    }
  }
  for (const c of [...(spec?.containers ?? []), ...(spec?.initContainers ?? [])]) {
    for (const ef of c.envFrom ?? []) {
      addRef(configMaps, 'ConfigMap', ef.configMapRef?.name);
      addRef(secrets, 'Secret', ef.secretRef?.name);
    }
    for (const e of c.env ?? []) {
      addRef(configMaps, 'ConfigMap', e.valueFrom?.configMapKeyRef?.name);
      addRef(secrets, 'Secret', e.valueFrom?.secretKeyRef?.name);
    }
  }

  const clusterLookup = (kind: string, name: string): Resource | undefined => byNsKindName.get(`|${kind}|${name}`);

  const pvcs = new Map<string, SchematicRef>();
  for (const v of spec?.volumes ?? []) addRef(pvcs, 'PersistentVolumeClaim', v.persistentVolumeClaim?.claimName);

  const pvs = new Map<string, SchematicRef>();
  const storageClasses = new Map<string, SchematicRef>();
  for (const pvcRef of pvcs.values()) {
    const pvcResource = graph.nodes.get(pvcRef.id);
    const volumeName = (pvcResource?.raw.spec as { volumeName?: string } | undefined)?.volumeName;
    if (!volumeName) continue;
    const pv = clusterLookup('PersistentVolume', volumeName);
    pvs.set(volumeName, { id: pv?.id ?? `PersistentVolume/${volumeName}`, name: volumeName, kind: 'PersistentVolume' });
    const scName = (pv?.raw.spec as { storageClassName?: string } | undefined)?.storageClassName;
    if (scName) {
      const sc = clusterLookup('StorageClass', scName);
      storageClasses.set(scName, { id: sc?.id ?? `StorageClass/${scName}`, name: scName, kind: 'StorageClass' });
    }
  }

  const services: SchematicRef[] = [];
  for (const svc of graph.nodes.values()) {
    if (svc.kind !== 'Service' || svc.namespace !== pod.namespace) continue;
    const endpoints = lookup('Endpoints', svc.name);
    const subsets = (endpoints?.raw.subsets as { addresses?: { targetRef?: { uid?: string } }[] }[] | undefined) ?? [];
    const targets = subsets.flatMap((s) => s.addresses ?? []).map((a) => a.targetRef?.uid);
    if (targets.includes(pod.uid ?? pod.id)) services.push({ id: svc.id, name: svc.name, kind: 'Service' });
  }

  const saName = spec?.serviceAccountName;
  const sa = saName ? lookup('ServiceAccount', saName) : undefined;

  const ownerChain: SchematicOwnerLink[] = [];
  let current: Resource | undefined = pod;
  const seen = new Set<ResourceId>();
  while (current) {
    const ownerEdge = graph.edges.find((e) => e.type === 'ownerReference' && e.to === current!.id && e.meta?.controller !== false);
    if (!ownerEdge || seen.has(ownerEdge.from)) break;
    seen.add(ownerEdge.from);
    const owner = graph.nodes.get(ownerEdge.from);
    if (!owner) break;
    ownerChain.unshift({ id: owner.id, kind: owner.kind, name: owner.name });
    current = owner;
  }

  const generatorLabel =
    pod.labels['app.kubernetes.io/managed-by'] ??
    (ownerChain[0] ? graph.nodes.get(ownerChain[0].id)?.labels['app.kubernetes.io/managed-by'] : undefined);

  return {
    pod,
    phase: status?.phase,
    conditions: status?.conditions ?? [],
    containers: toContainers(spec?.containers ?? [], status?.containerStatuses ?? []),
    initContainers: toContainers(spec?.initContainers ?? [], status?.initContainerStatuses ?? []),
    ownerChain,
    generatorLabel,
    config: { configMaps: [...configMaps.values()], secrets: [...secrets.values()] },
    network: { services },
    storage: { pvcs: [...pvcs.values()], pvs: [...pvs.values()], storageClasses: [...storageClasses.values()] },
    security: { serviceAccount: sa ? { id: sa.id, name: sa.name, kind: 'ServiceAccount' } : undefined },
  };
}
