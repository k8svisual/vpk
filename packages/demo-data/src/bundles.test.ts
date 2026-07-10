import { describe, it, expect } from 'vitest';
import type { RawObject } from '@vpk/core';
import {
  RBAC_USERS,
  buildRbacBundle,
  CONFIGMAP_POOL_NAMES,
  SECRET_POOL_NAMES,
  buildConfigSecretPool,
  buildConfigSecretRefsForPods,
  STORAGE_CLASS_NAMES,
  CSI_DRIVER_NAMES,
  buildStorageCsiBundle,
  buildCsiNodesForNodes,
  buildPvcPvForPods,
  buildServicesForPods,
  SYSTEM_NAMESPACES,
  buildNamespaceBundle,
  buildDaemonSetsForNodes,
  buildDeploymentsForPods,
  buildPodsPerNode,
  buildWorkloadsBundle,
  SERVICE_ACCOUNT_NAME,
  buildServiceAccountBundle,
  buildEventsForPods,
  buildGatewayBundle,
  buildNetworkPolicyBundle,
  buildQuotaLimitBundle,
  SYSTEM_POD_NAMES,
  buildSystemPodsBundle,
  type NodeRoleRef,
  type PodEventRef,
  type PodServiceRef,
} from './bundles';
import { resolvePattern } from './placeholders';

describe('buildRbacBundle', () => {
  const items = buildRbacBundle('default');
  const byKind = (kind: string) => items.filter((i) => i.kind === kind);

  it('produces exactly one of each Role/ClusterRole/RoleBinding/ClusterRoleBinding combination', () => {
    expect(byKind('Role')).toHaveLength(2);
    expect(byKind('ClusterRole')).toHaveLength(2);
    expect(byKind('RoleBinding')).toHaveLength(2);
    expect(byKind('ClusterRoleBinding')).toHaveLength(2);
  });

  it('only references the fixed 5-user team, and every user appears at least once', () => {
    const bindingSubjects = [...byKind('RoleBinding'), ...byKind('ClusterRoleBinding')].flatMap(
      (b) => (b.subjects as { name: string }[]).map((s) => s.name),
    );
    for (const name of bindingSubjects) expect(RBAC_USERS as readonly string[]).toContain(name);
    for (const user of RBAC_USERS) expect(bindingSubjects).toContain(user);
  });

  it('gives differing privilege levels — the viewer Role has fewer verbs than the editor Role', () => {
    const viewer = byKind('Role').find((r) => r.metadata && (r.metadata as { name: string }).name === 'demo-viewer');
    const editor = byKind('Role').find((r) => r.metadata && (r.metadata as { name: string }).name === 'demo-editor');
    const verbCount = (role: RawObject) => (role.rules as { verbs: string[] }[]).reduce((n, r) => n + r.verbs.length, 0);
    expect(verbCount(editor as RawObject)).toBeGreaterThan(verbCount(viewer as RawObject));
  });

  it('is namespaced correctly — Role/RoleBinding carry the namespace, ClusterRole/ClusterRoleBinding do not', () => {
    for (const r of byKind('Role')) expect((r.metadata as { namespace?: string }).namespace).toBe('default');
    for (const r of byKind('RoleBinding')) expect((r.metadata as { namespace?: string }).namespace).toBe('default');
    for (const r of byKind('ClusterRole')) expect((r.metadata as { namespace?: string }).namespace).toBeUndefined();
    for (const r of byKind('ClusterRoleBinding')) expect((r.metadata as { namespace?: string }).namespace).toBeUndefined();
  });
});

describe('buildConfigSecretPool', () => {
  it('produces exactly 5 ConfigMaps and 5 Secrets with the fixed pool names, per given Namespace', () => {
    const items = buildConfigSecretPool(['default'], new Set());
    const configMaps = items.filter((i) => i.kind === 'ConfigMap');
    const secrets = items.filter((i) => i.kind === 'Secret');
    expect(configMaps.map((c) => (c.metadata as { name: string }).name).sort()).toEqual([...CONFIGMAP_POOL_NAMES].sort());
    expect(secrets.map((s) => (s.metadata as { name: string }).name).sort()).toEqual([...SECRET_POOL_NAMES].sort());
  });

  it('gives every ConfigMap/Secret static (non-empty) data', () => {
    for (const item of buildConfigSecretPool(['default'], new Set())) {
      expect(Object.keys(item.data as object).length).toBeGreaterThan(0);
    }
  });

  it('gives every given Namespace its own 5+5 pool, reusing the same fixed names in each', () => {
    const items = buildConfigSecretPool(['ns-a', 'ns-b'], new Set());
    expect(items).toHaveLength(20); // (5 + 5) * 2 namespaces
    for (const ns of ['ns-a', 'ns-b']) {
      const inNs = items.filter((i) => (i.metadata as { namespace: string }).namespace === ns);
      expect(inNs.filter((i) => i.kind === 'ConfigMap')).toHaveLength(5);
      expect(inNs.filter((i) => i.kind === 'Secret')).toHaveLength(5);
    }
  });

  it('skips a Namespace that already has its pool — "created as needed", not duplicated', () => {
    const items = buildConfigSecretPool(['ns-a', 'ns-b'], new Set(['ns-a']));
    expect(items.every((i) => (i.metadata as { namespace: string }).namespace === 'ns-b')).toBe(true);
    expect(items).toHaveLength(10);
  });

  it('returns nothing when every given Namespace already has its pool', () => {
    expect(buildConfigSecretPool(['ns-a'], new Set(['ns-a']))).toHaveLength(0);
  });
});

