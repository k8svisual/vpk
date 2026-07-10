import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawObject } from '@vpk/core';
import {
  buildRbacBundle,
  buildConfigSecretPool,
  buildStorageCsiBundle,
  buildCsiNodesForNodes,
  buildPvcPvForPods,
  buildServicesForPods,
  buildNamespaceBundle,
  buildDaemonSetsForNodes,
  buildDeploymentsForPods,
  buildPodsPerNode,
  buildWorkloadsBundle,
  buildServiceAccountBundle,
  buildEventsForPods,
  buildGatewayBundle,
  buildNetworkPolicyBundle,
  buildQuotaLimitBundle,
  buildSystemPodsBundle,
  buildConfigSecretRefsForPods,
  SERVICE_ACCOUNT_NAME,
  CONFIGMAP_POOL_NAMES,
  CSI_DRIVER_NAMES,
  STORAGE_CLASS_NAMES,
  type NodeRoleRef,
  type PodServiceRef,
} from '@vpk/demo-data';
import { assignCreationTimestamps, validateHierarchy, simulatePodChurn, type TimestampOptions } from './demoTimestamps';
import { pushLog } from './logBuffer';

const WORKING_SUBDIR = 'demo-wip';

/** <snapshotDir>/demo-wip — where in-progress demo data is staged, one List file per Kind, kubectl-get-style
 *  (`{apiVersion, kind: "<Kind>List", items: [...]}`). Living alongside real snapshot captures (not some
 *  separate temp location) is what makes "finish → snapshot" a same-directory move instead of a copy across
 *  filesystems, and lets a user poke at the staged JSON with the same tools they'd use on a real capture. */
function workingDir(snapshotDir: string): string {
  return join(snapshotDir, WORKING_SUBDIR);
}

function kindFile(snapshotDir: string, kind: string): string {
  return join(workingDir(snapshotDir), `${kind}.json`);
}

