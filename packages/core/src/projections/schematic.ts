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
  /** Set when this owner is a custom-resource instance backed by a real CustomResourceDefinition in the
   *  graph — same letter as the matching entry in PodSchematic.crds, so the view can badge both with a
   *  small black circle+letter to visually link the instance to its type definition (DESIGN §6.9 follow-on,
   *  ported from the legacy app's Workload Schematics namespace/cluster split). */
  crdLetter?: string;
}
export interface SchematicCrdRef {
  letter: string;
  id: ResourceId;
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
  /** pvcs -> their bound pvs -> those pvs' storage classes (DESIGN §6.9 pvc<-pv<-sc chain). volumeAttachments
   *  is a sibling branch off the same pvs, not chained through storageClasses — mirrors the 3D wheel's
   *  pvToVolumeAttachment (see wheel.ts), which deliberately keeps VolumeAttachment and StorageClass as
   *  independent branches off PV rather than one hanging off the other. */
  storage: { pvcs: SchematicRef[]; pvs: SchematicRef[]; storageClasses: SchematicRef[]; volumeAttachments: SchematicRef[] };
  security: { serviceAccount?: SchematicRef };
  /** The Node the Pod is scheduled on — cluster-scoped (no namespace), so the view renders it in the
   *  separate "Cluster level resources" box rather than alongside the Pod's own namespaced resources. */
  node?: SchematicRef;
  /** Every distinct CustomResourceDefinition backing a custom-resource owner in `ownerChain`, in first-
   *  appearance order, lettered a/b/c/... — rendered in the "Cluster level resources" box (CRDs are
   *  cluster-scoped) alongside the matching lettered badge on the owner-chain instance in the namespace box. */
  crds: SchematicCrdRef[];
  /** Namespace-scoped governance resources that apply to this Pod — rendered as a row at the bottom of the
   *  namespace box. NetworkPolicy applies via podSelector match; ResourceQuota/LimitRange apply to every Pod
   *  in the namespace (no per-Pod selector in the K8s API); RoleBinding applies via a subject naming this
   *  Pod's ServiceAccount. */
  policies: {
    networkPolicies: SchematicRef[];
    resourceQuotas: SchematicRef[];
    limitRanges: SchematicRef[];
    roleBindings: SchematicRef[];
  };
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

interface LabelSelectorRaw {
  matchLabels?: Record<string, string>;
  matchExpressions?: { key: string; operator?: string; values?: string[] }[];
}

/** Standard Kubernetes LabelSelector semantics (matchLabels + matchExpressions' In/NotIn/Exists/DoesNotExist)
 *  against a resource's labels — an empty/missing selector (`{}`, as a NetworkPolicy with no podSelector
 *  fields selects) matches everything, matching real cluster behavior. No existing helper for this in the
 *  codebase (Service->Pod linkage instead uses the cluster's own Endpoints object, which has no equivalent
 *  for NetworkPolicy), so this is written directly against the K8s API's own selector spec. */
function matchesSelector(labels: Record<string, string>, selector: LabelSelectorRaw | undefined): boolean {
  for (const [k, v] of Object.entries(selector?.matchLabels ?? {})) {
    if (labels[k] !== v) return false;
  }
  for (const expr of selector?.matchExpressions ?? []) {
    const has = Object.prototype.hasOwnProperty.call(labels, expr.key);
    switch (expr.operator) {
      case 'In':
        if (!has || !(expr.values ?? []).includes(labels[expr.key] as string)) return false;
        break;
      case 'NotIn':
        if (has && (expr.values ?? []).includes(labels[expr.key] as string)) return false;
        break;
      case 'Exists':
        if (!has) return false;
        break;
      case 'DoesNotExist':
        if (has) return false;
        break;
    }
  }
  return true;
}

/** The CustomResourceDefinition (if any) that defines `kind`/`apiVersion` — matched by CRD spec.group +
 *  spec.names.kind, the same identity Kubernetes itself uses to bind a custom resource to its type. A
 *  built-in kind's apiVersion never carries a "/" group for the bare core group, so this correctly never
 *  matches core-group resources (Pod, ConfigMap, ...) against a CRD. */
function findCrdDefinition(graph: ResourceGraph, kind: string, apiVersion: string): Resource | undefined {
  const slash = apiVersion.indexOf('/');
  if (slash === -1) return undefined;
  const group = apiVersion.slice(0, slash);
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'CustomResourceDefinition') continue;
    const spec = r.raw.spec as { group?: string; names?: { kind?: string } } | undefined;
    if (spec?.group === group && spec?.names?.kind === kind) return r;
  }
  return undefined;
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
    | { containers?: ContainerRaw[]; initContainers?: ContainerRaw[]; volumes?: VolumeRaw[]; serviceAccountName?: string; nodeName?: string }
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

  // Same by-PV-name lookup wheel.ts's pvToVolumeAttachmentId uses — a VolumeAttachment names its PV via
  // spec.source.persistentVolumeName, so it's the initiating/owning side of this edge (unlike StorageClass,
  // which the PV itself names via spec.storageClassName).
  const vaByPvName = new Map<string, Resource>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'VolumeAttachment') continue;
    const pvName = (r.raw.spec as { source?: { persistentVolumeName?: string } } | undefined)?.source?.persistentVolumeName;
    if (pvName) vaByPvName.set(pvName, r);
  }

  const pvs = new Map<string, SchematicRef>();
  const storageClasses = new Map<string, SchematicRef>();
  const volumeAttachments = new Map<string, SchematicRef>();
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
    const va = vaByPvName.get(volumeName);
    if (va) volumeAttachments.set(volumeName, { id: va.id, name: va.name, kind: 'VolumeAttachment' });
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
  const ownerResources: Resource[] = [];
  let current: Resource | undefined = pod;
  const seen = new Set<ResourceId>();
  while (current) {
    const ownerEdge = graph.edges.find((e) => e.type === 'ownerReference' && e.to === current!.id && e.meta?.controller !== false);
    if (!ownerEdge || seen.has(ownerEdge.from)) break;
    seen.add(ownerEdge.from);
    const owner = graph.nodes.get(ownerEdge.from);
    if (!owner) break;
    ownerChain.unshift({ id: owner.id, kind: owner.kind, name: owner.name });
    ownerResources.unshift(owner);
    current = owner;
  }

  const generatorLabel =
    pod.labels['app.kubernetes.io/managed-by'] ??
    (ownerChain[0] ? graph.nodes.get(ownerChain[0].id)?.labels['app.kubernetes.io/managed-by'] : undefined);

  // Custom-resource detection (DESIGN §6.9 follow-on): an owner-chain entry backed by a real
  // CustomResourceDefinition in this graph is namespace-scoped like everything else here, but its TYPE
  // definition is cluster-scoped — so the view badges the instance and its CRD with a matching lettered
  // circle instead of drawing them in the same box.
  const crds: SchematicCrdRef[] = [];
  const crdLetterByResourceId = new Map<ResourceId, string>();
  for (const owner of ownerResources) {
    const crd = findCrdDefinition(graph, owner.kind, owner.apiVersion);
    if (!crd) continue;
    let letter = crdLetterByResourceId.get(crd.id);
    if (!letter) {
      letter = String.fromCharCode(97 + crds.length);
      crdLetterByResourceId.set(crd.id, letter);
      crds.push({ letter, id: crd.id, name: crd.name });
    }
    const link = ownerChain.find((o) => o.id === owner.id);
    if (link) link.crdLetter = letter;
  }

  const nodeName = spec?.nodeName;
  const nodeResource = nodeName ? clusterLookup('Node', nodeName) : undefined;
  const node: SchematicRef | undefined = nodeName
    ? { id: nodeResource?.id ?? `Node/${nodeName}`, name: nodeName, kind: 'Node' }
    : undefined;

  const networkPolicies: SchematicRef[] = [];
  const resourceQuotas: SchematicRef[] = [];
  const limitRanges: SchematicRef[] = [];
  const roleBindings: SchematicRef[] = [];
  for (const r of graph.nodes.values()) {
    if (r.namespace !== pod.namespace) continue;
    if (r.kind === 'NetworkPolicy') {
      const podSelector = (r.raw.spec as { podSelector?: LabelSelectorRaw } | undefined)?.podSelector;
      if (matchesSelector(pod.labels, podSelector)) networkPolicies.push({ id: r.id, name: r.name, kind: 'NetworkPolicy' });
    } else if (r.kind === 'ResourceQuota') {
      resourceQuotas.push({ id: r.id, name: r.name, kind: 'ResourceQuota' });
    } else if (r.kind === 'LimitRange') {
      limitRanges.push({ id: r.id, name: r.name, kind: 'LimitRange' });
    } else if (r.kind === 'RoleBinding' && saName) {
      const subjects = (r.raw.subjects as { kind?: string; name?: string; namespace?: string }[] | undefined) ?? [];
      const bindsThisSa = subjects.some((subj) => subj.kind === 'ServiceAccount' && subj.name === saName && (subj.namespace ?? pod.namespace) === pod.namespace);
      if (bindsThisSa) roleBindings.push({ id: r.id, name: r.name, kind: 'RoleBinding' });
    }
  }

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
    storage: {
      pvcs: [...pvcs.values()],
      pvs: [...pvs.values()],
      storageClasses: [...storageClasses.values()],
      volumeAttachments: [...volumeAttachments.values()],
    },
    security: { serviceAccount: sa ? { id: sa.id, name: sa.name, kind: 'ServiceAccount' } : undefined },
    node,
    crds,
    policies: { networkPolicies, resourceQuotas, limitRanges, roleBindings },
  };
}
