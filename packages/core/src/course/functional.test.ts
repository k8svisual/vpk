import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import type { RawObject } from '../types';
import { aggregateFunctional, resourceFunctional } from './functional';

function graphOf(objects: RawObject[]) {
  const graph = buildGraph(objects);
  return { graph, get: (kind: string, name: string) => [...graph.nodes.values()].find((r) => r.kind === kind && r.name === name)! };
}

describe('resourceFunctional — Pod', () => {
  it('Running -> working, Failed -> broken, Pending -> partial, no phase -> partial (unknown)', () => {
    const { graph, get } = graphOf([
      { kind: 'Pod', metadata: { uid: 'p1', name: 'a', namespace: 'ns' }, status: { phase: 'Running' } },
      { kind: 'Pod', metadata: { uid: 'p2', name: 'b', namespace: 'ns' }, status: { phase: 'Failed' } },
      { kind: 'Pod', metadata: { uid: 'p3', name: 'c', namespace: 'ns' }, status: { phase: 'Pending' } },
      { kind: 'Pod', metadata: { uid: 'p4', name: 'd', namespace: 'ns' } },
    ]);
    expect(resourceFunctional(get('Pod', 'a'), graph)).toBe('working');
    expect(resourceFunctional(get('Pod', 'b'), graph)).toBe('broken');
    expect(resourceFunctional(get('Pod', 'c'), graph)).toBe('partial');
    expect(resourceFunctional(get('Pod', 'd'), graph)).toBe('partial');
  });

  it('Succeeded (e.g. a completed Job pod) reads as working, not broken', () => {
    const { graph, get } = graphOf([{ kind: 'Pod', metadata: { uid: 'p1', name: 'a', namespace: 'ns' }, status: { phase: 'Succeeded' } }]);
    expect(resourceFunctional(get('Pod', 'a'), graph)).toBe('working');
  });
});

describe('resourceFunctional — Deployment/StatefulSet/DaemonSet', () => {
  it('ready >= desired -> working, 0 < ready < desired -> partial, ready = 0 -> broken', () => {
    const { graph, get } = graphOf([
      { kind: 'Deployment', metadata: { uid: 'd1', name: 'ok', namespace: 'ns' }, spec: { replicas: 3 }, status: { readyReplicas: 3 } },
      { kind: 'Deployment', metadata: { uid: 'd2', name: 'starting', namespace: 'ns' }, spec: { replicas: 3 }, status: { readyReplicas: 1 } },
      { kind: 'Deployment', metadata: { uid: 'd3', name: 'crashed', namespace: 'ns' }, spec: { replicas: 3 }, status: {} },
    ]);
    expect(resourceFunctional(get('Deployment', 'ok'), graph)).toBe('working');
    expect(resourceFunctional(get('Deployment', 'starting'), graph)).toBe('partial');
    expect(resourceFunctional(get('Deployment', 'crashed'), graph)).toBe('broken');
  });

  it('spec.replicas defaults to 1 when unset (matches the API server default)', () => {
    const { graph, get } = graphOf([{ kind: 'Deployment', metadata: { uid: 'd1', name: 'x', namespace: 'ns' }, spec: {}, status: { readyReplicas: 1 } }]);
    expect(resourceFunctional(get('Deployment', 'x'), graph)).toBe('working');
  });

  it('a deliberate scale-to-zero is n/a, not broken — nothing should be running', () => {
    const { graph, get } = graphOf([{ kind: 'Deployment', metadata: { uid: 'd1', name: 'x', namespace: 'ns' }, spec: { replicas: 0 }, status: {} }]);
    expect(resourceFunctional(get('Deployment', 'x'), graph)).toBe('n/a');
  });

  it('DaemonSet reads numberReady vs desiredNumberScheduled, not readyReplicas/spec.replicas', () => {
    const { graph, get } = graphOf([
      { kind: 'DaemonSet', metadata: { uid: 'ds1', name: 'x', namespace: 'ns' }, status: { desiredNumberScheduled: 2, numberReady: 2 } },
    ]);
    expect(resourceFunctional(get('DaemonSet', 'x'), graph)).toBe('working');
  });
});

describe('resourceFunctional — PersistentVolumeClaim', () => {
  it('Bound -> working, Pending -> partial, other/missing -> broken', () => {
    const { graph, get } = graphOf([
      { kind: 'PersistentVolumeClaim', metadata: { uid: 'c1', name: 'bound', namespace: 'ns' }, status: { phase: 'Bound' } },
      { kind: 'PersistentVolumeClaim', metadata: { uid: 'c2', name: 'pending', namespace: 'ns' }, status: { phase: 'Pending' } },
      { kind: 'PersistentVolumeClaim', metadata: { uid: 'c3', name: 'lost', namespace: 'ns' }, status: { phase: 'Lost' } },
    ]);
    expect(resourceFunctional(get('PersistentVolumeClaim', 'bound'), graph)).toBe('working');
    expect(resourceFunctional(get('PersistentVolumeClaim', 'pending'), graph)).toBe('partial');
    expect(resourceFunctional(get('PersistentVolumeClaim', 'lost'), graph)).toBe('broken');
  });
});