function readKindList(snapshotDir: string, kind: string): RawObject[] {
  const file = kindFile(snapshotDir, kind);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { items?: RawObject[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    // corrupt/hand-edited-wrong staged file — degrade to empty rather than crash the endpoint
    pushLog('warn', `Ignoring corrupt staged Demo Data file ${file}: ${String(e)}`);
    return [];
  }
}

export interface WorkingSetEntry {
  kind: string;
  count: number;
}

/** What's currently staged, one entry per Kind that has at least one generated item — read fresh from disk
 *  every call (not cached) so "continue defining demo data" reflects edits made outside this running server
 *  too (e.g. a hand-edited staged file, or the process having been restarted). */
export function listWorkingSet(snapshotDir: string): WorkingSetEntry[] {
  const dir = workingDir(snapshotDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const kind = f.slice(0, -'.json'.length);
      return { kind, count: readKindList(snapshotDir, kind).length };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

/** How many of this Kind are already staged — the /demo/generate endpoint uses this as the starting point
 *  for each new item's GLOBAL index (existing count + 1, + 2, ...), so patterns like "{n}" or an IP-range
 *  odometer keep incrementing across separate "Add N" calls instead of restarting (and colliding) at 1 every
 *  time. */
export function getStagedCount(snapshotDir: string, kind: string): number {
  return readKindList(snapshotDir, kind).length;
}

/** The `.metadata.name` of every currently-staged item of this Kind — /demo/generate uses this for Kind
 *  "Namespace" to resolve `{namespace}` tokens (round-robin spreading across whatever's staged), and the
 *  DaemonSet/CSINode bundles use it for Kind "Node". */
export function getStagedNames(snapshotDir: string, kind: string): string[] {
  return readKindList(snapshotDir, kind).map((item) => (item.metadata as { name: string }).name);
}

function writeKindList(snapshotDir: string, kind: string, apiVersion: string, items: RawObject[]): void {
  mkdirSync(workingDir(snapshotDir), { recursive: true });
  writeFileSync(kindFile(snapshotDir, kind), JSON.stringify({ apiVersion, kind: `${kind}List`, items }, null, 2));
}

/** Appends newly generated items to this Kind's staged List file, creating the working directory and/or the
 *  file itself if this is the first item of that Kind. Returns the Kind's new total count (not just how many
 *  were just added), since that's what the Demo Data screen wants to show. */
export function appendGenerated(snapshotDir: string, kind: string, apiVersion: string, newItems: RawObject[]): number {
  const items = [...readKindList(snapshotDir, kind), ...newItems];
  writeKindList(snapshotDir, kind, apiVersion, items);
  return items.length;
}

/** Discards staged data — a single Kind's file if `kind` is given, otherwise the whole working directory. */
export function clearWorkingSet(snapshotDir: string, kind?: string): void {
  if (kind) {
    const file = kindFile(snapshotDir, kind);
    if (existsSync(file)) rmSync(file);
    return;
  }
  const dir = workingDir(snapshotDir);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Merges every staged List file into a new snapshot at `<snapshotDir>/<safeName>/vpk.snapshot.json`, in the
 * same manifest-fields-plus-items shape a real "Capture from cluster" writes (see cliSource.ts's
 * CaptureResult / server.ts's `/capture` handler) — so the result shows up in the existing snapshot dropdown
 * exactly like a real capture would, no special-casing needed anywhere else in the app.
 *
 * creationTimestamps are assigned HERE, not at generate time — only once every staged Kind is known can the
 * whole set be ordered against one consistent "point in time" (see demoTimestamps.ts's assignCreationTimestamps),
 * and the resulting hierarchy checked (validateHierarchy) in a single pass — a real check now, not a no-op:
 * several bundles (buildDaemonSetsForNodes, buildDeploymentsForPods, buildWorkloadsBundle's StatefulSet
 * replicas) set real ownerReferences + uid on the objects they build, so a child staged with a creationTimestamp
 * that predates its owner's is a genuine finding here (see validateHierarchy's own doc comment). Any hierarchy
 * problems are returned as `warnings` rather than blocking the write — surfacing them is more useful than
 * refusing to produce a snapshot over what's still just a display-ordering issue, not a broken reference.
 *
 * `churn`, when opted into (the Demo Data "Simulate pod churn" setting), runs AFTER assignCreationTimestamps
 * (churned pods need a real creationTimestamp to pick a later synthetic deletionTimestamp from) and BEFORE
 * validateHierarchy (which never inspects deletionTimestamp, so churn can't trip that check) — see
 * simulatePodChurn's own doc comment for why this is opt-in rather than always-on.
 *
 * Deliberately non-destructive: the working set is left untouched after finishing, in case the resulting
 * snapshot needs another look (or another round of additions) before the staging data is discarded via
 * `clearWorkingSet`.
 */
export function finishToSnapshot(
  snapshotDir: string,
  name: string,
  opts: TimestampOptions = {},
  churn?: { simulatePodChurn: boolean; podChurnPercent: number },
): { file: string; count: number; warnings: string[] } {
  const entries = listWorkingSet(snapshotDir);
  const rawItems = entries.flatMap((e) => readKindList(snapshotDir, e.kind));
  let items = assignCreationTimestamps(rawItems, opts);
  if (churn?.simulatePodChurn) items = simulatePodChurn(items, { now: opts.now, percent: churn.podChurnPercent });
  const warnings = validateHierarchy(items);
  const safe = name.replace(/[^a-z0-9_.-]/gi, '_');
  const dir = join(snapshotDir, safe);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'vpk.snapshot.json');
  writeFileSync(
    file,
    JSON.stringify(
      { vpkSnapshot: 2, captured: new Date().toISOString(), cluster: 'demo-data', kinds: entries.length, items },
      null,
      2,
    ),
  );
  return { file, count: items.length, warnings };
}

/** Appends a bundle's mixed-Kind items to their respective staged List files in one pass — every bundle
 *  below is "a handful of different Kinds produced together," so this is shared plumbing rather than each
 *  bundle re-implementing its own group-by-kind loop. Returns the new total count per Kind touched. */
function appendBundle(snapshotDir: string, items: RawObject[]): Record<string, number> {
  const byKind = new Map<string, RawObject[]>();
  for (const item of items) {
    const kind = item.kind as string;
    const bucket = byKind.get(kind) ?? [];
    bucket.push(item);
    byKind.set(kind, bucket);
  }
  const totals: Record<string, number> = {};
  for (const [kind, kindItems] of byKind) {
    totals[kind] = appendGenerated(snapshotDir, kind, kindItems[0]?.apiVersion as string, kindItems);
  }
  return totals;
}

/** RBAC team bundle (Role/ClusterRole/RoleBinding/ClusterRoleBinding, the fixed 5-user team) — see
 *  bundles.ts's buildRbacBundle for the actual shape/privilege tiers. */
export function runRbacBundle(snapshotDir: string, namespace: string): Record<string, number> {
  return appendBundle(snapshotDir, buildRbacBundle(namespace));
}

/** 5 ConfigMaps + 5 Secrets, static data, fixed pool names, in EVERY currently-staged Namespace — created
 *  only as needed (a Namespace that already has `demo-config-1` is skipped) — see bundles.ts's
 *  buildConfigSecretPool. Safe to re-run after adding more Namespaces (top-up, not duplicate). */
export function runConfigSecretBundle(snapshotDir: string): Record<string, number> {
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const existing = new Set(
    readKindList(snapshotDir, 'ConfigMap')
      .filter((cm) => (cm.metadata as { name: string }).name === CONFIGMAP_POOL_NAMES[0])
      .map((cm) => (cm.metadata as { namespace: string }).namespace),
  );
  return appendBundle(snapshotDir, buildConfigSecretPool(namespaces, existing));
}

/**
 * Gives every currently-staged Pod that doesn't already reference one at least one ConfigMap + one Secret
 * (via envFrom, cycling through the fixed pool for variety) — see bundles.ts's buildConfigSecretRefsForPods.
 * Also ensures every Namespace that picked up a new reference actually has its ConfigMap/Secret pool staged
 * (reusing buildConfigSecretPool's own "created as needed" check), so a reference this bundle adds never
 * dangles even if the ConfigMap/Secret pool bundle was never run on its own.
 */
export function runConfigSecretRefsBundle(snapshotDir: string): Record<string, number> {
  const allPods = readKindList(snapshotDir, 'Pod');
  const { updatedPods, namespacesNeedingPool } = buildConfigSecretRefsForPods(allPods);
  writeKindList(snapshotDir, 'Pod', (allPods[0]?.apiVersion as string) ?? 'v1', updatedPods);

  const existingPoolNamespaces = new Set(
    readKindList(snapshotDir, 'ConfigMap')
      .filter((cm) => (cm.metadata as { name: string }).name === CONFIGMAP_POOL_NAMES[0])
      .map((cm) => (cm.metadata as { namespace: string }).namespace),
  );
  const poolItems = buildConfigSecretPool(namespacesNeedingPool, existingPoolNamespaces);
  const totals = appendBundle(snapshotDir, poolItems);
  const referencedCount = allPods.length - updatedPods.filter((p, i) => p === allPods[i]).length;
  return referencedCount > 0 ? { ...totals, PodsReferenced: referencedCount } : totals;
}

/** 3 StorageClasses + 3 CSIDrivers, fixed pool names — see bundles.ts's buildStorageCsiBundle. */
export function runStorageCsiBundle(snapshotDir: string): Record<string, number> {
  return appendBundle(snapshotDir, buildStorageCsiBundle());
}

/** Refreshes CSINode to have exactly one entry per currently-staged Node, each listing all 3 pool CSI
 *  drivers — OVERWRITES (not appends) the CSINode working file, since it should always reflect the CURRENT
 *  Node set, not accumulate a stale entry from a smaller Node set generated earlier in this session. */
export function runCsiNodeSync(snapshotDir: string): number {
  const nodeNames = readKindList(snapshotDir, 'Node').map((n) => (n.metadata as { name: string }).name);
  const csiNodes = buildCsiNodesForNodes(nodeNames, CSI_DRIVER_NAMES);
  writeKindList(snapshotDir, 'CSINode', 'storage.k8s.io/v1', csiNodes);
  return csiNodes.length;
}

/** Gives `percent`% of currently-staged Pods a PVC + matching PV (split 50/50 StorageClass-backed vs.
 *  VolumeAttachment-backed) — see bundles.ts's buildPvcPvForPods. Appends the new PVC/PV/VolumeAttachment
 *  objects (doesn't replace) so running this again after adding more Pods layers on more pairs rather than
 *  discarding the earlier ones. Also OVERWRITES Pod.json with the volume-wired versions of whichever Pods got
 *  a PVC (every other staged Pod is left exactly as it was) — without a matching `spec.volumes` entry, the
 *  wheel/schematic projections' Pod->PVC edge (which matches by claimName, not by this bundle's naming
 *  convention) would never resolve, leaving every PVC/PV/VolumeAttachment it creates orphaned from its Pod. */
export function runPvcPvBundle(snapshotDir: string, percent: number): Record<string, number> {
  const allPods = readKindList(snapshotDir, 'Pod');
  const { updatedPods, persistentVolumeClaims, persistentVolumes, volumeAttachments } = buildPvcPvForPods(
    allPods,
    percent,
    STORAGE_CLASS_NAMES,
  );
  const updatedByName = new Map(updatedPods.map((p) => [(p.metadata as { name: string }).name, p]));
  const mergedPods = allPods.map((p) => updatedByName.get((p.metadata as { name: string }).name) ?? p);
  writeKindList(snapshotDir, 'Pod', (allPods[0]?.apiVersion as string) ?? 'v1', mergedPods);
  return appendBundle(snapshotDir, [...persistentVolumeClaims, ...persistentVolumes, ...volumeAttachments]);
}

/** Gives `podPercent`% of currently-staged Pods a Service, `sharedPercent`% of the resulting Services shared
 *  by multiple Pods — see bundles.ts's buildServicesForPods. Since Services need a label on their Pods to
 *  select by (Pod.json's template doesn't define one), this OVERWRITES Pod.json with the labeled versions of
 *  whichever Pods got attached to a Service (every other staged Pod is left exactly as it was) — the only
 *  bundle here that touches a Kind other than the one it's nominally about. */
export function runServiceBundle(snapshotDir: string, podPercent: number, sharedPercent: number): Record<string, number> {
  const allPods = readKindList(snapshotDir, 'Pod');
  const { updatedPods, services, endpoints } = buildServicesForPods(allPods, podPercent, sharedPercent);
  const updatedByName = new Map(updatedPods.map((p) => [(p.metadata as { name: string }).name, p]));
  const mergedPods = allPods.map((p) => updatedByName.get((p.metadata as { name: string }).name) ?? p);
  writeKindList(snapshotDir, 'Pod', (allPods[0]?.apiVersion as string) ?? 'v1', mergedPods);
  return appendBundle(snapshotDir, [...services, ...endpoints]);
}

/** Ensures the required system namespaces (default/kube-system/kube-public/kube-node-lease) are staged —
 *  skipping any already present rather than duplicating — plus `additionalCount` freshly-named ones. See
 *  bundles.ts's buildNamespaceBundle. */
export function runNamespaceBundle(snapshotDir: string, additionalCount: number): Record<string, number> {
  const existingNames = getStagedNames(snapshotDir, 'Namespace');
  const additionalStartIndex = existingNames.filter((n) => n.startsWith('demo-ns-')).length;
  return appendBundle(snapshotDir, buildNamespaceBundle(existingNames, additionalCount, additionalStartIndex));
}

/** Gives every currently-staged Node between 8 and 13 DaemonSets (randomly assigned per Node), each with one
 *  owned Pod scheduled to it — see bundles.ts's buildDaemonSetsForNodes. Spread across whatever Namespaces
 *  are currently staged (falling back to "kube-system" if none are, since node-level agents are almost always
 *  there in a real cluster). Appends (doesn't replace) — calling this again after adding more Nodes only adds
 *  DaemonSets for the NEW Nodes: a Node already covered (detected via its existing DaemonSet-owned Pods'
 *  `spec.nodeName`, not by re-deriving DaemonSet names) is skipped rather than getting a second random
 *  8-13 batch piled on top of its first one. */
export function runDaemonSetBundle(snapshotDir: string): Record<string, number> {
  const nodeNames = getStagedNames(snapshotDir, 'Node');
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const existingNodeNamesWithDaemonSets = new Set(
    readKindList(snapshotDir, 'Pod')
      .filter((p) => ((p.metadata as { ownerReferences?: { kind?: string }[] } | undefined)?.ownerReferences ?? []).some((o) => o.kind === 'DaemonSet'))
      .map((p) => (p.spec as { nodeName?: string } | undefined)?.nodeName)
      .filter((n): n is string => !!n),
  );
  const { daemonSets, pods } = buildDaemonSetsForNodes(nodeNames, namespaces, existingNodeNamesWithDaemonSets);
  return appendBundle(snapshotDir, [...daemonSets, ...pods]);
}

/** Wires every currently-staged, not-yet-owned Pod up to a fresh Deployment -> ReplicaSet (1-5 replicas,
 *  randomly picked per group) -> Pod ownership chain — see bundles.ts's buildDeploymentsForPods. OVERWRITES
 *  Pod.json with the now-owned versions (Pods already owned, e.g. by a DaemonSet bundle run earlier, are left
 *  untouched) and appends the new Deployments/ReplicaSets. */
export function runDeploymentBundle(snapshotDir: string): Record<string, number> {
  const allPods = readKindList(snapshotDir, 'Pod');
  const { deployments, replicaSets, updatedPods } = buildDeploymentsForPods(allPods);
  writeKindList(snapshotDir, 'Pod', (allPods[0]?.apiVersion as string) ?? 'v1', updatedPods);
  return appendBundle(snapshotDir, [...deployments, ...replicaSets]);
}

/** A staged Node's role, read off its `node-role.kubernetes.io/{role}` label (see demoTemplates.ts's Node
 *  template) — falls back to "worker" if the label's missing entirely, since that's the more common role and
 *  an unlabeled Node is more likely hand-edited/incomplete than an intentional master. */
function nodeRoleFromLabels(labels: Record<string, string> | undefined): 'master' | 'worker' {
  return labels && 'node-role.kubernetes.io/master' in labels ? 'master' : 'worker';
}

/**
 * Gives every currently-staged Node a Pod count resolved from `podsPerNodePattern` (e.g. "{100-150,Random}"),
 * split randomly into Running/Succeeded, plus `failedCount` Failed and `warningCount` Pending ("Warning")
 * Pods scattered across Worker Nodes only — see bundles.ts's buildPodsPerNode. Appends (doesn't replace),
 * continuing the same global Pod-naming sequence /demo/generate and the other Pod-touching bundles use (see
 * getStagedCount) so names never collide regardless of which mechanism created a given Pod.
 */
export function runPodsPerNodeBundle(
  snapshotDir: string,
  podsPerNodePattern: string,
  failedCount: number,
  warningCount: number,
): Record<string, number> {
  const nodes: NodeRoleRef[] = readKindList(snapshotDir, 'Node').map((n) => {
    const metadata = n.metadata as { name: string; labels?: Record<string, string> };
    return { name: metadata.name, role: nodeRoleFromLabels(metadata.labels) };
  });
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const startIndex = getStagedCount(snapshotDir, 'Pod');
  const pods = buildPodsPerNode(nodes, namespaces, podsPerNodePattern, failedCount, warningCount, startIndex);
  return appendBundle(snapshotDir, pods);
}

/**
 * CronJobs, Jobs, and StatefulSets, each a percent of the currently-staged total Pod count — see
 * bundles.ts's buildWorkloadsBundle for the full split (StatefulSets get real per-replica PVC+PV). Appends
 * (doesn't replace); each Kind's naming continues its own count via getStagedCount, same as every other
 * Pod/CronJob/Job/StatefulSet-touching bundle.
 */
export function runWorkloadsBundle(
  snapshotDir: string,
  cronJobPercent: number,
  statefulSetPercent: number,
  jobPercent: number,
): Record<string, number> {
  const totalPodCount = getStagedCount(snapshotDir, 'Pod');
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const nodeNames = getStagedNames(snapshotDir, 'Node');
  const startIndex = {
    cronJob: getStagedCount(snapshotDir, 'CronJob'),
    job: getStagedCount(snapshotDir, 'Job'),
    statefulSet: getStagedCount(snapshotDir, 'StatefulSet'),
  };
  const result = buildWorkloadsBundle(
    totalPodCount,
    { cronJobPercent, statefulSetPercent, jobPercent },
    namespaces,
    STORAGE_CLASS_NAMES,
    nodeNames,
    startIndex,
  );
  return appendBundle(snapshotDir, [
    ...result.cronJobs,
    ...result.jobs,
    ...result.statefulSets,
    ...result.statefulSetPods,
    ...result.persistentVolumeClaims,
    ...result.persistentVolumes,
  ]);
}

/** One ServiceAccount per currently-staged Namespace, created only as needed — see bundles.ts's
 *  buildServiceAccountBundle. Namespaces that already have one (checked by namespace, not by name — the
 *  fixed SERVICE_ACCOUNT_NAME is reused everywhere) are skipped, so this is safe to re-run after adding more
 *  Namespaces. */
export function runServiceAccountBundle(snapshotDir: string): Record<string, number> {
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const existing = new Set(
    readKindList(snapshotDir, 'ServiceAccount')
      .filter((sa) => (sa.metadata as { name: string }).name === SERVICE_ACCOUNT_NAME)
      .map((sa) => (sa.metadata as { namespace: string }).namespace),
  );
  return appendBundle(snapshotDir, buildServiceAccountBundle(namespaces, existing));
}

/**
 * Warning Events for every currently-staged Failed/Pending ("Warning" — see @vpk/core's podStatus.ts) Pod;
 * when `includeStandardLaunchEvents` is true, ALSO the standard 5-step Normal launch sequence for every
 * staged Pod regardless of phase — see bundles.ts's buildEventsForPods. Appends (doesn't replace); Event
 * naming continues via getStagedCount like every other Kind.
 */
export function runEventsBundle(snapshotDir: string, includeStandardLaunchEvents: boolean): Record<string, number> {
  const pods = readKindList(snapshotDir, 'Pod').map((p) => {
    const metadata = p.metadata as { name: string; namespace: string };
    const status = p.status as { phase?: string } | undefined;
    return { name: metadata.name, namespace: metadata.namespace, phase: status?.phase ?? 'Unknown' };
  });
  const startIndex = getStagedCount(snapshotDir, 'Event');
  return appendBundle(snapshotDir, buildEventsForPods(pods, includeStandardLaunchEvents, startIndex));
}

/**
 * One Gateway + one GatewayClass for every `podsPerGateway` currently-staged Pods, plus an HTTPRoute for
 * `httpRoutePercent`% of Pods that already have a Service (the Service bundle's `demo.vpk/service` label) —
 * see bundles.ts's buildGatewayBundle. New HTTPRoutes are spread across every Gateway staged so far, not just
 * ones created this call.
 */
export function runGatewayBundle(snapshotDir: string, podsPerGateway: number, httpRoutePercent: number): Record<string, number> {
  const allPods = readKindList(snapshotDir, 'Pod');
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const existingGatewayNames = getStagedNames(snapshotDir, 'Gateway');
  const pods: PodServiceRef[] = allPods.map((p) => {
    const metadata = p.metadata as { name: string; namespace: string; labels?: Record<string, string> };
    return { name: metadata.name, namespace: metadata.namespace, serviceName: metadata.labels?.['demo.vpk/service'] };
  });
  const startIndex = {
    gateway: getStagedCount(snapshotDir, 'Gateway'),
    gatewayClass: getStagedCount(snapshotDir, 'GatewayClass'),
    httpRoute: getStagedCount(snapshotDir, 'HTTPRoute'),
  };
  const result = buildGatewayBundle(allPods.length, podsPerGateway, httpRoutePercent, pods, namespaces, existingGatewayNames, startIndex);
  return appendBundle(snapshotDir, [...result.gatewayClasses, ...result.gateways, ...result.httpRoutes]);
}

/** A default-deny-ingress NetworkPolicy for `percent`% of currently-staged Namespaces — see bundles.ts's
 *  buildNetworkPolicyBundle. */
export function runNetworkPolicyBundle(snapshotDir: string, percent: number): Record<string, number> {
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  return appendBundle(snapshotDir, buildNetworkPolicyBundle(namespaces, percent));
}

/** One ResourceQuota + one LimitRange for every currently-staged Namespace that isn't a required system
 *  Namespace and doesn't already have one — see bundles.ts's buildQuotaLimitBundle. Safe to re-run after
 *  adding more Namespaces (top-up, not duplicate). */
export function runQuotaLimitBundle(snapshotDir: string): Record<string, number> {
  const namespaces = getStagedNames(snapshotDir, 'Namespace');
  const existing = new Set(readKindList(snapshotDir, 'ResourceQuota').map((rq) => (rq.metadata as { namespace: string }).namespace));
  const result = buildQuotaLimitBundle(namespaces, existing);
  return appendBundle(snapshotDir, [...result.resourceQuotas, ...result.limitRanges]);
}

/** The 5 required system Pods (kube-apiserver, kube-controller-manager, kube-scheduler, coredns, kube-proxy)
 *  in kube-system — every real cluster has these, so demo data gets them too. Created only as needed (a name
 *  already staged is skipped, so safe to re-run), scheduled onto the first staged master-role Node if one
 *  exists — see bundles.ts's buildSystemPodsBundle. */
export function runSystemPodsBundle(snapshotDir: string): Record<string, number> {
  const existingNames = new Set(
    readKindList(snapshotDir, 'Pod')
      .filter((p) => (p.metadata as { namespace?: string }).namespace === 'kube-system')
      .map((p) => (p.metadata as { name: string }).name),
  );
  const masterNode = readKindList(snapshotDir, 'Node').find((n) => nodeRoleFromLabels((n.metadata as { labels?: Record<string, string> }).labels) === 'master');
  const masterNodeName = masterNode ? (masterNode.metadata as { name: string }).name : undefined;
  return appendBundle(snapshotDir, buildSystemPodsBundle(existingNames, masterNodeName));
}
