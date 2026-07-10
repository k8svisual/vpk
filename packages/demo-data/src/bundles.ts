import type { RawObject } from '@vpk/core';
import { resolvePattern } from './placeholders';

/**
 * Cross-Kind "bundle" generators — unlike the single-Kind, pattern-filled templates in demoTemplates.ts, a
 * bundle produces several related Kinds together (an RBAC team, a Node's CSINode drivers, a percentage of
 * Pods getting a PVC, ...), sometimes cross-referencing data that's already staged (Node names, Pod names).
 * Kept as pure functions here — no filesystem access, no randomness where a deterministic pool suffices — so
 * every bundle is independently testable; @vpk/server's demoData.ts is what reads/writes the working
 * directory and calls into these.
 *
 * Everything here is deliberately a FIXED, small, named pool (5 users, 5 ConfigMaps, 3 StorageClasses, ...)
 * rather than pattern-generated at arbitrary scale — the whole point ("reused for all demo data") is that
 * other bundles/templates can reference these same stable names (e.g. a future Pod could mount
 * `demo-config-1`), which only works if the pool doesn't change shape between runs.
 */

// ---------------------------------------------------------------------------------------------------------
// RBAC team
// ---------------------------------------------------------------------------------------------------------

/** The fixed "team" every RBAC bundle uses — same users every time, so bindings stay meaningful across runs
 *  instead of a fresh random cast each call. */
export const RBAC_USERS = ['alice', 'bob', 'carol', 'dave', 'erin'] as const;

/**
 * One Role + one ClusterRole at "viewer" and "editor"-ish tiers, one ClusterRole at "cluster-admin", bound to
 * a realistic mix of the fixed team — most of the team is namespace-scoped read-only, one person also reads
 * cluster-wide, one is a full namespace editor, one is the sole cluster-admin. This is meant to *look like* a
 * real environment's RBAC layout (a few viewers, an editor or two, one admin), not exhaustively model one.
 */
export function buildRbacBundle(namespace: string): RawObject[] {
  const role = (name: string, rules: RawObject[]): RawObject => ({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: { name, namespace },
    rules,
  });
  const clusterRole = (name: string, rules: RawObject[]): RawObject => ({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: { name },
    rules,
  });
  const roleBinding = (name: string, roleName: string, subjects: string[]): RawObject => ({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { name, namespace },
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: roleName },
    subjects: subjects.map((s) => ({ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: s })),
  });
  const clusterRoleBinding = (name: string, roleName: string, subjects: string[]): RawObject => ({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: { name },
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: roleName },
    subjects: subjects.map((s) => ({ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: s })),
  });

  const [alice, bob, carol, dave, erin] = RBAC_USERS;

  return [
    role('demo-viewer', [{ apiGroups: [''], resources: ['pods', 'services', 'configmaps'], verbs: ['get', 'list', 'watch'] }]),
    role('demo-editor', [
      { apiGroups: [''], resources: ['pods', 'services', 'configmaps'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
      { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] },
    ]),
    clusterRole('demo-cluster-viewer', [{ apiGroups: [''], resources: ['nodes', 'namespaces', 'persistentvolumes'], verbs: ['get', 'list', 'watch'] }]),
    clusterRole('demo-cluster-admin', [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }]),
    roleBinding('demo-viewers', 'demo-viewer', [alice, erin]),
    roleBinding('demo-editors', 'demo-editor', [bob, carol]),
    clusterRoleBinding('demo-cluster-viewers', 'demo-cluster-viewer', [carol, erin]),
    clusterRoleBinding('demo-cluster-admins', 'demo-cluster-admin', [dave]),
  ];
}

// ---------------------------------------------------------------------------------------------------------
// ConfigMap / Secret pool
// ---------------------------------------------------------------------------------------------------------

export const CONFIGMAP_POOL_NAMES = ['demo-config-1', 'demo-config-2', 'demo-config-3', 'demo-config-4', 'demo-config-5'];
export const SECRET_POOL_NAMES = ['demo-secret-1', 'demo-secret-2', 'demo-secret-3', 'demo-secret-4', 'demo-secret-5'];

/**
 * 5 ConfigMaps + 5 Secrets with static (not randomized) data, fixed names, in EVERY given Namespace — "if a
 * resource needs a ConfigMap or Secret, use one of these" instead of minting a fresh one every time. The same
 * 5+5 fixed names are reused across every Namespace (identity is the (namespace, name) pair, exactly like
 * ServiceAccount's fixed `demo-sa` name — see buildServiceAccountBundle), so this is "created as needed": a
 * Namespace already in `existingNamespacesWithPool` is skipped, letting this be re-run after adding more
 * Namespaces without duplicating ones that already have their pool.
 */
export function buildConfigSecretPool(namespaces: string[], existingNamespacesWithPool: Set<string>): RawObject[] {
  const targets = namespaces.filter((ns) => !existingNamespacesWithPool.has(ns));
  const items: RawObject[] = [];
  for (const namespace of targets) {
    CONFIGMAP_POOL_NAMES.forEach((name, i) => {
      items.push({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name, namespace },
        data: { 'app.properties': `demo.pool.index=${i + 1}` },
      });
    });
    for (const name of SECRET_POOL_NAMES) {
      items.push({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name, namespace },
        type: 'Opaque',
        data: { key: 'ZGVtbw==' },
      });
    }
  }
  return items;
}

export interface ConfigSecretRefsResult {
  /** The same Pods passed in, with `envFrom` added to their first container for any Pod that didn't already
   *  reference one — the caller (demoData.ts) persists these over the originally staged Pods. */
  updatedPods: RawObject[];
  /** Every Namespace that now has a Pod referencing the pool — the caller is expected to ensure each one
   *  actually has its pool (see buildConfigSecretPool), since a reference to a ConfigMap/Secret that doesn't
   *  exist is worse than no reference at all. */
  namespacesNeedingPool: string[];
}

/**
 * Gives every given Pod that doesn't already reference one at least one ConfigMap and one Secret, via
 * `envFrom` on its first container — cycling through the fixed 5-name pool (CONFIGMAP_POOL_NAMES/
 * SECRET_POOL_NAMES) for variety across Pods. Reuses the SAME literal names in every Namespace (see
 * buildConfigSecretPool), so a reference never needs to know which Namespace its Pod happens to live in — it
 * always resolves against that Namespace's own copy. A Pod with no containers, or one that already has an
 * `envFrom` entry (e.g. from an earlier run), is left untouched — "at least one", not "always add another".
 */