describe('buildConfigSecretRefsForPods', () => {
  function podWithContainer(name: string, namespace: string, envFrom?: unknown[]): RawObject {
    return {
      kind: 'Pod',
      metadata: { name, namespace },
      spec: { containers: [{ name: 'app', ...(envFrom ? { envFrom } : {}) }] },
    };
  }

  it('gives every Pod at least one ConfigMap ref and one Secret ref via envFrom', () => {
    const pods = [podWithContainer('p1', 'default'), podWithContainer('p2', 'default')];
    const { updatedPods } = buildConfigSecretRefsForPods(pods);
    for (const pod of updatedPods) {
      const container = (pod.spec as { containers: { envFrom?: { configMapRef?: { name: string }; secretRef?: { name: string } }[] }[] })
        .containers[0] as { envFrom: { configMapRef?: { name: string }; secretRef?: { name: string } }[] };
      expect(container.envFrom.some((e) => e.configMapRef)).toBe(true);
      expect(container.envFrom.some((e) => e.secretRef)).toBe(true);
    }
  });

  it('only references names from the fixed pool', () => {
    const pods = Array.from({ length: 8 }, (_, i) => podWithContainer(`p${i}`, 'default'));
    const { updatedPods } = buildConfigSecretRefsForPods(pods);
    for (const pod of updatedPods) {
      const envFrom = (pod.spec as { containers: { envFrom: { configMapRef?: { name: string }; secretRef?: { name: string } }[] }[] })
        .containers[0]?.envFrom as { configMapRef?: { name: string }; secretRef?: { name: string } }[];
      const cmName = envFrom.find((e) => e.configMapRef)?.configMapRef?.name as string;
      const secretName = envFrom.find((e) => e.secretRef)?.secretRef?.name as string;
      expect(CONFIGMAP_POOL_NAMES).toContain(cmName);
      expect(SECRET_POOL_NAMES).toContain(secretName);
    }
  });

  it('leaves a Pod with an existing envFrom untouched — "at least one", not "always add another"', () => {
    const already = podWithContainer('p1', 'default', [{ configMapRef: { name: 'custom-cm' } }]);
    const { updatedPods, namespacesNeedingPool } = buildConfigSecretRefsForPods([already]);
    expect(updatedPods[0]).toEqual(already);
    expect(namespacesNeedingPool).toHaveLength(0);
  });

  it('leaves a Pod with no containers untouched', () => {
    const noContainers: RawObject = { kind: 'Pod', metadata: { name: 'p1', namespace: 'default' }, spec: { containers: [] } };
    const { updatedPods, namespacesNeedingPool } = buildConfigSecretRefsForPods([noContainers]);
    expect(updatedPods[0]).toEqual(noContainers);
    expect(namespacesNeedingPool).toHaveLength(0);
  });

  it('reports every distinct Namespace that got a new reference, deduplicated', () => {
    const pods = [podWithContainer('p1', 'ns-a'), podWithContainer('p2', 'ns-a'), podWithContainer('p3', 'ns-b')];
    const { namespacesNeedingPool } = buildConfigSecretRefsForPods(pods);
    expect(namespacesNeedingPool.sort()).toEqual(['ns-a', 'ns-b']);
  });

  it('defaults a Pod with no namespace to "default"', () => {
    const pod: RawObject = { kind: 'Pod', metadata: { name: 'p1' }, spec: { containers: [{ name: 'app' }] } };
    const { namespacesNeedingPool } = buildConfigSecretRefsForPods([pod]);
    expect(namespacesNeedingPool).toEqual(['default']);
  });
});

describe('buildStorageCsiBundle', () => {
  it('produces exactly 3 StorageClasses and 3 CSIDrivers with the fixed pool names', () => {
    const items = buildStorageCsiBundle();
    const storageClasses = items.filter((i) => i.kind === 'StorageClass');
    const csiDrivers = items.filter((i) => i.kind === 'CSIDriver');
    expect(storageClasses.map((s) => (s.metadata as { name: string }).name).sort()).toEqual([...STORAGE_CLASS_NAMES].sort());
    expect(csiDrivers.map((c) => (c.metadata as { name: string }).name).sort()).toEqual([...CSI_DRIVER_NAMES].sort());
  });
});

describe('buildCsiNodesForNodes', () => {
  it('produces one CSINode per given node name, each listing every driver', () => {
    const nodeNames = ['node-a', 'node-b', 'node-c'];
    const items = buildCsiNodesForNodes(nodeNames, CSI_DRIVER_NAMES);
    expect(items).toHaveLength(3);
    for (const item of items) {
      const drivers = (item.spec as { drivers: { name: string }[] }).drivers;
      expect(drivers.map((d) => d.name).sort()).toEqual([...CSI_DRIVER_NAMES].sort());
    }
  });

  it('returns an empty array for an empty node list', () => {
    expect(buildCsiNodesForNodes([], CSI_DRIVER_NAMES)).toEqual([]);
  });
});

