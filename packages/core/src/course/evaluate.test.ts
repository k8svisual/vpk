import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import type { RawObject } from '../types';
import { clampToFloor, evaluateCheck, evaluateStep } from './evaluate';
import type { CheckContext, ClusterFacts, PureCheck } from './types';

const READY_CLUSTER: ClusterFacts = {
  contextReachable: true,
  serverVersion: 'v1.28.3',
  nodes: { total: 2, ready: 2 },
  provisioner: 'minikube',
  capabilities: { multiNode: true },
};

function ctx(objects: RawObject[], overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    graph: buildGraph(objects),
    cluster: READY_CLUSTER,
    answerKey: () => [],
    ...overrides,
  };
}

const deployment: RawObject = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { uid: 'd1', name: 'web', namespace: 'student-x' },
  spec: { replicas: 3, selector: { matchLabels: { app: 'web' } }, template: { spec: { containers: [{ name: 'web', image: 'nginx:1.25' }] } } },
};
const service: RawObject = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: 's1', name: 'web', namespace: 'student-x' },
  spec: { type: 'ClusterIP', selector: { app: 'web' } },
};

// ---------------------------------------------------------------------------------------------------------
// ClusterCheck
// ---------------------------------------------------------------------------------------------------------

describe('evaluateCheck — cluster', () => {
  it('contextReachable passes/fails on the cluster fact', () => {
    const passing = evaluateCheck({ id: 'c1', kind: 'cluster', describe: 'reachable', assert: 'contextReachable' }, ctx([]));
    expect(passing.functional).toBe('working');
    expect(passing.conformance).toBe('matched');

    const unreachable = ctx([], { cluster: { ...READY_CLUSTER, contextReachable: false } });
    const failing = evaluateCheck({ id: 'c1', kind: 'cluster', describe: 'reachable', assert: 'contextReachable' }, unreachable);
    expect(failing.functional).toBe('broken');
    // Always 'matched', even on failure — a cluster fact has nothing to structurally diverge from; the
    // failure is carried entirely by `functional`. See evaluateClusterCheck's own comment for why this
    // matters to evaluateStep's synthesis (a failing ClusterCheck must not read as "resource missing").
    expect(failing.conformance).toBe('matched');
  });

  it('nodesReady compares against the live count', () => {
    const check: PureCheck = { id: 'c2', kind: 'cluster', describe: '2 nodes', assert: { nodesReady: 2 } };
    expect(evaluateCheck(check, ctx([])).functional).toBe('working');
    const oneReady = ctx([], { cluster: { ...READY_CLUSTER, nodes: { total: 2, ready: 1 } } });
    expect(evaluateCheck(check, oneReady).functional).toBe('broken');
  });

  it('multiNode fails on a single-node (e.g. Docker Desktop) capability set', () => {
    const check: PureCheck = { id: 'c3', kind: 'cluster', describe: 'multi-node', assert: 'multiNode' };
    const dockerDesktop = ctx([], { cluster: { ...READY_CLUSTER, provisioner: 'docker-desktop', capabilities: { multiNode: false } } });
    expect(evaluateCheck(check, dockerDesktop).functional).toBe('broken');
    expect(evaluateCheck(check, ctx([])).functional).toBe('working');
  });

  it('serverVersionAtLeast does a major.minor.patch comparison', () => {
    const check: PureCheck = { id: 'c4', kind: 'cluster', describe: 'version', assert: { serverVersionAtLeast: '1.28.0' } };
    expect(evaluateCheck(check, ctx([])).functional).toBe('working');
    const older = ctx([], { cluster: { ...READY_CLUSTER, serverVersion: 'v1.27.9' } });
    expect(evaluateCheck(check, older).functional).toBe('broken');
    const unknown = ctx([], { cluster: { ...READY_CLUSTER, serverVersion: undefined } });
    expect(evaluateCheck(check, unknown).functional).toBe('broken');
  });
});

// ---------------------------------------------------------------------------------------------------------
// InventoryCheck
// ---------------------------------------------------------------------------------------------------------