export function buildConfigSecretRefsForPods(pods: RawObject[]): ConfigSecretRefsResult {
  const namespacesNeedingPool = new Set<string>();
  let index = 0;

  const updatedPods = pods.map((pod) => {
    const spec = pod.spec as { containers?: RawObject[] } | undefined;
    const containers = spec?.containers ?? [];
    const container = containers[0] as { envFrom?: unknown[] } | undefined;
    if (!container || (container.envFrom?.length ?? 0) > 0) return pod;

    const namespace = (pod.metadata as { namespace?: string }).namespace ?? 'default';
    namespacesNeedingPool.add(namespace);
    const configMapName = CONFIGMAP_POOL_NAMES[index % CONFIGMAP_POOL_NAMES.length] as string;
    const secretName = SECRET_POOL_NAMES[index % SECRET_POOL_NAMES.length] as string;
    index += 1;

    const updatedContainer = { ...container, envFrom: [{ configMapRef: { name: configMapName } }, { secretRef: { name: secretName } }] };
    return { ...pod, spec: { ...spec, containers: [updatedContainer, ...containers.slice(1)] } };
  });

  return { updatedPods, namespacesNeedingPool: [...namespacesNeedingPool] };
}

// ---------------------------------------------------------------------------------------------------------
// StorageClass / CSIDriver pool + per-Node CSINode
// ---------------------------------------------------------------------------------------------------------

export const STORAGE_CLASS_NAMES = ['demo-storage-fast', 'demo-storage-standard', 'demo-storage-slow'];
export const CSI_DRIVER_NAMES = ['demo.csi.fast.example.com', 'demo.csi.standard.example.com', 'demo.csi.slow.example.com'];

/** 3 StorageClasses + 3 CSIDrivers, fixed names — the pool every CSINode/PV in this working set references. */
export function buildStorageCsiBundle(): RawObject[] {
  const storageClasses: RawObject[] = STORAGE_CLASS_NAMES.map((name) => ({
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: { name },
    provisioner: name.replace('demo-storage-', 'demo.csi.') + '.example.com',
  }));
  const csiDrivers: RawObject[] = CSI_DRIVER_NAMES.map((name) => ({
    apiVersion: 'storage.k8s.io/v1',
    kind: 'CSIDriver',
    metadata: { name },
    spec: { attachRequired: true, podInfoOnMount: false },
  }));
  return [...storageClasses, ...csiDrivers];
}

/** One CSINode per given Node name, each listing ALL of `driverNames` — "every Node has all 3 CSI drivers
 *  associated." Meant to be called with the CURRENT staged Node set and OVERWRITE (not append to) the
 *  CSINode working file, so re-running after adding more Nodes refreshes the whole set instead of
 *  accumulating stale/duplicate entries for Nodes from a previous call. */
export function buildCsiNodesForNodes(nodeNames: string[], driverNames: string[]): RawObject[] {
  return nodeNames.map((nodeName) => ({
    apiVersion: 'storage.k8s.io/v1',
    kind: 'CSINode',
    metadata: { name: nodeName },
    spec: {
      drivers: driverNames.map((driverName) => ({ name: driverName, nodeID: nodeName, topologyKeys: null })),
    },
  }));
}

// ---------------------------------------------------------------------------------------------------------
// PVC / PV, a percentage of staged Pods
// ---------------------------------------------------------------------------------------------------------

export interface PvcPvResult {
  /** The same Pods passed in, with a `persistentVolumeClaim` volume added to the ones that got a PVC — the
   *  caller (demoData.ts) is expected to write these back over the originally staged Pods, the same way
   *  buildServicesForPods's updatedPods are, so the wheel/schematic projections' Pod->PVC edge (which matches
   *  on pod.spec.volumes[].persistentVolumeClaim.claimName, not on naming convention) actually resolves. */
  updatedPods: RawObject[];
  persistentVolumeClaims: RawObject[];
  persistentVolumes: RawObject[];
  volumeAttachments: RawObject[];
}

/**
 * Gives `percent`% of `pods` a PersistentVolumeClaim + matching PersistentVolume — e.g. 1,500 Pods at 15%
 * yields 225 PVC/PV pairs. Of those PVs, split 50/50: the first half get a `storageClassName` from
 * `storageClassNames` (a "pre-provisioned by StorageClass" volume); the second half instead get a
 * VolumeAttachment binding the PV to that Pod's Node (a "dynamically CSI-attached" volume) — two different
 * ways a real cluster ends up with a bound PV, both worth having examples of.
 *
 * The selected Pods are spread evenly across the whole `pods` array (stride = pods.length / count) rather
 * than just taking the first `count` — clustering every PVC onto the front of the list would leave the rest
 * of a large cluster looking storage-less in every view that renders Pods in their staged order.
 */
export function buildPvcPvForPods(pods: RawObject[], percent: number, storageClassNames: string[]): PvcPvResult {
  const count = Math.round((percent / 100) * pods.length);
  const stride = count > 0 ? pods.length / count : 0;
  const selected = Array.from({ length: count }, (_, i) => pods[Math.floor(i * stride)] as RawObject);
  const persistentVolumeClaims: RawObject[] = [];
  const persistentVolumes: RawObject[] = [];
  const volumeAttachments: RawObject[] = [];
  const updatedByName = new Map<string, RawObject>();

  selected.forEach((pod, i) => {
    const metadata = pod.metadata as { name: string; namespace: string };
    const spec = pod.spec as { nodeName?: string; volumes?: unknown[] } | undefined;
    const pvcName = `${metadata.name}-pvc`;
    const pvName = `pv-${metadata.name}`;
    const byStorageClass = i % 2 === 0;

    persistentVolumeClaims.push({
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { name: pvcName, namespace: metadata.namespace },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '10Gi' } },
        storageClassName: storageClassNames[i % storageClassNames.length],
        volumeName: pvName,
      },
      status: { phase: 'Bound' },
    });

    const pv: RawObject = {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: { name: pvName },
      spec: {
        accessModes: ['ReadWriteOnce'],
        capacity: { storage: '10Gi' },
        claimRef: { kind: 'PersistentVolumeClaim', name: pvcName, namespace: metadata.namespace },
        ...(byStorageClass ? { storageClassName: storageClassNames[i % storageClassNames.length] } : {}),
      },
      status: { phase: 'Bound' },
    };
    persistentVolumes.push(pv);

    if (!byStorageClass && spec?.nodeName) {
      volumeAttachments.push({
        apiVersion: 'storage.k8s.io/v1',
        kind: 'VolumeAttachment',
        metadata: { name: `va-${pvName}` },
        spec: {
          attacher: CSI_DRIVER_NAMES[i % CSI_DRIVER_NAMES.length],
          nodeName: spec.nodeName,
          source: { persistentVolumeName: pvName },
        },
        status: { attached: true },
      });
    }

    updatedByName.set(metadata.name, {
      ...pod,
      spec: { ...spec, volumes: [...(spec?.volumes ?? []), { name: 'data', persistentVolumeClaim: { claimName: pvcName } }] },
    });
  });

  const updatedPods = pods.map((p) => updatedByName.get((p.metadata as { name: string }).name) ?? p);
  return { updatedPods, persistentVolumeClaims, persistentVolumes, volumeAttachments };
}