describe('buildPvcPvForPods', () => {
  function pods(count: number): RawObject[] {
    return Array.from({ length: count }, (_, i) => ({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: `pod-${i + 1}`, namespace: 'default' },
      spec: { containers: [], nodeName: `node-${i + 1}` },
    }));
  }

  it('gives roughly percent% of pods a PVC + matching PV', () => {
    const result = buildPvcPvForPods(pods(1500), 15, STORAGE_CLASS_NAMES);
    expect(result.persistentVolumeClaims).toHaveLength(225); // round(1500 * 0.15)
    expect(result.persistentVolumes).toHaveLength(225);
  });

  it('splits PVs 50/50 between storageClassName-backed and VolumeAttachment-backed', () => {
    const result = buildPvcPvForPods(pods(100), 20, STORAGE_CLASS_NAMES); // 20 PVs
    const withStorageClass = result.persistentVolumes.filter((pv) => (pv.spec as { storageClassName?: string }).storageClassName);
    expect(withStorageClass).toHaveLength(10);
    expect(result.volumeAttachments).toHaveLength(10);
  });

  it('spreads VolumeAttachments across every pool CSIDriver, not just the first one', () => {
    const result = buildPvcPvForPods(pods(120), 50, STORAGE_CLASS_NAMES); // 30 VolumeAttachments
    const attachers = new Set(result.volumeAttachments.map((va) => (va.spec as { attacher: string }).attacher));
    expect(attachers).toEqual(new Set(CSI_DRIVER_NAMES));
  });

  it('every PVC has a matching PV by name (volumeName -> PV.metadata.name)', () => {
    const result = buildPvcPvForPods(pods(10), 50, STORAGE_CLASS_NAMES);
    const pvNames = new Set(result.persistentVolumes.map((pv) => (pv.metadata as { name: string }).name));
    for (const pvc of result.persistentVolumeClaims) {
      expect(pvNames.has((pvc.spec as { volumeName: string }).volumeName)).toBe(true);
    }
  });

  it('wires spec.volumes[].persistentVolumeClaim.claimName onto every Pod that got a PVC, leaving the rest untouched', () => {
    const result = buildPvcPvForPods(pods(10), 50, STORAGE_CLASS_NAMES); // 5 pods get a PVC
    const pvcNames = new Set(result.persistentVolumeClaims.map((pvc) => (pvc.metadata as { name: string }).name));
    let wired = 0;
    for (const pod of result.updatedPods) {
      const metadata = pod.metadata as { name: string };
      const volumes = (pod.spec as { volumes?: { persistentVolumeClaim?: { claimName: string } }[] }).volumes ?? [];
      const claimName = volumes.find((v) => v.persistentVolumeClaim)?.persistentVolumeClaim?.claimName;
      if (pvcNames.has(`${metadata.name}-pvc`)) {
        expect(claimName).toBe(`${metadata.name}-pvc`);
        wired += 1;
      } else {
        expect(claimName).toBeUndefined();
      }
    }
    expect(wired).toBe(5);
  });

  it('handles zero pods / zero percent without throwing', () => {
    expect(buildPvcPvForPods([], 15, STORAGE_CLASS_NAMES).persistentVolumeClaims).toEqual([]);
    expect(buildPvcPvForPods(pods(10), 0, STORAGE_CLASS_NAMES).persistentVolumeClaims).toEqual([]);
  });
});

describe('buildServicesForPods', () => {
  function pods(count: number): RawObject[] {
    return Array.from({ length: count }, (_, i) => ({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: `pod-${i + 1}`, namespace: 'default' },
    }));
  }

  it('attaches roughly podPercent% of pods to a Service', () => {
    const { updatedPods } = buildServicesForPods(pods(1500), 20, 15);
    // 20% of 1500 = 300 pods considered; every one of them gets the service label
    const labeled = updatedPods.filter((p) => (p.metadata as { labels?: Record<string, string> }).labels?.['demo.vpk/service']);
    expect(labeled).toHaveLength(300);
  });

  it('spreads the selected Pods evenly across the whole array, not just the front of it', () => {
    const { updatedPods } = buildServicesForPods(pods(1000), 20, 15); // 200 of 1000
    const indices = updatedPods
      .filter((p) => (p.metadata as { labels?: Record<string, string> }).labels?.['demo.vpk/service'])
      .map((p) => Number((p.metadata as { name: string }).name.replace('pod-', '')))
      .sort((a, b) => a - b);
    expect(indices).toHaveLength(200);
    // Evenly spread means the last selected index is near the END of the array, not clustered near the front.
    expect(indices[indices.length - 1]).toBeGreaterThan(900);
  });

  it('produces roughly sharedPercent% of resulting Services with more than one Pod behind them', () => {
    const { services, updatedPods } = buildServicesForPods(pods(1500), 20, 15);
    const podsPerService = new Map<string, number>();
    for (const pod of updatedPods) {
      const label = (pod.metadata as { labels?: Record<string, string> }).labels?.['demo.vpk/service'];
      if (label) podsPerService.set(label, (podsPerService.get(label) ?? 0) + 1);
    }
    const sharedCount = [...podsPerService.values()].filter((n) => n > 1).length;
    expect(services.length).toBeGreaterThan(0);
    const sharedFraction = sharedCount / services.length;
    // Approximate — the merge algorithm targets 15% but works in discrete group-size steps.
    expect(sharedFraction).toBeGreaterThan(0);
    expect(sharedFraction).toBeLessThan(0.5);
  });

  it('every Service selector matches at least one updated Pod label', () => {
    const { services, updatedPods } = buildServicesForPods(pods(50), 40, 20);
    const labelValues = new Set(
      updatedPods.map((p) => (p.metadata as { labels?: Record<string, string> }).labels?.['demo.vpk/service']).filter(Boolean),
    );
    for (const svc of services) {
      const selectorValue = (svc.spec as { selector: Record<string, string> }).selector['demo.vpk/service'];
      expect(labelValues.has(selectorValue)).toBe(true);
    }
  });

  it('handles zero pods / zero percent without throwing', () => {
    expect(buildServicesForPods([], 20, 15)).toEqual({ updatedPods: [], services: [], endpoints: [] });
    expect(buildServicesForPods(pods(10), 0, 15)).toEqual({ updatedPods: [], services: [], endpoints: [] });
  });

  it('builds one Endpoints object per Service, same name+namespace, targetRef.uid matching the real Pod resourceId', () => {
    const { services, endpoints } = buildServicesForPods(pods(50), 40, 20);
    expect(endpoints).toHaveLength(services.length);
    for (const ep of endpoints) {
      const match = services.find(
        (s) => (s.metadata as { name: string }).name === (ep.metadata as { name: string }).name,
      );
      expect(match).toBeDefined();
      expect((match?.metadata as { namespace: string }).namespace).toBe((ep.metadata as { namespace: string }).namespace);

      const addresses = (ep.subsets as { addresses: { targetRef: { kind: string; uid: string } }[] }[])[0]?.addresses ?? [];
      expect(addresses.length).toBeGreaterThan(0);
      for (const addr of addresses) {
        expect(addr.targetRef.kind).toBe('Pod');
        expect(addr.targetRef.uid).toMatch(/^v1\|Pod\|default\|pod-\d+$/);
      }
    }
  });

  it('gives every Endpoints address a synthetic podIP, unique across the whole call (Network cards need one to show)', () => {
    const { endpoints } = buildServicesForPods(pods(50), 40, 20);
    const allIps: string[] = [];
    for (const ep of endpoints) {
      const addresses = (ep.subsets as { addresses: { ip?: string }[] }[])[0]?.addresses ?? [];
      for (const addr of addresses) {
        expect(addr.ip).toMatch(/^10\.244\.\d+\.\d+$/);
        allIps.push(addr.ip as string);
      }
    }
    expect(new Set(allIps).size).toBe(allIps.length); // no duplicate IPs across the whole call
  });

  it('never groups Pods from different namespaces behind the same Service (a Service is namespace-scoped)', () => {
    // Pods alternate namespace so any namespace-blind merge would immediately mix them into one group.
    const namespaces = ['ns-a', 'ns-b', 'ns-c'];
    const mixedPods: RawObject[] = Array.from({ length: 300 }, (_, i) => ({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: `pod-${i + 1}`, namespace: namespaces[i % namespaces.length] },
    }));
    const { services, endpoints } = buildServicesForPods(mixedPods, 80, 30);
    expect(services.length).toBeGreaterThan(0);

    const podNamespaceByResourceId = new Map(
      mixedPods.map((p) => {
        const metadata = p.metadata as { name: string; namespace: string };
        return [`v1|Pod|${metadata.namespace}|${metadata.name}`, metadata.namespace];
      }),
    );

    for (const svc of services) {
      const svcNamespace = (svc.metadata as { namespace: string }).namespace;
      const ep = endpoints.find(
        (e) => (e.metadata as { name: string }).name === (svc.metadata as { name: string }).name,
      );
      expect((ep?.metadata as { namespace: string }).namespace).toBe(svcNamespace);
      const addresses = (ep?.subsets as { addresses: { targetRef: { uid: string } }[] }[] | undefined)?.[0]?.addresses ?? [];
      for (const addr of addresses) {
        expect(podNamespaceByResourceId.get(addr.targetRef.uid)).toBe(svcNamespace);
      }
    }
  });
});

