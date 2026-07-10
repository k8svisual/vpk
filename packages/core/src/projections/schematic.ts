import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

interface ContainerRaw {
  name?: string;
  image?: string;
  ports?: { containerPort?: number; protocol?: string; name?: string }[];
  volumeMounts?: { name?: string; mountPath?: string; readOnly?: boolean }[];
  resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
  livenessProbe?: unknown;
  readinessProbe?: unknown;
  startupProbe?: unknown;
  /** EphemeralContainer-only: which existing container's process namespace this debug container joins
   *  (spec.ephemeralContainers[].targetContainerName). Never set on init/app containers — the API only
   *  allows it on ephemeral containers, so it's the one field unique to that section. */
  targetContainerName?: string;
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
  name?: string;
  configMap?: { name?: string };
  secret?: { secretName?: string };
  persistentVolumeClaim?: { claimName?: string };
  projected?: { sources?: { configMap?: { name?: string }; secret?: { name?: string } }[] };
  emptyDir?: unknown;
  hostPath?: unknown;
  downwardAPI?: unknown;
  csi?: { driver?: string };
}
interface ConditionRaw {
  type?: string;
  status?: string;
}

/** Which of a Pod's three container arrays a container came from — the Container schematic renders one
 *  section per kind (spec.initContainers / spec.containers / spec.ephemeralContainers), and ephemeral
 *  containers are drawn distinctly (transient debug containers, not part of the declared spec). */
export type ContainerKind = 'init' | 'app' | 'ephemeral';

export interface ContainerPort {
  containerPort: number;
  protocol?: string;
  name?: string;
}
export interface ContainerMount {
  /** The Pod volume name this mount targets (spec.volumes[].name) — links a container to an entry in
   *  PodSchematic.volumes so the renderer can draw the mount edge and detect volumes shared across containers. */
  volumeName: string;
  mountPath: string;
  readOnly?: boolean;
}
export interface ContainerResources {
  cpuRequest?: string;
  cpuLimit?: string;
  memRequest?: string;
  memLimit?: string;
}

export interface SchematicContainer {
  name: string;
  image?: string;
  ready?: boolean;
  restartCount?: number;
  stateLabel?: string;
  /** Which array this came from — drives the Container schematic's init/app/ephemeral sectioning. */
  kind: ContainerKind;
  ports: ContainerPort[];
  mounts: ContainerMount[];
  resources?: ContainerResources;
  /** Presence of each probe kind (the probe's own handler detail isn't needed for the schematic, only whether
   *  the container declares one). The Kubernetes API forbids all three on ephemeral containers, so an
   *  ephemeral container always reports false/absent here. */
  probes: { liveness: boolean; readiness: boolean; startup: boolean };
  /** ConfigMap/Secret names THIS container consumes via env/envFrom — lets the Container schematic attribute
   *  config to the specific container that uses it, rather than the Pod-level aggregate (PodSchematic.config)
   *  which merges every container's and every volume's references together. Names only (the clickable id comes
   *  from matching these against the resolved Pod-level config refs). */
  configRefs: { configMaps: string[]; secrets: string[] };
  /** EphemeralContainer-only — see ContainerRaw.targetContainerName. */
  targetContainerName?: string;
}

/** A Pod volume (spec.volumes[]) — the Container schematic draws these once inside the Pod boundary and links
 *  each container's mounts to them, so a volume shared by multiple containers (e.g. a sidecar reading the app's
 *  data dir) is visible as such. `backingRef` is set for the volume types that reference another resource
 *  (PVC/ConfigMap/Secret), resolved to a clickable id where the resource exists in the snapshot. */