// ---------------------------------------------------------------------------------------------------------
// Services, a percentage of staged Pods, a percentage of the resulting Services shared by multiple Pods
// ---------------------------------------------------------------------------------------------------------

export interface ServiceResult {
  /** ONLY the subset of the input Pods that got attached to a Service (not the full input array), each with a
   *  `demo.vpk/service` label added — the caller (demoData.ts) merges these back into the full staged Pod set
   *  by name, leaving every other Pod untouched, so the Service's selector actually matches something. */
  updatedPods: RawObject[];
  services: RawObject[];
  /** One per Service, same name+namespace — VpK's Network view joins Services to Pods via this object's
   *  `subsets[].addresses[].targetRef` (see @vpk/core's network.ts), NOT the Service's label selector, so a
   *  Service with no matching Endpoints object shows "no backing pods" even with a selector that matches. */
  endpoints: RawObject[];
}

/** @vpk/core's identity.ts resourceId format for a namespaced Pod with no metadata.uid — duplicated here
 *  (not imported) since @vpk/demo-data deliberately doesn't depend on @vpk/core's graph/identity internals,
 *  only its RawObject type; this is the one place a bundle needs to predict an id ahead of buildGraph. */
function podResourceId(pod: RawObject): string {
  const metadata = pod.metadata as { name: string; namespace: string };
  return `${pod.apiVersion as string}|Pod|${metadata.namespace}|${metadata.name}`;
}

/** A synthetic pod-network IP in the `10.244.x.y` range (the same /16 minikube's default CNI uses) — no demo
 *  bundle ever sets a real `status.podIP` on a generated Pod, so without this the Network view's
 *  Services-To-Pods cards show every demo-generated backing pod with a blank IP column. `index` is a running
 *  counter across every address this bundle emits (not per-Service), so addresses stay unique — deterministic,
 *  not random, so the same generate call always produces the same-looking data. */
function demoPodIp(index: number): string {
  return `10.244.${Math.floor(index / 254)}.${(index % 254) + 1}`;
}

/**
 * Gives `podPercent`% of `pods` a Service (e.g. 1,500 Pods at 20% -> 300 Pods get attached to some Service),
 * then groups those Pods into Services such that roughly `sharedPercent`% of the resulting Services are
 * "shared" (selected by more than one Pod) — e.g. of the Services created, 15% have 2+ Pods behind them, the
 * rest have exactly 1. Solo services get a 1:1 label; shared services absorb a handful of pods each (2-4),
 * merging one-pod groups together until the shared fraction is reached (or every eligible pod is used up).
 *
 * Pods need a matching label for a Service's selector to mean anything — since Pod.json's template doesn't
 * define one (kept deliberately minimal), this bundle adds a `demo.vpk/service` label to the Pods it
 * attaches to a Service, and returns the updated Pod objects for the caller to persist. It also builds a
 * matching Endpoints object per Service (see `endpoints` above) — without one, the Network view has nothing
 * to join the Service to its Pods with, selector or not.
 *
 * The selected Pods are spread evenly across the whole `pods` array (stride = pods.length / podCount) rather
 * than just taking the first `podCount` — see buildPvcPvForPods's identical fix for why: clustering every
 * Service onto the front of the list leaves the rest of a large cluster looking service-less in any view
 * that renders Pods in their staged order.
 *
 * Sharing/merging happens WITHIN each namespace independently (never across) — a Service and its Endpoints
 * object are namespace-scoped, and an Endpoints targetRef can only ever point at a Pod in that SAME
 * namespace, so a "shared" group can never legally include Pods from two different namespaces.
 */
export function buildServicesForPods(pods: RawObject[], podPercent: number, sharedPercent: number): ServiceResult {
  const podCount = Math.round((podPercent / 100) * pods.length);
  const stride = podCount > 0 ? pods.length / podCount : 0;
  const selected = Array.from({ length: podCount }, (_, i) => pods[Math.floor(i * stride)] as RawObject);
  if (selected.length === 0) return { updatedPods: [], services: [], endpoints: [] };

  // A Service (and the Endpoints object backing it) is namespace-scoped — its Endpoints targetRefs can only
  // ever point at Pods in that SAME namespace. Grouping must therefore stay within one namespace at a time, so
  // the merge below runs independently per namespace rather than across the whole selection.
  const selectedByNamespace = new Map<string, RawObject[]>();
  for (const pod of selected) {
    const ns = (pod.metadata as { namespace: string }).namespace;
    const list = selectedByNamespace.get(ns) ?? [];
    list.push(pod);
    selectedByNamespace.set(ns, list);
  }

  // Start with every selected pod as its own solo group, then merge consecutive groups (2-4 pods each) into
  // "shared" ones until the shared fraction of the resulting service count reaches sharedPercent (or we run
  // out of solo groups to merge) — independently within each namespace, so a merged group's pods always share
  // the same namespace.
  const groups: string[][] = [];
  for (const nsPods of selectedByNamespace.values()) {
    let nsGroups: string[][] = nsPods.map((p) => [(p.metadata as { name: string }).name]);
    const targetSharedFraction = sharedPercent / 100;
    let mergeSize = 2;
    while (nsGroups.length > 1) {
      const sharedCount = nsGroups.filter((g) => g.length > 1).length;
      if (sharedCount / nsGroups.length >= targetSharedFraction) break;
      const soloIndex = nsGroups.findIndex((g) => g.length === 1);
      if (soloIndex === -1) break; // nothing left to merge
      const merged = nsGroups.slice(soloIndex, soloIndex + mergeSize).flat();
      nsGroups = [...nsGroups.slice(0, soloIndex), merged, ...nsGroups.slice(soloIndex + mergeSize)];
      mergeSize = mergeSize >= 4 ? 2 : mergeSize + 1; // vary shared-group size (2, 3, 4, 2, 3, 4, ...)
    }
    groups.push(...nsGroups);
  }

  const podByName = new Map(selected.map((p) => [(p.metadata as { name: string; namespace: string }).name, p]));
  const services: RawObject[] = [];
  const endpoints: RawObject[] = [];
  const labeledPodNames = new Map<string, string>(); // pod name -> service label value
  let ipCounter = 0;

  groups.forEach((podNames, i) => {
    const serviceName = `demo-svc-${i + 1}`;
    for (const podName of podNames) labeledPodNames.set(podName, serviceName);
    const firstPod = podByName.get(podNames[0] as string) as RawObject;
    const namespace = (firstPod.metadata as { namespace: string }).namespace;
    services.push({
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: serviceName, namespace },
      spec: {
        selector: { 'demo.vpk/service': serviceName },
        ports: [{ port: 80, targetPort: 8080 }],
      },
    });
    endpoints.push({
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: { name: serviceName, namespace },
      subsets: [
        {
          addresses: podNames.map((podName) => {
            const pod = podByName.get(podName) as RawObject;
            const spec = pod.spec as { nodeName?: string } | undefined;
            return { ip: demoPodIp(ipCounter++), targetRef: { kind: 'Pod', uid: podResourceId(pod) }, nodeName: spec?.nodeName };
          }),
          ports: [{ port: 8080 }],
        },
      ],
    });
  });

  const updatedPods = selected.map((pod) => {
    const name = (pod.metadata as { name: string }).name;
    const label = labeledPodNames.get(name);
    if (!label) return pod;
    const metadata = pod.metadata as { labels?: Record<string, string> };
    return { ...pod, metadata: { ...metadata, labels: { ...metadata.labels, 'demo.vpk/service': label } } };
  });

  return { updatedPods, services, endpoints };
}