describe('buildNamespaceBundle', () => {
  it('produces every system namespace when none are staged yet', () => {
    const items = buildNamespaceBundle([], 0, 0);
    expect(items.map((i) => (i.metadata as { name: string }).name).sort()).toEqual([...SYSTEM_NAMESPACES].sort());
  });

  it('skips system namespaces already staged (checked by name), never duplicating them', () => {
    const items = buildNamespaceBundle(['default', 'kube-system'], 0, 0);
    const names = items.map((i) => (i.metadata as { name: string }).name);
    expect(names).not.toContain('default');
    expect(names).not.toContain('kube-system');
    expect(names.sort()).toEqual(['kube-node-lease', 'kube-public'].sort());
  });

  it('adds `additionalCount` freshly-named namespaces continuing from startIndex', () => {
    const items = buildNamespaceBundle(SYSTEM_NAMESPACES, 3, 2);
    const additional = items.filter((i) => (i.metadata as { name: string }).name.startsWith('demo-ns-'));
    expect(additional.map((i) => (i.metadata as { name: string }).name)).toEqual(['demo-ns-3', 'demo-ns-4', 'demo-ns-5']);
  });
});

describe('resolvePattern {namespace} token', () => {
  it('round-robins through the given namespaces by index', () => {
    const ns = ['ns-a', 'ns-b', 'ns-c'];
    expect(resolvePattern('{namespace}', 1, ns)).toBe('ns-a');
    expect(resolvePattern('{namespace}', 2, ns)).toBe('ns-b');
    expect(resolvePattern('{namespace}', 3, ns)).toBe('ns-c');
    expect(resolvePattern('{namespace}', 4, ns)).toBe('ns-a'); // wraps
  });

  it('throws when no namespaces are available to spread across', () => {
    expect(() => resolvePattern('{namespace}', 1, [])).toThrow(/namespace/i);
    expect(() => resolvePattern('{namespace}', 1)).toThrow(/namespace/i);
  });
});

describe('buildDaemonSetsForNodes', () => {
  it('gives every Node between 8 and 13 DaemonSets, each with exactly one owned Pod scheduled to it', () => {
    const nodeNames = ['node-a', 'node-b', 'node-c'];
    const { daemonSets, pods } = buildDaemonSetsForNodes(nodeNames, ['kube-system']);

    const countByNode = new Map<string, number>();
    for (const pod of pods) {
      const nodeName = (pod.spec as { nodeName: string }).nodeName;
      countByNode.set(nodeName, (countByNode.get(nodeName) ?? 0) + 1);
    }
    for (const nodeName of nodeNames) {
      const count = countByNode.get(nodeName) ?? 0;
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThanOrEqual(13);
    }
    expect(daemonSets).toHaveLength(pods.length); // one DaemonSet per Pod
  });

  it('every Pod is owned by a DaemonSet with a matching uid', () => {
    const { daemonSets, pods } = buildDaemonSetsForNodes(['node-a'], ['kube-system']);
    const dsByUid = new Map(daemonSets.map((d) => [(d.metadata as { uid: string }).uid, d]));
    for (const pod of pods) {
      const ownerRefs = (pod.metadata as { ownerReferences: { kind: string; uid: string }[] }).ownerReferences;
      expect(ownerRefs).toHaveLength(1);
      expect(ownerRefs[0]?.kind).toBe('DaemonSet');
      expect(dsByUid.has(ownerRefs[0]?.uid as string)).toBe(true);
    }
  });

  it('returns nothing for an empty node list', () => {
    expect(buildDaemonSetsForNodes([], ['kube-system'])).toEqual({ daemonSets: [], pods: [] });
  });

  it('skips Nodes already in existingNodeNamesWithDaemonSets — top up, not duplicate', () => {
    const { daemonSets, pods } = buildDaemonSetsForNodes(['node-a', 'node-b', 'node-c'], ['kube-system'], new Set(['node-a', 'node-b']));
    const nodeNamesCovered = new Set(pods.map((p) => (p.spec as { nodeName: string }).nodeName));
    expect(nodeNamesCovered).toEqual(new Set(['node-c']));
    expect(daemonSets.length).toBeGreaterThanOrEqual(8);
    expect(daemonSets.length).toBeLessThanOrEqual(13);
  });

  it('defaults to generating for every given Node when existingNodeNamesWithDaemonSets is omitted', () => {
    const { pods } = buildDaemonSetsForNodes(['node-a', 'node-b'], ['kube-system']);
    const nodeNamesCovered = new Set(pods.map((p) => (p.spec as { nodeName: string }).nodeName));
    expect(nodeNamesCovered).toEqual(new Set(['node-a', 'node-b']));
  });
});

