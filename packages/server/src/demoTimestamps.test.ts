import { describe, it, expect } from 'vitest';
import type { RawObject } from '@vpk/core';
import { assignCreationTimestamps, validateHierarchy, simulatePodChurn } from './demoTimestamps';

const NOW = new Date('2026-07-07T12:00:00Z').getTime();

function node(name: string): RawObject {
  return { kind: 'Node', metadata: { name } };
}
function pod(name: string): RawObject {
  return { kind: 'Pod', metadata: { name } };
}
function timedPod(name: string, creationTimestamp: string, ownerKind?: string): RawObject {
  return {
    kind: 'Pod',
    metadata: { name, creationTimestamp, ...(ownerKind ? { ownerReferences: [{ kind: ownerKind }] } : {}) },
  };
}

describe('assignCreationTimestamps', () => {
  it('gives every item a creationTimestamp no later than "now"', () => {
    const items = [node('n1'), pod('p1')];
    const result = assignCreationTimestamps(items, { now: NOW });
    for (const item of result) {
      const ts = (item.metadata as { creationTimestamp: string }).creationTimestamp;
      expect(new Date(ts).getTime()).toBeLessThanOrEqual(NOW);
    }
  });

  it('orders Nodes strictly before Pods (lower KIND_PRIORITY = earlier bucket)', () => {
    const result = assignCreationTimestamps([pod('p1'), node('n1')], { now: NOW });
    const podTs = new Date((result[0]?.metadata as { creationTimestamp: string }).creationTimestamp).getTime();
    const nodeTs = new Date((result[1]?.metadata as { creationTimestamp: string }).creationTimestamp).getTime();
    expect(nodeTs).toBeLessThan(podTs);
  });

  it('stamps multiple items of the same Kind in ascending order, preserving input order', () => {
    const result = assignCreationTimestamps([node('n1'), node('n2'), node('n3')], { now: NOW });
    const times = result.map((r) => new Date((r.metadata as { creationTimestamp: string }).creationTimestamp).getTime());
    expect(times[0]).toBeLessThan(times[1] as number);
    expect(times[1]).toBeLessThan(times[2] as number);
  });

  it("never overwrites a timestamp a template/extraction already set", () => {
    const withReal: RawObject = { kind: 'Event', metadata: { name: 'e1', creationTimestamp: '2020-01-01T00:00:00Z' } };
    const result = assignCreationTimestamps([withReal], { now: NOW });
    expect((result[0]?.metadata as { creationTimestamp: string }).creationTimestamp).toBe('2020-01-01T00:00:00Z');
  });

  it('handles an empty list without throwing', () => {
    expect(assignCreationTimestamps([], { now: NOW })).toEqual([]);
  });
});

describe('validateHierarchy', () => {
  it('reports nothing when no item has ownerReferences (the case for every template today)', () => {
    expect(validateHierarchy([node('n1'), pod('p1')])).toEqual([]);
  });

  it('reports nothing when a child is timestamped after its owner', () => {
    const owner: RawObject = { kind: 'ReplicaSet', metadata: { name: 'rs1', uid: 'u1', creationTimestamp: '2026-01-01T00:00:00Z' } };
    const child: RawObject = {
      kind: 'Pod',
      metadata: { name: 'p1', ownerReferences: [{ uid: 'u1' }], creationTimestamp: '2026-01-02T00:00:00Z' },
    };
    expect(validateHierarchy([owner, child])).toEqual([]);
  });

  it('flags a child timestamped BEFORE its resolved owner', () => {
    const owner: RawObject = { kind: 'ReplicaSet', metadata: { name: 'rs1', uid: 'u1', creationTimestamp: '2026-01-02T00:00:00Z' } };
    const child: RawObject = {
      kind: 'Pod',
      metadata: { name: 'p1', ownerReferences: [{ uid: 'u1' }], creationTimestamp: '2026-01-01T00:00:00Z' },
    };
    const problems = validateHierarchy([owner, child]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Pod\/p1.*before.*ReplicaSet\/rs1/);
  });

  it("ignores an ownerReference whose uid isn't present in this set", () => {
    const child: RawObject = { kind: 'Pod', metadata: { name: 'p1', ownerReferences: [{ uid: 'not-in-set' }] } };
    expect(validateHierarchy([child])).toEqual([]);
  });
});

describe('simulatePodChurn', () => {
  const OLD_CREATION = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days before NOW

  it('churns roughly `percent`% of eligible pods over a large sample', () => {
    const pods = Array.from({ length: 1000 }, (_, i) => timedPod(`p${i}`, OLD_CREATION));
    const result = simulatePodChurn(pods, { now: NOW, percent: 20 });
    const churned = result.filter((r) => (r.metadata as { deletionTimestamp?: string }).deletionTimestamp);
    // Generous statistical tolerance band around the expected ~200.
    expect(churned.length).toBeGreaterThan(100);
    expect(churned.length).toBeLessThan(300);
  });

  it('never churns a DaemonSet-owned pod, even at percent: 100', () => {
    const pods = Array.from({ length: 50 }, (_, i) => timedPod(`ds${i}`, OLD_CREATION, 'DaemonSet'));
    const result = simulatePodChurn(pods, { now: NOW, percent: 100 });
    expect(result.every((r) => !(r.metadata as { deletionTimestamp?: string }).deletionTimestamp)).toBe(true);
  });

  it('always assigns a deletionTimestamp strictly after creationTimestamp and no later than now', () => {
    const pods = Array.from({ length: 200 }, (_, i) => timedPod(`p${i}`, OLD_CREATION));
    const result = simulatePodChurn(pods, { now: NOW, percent: 100 });
    for (const r of result) {
      const metadata = r.metadata as { creationTimestamp: string; deletionTimestamp: string };
      const createdMs = new Date(metadata.creationTimestamp).getTime();
      const deletedMs = new Date(metadata.deletionTimestamp).getTime();
      expect(deletedMs).toBeGreaterThan(createdMs);
      expect(deletedMs).toBeLessThanOrEqual(NOW);
    }
  });

  it('percent: 0 changes nothing', () => {
    const pods = Array.from({ length: 50 }, (_, i) => timedPod(`p${i}`, OLD_CREATION));
    const result = simulatePodChurn(pods, { now: NOW, percent: 0 });
    expect(result).toEqual(pods);
  });

  it('never touches non-Pod kinds', () => {
    const items = [node('n1'), timedPod('p1', OLD_CREATION)];
    const result = simulatePodChurn(items, { now: NOW, percent: 100 });
    expect((result[0]?.metadata as { deletionTimestamp?: string }).deletionTimestamp).toBeUndefined();
  });

  it('leaves a pod with no creationTimestamp untouched', () => {
    const result = simulatePodChurn([pod('bare')], { now: NOW, percent: 100 });
    expect((result[0]?.metadata as { deletionTimestamp?: string }).deletionTimestamp).toBeUndefined();
  });
});