// ---------------------------------------------------------------------------------------------------------
// Namespaces — required system namespaces, plus 'n' additional
// ---------------------------------------------------------------------------------------------------------

/** Every real cluster has these — generated data should too, rather than every other bundle needing its own
 *  namespace out of nowhere. */
export const SYSTEM_NAMESPACES = ['default', 'kube-system', 'kube-public', 'kube-node-lease'];

function namespaceObject(name: string): RawObject {
  return { apiVersion: 'v1', kind: 'Namespace', metadata: { name }, status: { phase: 'Active' } };
}

/** The required system namespaces not already staged (checked by name, so calling this again after some are
 *  already present only adds what's missing — never duplicates kube-system etc.), plus `additionalCount`
 *  freshly-named ones (`demo-ns-{startIndex+1..}`, continuing from `startIndex` the same way /demo/generate's
 *  patterns continue a Kind's count across separate calls — see demoData.ts's getStagedCount). */
export function buildNamespaceBundle(existingNames: string[], additionalCount: number, startIndex: number): RawObject[] {
  const missing = SYSTEM_NAMESPACES.filter((n) => !existingNames.includes(n)).map(namespaceObject);
  const additional = Array.from({ length: additionalCount }, (_, i) => namespaceObject(`demo-ns-${startIndex + i + 1}`));
  return [...missing, ...additional];
}

// ---------------------------------------------------------------------------------------------------------
// DaemonSets, 8-13 per Node (randomly assigned)
// ---------------------------------------------------------------------------------------------------------

/** Real DaemonSets aren't "per Node" objects (one DaemonSet's Pods span every matching Node) — but the ask
 *  here is demo data that LOOKS like "this Node runs its usual handful of node-level agents" (kube-proxy,
 *  CNI, log shipper, ...), so each Node gets its own random-8-to-13 DaemonSets, each with exactly one backing
 *  Pod scheduled to that Node and owned by it (ownerReferences + matching uid — see demoTimestamps.ts's
 *  validateHierarchy, which can finally check something real once a Kind's data carries these). Only Nodes
 *  NOT already in `existingNodeNamesWithDaemonSets` get a fresh batch — "created as needed," the same "top
 *  up, don't duplicate" shape as buildServiceAccountBundle/buildQuotaLimitBundle — so calling this again after
 *  adding more Nodes only generates DaemonSets for the newly-added ones instead of piling a second random
 *  8-13 batch (with fresh names, since `i` restarts at 1 each call) onto Nodes that already have one. */
export function buildDaemonSetsForNodes(
  nodeNames: string[],
  namespaces: string[],
  existingNodeNamesWithDaemonSets: Set<string> = new Set(),
): { daemonSets: RawObject[]; pods: RawObject[] } {
  const daemonSets: RawObject[] = [];
  const pods: RawObject[] = [];
  const ns = namespaces.length > 0 ? namespaces : ['kube-system'];
  const targetNodeNames = nodeNames.filter((n) => !existingNodeNamesWithDaemonSets.has(n));

  targetNodeNames.forEach((nodeName, nodeIndex) => {
    const count = 8 + Math.floor(Math.random() * 6); // 8-13 inclusive
    const namespace = ns[nodeIndex % ns.length] as string;
    for (let i = 1; i <= count; i++) {
      const uid = crypto.randomUUID();
      const name = `demo-ds-${nodeName}-${i}`;
      daemonSets.push({
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name, namespace, uid },
        spec: {
          selector: { matchLabels: { app: name } },
          template: { metadata: { labels: { app: name } }, spec: { containers: [{ name: 'app', image: 'demo-registry-a.example.com/apps/agent:latest' }] } },
        },
      });
      pods.push({
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: `${name}-pod`, namespace, ownerReferences: [{ apiVersion: 'apps/v1', kind: 'DaemonSet', name, uid }] },
        spec: { containers: [{ name: 'app', image: 'demo-registry-a.example.com/apps/agent:latest' }], nodeName },
        status: { phase: 'Running' },
      });
    }
  });

  return { daemonSets, pods };
}

// ---------------------------------------------------------------------------------------------------------
// Deployment -> ReplicaSet (1-5 replicas, randomly picked) -> Pod ownership, for every un-owned Pod
// ---------------------------------------------------------------------------------------------------------

export interface DeploymentResult {
  deployments: RawObject[];
  replicaSets: RawObject[];
  /** Every input Pod that had no ownerReferences yet, now pointing at its new ReplicaSet — Pods already
   *  owned (e.g. by a DaemonSet bundle run earlier) are left completely alone. */
  updatedPods: RawObject[];
}