describe('evaluateCheck — inventory', () => {
  const check: PureCheck = {
    id: 'inv1',
    kind: 'inventory',
    describe: 'expected resources',
    namespace: 'student-x',
    expect: { source: 'literal', value: { Deployment: 1, Service: 1 } },
  };

  it('matches when kinds and counts line up', () => {
    const result = evaluateCheck(check, ctx([deployment, service]));
    expect(result.conformance).toBe('matched');
    expect(result.findings.every((f) => f.status === 'ok')).toBe(true);
  });

  it('is missing (not just divergent) when an expected kind is entirely absent', () => {
    const result = evaluateCheck(check, ctx([deployment]));
    expect(result.conformance).toBe('missing');
    const kindsFindings = result.findings.filter((f) => f.tier === 'kinds' && f.status === 'mismatch');
    expect(kindsFindings).toHaveLength(1);
    expect(kindsFindings[0]?.detail).toMatchObject({ kind: 'Service', expected: 1, actual: 0 });
  });

  it('is divergent (not missing) when the kind exists but the count differs', () => {
    const two = { ...deployment, metadata: { ...deployment.metadata, uid: 'd2', name: 'web2' } } as RawObject;
    const result = evaluateCheck(check, ctx([deployment, two, service]));
    expect(result.conformance).toBe('divergent');
    const countFindings = result.findings.filter((f) => f.tier === 'counts' && f.status === 'mismatch');
    expect(countFindings).toHaveLength(1);
    expect(countFindings[0]?.detail).toMatchObject({ kind: 'Deployment', expected: 1, actual: 2 });
  });

  it('flags an unexpected extra kind as a counts mismatch, not silently ignored', () => {
    const configMap: RawObject = { kind: 'ConfigMap', metadata: { uid: 'cm1', name: 'extra', namespace: 'student-x' } };
    const result = evaluateCheck(check, ctx([deployment, service, configMap]));
    expect(result.conformance).toBe('divergent');
    expect(result.findings.some((f) => f.detail.kind === 'ConfigMap' && f.status === 'mismatch')).toBe(true);
  });

  it('resolves an answerKey expectation from the authored fixture, not live objects', () => {
    const answerKeyCheck: PureCheck = {
      id: 'inv2',
      kind: 'inventory',
      describe: 'matches teacher fixture',
      namespace: 'student-x',
      expect: { source: 'answerKey', id: 'teacher-fixture' },
    };
    const withAnswerKey = ctx([deployment, service], { answerKey: (id) => (id === 'teacher-fixture' ? [deployment, service] : []) });
    expect(evaluateCheck(answerKeyCheck, withAnswerKey).conformance).toBe('matched');
  });

  it('resolves a compareNamespace expectation live-vs-live', () => {
    const teacherDeploy = { ...deployment, metadata: { ...deployment.metadata, uid: 'td1', namespace: 'teacher-x' } } as RawObject;
    const compareCheck: PureCheck = {
      id: 'inv3',
      kind: 'inventory',
      describe: 'matches teacher namespace',
      namespace: 'student-x',
      expect: { source: 'compareNamespace', namespace: 'teacher-x' },
    };
    // student only has the Deployment, teacher also has it — but not the Service, so still matched
    expect(evaluateCheck(compareCheck, ctx([deployment, teacherDeploy])).conformance).toBe('matched');
  });
});

// ---------------------------------------------------------------------------------------------------------
// FieldsCheck
// ---------------------------------------------------------------------------------------------------------

describe('evaluateCheck — fields', () => {
  it('matches when every declared path is present, literal expectation', () => {
    const check: PureCheck = {
      id: 'f1',
      kind: 'fields',
      describe: 'required fields',
      namespace: 'student-x',
      expect: { source: 'literal', value: [{ select: { kind: 'Deployment' }, paths: ['.spec.replicas', '.spec.template.spec.containers[*].image'] }] },
    };
    expect(evaluateCheck(check, ctx([deployment])).conformance).toBe('matched');
  });

  it('is divergent when the resource exists but a required field is missing', () => {
    const bare: RawObject = { ...deployment, spec: { replicas: 1 } };
    const check: PureCheck = {
      id: 'f2',
      kind: 'fields',
      describe: 'required fields',
      namespace: 'student-x',
      expect: { source: 'literal', value: [{ select: { kind: 'Deployment' }, paths: ['.spec.selector.matchLabels.app'] }] },
    };
    const result = evaluateCheck(check, ctx([bare]));
    expect(result.conformance).toBe('divergent');
  });

  it('is missing when the selected resource does not exist at all', () => {
    const check: PureCheck = {
      id: 'f3',
      kind: 'fields',
      describe: 'required fields',
      namespace: 'student-x',
      expect: { source: 'literal', value: [{ select: { kind: 'Deployment' }, paths: ['.spec.replicas'] }] },
    };
    expect(evaluateCheck(check, ctx([])).conformance).toBe('missing');
  });

  it('answerKey source auto-derives the checklist from the teacher fixture', () => {
    const studentMissingSelector: RawObject = {
      ...deployment,
      spec: { replicas: 3, template: { spec: { containers: [{ name: 'web', image: 'nginx:1.25' }] } } },
    };
    const check: PureCheck = {
      id: 'f4',
      kind: 'fields',
      describe: 'matches teacher required fields',
      namespace: 'student-x',
      expect: { source: 'answerKey', id: 'teacher-fixture' },
    };
    const withAnswerKey = ctx([studentMissingSelector], { answerKey: () => [deployment] });
    const result = evaluateCheck(check, withAnswerKey);
    expect(result.conformance).toBe('divergent');
    expect(result.findings.some((f) => (f.detail.path as string)?.includes('selector'))).toBe(true);
  });

  it('compareNamespace is deliberately unimplemented pending the live-vs-live canonicalizer (§7.4)', () => {
    const check: PureCheck = {
      id: 'f5',
      kind: 'fields',
      describe: 'live compare',
      namespace: 'student-x',
      expect: { source: 'compareNamespace', namespace: 'teacher-x' },
    };
    expect(() => evaluateCheck(check, ctx([deployment]))).toThrow(/canonicalizer/);
  });
});