describe('buildDeploymentsForPods', () => {
  function unownedPods(count: number): RawObject[] {
    return Array.from({ length: count }, (_, i) => ({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: `pod-${i + 1}`, namespace: 'default' },
    }));
  }

  it('groups every un-owned Pod into a ReplicaSet of 1-5, each ReplicaSet owned by a Deployment', () => {
    const { deployments, replicaSets, updatedPods } = buildDeploymentsForPods(unownedPods(100));
    expect(replicaSets).toHaveLength(deployments.length);

    const podsByRsUid = new Map<string, number>();
    for (const pod of updatedPods) {
      const ref = (pod.metadata as { ownerReferences: { kind: string; uid: string }[] }).ownerReferences[0] as {
        kind: string;
        uid: string;
      };
      expect(ref.kind).toBe('ReplicaSet');
      podsByRsUid.set(ref.uid, (podsByRsUid.get(ref.uid) ?? 0) + 1);
    }
    for (const rs of replicaSets) {
      const uid = (rs.metadata as { uid: string }).uid;
      const size = podsByRsUid.get(uid) ?? 0;
      expect(size).toBeGreaterThanOrEqual(1);
      expect(size).toBeLessThanOrEqual(5);
      expect((rs.spec as { replicas: number }).replicas).toBe(size);
    }
  });

  it('every ReplicaSet has an ownerReferences entry pointing at a real Deployment uid', () => {
    const { deployments, replicaSets } = buildDeploymentsForPods(unownedPods(20));
    const deployUids = new Set(deployments.map((d) => (d.metadata as { uid: string }).uid));
    for (const rs of replicaSets) {
      const ref = (rs.metadata as { ownerReferences: { kind: string; uid: string }[] }).ownerReferences[0] as {
        kind: string;
        uid: string;
      };
      expect(ref.kind).toBe('Deployment');
      expect(deployUids.has(ref.uid)).toBe(true);
    }
  });

  it('leaves already-owned Pods (e.g. from a DaemonSet bundle) completely untouched', () => {
    const owned: RawObject = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'ds-pod', namespace: 'default', ownerReferences: [{ kind: 'DaemonSet', uid: 'existing' }] },
    };
    const { updatedPods, deployments, replicaSets } = buildDeploymentsForPods([owned]);
    expect(updatedPods).toEqual([owned]);
    expect(deployments).toEqual([]);
    expect(replicaSets).toEqual([]);
  });

  it('handles an empty Pod list without throwing', () => {
    expect(buildDeploymentsForPods([])).toEqual({ deployments: [], replicaSets: [], updatedPods: [] });
  });

  it('never owns Pods from different namespaces with the same Deployment/ReplicaSet (both are namespace-scoped)', () => {
    // Pods alternate namespace so any namespace-blind chunking would immediately mix them into one chunk.
    const namespaces = ['ns-a', 'ns-b', 'ns-c'];
    const mixedPods: RawObject[] = Array.from({ length: 90 }, (_, i) => ({
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: `pod-${i + 1}`, namespace: namespaces[i % namespaces.length] },
    }));
    const { deployments, replicaSets, updatedPods } = buildDeploymentsForPods(mixedPods);

    const podNamespaceByName = new Map(
      mixedPods.map((p) => [(p.metadata as { name: string }).name, (p.metadata as { namespace: string }).namespace]),
    );
    const rsNamespaceByUid = new Map(replicaSets.map((rs) => [(rs.metadata as { uid: string }).uid, (rs.metadata as { namespace: string }).namespace]));
    const deployNamespaceByUid = new Map(deployments.map((d) => [(d.metadata as { uid: string }).uid, (d.metadata as { namespace: string }).namespace]));

    for (const pod of updatedPods) {
      const metadata = pod.metadata as { name: string; ownerReferences: { uid: string }[] };
      const rsUid = metadata.ownerReferences[0]?.uid as string;
      expect(rsNamespaceByUid.get(rsUid)).toBe(podNamespaceByName.get(metadata.name));
    }
    for (const rs of replicaSets) {
      const metadata = rs.metadata as { namespace: string; ownerReferences: { uid: string }[] };
      const deployUid = metadata.ownerReferences[0]?.uid as string;
      expect(deployNamespaceByUid.get(deployUid)).toBe(metadata.namespace);
    }
  });
});

