import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendGenerated,
  clearWorkingSet,
  finishToSnapshot,
  getStagedCount,
  getStagedNames,
  listWorkingSet,
  runRbacBundle,
  runConfigSecretBundle,
  runConfigSecretRefsBundle,
  runStorageCsiBundle,
  runCsiNodeSync,
  runPvcPvBundle,
  runServiceBundle,
  runNamespaceBundle,
  runDaemonSetBundle,
  runDeploymentBundle,
  runPodsPerNodeBundle,
  runWorkloadsBundle,
  runServiceAccountBundle,
  runEventsBundle,
  runGatewayBundle,
  runNetworkPolicyBundle,
  runQuotaLimitBundle,
  runSystemPodsBundle,
} from './demoData';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vpk-demo-data-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('appendGenerated / listWorkingSet', () => {
  it('starts empty when nothing has been staged yet', () => {
    expect(listWorkingSet(tempDir())).toEqual([]);
  });

  it('creates a Kind List file on first append and reports its count', () => {
    const dir = tempDir();
    const total = appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'demo-node-1' } }]);
    expect(total).toBe(1);
    expect(listWorkingSet(dir)).toEqual([{ kind: 'Node', count: 1 }]);
  });

  it('appends to (not replaces) an existing Kind on a later call, returning the new total', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'demo-node-1' } }]);
    const total = appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'demo-node-2' } },
      { kind: 'Node', metadata: { name: 'demo-node-3' } },
    ]);
    expect(total).toBe(3);
    expect(listWorkingSet(dir)).toEqual([{ kind: 'Node', count: 3 }]);
  });

  it('tracks multiple Kinds independently', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node' }]);
    appendGenerated(dir, 'Pod', 'v1', [{ kind: 'Pod' }, { kind: 'Pod' }]);
    expect(listWorkingSet(dir).sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
      { kind: 'Node', count: 1 },
      { kind: 'Pod', count: 2 },
    ]);
  });

  it('getStagedCount reports 0 for an untouched Kind and tracks appends afterwards', () => {
    const dir = tempDir();
    expect(getStagedCount(dir, 'Node')).toBe(0);
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node' }, { kind: 'Node' }]);
    expect(getStagedCount(dir, 'Node')).toBe(2);
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node' }]);
    expect(getStagedCount(dir, 'Node')).toBe(3);
  });

  it('writes a kubectl-get-style {apiVersion, kind: "<Kind>List", items} file', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'demo-node-1' } }]);
    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Node.json'), 'utf8'));
    expect(written.apiVersion).toBe('v1');
    expect(written.kind).toBe('NodeList');
    expect(written.items).toHaveLength(1);
  });
});

describe('clearWorkingSet', () => {
  it('removes a single Kind, leaving the rest staged', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node' }]);
    appendGenerated(dir, 'Pod', 'v1', [{ kind: 'Pod' }]);
    clearWorkingSet(dir, 'Node');
    expect(listWorkingSet(dir)).toEqual([{ kind: 'Pod', count: 1 }]);
  });

  it('removes the entire working directory when no Kind is given', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node' }]);
    clearWorkingSet(dir);
    expect(listWorkingSet(dir)).toEqual([]);
    expect(existsSync(join(dir, 'demo-wip'))).toBe(false);
  });

  it('is a no-op against a directory with nothing staged', () => {
    const dir = tempDir();
    expect(() => clearWorkingSet(dir)).not.toThrow();
    expect(() => clearWorkingSet(dir, 'Node')).not.toThrow();
  });
});

describe('finishToSnapshot', () => {
  it('merges every staged Kind into <snapshotDir>/<name>/vpk.snapshot.json', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'demo-node-1' } }]);
    appendGenerated(dir, 'Pod', 'v1', [{ kind: 'Pod', metadata: { name: 'demo-pod-1' } }]);

    const result = finishToSnapshot(dir, 'my demo!');
    expect(result.count).toBe(2);
    expect(result.file).toBe(join(dir, 'my_demo_', 'vpk.snapshot.json'));

    const written = JSON.parse(readFileSync(result.file, 'utf8'));
    expect(written.items).toHaveLength(2);
    expect(written.items.map((i: { kind: string }) => i.kind).sort()).toEqual(['Node', 'Pod']);
  });

  it('stamps every written item with a creationTimestamp and reports no hierarchy warnings for owner-less items', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'demo-node-1' } }]);

    const result = finishToSnapshot(dir, 'demo-timestamps');
    expect(result.warnings).toEqual([]);

    const written = JSON.parse(readFileSync(result.file, 'utf8'));
    expect(written.items[0].metadata.creationTimestamp).toBeTruthy();
    expect(new Date(written.items[0].metadata.creationTimestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('leaves the working set intact after finishing (non-destructive)', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node' }]);
    finishToSnapshot(dir, 'first-attempt');
    expect(listWorkingSet(dir)).toEqual([{ kind: 'Node', count: 1 }]);
  });
});