export interface SchematicVolume {
  name: string;
  /** persistentVolumeClaim | configMap | secret | projected | emptyDir | hostPath | downwardAPI | csi | other */
  type: string;
  backingRef?: SchematicRef;
  /** How the volume is realized — drives the storage-implementation sub-diagram the Container schematic draws
   *  when a volume is clicked. `local` covers configMap/secret/emptyDir/hostPath/projected/downwardAPI (data
   *  lives on the Node the Pod runs on, no PV involved). The three `pvc-*` variants are the persistent chain,
   *  distinguished by how far it resolves: a PVC bound to a PV whose CSI driver is resolvable — either via a
   *  VolumeAttachment's spec.attacher, or (when no VolumeAttachment was captured) the PV's own spec.csi.driver
   *  — is `pvc-pv-va-csi` (the VolumeAttachment itself may or may not be present; `volumeAttachment` below is
   *  set only when one was); one with only a StorageClass and no resolvable driver is `pvc-pv-sc`; one that
   *  resolves to neither is `pvc-pv`. */
  implementation: 'local' | 'pvc-pv' | 'pvc-pv-sc' | 'pvc-pv-va-csi';
  /** The persistent chain (set only for `pvc-*` implementations), each resolved to a clickable id where the
   *  resource exists in the snapshot. `backingRef` is the PVC itself for these. */
  pv?: SchematicRef;
  storageClass?: SchematicRef;
  volumeAttachment?: SchematicRef;
  csiDriver?: SchematicRef;
}
export interface SchematicRef {
  id: ResourceId;
  name: string;
  kind: string;
}
/** A Service ref plus the container-side ports it routes to (spec.ports[].targetPort, defaulting to `port`
 *  when targetPort is omitted — a number or a named container port). The Container schematic uses this to draw
 *  a line from a selected container to the specific Service(s) that expose one of its ports. */
export interface SchematicServiceRef extends SchematicRef {
  targetPorts: (number | string)[];
}
export interface SchematicOwnerLink {
  id: ResourceId;
  kind: string;
  name: string;
  /** The owner's own apiVersion — lets the icon renderer show a vendor's icon (e.g. Argo, Cilium) for a
   *  custom-resource owner whose kind isn't a built-in Kubernetes type (see @vpk/core's vendorIcons.ts). */
  apiVersion?: string;
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
  /** Debug containers injected via `kubectl debug` (spec.ephemeralContainers) — rendered as their own section
   *  in the Container schematic. Empty for the overwhelming majority of Pods. */
  ephemeralContainers: SchematicContainer[];
  /** Pod volumes (spec.volumes) — drives the Container schematic's shared-volumes box; unused by the Pod-level
   *  schematic (which only surfaces the PVC subset, via `storage`). */
  volumes: SchematicVolume[];
  /** Root -> immediate parent (the Pod itself is not included). */
  ownerChain: SchematicOwnerLink[];
  generatorLabel?: string;
  config: { configMaps: SchematicRef[]; secrets: SchematicRef[] };
  /** The Service(s) that target this Pod, plus the Endpoints/EndpointSlices backing them (merged into one list).
   *  `endpointKind` is the icon/kind to show for that merged list — EndpointSlice when any slice is present. */
  network: { services: SchematicServiceRef[]; endpoints: SchematicRef[]; endpointKind: 'Endpoints' | 'EndpointSlice' };
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
  /** Event objects (core/v1 Event) whose involvedObject resolves to this Pod — drives the small purple
   *  "has Events" indicator in the schematic SVG. Snapshot-time-bound like every Event (see events.ts). */
  events: { total: number; warnings: number };
}

function stateLabel(state: ContainerStatusRaw['state']): string | undefined {
  if (!state) return undefined;
  if (state.running) return 'Running';
  if (state.terminated) return state.terminated.reason ?? 'Terminated';
  if (state.waiting) return state.waiting.reason ?? 'Waiting';
  return undefined;
}

/** ConfigMap/Secret names one container references via env/envFrom — the per-container slice of the same
 *  logic projectPodSchematic runs Pod-wide for the aggregate config box. */
function containerConfigRefs(c: ContainerRaw): { configMaps: string[]; secrets: string[] } {
  const configMaps = new Set<string>();
  const secrets = new Set<string>();
  for (const ef of c.envFrom ?? []) {
    if (ef.configMapRef?.name) configMaps.add(ef.configMapRef.name);
    if (ef.secretRef?.name) secrets.add(ef.secretRef.name);
  }
  for (const e of c.env ?? []) {
    const cm = e.valueFrom?.configMapKeyRef?.name;
    const sec = e.valueFrom?.secretKeyRef?.name;
    if (cm) configMaps.add(cm);
    if (sec) secrets.add(sec);
  }
  return { configMaps: [...configMaps], secrets: [...secrets] };
}