/**
 * Groups every currently un-owned Pod into chunks of 1-5 (randomly picked per chunk), gives each chunk a
 * ReplicaSet (spec.replicas = chunk size) owned by a fresh Deployment, and sets each Pod's ownerReferences to
 * that ReplicaSet. Pods that already have an ownerReferences entry (e.g. a DaemonSet-owned Pod) are left
 * untouched — this only wires up the ones nothing owns yet. Chunking happens WITHIN each namespace
 * independently (never across) — a ReplicaSet/Deployment lives in one namespace, and every Pod it owns must
 * live in that same namespace, which is only guaranteed if a chunk is never allowed to mix namespaces.
 */
export function buildDeploymentsForPods(pods: RawObject[]): DeploymentResult {
  const unowned = pods.filter((p) => !((p.metadata as { ownerReferences?: unknown[] }).ownerReferences?.length));
  const deployments: RawObject[] = [];
  const replicaSets: RawObject[] = [];
  const updatedByName = new Map<string, RawObject>();

  // A ReplicaSet's ownerReferences (and a Deployment's own metadata) are namespace-scoped — every Pod in a
  // chunk must live in the SAME namespace as the Deployment/ReplicaSet that ends up owning it, so chunking has
  // to stay within one namespace at a time rather than slicing straight across `unowned` in its given order
  // (which interleaves namespaces whenever Pods from different namespaces are adjacent in that list).
  const unownedByNamespace = new Map<string, RawObject[]>();
  for (const pod of unowned) {
    const ns = (pod.metadata as { namespace: string }).namespace;
    const list = unownedByNamespace.get(ns) ?? [];
    list.push(pod);
    unownedByNamespace.set(ns, list);
  }

  let groupIndex = 0;
  for (const nsPods of unownedByNamespace.values()) {
    let i = 0;
    while (i < nsPods.length) {
      const size = Math.min(1 + Math.floor(Math.random() * 5), nsPods.length - i); // 1-5, capped by what's left
      const chunk = nsPods.slice(i, i + size);
      i += size;
      groupIndex += 1;

      const firstPod = chunk[0] as RawObject;
      const namespace = (firstPod.metadata as { namespace: string }).namespace;
      const deploymentName = `demo-deploy-${groupIndex}`;
      const replicaSetName = `${deploymentName}-rs`;
      const deploymentUid = crypto.randomUUID();
      const replicaSetUid = crypto.randomUUID();
      // Resolved directly (not left as a literal "{image}" token) — these objects are built straight from
      // this bundle, not filled via fillTemplate/DEMO_TEMPLATES, so nothing else would ever resolve it.
      const image = resolvePattern('{image}', 1);

      deployments.push({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: deploymentName, namespace, uid: deploymentUid },
        spec: {
          replicas: chunk.length,
          selector: { matchLabels: { app: deploymentName } },
          template: { metadata: { labels: { app: deploymentName } }, spec: { containers: [{ name: 'app', image }] } },
        },
      });
      replicaSets.push({
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        metadata: {
          name: replicaSetName,
          namespace,
          uid: replicaSetUid,
          ownerReferences: [{ apiVersion: 'apps/v1', kind: 'Deployment', name: deploymentName, uid: deploymentUid }],
        },
        spec: {
          replicas: chunk.length,
          selector: { matchLabels: { app: deploymentName } },
          template: { metadata: { labels: { app: deploymentName } }, spec: { containers: [{ name: 'app', image }] } },
        },
      });

      for (const pod of chunk) {
        const metadata = pod.metadata as { name: string; labels?: Record<string, string> };
        updatedByName.set(metadata.name, {
          ...pod,
          metadata: {
            ...metadata,
            labels: { ...metadata.labels, app: deploymentName },
            ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: replicaSetName, uid: replicaSetUid }],
          },
        });
      }
    }
  }

  const updatedPods = pods.map((p) => updatedByName.get((p.metadata as { name: string }).name) ?? p);
  return { deployments, replicaSets, updatedPods };
}

// ---------------------------------------------------------------------------------------------------------
// Pods per Node — a count pattern per Node (Running/Succeeded split to match), plus a cluster-wide
// Failed/Warning count scattered across Worker Nodes only
// ---------------------------------------------------------------------------------------------------------

export interface NodeRoleRef {
  name: string;
  role: 'master' | 'worker';
}

function demoPodObject(name: string, namespace: string, nodeName: string, phase: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name, namespace },
    spec: { containers: [{ name: 'app', image: resolvePattern('{image}', 1) }], nodeName },
    status: { phase },
  };
}

/**
 * Gives every Node a Pod count resolved from `podsPerNodePattern` via resolvePattern (so "{100-150,Random}"
 * draws a fresh random count per Node, "{100-150}" walks the range sequentially node to node, or a plain
 * number gives every Node the same count — whatever the pattern language already supports, not a new
 * mini-language just for this), split randomly into Running vs. Succeeded ("Completed") so the two sum back
 * to that Node's count exactly. `failedCount` and `warningCount` (this app's vocabulary: Warning = pod phase
 * Pending — see @vpk/core's podStatus.ts) are each a single number for the WHOLE cluster, not per-Node,
 * scattered onto randomly-chosen Worker Nodes only (never Masters) — e.g. "5 Failed" means 5 Pods total,
 * each independently assigned to a random Worker.
 *
 * `startIndex` continues the same global Pod-naming sequence every other Pod-generating path uses (see
 * demoData.ts's getStagedCount) so names stay unique regardless of which mechanism created a given Pod.
 */
export function buildPodsPerNode(
  nodes: NodeRoleRef[],
  namespaces: string[],
  podsPerNodePattern: string,
  failedCount: number,
  warningCount: number,
  startIndex: number,
): RawObject[] {
  const ns = namespaces.length > 0 ? namespaces : ['default'];
  const pods: RawObject[] = [];
  let counter = startIndex;

  function addPod(nodeName: string, phase: string) {
    counter += 1;
    const namespace = ns[(counter - 1) % ns.length] as string;
    pods.push(demoPodObject(`demo-pod-${counter}`, namespace, nodeName, phase));
  }

  nodes.forEach((node, i) => {
    const resolved = Number(resolvePattern(podsPerNodePattern, i + 1));
    const total = Math.max(0, Math.round(Number.isFinite(resolved) ? resolved : 0));
    const runningCount = Math.floor(Math.random() * (total + 1)); // 0..total inclusive
    const succeededCount = total - runningCount;
    for (let k = 0; k < runningCount; k++) addPod(node.name, 'Running');
    for (let k = 0; k < succeededCount; k++) addPod(node.name, 'Succeeded');
  });

  const workerNodes = nodes.filter((n) => n.role === 'worker');
  if (workerNodes.length > 0) {
    for (let k = 0; k < failedCount; k++) {
      const node = workerNodes[Math.floor(Math.random() * workerNodes.length)] as NodeRoleRef;
      addPod(node.name, 'Failed');
    }
    for (let k = 0; k < warningCount; k++) {
      const node = workerNodes[Math.floor(Math.random() * workerNodes.length)] as NodeRoleRef;
      addPod(node.name, 'Pending');
    }
  }

  return pods;
}