// ---------------------------------------------------------------------------------------------------------
// ValueCheck
// ---------------------------------------------------------------------------------------------------------

describe('evaluateCheck — value (pinned)', () => {
  it('matches an exact-equality assertion', () => {
    const check: PureCheck = {
      id: 'v1',
      kind: 'value',
      describe: 'replicas pinned',
      namespace: 'student-x',
      assert: [{ select: { kind: 'Deployment' }, path: '.spec.replicas', op: '==', value: 3 }],
    };
    expect(evaluateCheck(check, ctx([deployment])).conformance).toBe('matched');
  });

  it('supports >= / <= / matches operators', () => {
    const ge: PureCheck = { id: 'v2', kind: 'value', describe: '>=', namespace: 'student-x', assert: [{ select: { kind: 'Deployment' }, path: '.spec.replicas', op: '>=', value: 2 }] };
    const le: PureCheck = { id: 'v3', kind: 'value', describe: '<=', namespace: 'student-x', assert: [{ select: { kind: 'Deployment' }, path: '.spec.replicas', op: '<=', value: 2 }] };
    const matches: PureCheck = {
      id: 'v4',
      kind: 'value',
      describe: 'regex',
      namespace: 'student-x',
      assert: [{ select: { kind: 'Deployment' }, path: '.spec.template.spec.containers[*].image', op: 'matches', value: '^nginx:' }],
    };
    expect(evaluateCheck(ge, ctx([deployment])).conformance).toBe('matched');
    expect(evaluateCheck(le, ctx([deployment])).conformance).toBe('divergent');
    expect(evaluateCheck(matches, ctx([deployment])).conformance).toBe('matched');
  });

  it('is missing when the selected resource does not exist', () => {
    const check: PureCheck = { id: 'v5', kind: 'value', describe: 'x', namespace: 'student-x', assert: [{ select: { kind: 'Deployment' }, path: '.spec.replicas', op: '==', value: 3 }] };
    expect(evaluateCheck(check, ctx([])).conformance).toBe('missing');
  });
});

// ---------------------------------------------------------------------------------------------------------
// clampToFloor
// ---------------------------------------------------------------------------------------------------------

describe('clampToFloor', () => {
  it('leaves strictness alone when at/above the floor', () => {
    expect(clampToFloor('strict', 'standard')).toBe('strict');
    expect(clampToFloor('standard', 'standard')).toBe('standard');
  });

  it('raises strictness up to the floor when below it', () => {
    expect(clampToFloor('loose', 'strict')).toBe('strict');
  });
});

// ---------------------------------------------------------------------------------------------------------
// evaluateStep — synthesis
// ---------------------------------------------------------------------------------------------------------