describe('resourceFunctional — Job', () => {
  it('succeeded >= completions -> working, failed > 0 -> broken, still running -> partial', () => {
    const { graph, get } = graphOf([
      { kind: 'Job', metadata: { uid: 'j1', name: 'done', namespace: 'ns' }, spec: { completions: 1 }, status: { succeeded: 1 } },
      { kind: 'Job', metadata: { uid: 'j2', name: 'failed', namespace: 'ns' }, spec: { completions: 1 }, status: { failed: 1 } },
      { kind: 'Job', metadata: { uid: 'j3', name: 'running', namespace: 'ns' }, spec: { completions: 1 }, status: {} },
    ]);
    expect(resourceFunctional(get('Job', 'done'), graph)).toBe('working');
    expect(resourceFunctional(get('Job', 'failed'), graph)).toBe('broken');
    expect(resourceFunctional(get('Job', 'running'), graph)).toBe('partial');
  });
});

describe('resourceFunctional — Service', () => {
  const pod: RawObject = { kind: 'Pod', metadata: { uid: 'p1', name: 'web-0', namespace: 'ns' }, status: { phase: 'Running' } };
  const endpoints = (ready: boolean): RawObject => ({
    kind: 'Endpoints',
    metadata: { uid: 'e1', name: 'web', namespace: 'ns' },
    subsets: [ready ? { addresses: [{ targetRef: { kind: 'Pod', uid: 'p1' } }] } : { notReadyAddresses: [{ targetRef: { kind: 'Pod', uid: 'p1' } }] }],
  });
  const svc: RawObject = { kind: 'Service', metadata: { uid: 's1', name: 'web', namespace: 'ns' }, spec: { type: 'ClusterIP', selector: { app: 'web' } } };

  it('at least one ready backing pod -> working (rides the F1 Endpoints/EndpointSlice union)', () => {
    const { graph, get } = graphOf([svc, pod, endpoints(true)]);
    expect(resourceFunctional(get('Service', 'web'), graph)).toBe('working');
  });

  it('backing pods exist but none ready -> partial', () => {
    const { graph, get } = graphOf([svc, pod, endpoints(false)]);
    expect(resourceFunctional(get('Service', 'web'), graph)).toBe('partial');
  });

  it('no backing pods at all -> broken', () => {
    const { graph, get } = graphOf([svc]);
    expect(resourceFunctional(get('Service', 'web'), graph)).toBe('broken');
  });

  it('a selector-less (e.g. ExternalName) Service has nothing to be backed by -> n/a', () => {
    const { graph, get } = graphOf([{ kind: 'Service', metadata: { uid: 's2', name: 'ext', namespace: 'ns' }, spec: { type: 'ExternalName' } }]);
    expect(resourceFunctional(get('Service', 'ext'), graph)).toBe('n/a');
  });
});

describe('resourceFunctional — kinds with no runtime aspect', () => {
  it('ConfigMap/Secret/ServiceAccount/Role all report n/a', () => {
    const { graph, get } = graphOf([
      { kind: 'ConfigMap', metadata: { uid: 'c1', name: 'x', namespace: 'ns' } },
      { kind: 'Secret', metadata: { uid: 's1', name: 'x', namespace: 'ns' } },
      { kind: 'ServiceAccount', metadata: { uid: 'sa1', name: 'x', namespace: 'ns' } },
      { kind: 'Role', metadata: { uid: 'r1', name: 'x', namespace: 'ns' } },
    ]);
    for (const [kind, name] of [
      ['ConfigMap', 'x'],
      ['Secret', 'x'],
      ['ServiceAccount', 'x'],
      ['Role', 'x'],
    ] as const) {
      expect(resourceFunctional(get(kind, name), graph)).toBe('n/a');
    }
  });
});

describe('aggregateFunctional', () => {
  it('one broken makes the whole aggregate broken, regardless of the others', () => {
    expect(aggregateFunctional(['working', 'working', 'broken'])).toBe('broken');
  });

  it('partial wins over working when nothing is broken', () => {
    expect(aggregateFunctional(['working', 'partial', 'n/a'])).toBe('partial');
  });

  it('all n/a stays n/a, not working — no fabricated positive when there is no runtime signal', () => {
    expect(aggregateFunctional(['n/a', 'n/a'])).toBe('n/a');
  });

  it('an empty list is n/a', () => {
    expect(aggregateFunctional([])).toBe('n/a');
  });

  it('n/a mixed with working is working — a conformance-only resource does not block a working verdict', () => {
    expect(aggregateFunctional(['n/a', 'working'])).toBe('working');
  });
});