// ---------------------------------------------------------------------------------------------------------
// CronJobs, Jobs, StatefulSets — each a percent of the total staged Pod count (same denominator PVC/PV and
// Services already use), StatefulSets carrying real per-replica PVC + PV (volumeClaimTemplates-style)
// ---------------------------------------------------------------------------------------------------------

export interface WorkloadPercents {
  cronJobPercent: number;
  statefulSetPercent: number;
  jobPercent: number;
}

export interface WorkloadStartIndex {
  cronJob: number;
  job: number;
  statefulSet: number;
}

export interface WorkloadsBundleResult {
  cronJobs: RawObject[];
  jobs: RawObject[];
  statefulSets: RawObject[];
  /** One Pod per StatefulSet replica, owned directly by the StatefulSet (no ReplicaSet in between — real
   *  StatefulSets don't use one), named `<statefulSetName>-<ordinal>` the way kubernetes actually names them. */
  statefulSetPods: RawObject[];
  /** One PVC+PV pair per StatefulSet replica, named `data-<podName>` / `pv-data-<podName>` — mirrors what a
   *  real StatefulSet's volumeClaimTemplates produces per-Pod, not a shared volume across replicas. */
  persistentVolumeClaims: RawObject[];
  persistentVolumes: RawObject[];
}

/**
 * `cronJobPercent`/`jobPercent`/`statefulSetPercent` are each resolved against the SAME total staged Pod count
 * (e.g. 1,500 Pods at 10% CronJob = 150 CronJobs) — independent percentages, not carved out of each other.
 * CronJobs and Jobs are simple, minimal objects (this is demo data, not real workload definitions). Each
 * StatefulSet gets 1-3 replicas (randomly picked) and a `data` volumeClaimTemplate; every replica Pod is
 * created directly owned by the StatefulSet (ownerReferences + uid, matching what demoTimestamps.ts's
 * validateHierarchy checks) along with its own bound PVC and PV — the "proper PVC, PV" a real StatefulSet
 * would have, not a single volume shared across replicas.
 */
export function buildWorkloadsBundle(
  totalPodCount: number,
  percents: WorkloadPercents,
  namespaces: string[],
  storageClassNames: string[],
  nodeNames: string[],
  startIndex: WorkloadStartIndex,
): WorkloadsBundleResult {
  const ns = namespaces.length > 0 ? namespaces : ['default'];
  const sc = storageClassNames.length > 0 ? storageClassNames : ['standard'];

  const cronJobCount = Math.round((percents.cronJobPercent / 100) * totalPodCount);
  const jobCount = Math.round((percents.jobPercent / 100) * totalPodCount);
  const statefulSetCount = Math.round((percents.statefulSetPercent / 100) * totalPodCount);

  const cronJobs: RawObject[] = Array.from({ length: cronJobCount }, (_, i) => {
    const n = startIndex.cronJob + i + 1;
    const namespace = ns[(n - 1) % ns.length] as string;
    return {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: { name: `demo-cronjob-${n}`, namespace },
      spec: {
        schedule: '*/5 * * * *',
        jobTemplate: { spec: { template: { spec: { containers: [{ name: 'app', image: resolvePattern('{image}', 1) }], restartPolicy: 'OnFailure' } } } },
      },
    };
  });

  const jobs: RawObject[] = Array.from({ length: jobCount }, (_, i) => {
    const n = startIndex.job + i + 1;
    const namespace = ns[(n - 1) % ns.length] as string;
    return {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: { name: `demo-job-${n}`, namespace },
      spec: { template: { spec: { containers: [{ name: 'app', image: resolvePattern('{image}', 1) }], restartPolicy: 'OnFailure' } } },
      status: { succeeded: 1 },
    };
  });

  const statefulSets: RawObject[] = [];
  const statefulSetPods: RawObject[] = [];
  const persistentVolumeClaims: RawObject[] = [];
  const persistentVolumes: RawObject[] = [];

  for (let i = 0; i < statefulSetCount; i++) {
    const n = startIndex.statefulSet + i + 1;
    const name = `demo-sts-${n}`;
    const namespace = ns[(n - 1) % ns.length] as string;
    const replicas = 1 + Math.floor(Math.random() * 3); // 1-3
    const storageClassName = sc[(n - 1) % sc.length] as string;
    const uid = crypto.randomUUID();

    statefulSets.push({
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      metadata: { name, namespace, uid },
      spec: {
        serviceName: name,
        replicas,
        selector: { matchLabels: { app: name } },
        template: { metadata: { labels: { app: name } }, spec: { containers: [{ name: 'app', image: resolvePattern('{image}', 1) }] } },
        volumeClaimTemplates: [
          { metadata: { name: 'data' }, spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '10Gi' } }, storageClassName } },
        ],
      },
    });

    for (let ordinal = 0; ordinal < replicas; ordinal++) {
      const podName = `${name}-${ordinal}`;
      const pvcName = `data-${podName}`;
      const pvName = `pv-${pvcName}`;
      const nodeName = nodeNames.length > 0 ? nodeNames[(n + ordinal - 1) % nodeNames.length] : undefined;

      statefulSetPods.push({
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: podName,
          namespace,
          labels: { app: name },
          ownerReferences: [{ apiVersion: 'apps/v1', kind: 'StatefulSet', name, uid }],
        },
        spec: {
          containers: [{ name: 'app', image: resolvePattern('{image}', 1) }],
          ...(nodeName ? { nodeName } : {}),
          volumes: [{ name: 'data', persistentVolumeClaim: { claimName: pvcName } }],
        },
        status: { phase: 'Running' },
      });

      persistentVolumeClaims.push({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: pvcName, namespace },
        spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '10Gi' } }, storageClassName, volumeName: pvName },
        status: { phase: 'Bound' },
      });

      persistentVolumes.push({
        apiVersion: 'v1',
        kind: 'PersistentVolume',
        metadata: { name: pvName },
        spec: {
          accessModes: ['ReadWriteOnce'],
          capacity: { storage: '10Gi' },
          storageClassName,
          claimRef: { kind: 'PersistentVolumeClaim', name: pvcName, namespace },
        },
        status: { phase: 'Bound' },
      });
    }
  }

  return { cronJobs, jobs, statefulSets, statefulSetPods, persistentVolumeClaims, persistentVolumes };
}