describe('evaluateStep', () => {
  const inventoryMatch: PureCheck = {
    id: 'inv',
    kind: 'inventory',
    describe: 'inventory',
    namespace: 'student-x',
    expect: { source: 'literal', value: { Deployment: 1 } },
  };
  const inventoryDivergentKind: PureCheck = {
    id: 'inv',
    kind: 'inventory',
    describe: 'inventory',
    namespace: 'student-x',
    expect: { source: 'literal', value: { Deployment: 1, Service: 1 } }, // student never created a Service
  };
  const clusterBroken: PureCheck = { id: 'cl', kind: 'cluster', describe: 'reachable', assert: 'contextReachable' };

  it('matched: every check working (or n/a) and fully conformant', () => {
    const step = evaluateStep([inventoryMatch], ctx([deployment]), { strictness: 'strict', passWhen: 'conformant', floor: 'loose' });
    expect(step.level).toBe('matched');
    expect(step.status).toBe('pass');
    expect(step.feedback).toEqual([]);
  });

  it('working-with-differences: divergent but nothing broken — student built something extra/different that still works', () => {
    // student has BOTH kinds required but with a count mismatch (divergent, not missing) — nothing 'broken'.
    const withExtra = [deployment, { ...deployment, metadata: { ...deployment.metadata, uid: 'd2', name: 'web2' } } as RawObject];
    const check: PureCheck = { id: 'inv', kind: 'inventory', describe: 'inventory', namespace: 'student-x', expect: { source: 'literal', value: { Deployment: 1 } } };
    const step = evaluateStep([check], ctx(withExtra), { strictness: 'strict', passWhen: 'functional', floor: 'loose' });
    expect(step.level).toBe('working-with-differences');
    expect(step.status).toBe('pass'); // passWhen: functional — divergence doesn't block progress
    expect(step.feedback.some((f) => f.severity === 'difference')).toBe(true);
  });

  it('incomplete: a required resource is entirely missing', () => {
    const step = evaluateStep([inventoryDivergentKind], ctx([deployment]), { strictness: 'loose', passWhen: 'functional', floor: 'loose' });
    expect(step.level).toBe('incomplete');
    expect(step.status).toBe('fail');
  });

  it('not-yet-working: a check with real functional signal (cluster) is broken', () => {
    const unreachable = ctx([deployment], { cluster: { ...READY_CLUSTER, contextReachable: false } });
    const step = evaluateStep([clusterBroken, inventoryMatch], unreachable, { strictness: 'loose', passWhen: 'functional', floor: 'loose' });
    expect(step.level).toBe('not-yet-working');
    expect(step.status).toBe('fail');
  });

  it('passWhen "conformant" requires full match even if functional would already pass', () => {
    const withExtra = [deployment, { ...deployment, metadata: { ...deployment.metadata, uid: 'd2', name: 'web2' } } as RawObject];
    const check: PureCheck = { id: 'inv', kind: 'inventory', describe: 'inventory', namespace: 'student-x', expect: { source: 'literal', value: { Deployment: 1 } } };
    const functionalStep = evaluateStep([check], ctx(withExtra), { strictness: 'strict', passWhen: 'functional', floor: 'loose' });
    const conformantStep = evaluateStep([check], ctx(withExtra), { strictness: 'strict', passWhen: 'conformant', floor: 'loose' });
    expect(functionalStep.status).toBe('pass');
    expect(conformantStep.status).toBe('fail');
  });

  it('strictness gates which findings read as "difference" vs "tip"', () => {
    // a count mismatch (counts tier) at loose strictness is a tip (not gating); at standard it's a difference.
    const withExtra = [deployment, { ...deployment, metadata: { ...deployment.metadata, uid: 'd2', name: 'web2' } } as RawObject];
    const check: PureCheck = { id: 'inv', kind: 'inventory', describe: 'inventory', namespace: 'student-x', expect: { source: 'literal', value: { Deployment: 1 } } };
    const loose = evaluateStep([check], ctx(withExtra), { strictness: 'loose', passWhen: 'functional', floor: 'loose' });
    const standard = evaluateStep([check], ctx(withExtra), { strictness: 'standard', passWhen: 'functional', floor: 'loose' });
    expect(loose.feedback.find((f) => f.message.includes('Deployment'))?.severity).toBe('tip');
    expect(standard.feedback.find((f) => f.message.includes('Deployment'))?.severity).toBe('difference');
  });

  it('the lesson floor clamps a looser student choice up before gating', () => {
    // student picks 'loose', but the lesson floor is 'standard' — the count mismatch must still gate.
    const withExtra = [deployment, { ...deployment, metadata: { ...deployment.metadata, uid: 'd2', name: 'web2' } } as RawObject];
    const check: PureCheck = { id: 'inv', kind: 'inventory', describe: 'inventory', namespace: 'student-x', expect: { source: 'literal', value: { Deployment: 1 } } };
    const step = evaluateStep([check], ctx(withExtra), { strictness: 'loose', passWhen: 'conformant', floor: 'standard' });
    expect(step.status).toBe('fail');
    expect(step.feedback.find((f) => f.message.includes('Deployment'))?.severity).toBe('difference');
  });

  it('feedback is ordered blocker before difference before tip', () => {
    const unreachable = ctx([deployment], { cluster: { ...READY_CLUSTER, contextReachable: false } });
    const withExtraCheck: PureCheck = { id: 'inv', kind: 'inventory', describe: 'inventory', namespace: 'student-x', expect: { source: 'literal', value: { Deployment: 1, Service: 1 } } };
    const step = evaluateStep([clusterBroken, withExtraCheck], unreachable, { strictness: 'loose', passWhen: 'functional', floor: 'loose' });
    const severities = step.feedback.map((f) => f.severity);
    const sorted = [...severities].sort((a, b) => ({ blocker: 0, difference: 1, tip: 2 })[a] - ({ blocker: 0, difference: 1, tip: 2 })[b]);
    expect(severities).toEqual(sorted);
  });
});