function toContainers(specList: ContainerRaw[], statusList: ContainerStatusRaw[], kind: ContainerKind): SchematicContainer[] {
  const statusByName = new Map(statusList.map((s) => [s.name, s]));
  return specList.map((c) => {
    const status = c.name ? statusByName.get(c.name) : undefined;
    const req = c.resources?.requests;
    const lim = c.resources?.limits;
    const resources: ContainerResources | undefined =
      req?.cpu || req?.memory || lim?.cpu || lim?.memory
        ? { cpuRequest: req?.cpu, cpuLimit: lim?.cpu, memRequest: req?.memory, memLimit: lim?.memory }
        : undefined;
    return {
      name: c.name ?? '',
      image: c.image,
      ready: status?.ready,
      restartCount: status?.restartCount,
      stateLabel: stateLabel(status?.state),
      kind,
      ports: (c.ports ?? [])
        .filter((p): p is { containerPort: number; protocol?: string; name?: string } => typeof p.containerPort === 'number')
        .map((p) => ({ containerPort: p.containerPort, protocol: p.protocol, name: p.name })),
      mounts: (c.volumeMounts ?? [])
        .filter((m): m is { name: string; mountPath?: string; readOnly?: boolean } => !!m.name)
        .map((m) => ({ volumeName: m.name, mountPath: m.mountPath ?? '', readOnly: m.readOnly })),
      resources,
      probes: { liveness: !!c.livenessProbe, readiness: !!c.readinessProbe, startup: !!c.startupProbe },
      configRefs: containerConfigRefs(c),
      targetContainerName: c.targetContainerName,
    };
  });
}

/** The volume's type + the resource it backs onto (for the types that reference another object). Order matters
 *  only in that each K8s volume source is mutually exclusive, so the first present wins. */