// ---------------------------------------------------------------------------------------------------------
// ServiceAccounts — one per Namespace, created only as needed (never a fixed pool, never duplicated)
// ---------------------------------------------------------------------------------------------------------

/** Fixed name reused in every Namespace — identity is the (namespace, name) pair, so the same literal name
 *  across many Namespaces is completely fine and keeps every Namespace's ServiceAccount predictable. */
export const SERVICE_ACCOUNT_NAME = 'demo-sa';

function serviceAccountObject(namespace: string): RawObject {
  return { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name: SERVICE_ACCOUNT_NAME, namespace } };
}

/**
 * One ServiceAccount per given Namespace — "created as needed" rather than a fixed pool: a Namespace already
 * in `existingNamespacesWithServiceAccount` is skipped, so calling this again after adding more Namespaces
 * only creates the newly-missing ones instead of duplicating (same "top up" shape as runCsiNodeSync).
 */
export function buildServiceAccountBundle(namespaces: string[], existingNamespacesWithServiceAccount: Set<string>): RawObject[] {
  return namespaces.filter((ns) => !existingNamespacesWithServiceAccount.has(ns)).map(serviceAccountObject);
}

// ---------------------------------------------------------------------------------------------------------
// Events — always for Failed/Warning(Pending) Pods; optionally the standard launch sequence for every Pod
// ---------------------------------------------------------------------------------------------------------

export interface PodEventRef {
  name: string;
  namespace: string;
  phase: string;
}

/** The Normal event sequence a real kubelet emits launching a Pod, in order — used only when the caller opts
 *  in via `includeStandardLaunchEvents` (this can be a LOT of Events at scale, so it's off by default). */
const LAUNCH_EVENT_STEPS: { reason: string; message: string }[] = [
  { reason: 'Scheduled', message: 'Successfully assigned pod to a Node' },
  { reason: 'Pulling', message: 'Pulling image "app"' },
  { reason: 'Pulled', message: 'Successfully pulled image "app"' },
  { reason: 'Created', message: 'Created container app' },
  { reason: 'Started', message: 'Started container app' },
];

function eventObject(name: string, namespace: string, podName: string, reason: string, type: 'Normal' | 'Warning', message: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Event',
    metadata: { name, namespace },
    involvedObject: { kind: 'Pod', name: podName, namespace },
    reason,
    message,
    type,
    count: 1,
  };
}

/**
 * Every Failed Pod gets one Warning "BackOff" Event, every Warning-category Pod (phase Pending — see
 * @vpk/core's podStatus.ts, this app's "Warning" vocabulary) gets one Warning "FailedScheduling" Event. When
 * `includeStandardLaunchEvents` is true, EVERY Pod (regardless of phase) also gets the 5-step Normal launch
 * sequence a real kubelet emits (Scheduled -> Pulling -> Pulled -> Created -> Started) — opt-in since at scale
 * (hundreds of Pods) this is a lot more Events than the Failed/Warning-only default.
 */
export function buildEventsForPods(pods: PodEventRef[], includeStandardLaunchEvents: boolean, startIndex: number): RawObject[] {
  const events: RawObject[] = [];
  let counter = startIndex;

  function push(pod: PodEventRef, reason: string, type: 'Normal' | 'Warning', message: string) {
    counter += 1;
    events.push(eventObject(`demo-event-${counter}`, pod.namespace, pod.name, reason, type, message));
  }

  for (const pod of pods) {
    if (pod.phase === 'Failed') push(pod, 'BackOff', 'Warning', 'Back-off restarting failed container');
    if (pod.phase === 'Pending') push(pod, 'FailedScheduling', 'Warning', '0/1 nodes are available: Insufficient cpu.');
    if (includeStandardLaunchEvents) {
      for (const step of LAUNCH_EVENT_STEPS) push(pod, step.reason, 'Normal', step.message);
    }
  }

  return events;
}

// ---------------------------------------------------------------------------------------------------------
// Gateway/GatewayClass — one pair per `podsPerGateway` Pods; HTTPRoute for a percent of Pods with a Service
// ---------------------------------------------------------------------------------------------------------

export interface PodServiceRef {
  name: string;
  namespace: string;
  /** The `demo.vpk/service` label value set by buildServicesForPods — undefined if this Pod has no Service. */
  serviceName?: string;
}

export interface GatewayStartIndex {
  gateway: number;
  gatewayClass: number;
  httpRoute: number;
}

export interface GatewayBundleResult {
  gatewayClasses: RawObject[];
  gateways: RawObject[];
  httpRoutes: RawObject[];
}

function gatewayClassObject(name: string): RawObject {
  return {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'GatewayClass',
    metadata: { name },
    spec: { controllerName: 'example.com/gateway-controller' },
  };
}

function gatewayObject(name: string, namespace: string, gatewayClassName: string): RawObject {
  return {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'Gateway',
    metadata: { name, namespace },
    spec: { gatewayClassName, listeners: [{ name: 'http', protocol: 'HTTP', port: 80 }] },
  };
}

function httpRouteObject(name: string, namespace: string, gatewayName: string, serviceName: string): RawObject {
  return {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
    metadata: { name, namespace },
    spec: { parentRefs: [{ name: gatewayName }], rules: [{ backendRefs: [{ name: serviceName, port: 80 }] }] },
  };
}

/**
 * One Gateway + one GatewayClass for every `podsPerGateway` Pods (e.g. 500 Pods at 100/Gateway -> 5
 * Gateway/GatewayClass pairs) — at least 1 of each as long as there's at least 1 Pod and `podsPerGateway` > 0.
 * Separately, `httpRoutePercent`% of Pods that already have a Service (the `demo.vpk/service` label
 * buildServicesForPods sets) get an HTTPRoute to that Service — Pods sharing one Service only ever produce ONE
 * HTTPRoute for it (a Service, not a Pod, is what an HTTPRoute actually targets), spread round-robin across
 * every Gateway that exists once this call's new ones are added to whatever was already staged.
 */