describe('bundle orchestration', () => {
  it('runRbacBundle stages Role/ClusterRole/RoleBinding/ClusterRoleBinding', () => {
    const dir = tempDir();
    const totals = runRbacBundle(dir, 'default');
    expect(totals).toEqual({ Role: 2, ClusterRole: 2, RoleBinding: 2, ClusterRoleBinding: 2 });
    expect(listWorkingSet(dir).map((e) => e.kind).sort()).toEqual(['ClusterRole', 'ClusterRoleBinding', 'Role', 'RoleBinding']);
  });

  it('runConfigSecretBundle stages 5 ConfigMaps + 5 Secrets in every currently-staged Namespace, then tops up', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Namespace', 'v1', [
      { kind: 'Namespace', metadata: { name: 'ns-a' } },
      { kind: 'Namespace', metadata: { name: 'ns-b' } },
    ]);
    expect(runConfigSecretBundle(dir)).toEqual({ ConfigMap: 10, Secret: 10 }); // (5+5) * 2 namespaces

    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'ns-c' } }]);
    expect(runConfigSecretBundle(dir)).toEqual({ ConfigMap: 15, Secret: 15 }); // top up ns-c only, not duplicate
  });

  it('runConfigSecretBundle reports a warning instead of an error when no Namespaces are staged', () => {
    expect(runConfigSecretBundle(tempDir())).toEqual({});
  });

  it('runConfigSecretRefsBundle gives every staged Pod at least one ConfigMap + Secret ref, and stages the pool it needs', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Pod', 'v1', [
      { kind: 'Pod', metadata: { name: 'p1', namespace: 'ns-a' }, spec: { containers: [{ name: 'app' }] } },
      { kind: 'Pod', metadata: { name: 'p2', namespace: 'ns-b' }, spec: { containers: [{ name: 'app' }] } },
    ]);

    const totals = runConfigSecretRefsBundle(dir);
    expect(totals.ConfigMap).toBe(10); // 5 * 2 namespaces
    expect(totals.Secret).toBe(10);
    expect(totals.PodsReferenced).toBe(2);

    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as {
      items: { spec: { containers: { envFrom?: { configMapRef?: { name: string }; secretRef?: { name: string } }[] }[] } }[];
    };
    for (const pod of written.items) {
      const envFrom = pod.spec.containers[0]?.envFrom ?? [];
      expect(envFrom.some((e) => e.configMapRef)).toBe(true);
      expect(envFrom.some((e) => e.secretRef)).toBe(true);
    }
  });

  it('runConfigSecretRefsBundle does not duplicate the pool for a Namespace that already has it, and skips Pods that already have a ref', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'ns-a' } }]);
    runConfigSecretBundle(dir); // pre-stage the pool
    appendGenerated(dir, 'Pod', 'v1', [
      { kind: 'Pod', metadata: { name: 'p1', namespace: 'ns-a' }, spec: { containers: [{ name: 'app', envFrom: [{ configMapRef: { name: 'x' } }] }] } },
    ]);

    const totals = runConfigSecretRefsBundle(dir);
    expect(totals).toEqual({}); // pool already there, Pod already referenced — nothing to do
  });

  it('runConfigSecretRefsBundle reports a warning instead of an error when no Pods are staged', () => {
    expect(runConfigSecretRefsBundle(tempDir())).toEqual({});
  });

  it('runStorageCsiBundle stages 3 StorageClasses and 3 CSIDrivers', () => {
    const dir = tempDir();
    expect(runStorageCsiBundle(dir)).toEqual({ StorageClass: 3, CSIDriver: 3 });
  });

  it('runCsiNodeSync creates one CSINode per staged Node, and REPLACES on a later call rather than duplicating', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'node-a' } },
      { kind: 'Node', metadata: { name: 'node-b' } },
    ]);
    expect(runCsiNodeSync(dir)).toBe(2);
    expect(getStagedCount(dir, 'CSINode')).toBe(2);

    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'node-c' } }]);
    expect(runCsiNodeSync(dir)).toBe(3); // refreshed to match the now-3 staged Nodes, not 2+3
    expect(getStagedCount(dir, 'CSINode')).toBe(3);
  });

  it('runPvcPvBundle reads staged Pods, stages PVC/PV/VolumeAttachment proportionally, and wires each PVC onto its Pod', () => {
    const dir = tempDir();
    const pods = Array.from({ length: 20 }, (_, i) => ({
      kind: 'Pod',
      metadata: { name: `pod-${i + 1}`, namespace: 'default' },
      spec: { nodeName: `node-${i + 1}` },
    }));
    appendGenerated(dir, 'Pod', 'v1', pods);
    const totals = runPvcPvBundle(dir, 50); // 10 of 20 pods
    expect(totals.PersistentVolumeClaim).toBe(10);
    expect(totals.PersistentVolume).toBe(10);
    expect(totals.VolumeAttachment).toBe(5); // half of the 10 PVs

    expect(getStagedCount(dir, 'Pod')).toBe(20); // pod count unchanged, only spec.volumes touched
    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as {
      items: { metadata: { name: string }; spec: { volumes?: { persistentVolumeClaim?: { claimName: string } }[] } }[];
    };
    const wired = written.items.filter((p) => p.spec.volumes?.some((v) => v.persistentVolumeClaim));
    expect(wired).toHaveLength(10);
    for (const pod of wired) {
      const claimName = pod.spec.volumes?.find((v) => v.persistentVolumeClaim)?.persistentVolumeClaim?.claimName;
      expect(claimName).toBe(`${pod.metadata.name}-pvc`);
    }
  });

  it('runServiceBundle labels the selected Pods in place and stages the Services', () => {
    const dir = tempDir();
    const pods = Array.from({ length: 10 }, (_, i) => ({ kind: 'Pod', metadata: { name: `pod-${i + 1}`, namespace: 'default' } }));
    appendGenerated(dir, 'Pod', 'v1', pods);
    const totals = runServiceBundle(dir, 50, 20); // 5 of 10 pods attached to a service

    expect(getStagedCount(dir, 'Pod')).toBe(10); // pod count unchanged, only labels touched
    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as {
      items: { metadata: { labels?: Record<string, string> } }[];
    };
    const labeled = written.items.filter((p) => p.metadata.labels?.['demo.vpk/service']);
    expect(labeled).toHaveLength(5);
    expect(totals.Service).toBeGreaterThan(0);
    expect(totals.Endpoints).toBe(totals.Service); // one Endpoints per Service — the actual Network-view join key
  });

  it('getStagedNames returns the name of every currently-staged item of a Kind', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'node-a' } },
      { kind: 'Node', metadata: { name: 'node-b' } },
    ]);
    expect(getStagedNames(dir, 'Node').sort()).toEqual(['node-a', 'node-b']);
    expect(getStagedNames(dir, 'Namespace')).toEqual([]);
  });

  it('runNamespaceBundle stages the 4 system namespaces plus N additional on a fresh working set', () => {
    const dir = tempDir();
    const totals = runNamespaceBundle(dir, 2);
    expect(totals.Namespace).toBe(6); // 4 system + 2 additional
    expect(getStagedNames(dir, 'Namespace').sort()).toEqual(
      ['default', 'kube-system', 'kube-public', 'kube-node-lease', 'demo-ns-1', 'demo-ns-2'].sort(),
    );
  });

  it('runNamespaceBundle does not re-add system namespaces already staged, on a second call', () => {
    const dir = tempDir();
    runNamespaceBundle(dir, 0); // 4 system namespaces
    const totals = runNamespaceBundle(dir, 1); // + 1 additional; system namespaces should NOT duplicate
    expect(totals.Namespace).toBe(5); // new total: 4 system + 1 additional, not 4+4+1
    expect(getStagedNames(dir, 'Namespace').filter((n) => n === 'default')).toHaveLength(1);
  });

  it('runDaemonSetBundle gives every staged Node 8-13 DaemonSets, spread across staged Namespaces', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'node-a' } },
      { kind: 'Node', metadata: { name: 'node-b' } },
    ]);
    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'kube-system' } }]);

    const totals = runDaemonSetBundle(dir);
    expect(totals.DaemonSet).toBeGreaterThanOrEqual(16); // 2 nodes * at least 8 each
    expect(totals.DaemonSet).toBeLessThanOrEqual(26); // 2 nodes * at most 13 each
    expect(totals.Pod).toBe(totals.DaemonSet); // one Pod per DaemonSet
  });

  it('runDaemonSetBundle reports a warning instead of an error when no Nodes are staged', () => {
    expect(runDaemonSetBundle(tempDir())).toEqual({});
  });

  it('runDaemonSetBundle does not duplicate DaemonSets for a Node re-run against an unchanged Node set', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'node-a' } },
      { kind: 'Node', metadata: { name: 'node-b' } },
    ]);
    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'kube-system' } }]);

    const first = runDaemonSetBundle(dir);
    const second = runDaemonSetBundle(dir);
    // Re-running with the same Node set already covered should add nothing further.
    expect(second).toEqual({});
    expect(second.DaemonSet ?? 0).toBe(0);
    expect(first.DaemonSet).toBeGreaterThan(0);
  });

  it('runDaemonSetBundle only generates DaemonSets for a newly-added Node, leaving the covered ones untouched', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'node-a' } }]);
    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'kube-system' } }]);

    const first = runDaemonSetBundle(dir);
    appendGenerated(dir, 'Node', 'v1', [{ kind: 'Node', metadata: { name: 'node-b' } }]);
    const second = runDaemonSetBundle(dir);

    // `second.DaemonSet` is already the running TOTAL after the second run (see appendBundle) — it should only
    // have grown by node-b's own 8-13 batch, never a re-generated node-a batch stacked on top of the first.
    expect(second.DaemonSet).toBe(getStagedCount(dir, 'DaemonSet'));
    expect(second.DaemonSet as number).toBeGreaterThan(first.DaemonSet as number);
    expect((second.DaemonSet as number) - (first.DaemonSet as number)).toBeGreaterThanOrEqual(8);
    expect((second.DaemonSet as number) - (first.DaemonSet as number)).toBeLessThanOrEqual(13);

    const pods = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as { items: { spec: { nodeName: string } }[] };
    const nodeACount = pods.items.filter((p) => p.spec.nodeName === 'node-a').length;
    expect(nodeACount).toBe(first.Pod); // node-a's Pod count is unchanged by the second run
  });

  it('runDeploymentBundle wires up un-owned Pods into Deployment -> ReplicaSet -> Pod chains', () => {
    const dir = tempDir();
    const pods = Array.from({ length: 20 }, (_, i) => ({ kind: 'Pod', metadata: { name: `pod-${i + 1}`, namespace: 'default' } }));
    appendGenerated(dir, 'Pod', 'v1', pods);

    const totals = runDeploymentBundle(dir);
    expect(totals.Deployment).toBeGreaterThan(0);
    expect(totals.ReplicaSet).toBe(totals.Deployment);

    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as {
      items: { metadata: { ownerReferences?: { kind: string }[] } }[];
    };
    expect(written.items.every((p) => p.metadata.ownerReferences?.[0]?.kind === 'ReplicaSet')).toBe(true);
  });

  it('runPodsPerNodeBundle resolves a per-Node count from the pattern and scatters Failed/Warning on Workers only', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'master-a', labels: { 'node-role.kubernetes.io/master': '' } } },
      { kind: 'Node', metadata: { name: 'worker-a', labels: {} } },
      { kind: 'Node', metadata: { name: 'worker-b' } },
    ]);

    const totals = runPodsPerNodeBundle(dir, '{5-8,Random}', 3, 4);
    expect(totals.Pod).toBeGreaterThanOrEqual(15); // 3 nodes * at least 5 each
    expect(totals.Pod).toBeLessThanOrEqual(24 + 7); // 3 nodes * at most 8 each, + 3 failed + 4 warning

    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as {
      items: { spec: { nodeName: string }; status: { phase: string } }[];
    };
    const byNode = new Map<string, string[]>();
    for (const p of written.items) {
      const list = byNode.get(p.spec.nodeName) ?? [];
      list.push(p.status.phase);
      byNode.set(p.spec.nodeName, list);
    }

    for (const phases of byNode.values()) {
      const base = phases.filter((p) => p === 'Running' || p === 'Succeeded');
      expect(base.length).toBeGreaterThanOrEqual(5);
      expect(base.length).toBeLessThanOrEqual(8);
    }
    expect(byNode.get('master-a')?.some((p) => p === 'Failed' || p === 'Pending')).toBe(false);
    expect(written.items.filter((p) => p.status.phase === 'Failed')).toHaveLength(3);
    expect(written.items.filter((p) => p.status.phase === 'Pending')).toHaveLength(4);
  });

  it('runPodsPerNodeBundle reports a warning instead of an error when no Nodes are staged', () => {
    expect(runPodsPerNodeBundle(tempDir(), '{5-8,Random}', 0, 0)).toEqual({});
  });

  it('runWorkloadsBundle stages CronJobs/Jobs/StatefulSets as a percent of the staged Pod count, with StatefulSet PVC/PV', () => {
    const dir = tempDir();
    const pods = Array.from({ length: 100 }, (_, i) => ({ kind: 'Pod', metadata: { name: `pod-${i + 1}`, namespace: 'default' } }));
    appendGenerated(dir, 'Pod', 'v1', pods);
    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'default' } }]);

    const totals = runWorkloadsBundle(dir, 10, 5, 20);
    expect(totals.CronJob).toBe(10);
    expect(totals.Job).toBe(20);
    expect(totals.StatefulSet).toBe(5);
    expect(totals.PersistentVolumeClaim).toBeGreaterThanOrEqual(5); // at least 1 replica each
    expect(totals.PersistentVolume).toBe(totals.PersistentVolumeClaim);
    expect(totals.Pod).toBe(100 + (totals.PersistentVolumeClaim as number)); // original Pods + one per StatefulSet replica
  });

  it('runWorkloadsBundle continues naming from the currently-staged count on a second call', () => {
    const dir = tempDir();
    // 0% StatefulSet so the second call's percentages are resolved against the same Pod count as the first
    // (StatefulSet replicas add their own Pods, which would otherwise grow the denominator between calls).
    appendGenerated(dir, 'Pod', 'v1', Array.from({ length: 100 }, (_, i) => ({ kind: 'Pod', metadata: { name: `pod-${i + 1}`, namespace: 'default' } })));

    runWorkloadsBundle(dir, 5, 0, 5);
    const totals = runWorkloadsBundle(dir, 5, 0, 5);
    expect(totals.CronJob).toBe(10); // 5 + 5, not duplicated/reset
    expect(totals.Job).toBe(10);
    expect(getStagedNames(dir, 'CronJob').sort((a, b) => a.length - b.length || a.localeCompare(b))).toEqual([
      'demo-cronjob-1',
      'demo-cronjob-2',
      'demo-cronjob-3',
      'demo-cronjob-4',
      'demo-cronjob-5',
      'demo-cronjob-6',
      'demo-cronjob-7',
      'demo-cronjob-8',
      'demo-cronjob-9',
      'demo-cronjob-10',
    ]);
  });

  it('runWorkloadsBundle reports a warning instead of an error when no Pods are staged', () => {
    expect(runWorkloadsBundle(tempDir(), 10, 10, 10)).toEqual({});
  });

  it('runServiceAccountBundle creates one ServiceAccount per staged Namespace, then tops up rather than duplicating', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Namespace', 'v1', [
      { kind: 'Namespace', metadata: { name: 'default' } },
      { kind: 'Namespace', metadata: { name: 'kube-system' } },
    ]);
    expect(runServiceAccountBundle(dir)).toEqual({ ServiceAccount: 2 });

    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'demo-ns-1' } }]);
    expect(runServiceAccountBundle(dir)).toEqual({ ServiceAccount: 3 }); // 2 already there + 1 new, not 2+3
  });

  it('runEventsBundle gives Failed/Pending Pods a Warning Event by default, and everyone the launch sequence when asked', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Pod', 'v1', [
      { kind: 'Pod', metadata: { name: 'p1', namespace: 'default' }, status: { phase: 'Running' } },
      { kind: 'Pod', metadata: { name: 'p2', namespace: 'default' }, status: { phase: 'Failed' } },
      { kind: 'Pod', metadata: { name: 'p3', namespace: 'default' }, status: { phase: 'Pending' } },
    ]);
    expect(runEventsBundle(dir, false)).toEqual({ Event: 2 });

    const dir2 = tempDir();
    appendGenerated(dir2, 'Pod', 'v1', [
      { kind: 'Pod', metadata: { name: 'p1', namespace: 'default' }, status: { phase: 'Running' } },
      { kind: 'Pod', metadata: { name: 'p2', namespace: 'default' }, status: { phase: 'Failed' } },
    ]);
    expect(runEventsBundle(dir2, true)).toEqual({ Event: 11 }); // p1: 5 launch, p2: 5 launch + 1 BackOff
  });

  it('runGatewayBundle creates Gateway/GatewayClass per podsPerGateway Pods and an HTTPRoute per Service-labeled Pod group', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Pod', 'v1', [
      { kind: 'Pod', metadata: { name: 'p1', namespace: 'default', labels: { 'demo.vpk/service': 'demo-svc-1' } } },
      { kind: 'Pod', metadata: { name: 'p2', namespace: 'default', labels: { 'demo.vpk/service': 'demo-svc-1' } } },
      { kind: 'Pod', metadata: { name: 'p3', namespace: 'default' } },
    ]);

    const totals = runGatewayBundle(dir, 2, 100);
    expect(totals.Gateway).toBe(1);
    expect(totals.GatewayClass).toBe(1);
    expect(totals.HTTPRoute).toBe(1); // p1+p2 share demo-svc-1 -> one HTTPRoute, p3 has no Service
  });

  it('runGatewayBundle reports a warning instead of an error when no Pods are staged', () => {
    expect(runGatewayBundle(tempDir(), 10, 50)).toEqual({});
  });

  it('runNetworkPolicyBundle gives percent% of staged Namespaces a default-deny NetworkPolicy', () => {
    const dir = tempDir();
    appendGenerated(
      dir,
      'Namespace',
      'v1',
      Array.from({ length: 10 }, (_, i) => ({ kind: 'Namespace', metadata: { name: `ns-${i + 1}` } })),
    );
    expect(runNetworkPolicyBundle(dir, 50)).toEqual({ NetworkPolicy: 5 });
  });

  it('runQuotaLimitBundle gives every non-system Namespace a ResourceQuota + LimitRange, then tops up', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Namespace', 'v1', [
      { kind: 'Namespace', metadata: { name: 'default' } },
      { kind: 'Namespace', metadata: { name: 'demo-ns-1' } },
    ]);
    expect(runQuotaLimitBundle(dir)).toEqual({ ResourceQuota: 1, LimitRange: 1 }); // 'default' is system, skipped

    appendGenerated(dir, 'Namespace', 'v1', [{ kind: 'Namespace', metadata: { name: 'demo-ns-2' } }]);
    expect(runQuotaLimitBundle(dir)).toEqual({ ResourceQuota: 2, LimitRange: 2 }); // top up, not duplicate
  });

  it('runSystemPodsBundle stages all 5 required system Pods in kube-system, then tops up rather than duplicating', () => {
    const dir = tempDir();
    expect(runSystemPodsBundle(dir)).toEqual({ Pod: 5 });
    expect(getStagedNames(dir, 'Pod').sort()).toEqual(['coredns', 'kube-apiserver', 'kube-controller-manager', 'kube-proxy', 'kube-scheduler'].sort());

    // Simulate someone clearing just one of them, then re-running: only the missing one comes back.
    clearWorkingSet(dir, 'Pod');
    appendGenerated(dir, 'Pod', 'v1', [
      { kind: 'Pod', metadata: { name: 'kube-apiserver', namespace: 'kube-system' } },
      { kind: 'Pod', metadata: { name: 'coredns', namespace: 'kube-system' } },
    ]);
    expect(runSystemPodsBundle(dir)).toEqual({ Pod: 5 }); // 2 already there + 3 new, not 2+5
  });

  it('runSystemPodsBundle schedules onto a staged master Node when one exists', () => {
    const dir = tempDir();
    appendGenerated(dir, 'Node', 'v1', [
      { kind: 'Node', metadata: { name: 'worker-1', labels: {} } },
      { kind: 'Node', metadata: { name: 'master-1', labels: { 'node-role.kubernetes.io/master': '' } } },
    ]);
    runSystemPodsBundle(dir);
    const written = JSON.parse(readFileSync(join(dir, 'demo-wip', 'Pod.json'), 'utf8')) as {
      items: { spec: { nodeName?: string } }[];
    };
    for (const pod of written.items) expect(pod.spec.nodeName).toBe('master-1');
  });
});