function classifyVolume(v: VolumeRaw): { type: string; backing?: { kind: string; name: string } } {
  if (v.persistentVolumeClaim?.claimName)
    return { type: 'persistentVolumeClaim', backing: { kind: 'PersistentVolumeClaim', name: v.persistentVolumeClaim.claimName } };
  if (v.configMap?.name) return { type: 'configMap', backing: { kind: 'ConfigMap', name: v.configMap.name } };
  if (v.secret?.secretName) return { type: 'secret', backing: { kind: 'Secret', name: v.secret.secretName } };
  if (v.projected) return { type: 'projected' };
  if (v.emptyDir) return { type: 'emptyDir' };
  if (v.hostPath) return { type: 'hostPath' };
  if (v.downwardAPI) return { type: 'downwardAPI' };
  if (v.csi) return { type: 'csi' };
  return { type: 'other' };
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
      default:
        // An operator outside the 4 the K8s API defines — never expected in practice, but fail CLOSED (this
        // expression doesn't match) rather than silently treating an unrecognized constraint as satisfied.
        return false;
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
    | {
        containers?: ContainerRaw[];
        initContainers?: ContainerRaw[];
        ephemeralContainers?: ContainerRaw[];
        volumes?: VolumeRaw[];
        serviceAccountName?: string;
        nodeName?: string;
      }
    | undefined;
  const status = pod.raw.status as
    | {
        phase?: string;
        conditions?: ConditionRaw[];
        containerStatuses?: ContainerStatusRaw[];
        initContainerStatuses?: ContainerStatusRaw[];
        ephemeralContainerStatuses?: ContainerStatusRaw[];
      }
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
  for (const c of [...(spec?.containers ?? []), ...(spec?.initContainers ?? []), ...(spec?.ephemeralContainers ?? [])]) {
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

  // Resolves one PVC-backed volume's full persistent chain (PVC -> PV -> {StorageClass | VolumeAttachment ->
  // CSIDriver}) for the Container schematic's per-volume storage-implementation sub-diagram. The CSIDriver is
  // named either by the PV's own spec.csi.driver or the VolumeAttachment's spec.attacher (same driver, two
  // places it can appear) — resolved to a real CSIDriver resource where one was captured. Resolved from the
  // PV's own spec.csi.driver REGARDLESS of whether a VolumeAttachment exists in this snapshot — a snapshot
  // without VolumeAttachments captured (e.g. a namespace-scoped capture, which can't see the cluster-scoped
  // VolumeAttachment kind at all) previously showed no driver whatsoever for a PV that plainly declares one.
  const resolvePvChain = (claimName: string): Pick<SchematicVolume, 'implementation' | 'pv' | 'storageClass' | 'volumeAttachment' | 'csiDriver'> => {
    const pvcResource = lookup('PersistentVolumeClaim', claimName);
    const volumeName = (pvcResource?.raw.spec as { volumeName?: string } | undefined)?.volumeName;
    if (!volumeName) return { implementation: 'pvc-pv' };
    const pvResource = clusterLookup('PersistentVolume', volumeName);
    const pv: SchematicRef = { id: pvResource?.id ?? `PersistentVolume/${volumeName}`, name: volumeName, kind: 'PersistentVolume' };

    const scName = (pvResource?.raw.spec as { storageClassName?: string } | undefined)?.storageClassName;
    let storageClass: SchematicRef | undefined;
    if (scName) {
      const sc = clusterLookup('StorageClass', scName);
      storageClass = { id: sc?.id ?? `StorageClass/${scName}`, name: scName, kind: 'StorageClass' };
    }

    const vaResource = vaByPvName.get(volumeName);
    let volumeAttachment: SchematicRef | undefined;
    if (vaResource) volumeAttachment = { id: vaResource.id, name: vaResource.name, kind: 'VolumeAttachment' };

    const driverName =
      (vaResource?.raw.spec as { attacher?: string } | undefined)?.attacher ??
      (pvResource?.raw.spec as { csi?: { driver?: string } } | undefined)?.csi?.driver;
    let csiDriver: SchematicRef | undefined;
    if (driverName) {
      const d = clusterLookup('CSIDriver', driverName);
      csiDriver = { id: d?.id ?? `CSIDriver/${driverName}`, name: driverName, kind: 'CSIDriver' };
    }

    const implementation: SchematicVolume['implementation'] = csiDriver ? 'pvc-pv-va-csi' : storageClass ? 'pvc-pv-sc' : 'pvc-pv';
    return { implementation, pv, storageClass, volumeAttachment, csiDriver };
  };

  // Full volume list for the Container schematic (the Pod-level schematic only surfaces the PVC subset above).
  // Backing PVC/ConfigMap/Secret are namespace-scoped, so `lookup` resolves a clickable id where present; a
  // PVC-type volume additionally carries its resolved persistent chain, everything else is `local`.
  const volumes: SchematicVolume[] = (spec?.volumes ?? []).map((v) => {
    const { type, backing } = classifyVolume(v);
    let backingRef: SchematicRef | undefined;
    if (backing) {
      const r = lookup(backing.kind, backing.name);
      backingRef = { id: r?.id ?? `${backing.kind}/${backing.name}`, name: backing.name, kind: backing.kind };
    }
    if (type === 'persistentVolumeClaim' && v.persistentVolumeClaim?.claimName) {
      return { name: v.name ?? '', type, backingRef, ...resolvePvChain(v.persistentVolumeClaim.claimName) };
    }
    return { name: v.name ?? '', type, backingRef, implementation: 'local' as const };
  });

  // EndpointSlices name their Service via the standard `kubernetes.io/service-name` label (a Service can have
  // several slices) — precomputed once here so the per-service loop below stays O(services), not O(services×N).
  const slicesByService = new Map<string, Resource[]>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'EndpointSlice' || r.namespace !== pod.namespace) continue;
    const svcName = r.labels['kubernetes.io/service-name'];
    if (!svcName) continue;
    const list = slicesByService.get(svcName);
    if (list) list.push(r);
    else slicesByService.set(svcName, [r]);
  }

  const services: SchematicServiceRef[] = [];
  // Endpoints + EndpointSlices backing the Service(s) that target this Pod, merged into one list. Both kinds can
  // coexist (a cluster may still publish the legacy Endpoints object alongside EndpointSlices); when they do the
  // renderer shows the EndpointSlice icon over the combined list (see network.endpointKind).
  const endpoints: SchematicRef[] = [];
  let hasSlice = false;
  for (const svc of graph.nodes.values()) {
    if (svc.kind !== 'Service' || svc.namespace !== pod.namespace) continue;
    const endpointsObj = lookup('Endpoints', svc.name);
    const subsets = (endpointsObj?.raw.subsets as { addresses?: { targetRef?: { uid?: string } }[] }[] | undefined) ?? [];
    const targets = new Set(subsets.flatMap((s) => s.addresses ?? []).map((a) => a.targetRef?.uid));
    // A Service can be backed ONLY by EndpointSlices (the Endpoints API is deprecated as of Kubernetes
    // 1.33) — matching solely against the legacy Endpoints object above would silently show no Network box
    // at all for such a Pod, even though slicesByService already has the slice(s) indexed for display below.
    // Only READY slice endpoints count, mirroring the Endpoints-side check above (which only reads `addresses`,
    // never `notReadyAddresses`).
    const slices = slicesByService.get(svc.name) ?? [];
    for (const es of slices) {
      const epEndpoints = (es.raw.endpoints as { targetRef?: { uid?: string }; conditions?: { ready?: boolean } }[] | undefined) ?? [];
      for (const ep of epEndpoints) {
        if ((ep.conditions?.ready ?? true) && ep.targetRef?.uid) targets.add(ep.targetRef.uid);
      }
    }
    if (!targets.has(pod.uid ?? pod.id)) continue;
    // targetPort defaults to `port` when omitted (standard Service semantics) — this is the container-side port
    // the Service routes to, matched against each container's declared ports by number or name in the renderer.
    const svcPorts = (svc.raw.spec as { ports?: { port?: number; targetPort?: number | string }[] } | undefined)?.ports ?? [];
    const targetPorts = svcPorts.map((p) => p.targetPort ?? p.port).filter((v): v is number | string => v !== undefined);
    services.push({ id: svc.id, name: svc.name, kind: 'Service', targetPorts });
    if (endpointsObj) endpoints.push({ id: endpointsObj.id, name: endpointsObj.name, kind: 'Endpoints' });
    for (const es of slices) {
      endpoints.push({ id: es.id, name: es.name, kind: 'EndpointSlice' });
      hasSlice = true;
    }
  }
  const endpointKind: 'Endpoints' | 'EndpointSlice' = hasSlice ? 'EndpointSlice' : 'Endpoints';

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
    ownerChain.unshift({ id: owner.id, kind: owner.kind, name: owner.name, apiVersion: owner.apiVersion });
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

  // Events targeting this Pod — matched by involvedObject.uid when present, else by kind/name/namespace (some
  // real-cluster Events omit uid; see events.ts's own resolution for why this fallback matters). Snapshot-
  // time-bound, so this is a point-in-time count, not a live tally.
  let eventsTotal = 0;
  let eventsWarnings = 0;
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Event') continue;
    const involved = r.raw.involvedObject as { kind?: string; name?: string; namespace?: string; uid?: string } | undefined;
    if (!involved) continue;
    const matches =
      involved.uid && pod.uid
        ? involved.uid === pod.uid
        : involved.kind === 'Pod' && involved.name === pod.name && (involved.namespace ?? '') === (pod.namespace ?? '');
    if (!matches) continue;
    eventsTotal++;
    if ((r.raw as { type?: string }).type === 'Warning') eventsWarnings++;
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
    containers: toContainers(spec?.containers ?? [], status?.containerStatuses ?? [], 'app'),
    initContainers: toContainers(spec?.initContainers ?? [], status?.initContainerStatuses ?? [], 'init'),
    ephemeralContainers: toContainers(spec?.ephemeralContainers ?? [], status?.ephemeralContainerStatuses ?? [], 'ephemeral'),
    volumes,
    ownerChain,
    generatorLabel,
    config: { configMaps: [...configMaps.values()], secrets: [...secrets.values()] },
    network: { services, endpoints, endpointKind },
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
    events: { total: eventsTotal, warnings: eventsWarnings },
  };
}