describe('buildPodsPerNode', () => {
  function nodes(count: number, role: 'master' | 'worker' = 'worker'): NodeRoleRef[] {
    return Array.from({ length: count }, (_, i) => ({ name: `node-${i + 1}`, role }));
  }

  it('gives every Node a pod count resolved from the pattern, Running + Succeeded summing to that count', () => {
    const pods = buildPodsPerNode(nodes(5), ['default'], '{100-150,Random}', 0, 0, 0);
    const byNode = new Map<string, { running: number; succeeded: number }>();
    for (const pod of pods) {
      const nodeName = (pod.spec as { nodeName: string }).nodeName;
      const phase = (pod.status as { phase: string }).phase;
      const entry = byNode.get(nodeName) ?? { running: 0, succeeded: 0 };
      if (phase === 'Running') entry.running += 1;
      else if (phase === 'Succeeded') entry.succeeded += 1;
      byNode.set(nodeName, entry);
    }
    expect(byNode.size).toBe(5);
    for (const { running, succeeded } of byNode.values()) {
      const total = running + succeeded;
      expect(total).toBeGreaterThanOrEqual(100);
      expect(total).toBeLessThanOrEqual(150);
    }
  });

  it('supports a plain fixed number (not just a range) for the per-Node pattern', () => {
    const pods = buildPodsPerNode(nodes(3), ['default'], '20', 0, 0, 0);
    const countByNode = new Map<string, number>();
    for (const pod of pods) {
      const nodeName = (pod.spec as { nodeName: string }).nodeName;
      countByNode.set(nodeName, (countByNode.get(nodeName) ?? 0) + 1);
    }
    for (const count of countByNode.values()) expect(count).toBe(20);
  });

  it('scatters exactly `failedCount` Failed and `warningCount` Pending (Warning) Pods across Worker Nodes only', () => {
    const mixedNodes = [...nodes(3, 'worker'), ...nodes(2, 'master')];
    const pods = buildPodsPerNode(mixedNodes, ['default'], '0', 10, 6, 0);
    const failed = pods.filter((p) => (p.status as { phase: string }).phase === 'Failed');
    const warning = pods.filter((p) => (p.status as { phase: string }).phase === 'Pending');
    expect(failed).toHaveLength(10);
    expect(warning).toHaveLength(6);

    const workerNames = new Set(mixedNodes.filter((n) => n.role === 'worker').map((n) => n.name));
    for (const pod of [...failed, ...warning]) {
      expect(workerNames.has((pod.spec as { nodeName: string }).nodeName)).toBe(true);
    }
  });

  it('adds no Failed/Warning Pods when there are no Worker Nodes at all', () => {
    const pods = buildPodsPerNode(nodes(2, 'master'), ['default'], '0', 5, 5, 0);
    expect(pods).toHaveLength(0);
  });

  it('continues Pod naming from startIndex, never colliding with already-staged Pods', () => {
    const pods = buildPodsPerNode(nodes(1), ['default'], '3', 0, 0, 100);
    expect(pods.map((p) => (p.metadata as { name: string }).name).sort()).toEqual(['demo-pod-101', 'demo-pod-102', 'demo-pod-103']);
  });

  it('round-robins Pod namespaces across the given list', () => {
    const pods = buildPodsPerNode(nodes(1), ['ns-a', 'ns-b'], '4', 0, 0, 0);
    const namespaces = pods.map((p) => (p.metadata as { namespace: string }).namespace);
    expect(namespaces).toEqual(['ns-a', 'ns-b', 'ns-a', 'ns-b']);
  });

  it('falls back to "default" when no namespaces are given', () => {
    const pods = buildPodsPerNode(nodes(1), [], '2', 0, 0, 0);
    for (const pod of pods) expect((pod.metadata as { namespace: string }).namespace).toBe('default');
  });

  it('handles an empty Node list without throwing', () => {
    expect(buildPodsPerNode([], ['default'], '{100-150,Random}', 5, 5, 0)).toEqual([]);
  });
});