export function buildGatewayBundle(
  totalPodCount: number,
  podsPerGateway: number,
  httpRoutePercent: number,
  pods: PodServiceRef[],
  namespaces: string[],
  existingGatewayNames: string[],
  startIndex: GatewayStartIndex,
): GatewayBundleResult {
  const ns = namespaces.length > 0 ? namespaces : ['default'];
  const gatewayCount = totalPodCount > 0 && podsPerGateway > 0 ? Math.max(1, Math.floor(totalPodCount / podsPerGateway)) : 0;

  const gatewayClasses: RawObject[] = [];
  const gateways: RawObject[] = [];
  const newGatewayNames: string[] = [];
  for (let i = 0; i < gatewayCount; i++) {
    const gwN = startIndex.gateway + i + 1;
    const gcN = startIndex.gatewayClass + i + 1;
    const gcName = `demo-gatewayclass-${gcN}`;
    const gwName = `demo-gateway-${gwN}`;
    const namespace = ns[(gwN - 1) % ns.length] as string;
    gatewayClasses.push(gatewayClassObject(gcName));
    gateways.push(gatewayObject(gwName, namespace, gcName));
    newGatewayNames.push(gwName);
  }

  const allGatewayNames = [...existingGatewayNames, ...newGatewayNames];
  const candidatePods = pods.filter((p) => p.serviceName);
  const selectedCount = Math.round((httpRoutePercent / 100) * candidatePods.length);
  const selected = candidatePods.slice(0, selectedCount);

  const httpRoutes: RawObject[] = [];
  const seenServices = new Set<string>();
  let routeCounter = startIndex.httpRoute;
  let gwIndex = 0;
  for (const pod of selected) {
    const serviceKey = `${pod.namespace}/${pod.serviceName}`;
    if (seenServices.has(serviceKey)) continue;
    seenServices.add(serviceKey);
    if (allGatewayNames.length === 0) continue; // nothing to attach a route to yet
    const gatewayName = allGatewayNames[gwIndex % allGatewayNames.length] as string;
    gwIndex += 1;
    routeCounter += 1;
    httpRoutes.push(httpRouteObject(`demo-httproute-${routeCounter}`, pod.namespace, gatewayName, pod.serviceName as string));
  }

  return { gatewayClasses, gateways, httpRoutes };
}

// ---------------------------------------------------------------------------------------------------------
// NetworkPolicy — a default-deny policy for a percent of Namespaces
// ---------------------------------------------------------------------------------------------------------

function networkPolicyObject(namespace: string): RawObject {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'demo-default-deny', namespace },
    spec: { podSelector: {}, policyTypes: ['Ingress'] },
  };
}

/** `percent`% of `namespaces` get a default-deny-ingress NetworkPolicy (e.g. 20 Namespaces at 50% -> 10 get
 *  one) — the first `count` Namespaces in the given order. Unlike buildPvcPvForPods/buildServicesForPods
 *  (which spread their selection evenly across the whole input via a stride, so a large Pod list doesn't
 *  visually cluster every selected item at the front), a plain "take from the front" slice is fine here: a
 *  Namespace list has no equivalent "order Namespaces render in" concern for a namespace-wide policy to
 *  cluster against. */
export function buildNetworkPolicyBundle(namespaces: string[], percent: number): RawObject[] {
  const count = Math.round((percent / 100) * namespaces.length);
  return namespaces.slice(0, count).map(networkPolicyObject);
}

// ---------------------------------------------------------------------------------------------------------
// ResourceQuota + LimitRange — one pair per non-system Namespace
// ---------------------------------------------------------------------------------------------------------

function resourceQuotaObject(namespace: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: { name: 'demo-quota', namespace },
    spec: { hard: { 'requests.cpu': '20', 'requests.memory': '64Gi', pods: '200' } },
  };
}

function limitRangeObject(namespace: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'LimitRange',
    metadata: { name: 'demo-limits', namespace },
    spec: { limits: [{ type: 'Container', default: { cpu: '500m', memory: '512Mi' }, defaultRequest: { cpu: '100m', memory: '128Mi' } }] },
  };
}

export interface QuotaLimitResult {
  resourceQuotas: RawObject[];
  limitRanges: RawObject[];
}

/**
 * One ResourceQuota + one LimitRange for every Namespace that ISN'T one of the required system Namespaces
 * (SYSTEM_NAMESPACES — you wouldn't quota kube-system in a real cluster either) and doesn't already have one
 * (checked via `existingNamespacesWithQuota`, same "top up, don't duplicate" shape as the ServiceAccount and
 * CSINode-sync bundles).
 */
export function buildQuotaLimitBundle(namespaces: string[], existingNamespacesWithQuota: Set<string>): QuotaLimitResult {
  const targets = namespaces.filter((ns) => !SYSTEM_NAMESPACES.includes(ns) && !existingNamespacesWithQuota.has(ns));
  return { resourceQuotas: targets.map(resourceQuotaObject), limitRanges: targets.map(limitRangeObject) };
}

// ---------------------------------------------------------------------------------------------------------
// System Pods — the control-plane/system Pods every real cluster has running in kube-system
// ---------------------------------------------------------------------------------------------------------

/** Every real cluster runs exactly these in kube-system — one apiserver/controller-manager/scheduler/coredns/
 *  kube-proxy each (demo data stays SIMPLE: one of each, not one kube-proxy per Node like a real DaemonSet
 *  would produce), so demo clusters look complete even before any workload bundle has run. */
export const SYSTEM_POD_NAMES = ['kube-apiserver', 'kube-controller-manager', 'kube-scheduler', 'coredns', 'kube-proxy'];

function systemPodObject(name: string, nodeName?: string): RawObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name, namespace: 'kube-system', labels: { component: name, tier: 'control-plane' } },
    spec: { containers: [{ name, image: resolvePattern('{image}', 1) }], ...(nodeName ? { nodeName } : {}) },
    status: { phase: 'Running' },
  };
}

/**
 * The 5 required system Pods in kube-system (SYSTEM_POD_NAMES) — created only as needed, one time per
 * cluster: a name already present in `existingKubeSystemPodNames` is skipped, so re-running this after
 * clearing some-but-not-all of them only tops up what's missing rather than duplicating. Scheduled onto
 * `masterNodeName` when given (a real cluster's control plane runs on master Nodes) — left unscheduled
 * (no `spec.nodeName`) if no master Node is staged yet, since these Pods don't require one to exist.
 */
export function buildSystemPodsBundle(existingKubeSystemPodNames: Set<string>, masterNodeName?: string): RawObject[] {
  return SYSTEM_POD_NAMES.filter((name) => !existingKubeSystemPodNames.has(name)).map((name) => systemPodObject(name, masterNodeName));
}