describe('resolvePattern integration sanity for the {100-150,Random} example from the ask', () => {
  it('always resolves within range and varies across calls', () => {
    const values = new Set(Array.from({ length: 20 }, () => Number(resolvePattern('{100-150,Random}', 1))));
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(100);
      expect(v).toBeLessThanOrEqual(150);
    }
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('buildWorkloadsBundle', () => {
  const startIndex = { cronJob: 0, job: 0, statefulSet: 0 };

  it('resolves each of CronJob/Job/StatefulSet count independently against the same total Pod count', () => {
    const result = buildWorkloadsBundle(
      1000,
      { cronJobPercent: 10, statefulSetPercent: 5, jobPercent: 20 },
      ['default'],
      STORAGE_CLASS_NAMES,
      [],
      startIndex,
    );
    expect(result.cronJobs).toHaveLength(100);
    expect(result.jobs).toHaveLength(200);
    expect(result.statefulSets).toHaveLength(50);
  });

  it('gives every StatefulSet 1-3 replicas, each with an owned Pod + bound PVC + bound PV', () => {
    const result = buildWorkloadsBundle(
      100,
      { cronJobPercent: 0, statefulSetPercent: 10, jobPercent: 0 },
      ['default'],
      STORAGE_CLASS_NAMES,
      [],
      startIndex,
    );
    expect(result.statefulSets).toHaveLength(10);

    for (const sts of result.statefulSets) {
      const meta = sts.metadata as { name: string; uid: string };
      const spec = sts.spec as { replicas: number; volumeClaimTemplates: unknown[] };
      expect(spec.replicas).toBeGreaterThanOrEqual(1);
      expect(spec.replicas).toBeLessThanOrEqual(3);
      expect(spec.volumeClaimTemplates).toHaveLength(1);

      const ownedPods = result.statefulSetPods.filter(
        (p) => (p.metadata as { ownerReferences?: { uid: string }[] }).ownerReferences?.[0]?.uid === meta.uid,
      );
      expect(ownedPods).toHaveLength(spec.replicas);

      for (const pod of ownedPods) {
        const podMeta = pod.metadata as { name: string };
        const pvc = result.persistentVolumeClaims.find((p) => (p.metadata as { name: string }).name === `data-${podMeta.name}`);
        expect(pvc).toBeDefined();
        expect((pvc?.status as { phase: string }).phase).toBe('Bound');
        const volumeName = (pvc?.spec as { volumeName: string }).volumeName;
        const pv = result.persistentVolumes.find((p) => (p.metadata as { name: string }).name === volumeName);
        expect(pv).toBeDefined();
        expect((pv?.status as { phase: string }).phase).toBe('Bound');
      }
    }
  });

  it('continues CronJob/Job/StatefulSet naming from the given startIndex', () => {
    const result = buildWorkloadsBundle(
      100,
      { cronJobPercent: 2, statefulSetPercent: 1, jobPercent: 3 },
      ['default'],
      STORAGE_CLASS_NAMES,
      [],
      { cronJob: 5, job: 10, statefulSet: 2 },
    );
    expect((result.cronJobs[0]?.metadata as { name: string }).name).toBe('demo-cronjob-6');
    expect((result.jobs[0]?.metadata as { name: string }).name).toBe('demo-job-11');
    expect((result.statefulSets[0]?.metadata as { name: string }).name).toBe('demo-sts-3');
  });

  it('assigns replica Pods a nodeName round-robin from the given Node list, when provided', () => {
    const result = buildWorkloadsBundle(
      100,
      { cronJobPercent: 0, statefulSetPercent: 10, jobPercent: 0 },
      ['default'],
      STORAGE_CLASS_NAMES,
      ['node-a', 'node-b'],
      startIndex,
    );
    for (const pod of result.statefulSetPods) {
      expect(['node-a', 'node-b']).toContain((pod.spec as { nodeName?: string }).nodeName);
    }
  });

  it('returns all-empty results when every percent is 0', () => {
    const result = buildWorkloadsBundle(500, { cronJobPercent: 0, statefulSetPercent: 0, jobPercent: 0 }, ['default'], STORAGE_CLASS_NAMES, [], startIndex);
    expect(result.cronJobs).toHaveLength(0);
    expect(result.jobs).toHaveLength(0);
    expect(result.statefulSets).toHaveLength(0);
    expect(result.statefulSetPods).toHaveLength(0);
    expect(result.persistentVolumeClaims).toHaveLength(0);
    expect(result.persistentVolumes).toHaveLength(0);
  });
});

describe('buildServiceAccountBundle', () => {
  it('creates a ServiceAccount for every given Namespace when none exist yet', () => {
    const result = buildServiceAccountBundle(['default', 'kube-system'], new Set());
    expect(result).toHaveLength(2);
    for (const sa of result) {
      expect((sa.metadata as { name: string }).name).toBe(SERVICE_ACCOUNT_NAME);
    }
    expect(result.map((sa) => (sa.metadata as { namespace: string }).namespace).sort()).toEqual(['default', 'kube-system']);
  });

  it('skips Namespaces that already have one — "created as needed", not duplicated', () => {
    const result = buildServiceAccountBundle(['default', 'kube-system', 'demo-ns-1'], new Set(['default', 'kube-system']));
    expect(result).toHaveLength(1);
    expect((result[0]?.metadata as { namespace: string }).namespace).toBe('demo-ns-1');
  });

  it('returns nothing when every Namespace already has one', () => {
    expect(buildServiceAccountBundle(['default'], new Set(['default']))).toHaveLength(0);
  });
});

describe('buildEventsForPods', () => {
  function pod(name: string, namespace: string, phase: string): PodEventRef {
    return { name, namespace, phase };
  }

  it('gives every Failed Pod one Warning BackOff Event and every Pending ("Warning") Pod one Warning FailedScheduling Event, by default', () => {
    const pods = [pod('p1', 'default', 'Running'), pod('p2', 'default', 'Failed'), pod('p3', 'default', 'Pending'), pod('p4', 'default', 'Succeeded')];
    const events = buildEventsForPods(pods, false, 0);
    expect(events).toHaveLength(2);
    const byPod = new Map(events.map((e) => [(e.involvedObject as { name: string }).name, e]));
    expect((byPod.get('p2')?.reason)).toBe('BackOff');
    expect((byPod.get('p2') as RawObject).type).toBe('Warning');
    expect((byPod.get('p3')?.reason)).toBe('FailedScheduling');
    expect((byPod.get('p3') as RawObject).type).toBe('Warning');
  });

  it('adds the 5-step standard launch sequence to EVERY Pod when includeStandardLaunchEvents is true, in addition to Failed/Warning Events', () => {
    const pods = [pod('p1', 'default', 'Running'), pod('p2', 'default', 'Failed')];
    const events = buildEventsForPods(pods, true, 0);
    // p1: 5 launch events. p2: 5 launch events + 1 BackOff = 6. Total 11.
    expect(events).toHaveLength(11);
    const p1Reasons = events.filter((e) => (e.involvedObject as { name: string }).name === 'p1').map((e) => e.reason);
    expect(p1Reasons).toEqual(['Scheduled', 'Pulling', 'Pulled', 'Created', 'Started']);
    const p2Reasons = events.filter((e) => (e.involvedObject as { name: string }).name === 'p2').map((e) => e.reason);
    expect(p2Reasons).toEqual(['BackOff', 'Scheduled', 'Pulling', 'Pulled', 'Created', 'Started']);
  });

  it('produces no Events at all for an empty Pod list', () => {
    expect(buildEventsForPods([], true, 0)).toHaveLength(0);
  });

  it('continues Event naming from startIndex', () => {
    const events = buildEventsForPods([pod('p1', 'default', 'Failed')], false, 50);
    expect((events[0]?.metadata as { name: string }).name).toBe('demo-event-51');
  });
});

describe('buildGatewayBundle', () => {
  const startIndex = { gateway: 0, gatewayClass: 0, httpRoute: 0 };

  function podRef(name: string, namespace: string, serviceName?: string): PodServiceRef {
    return { name, namespace, serviceName };
  }

  it('creates one Gateway + one GatewayClass per podsPerGateway Pods', () => {
    const result = buildGatewayBundle(500, 100, 0, [], ['default'], [], startIndex);
    expect(result.gateways).toHaveLength(5);
    expect(result.gatewayClasses).toHaveLength(5);
  });

  it('creates at least 1 Gateway/GatewayClass pair when there is at least 1 Pod, even if fewer than podsPerGateway', () => {
    const result = buildGatewayBundle(3, 100, 0, [], ['default'], [], startIndex);
    expect(result.gateways).toHaveLength(1);
    expect(result.gatewayClasses).toHaveLength(1);
  });

  it('creates no Gateways when there are no Pods', () => {
    const result = buildGatewayBundle(0, 100, 0, [], ['default'], [], startIndex);
    expect(result.gateways).toHaveLength(0);
  });

  it('creates one HTTPRoute per unique Service among the selected percent of Pods-with-a-Service, not one per Pod', () => {
    const pods = [
      podRef('p1', 'default', 'svc-a'),
      podRef('p2', 'default', 'svc-a'), // shares svc-a with p1 — should only produce ONE HTTPRoute for svc-a
      podRef('p3', 'default', 'svc-b'),
      podRef('p4', 'default'), // no Service — never eligible
    ];
    const result = buildGatewayBundle(4, 100, 100, pods, ['default'], ['demo-gateway-1'], startIndex);
    expect(result.httpRoutes).toHaveLength(2); // svc-a once, svc-b once
    const targets = result.httpRoutes.map((r) => (r.spec as { rules: { backendRefs: { name: string }[] }[] }).rules[0]?.backendRefs[0]?.name).sort();
    expect(targets).toEqual(['svc-a', 'svc-b']);
  });

  it('spreads HTTPRoutes across pre-existing Gateways when this call creates none of its own', () => {
    // totalPodCount 0 -> no new Gateways this call, but `pods` (already-staged, from a prior call) still has
    // one with a Service — its HTTPRoute must attach to the pre-existing Gateway, not go missing.
    const pods = [podRef('p1', 'default', 'svc-a')];
    const result = buildGatewayBundle(0, 1000, 100, pods, ['default'], ['demo-gateway-1', 'demo-gateway-2'], startIndex);
    expect(result.gateways).toHaveLength(0);
    expect(result.httpRoutes).toHaveLength(1);
    expect((result.httpRoutes[0]?.spec as { parentRefs: { name: string }[] }).parentRefs[0]?.name).toBe('demo-gateway-1');
  });

  it('creates no HTTPRoutes when no Gateway exists at all (new or pre-existing)', () => {
    const pods = [podRef('p1', 'default', 'svc-a')];
    const result = buildGatewayBundle(0, 100, 100, pods, ['default'], [], startIndex);
    expect(result.httpRoutes).toHaveLength(0);
  });

  it('continues Gateway/GatewayClass/HTTPRoute naming from the given startIndex', () => {
    const pods = [podRef('p1', 'default', 'svc-a')];
    const result = buildGatewayBundle(100, 100, 100, pods, ['default'], [], { gateway: 5, gatewayClass: 2, httpRoute: 9 });
    expect((result.gateways[0]?.metadata as { name: string }).name).toBe('demo-gateway-6');
    expect((result.gatewayClasses[0]?.metadata as { name: string }).name).toBe('demo-gatewayclass-3');
    expect((result.httpRoutes[0]?.metadata as { name: string }).name).toBe('demo-httproute-10');
  });
});

describe('buildNetworkPolicyBundle', () => {
  it('gives percent% of Namespaces a default-deny-ingress NetworkPolicy', () => {
    const namespaces = Array.from({ length: 20 }, (_, i) => `ns-${i + 1}`);
    const result = buildNetworkPolicyBundle(namespaces, 50);
    expect(result).toHaveLength(10);
    for (const np of result) {
      expect((np.spec as { policyTypes: string[] }).policyTypes).toEqual(['Ingress']);
    }
  });

  it('returns nothing at 0 percent', () => {
    expect(buildNetworkPolicyBundle(['default'], 0)).toHaveLength(0);
  });
});

describe('buildQuotaLimitBundle', () => {
  it('gives every non-system Namespace a ResourceQuota + LimitRange', () => {
    const namespaces = [...SYSTEM_NAMESPACES, 'demo-ns-1', 'demo-ns-2'];
    const result = buildQuotaLimitBundle(namespaces, new Set());
    expect(result.resourceQuotas).toHaveLength(2);
    expect(result.limitRanges).toHaveLength(2);
    const quotaNamespaces = result.resourceQuotas.map((rq) => (rq.metadata as { namespace: string }).namespace).sort();
    expect(quotaNamespaces).toEqual(['demo-ns-1', 'demo-ns-2']);
  });

  it('skips Namespaces that already have one', () => {
    const result = buildQuotaLimitBundle(['demo-ns-1', 'demo-ns-2'], new Set(['demo-ns-1']));
    expect(result.resourceQuotas).toHaveLength(1);
    expect((result.resourceQuotas[0]?.metadata as { namespace: string }).namespace).toBe('demo-ns-2');
  });

  it('never targets a system Namespace even if not marked as already having one', () => {
    const result = buildQuotaLimitBundle(SYSTEM_NAMESPACES, new Set());
    expect(result.resourceQuotas).toHaveLength(0);
    expect(result.limitRanges).toHaveLength(0);
  });
});

describe('buildSystemPodsBundle', () => {
  it('creates all 5 required system Pods in kube-system when none exist yet', () => {
    const pods = buildSystemPodsBundle(new Set());
    expect(pods).toHaveLength(5);
    expect(pods.map((p) => (p.metadata as { name: string }).name).sort()).toEqual([...SYSTEM_POD_NAMES].sort());
    for (const pod of pods) {
      expect((pod.metadata as { namespace: string }).namespace).toBe('kube-system');
      expect((pod.status as { phase: string }).phase).toBe('Running');
    }
  });

  it('skips Pods that already exist — "created as needed", not duplicated', () => {
    const pods = buildSystemPodsBundle(new Set(['kube-apiserver', 'coredns']));
    expect(pods).toHaveLength(3);
    expect(pods.map((p) => (p.metadata as { name: string }).name).sort()).toEqual(
      ['kube-controller-manager', 'kube-scheduler', 'kube-proxy'].sort(),
    );
  });

  it('returns nothing when all 5 already exist', () => {
    expect(buildSystemPodsBundle(new Set(SYSTEM_POD_NAMES))).toHaveLength(0);
  });

  it('schedules onto the given master Node when provided, leaves unscheduled otherwise', () => {
    const scheduled = buildSystemPodsBundle(new Set(), 'master-1');
    for (const pod of scheduled) expect((pod.spec as { nodeName?: string }).nodeName).toBe('master-1');

    const unscheduled = buildSystemPodsBundle(new Set());
    for (const pod of unscheduled) expect((pod.spec as { nodeName?: string }).nodeName).toBeUndefined();
  });
});
