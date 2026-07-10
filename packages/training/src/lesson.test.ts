import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGraph } from '@vpk/core';
import type { RawObject } from '@vpk/core';
import { evaluateCheck } from './evaluate';
import { blocksOfKind, parseLesson } from './lesson';
import type { ClusterFacts, PureCheck } from './types';

const FULL_LESSON = `---
id: workloads-03-scale
title: Scale a Deployment
difficulty: 2
prereqs: [workloads-02-create]
estimatedMinutes: 15
timeMode: advisory
sandbox: student-workloads-03
answerKey: teacher-workloads-03
passWhen: conformant
floor: standard
allow: [get, describe, scale, edit]
---

Deployments manage replica counts for you. Let's scale one up.

\`\`\`vpk-setup
by: course
apply: fixtures/web-deployment.yaml
into: [student, teacher]
\`\`\`

Run \`kubectl scale deployment web --replicas=3\`.

\`\`\`vpk-check
kind: inventory
namespace: student-workloads-03
expect: { source: answerKey, id: teacher-workloads-03 }
\`\`\`

\`\`\`vpk-teardown
delete-namespace: student-workloads-03
\`\`\`
`;

describe('parseLesson — frontmatter', () => {
  it('parses every documented frontmatter field', () => {
    const { frontmatter } = parseLesson(FULL_LESSON);
    expect(frontmatter).toEqual({
      id: 'workloads-03-scale',
      title: 'Scale a Deployment',
      difficulty: 2,
      prereqs: ['workloads-02-create'],
      estimatedMinutes: 15,
      timeMode: 'advisory',
      sandbox: 'student-workloads-03',
      answerKey: 'teacher-workloads-03',
      passWhen: 'conformant',
      floor: 'standard',
      allow: ['get', 'describe', 'scale', 'edit'],
    });
  });

  it('throws a clear error when there is no frontmatter block at all', () => {
    expect(() => parseLesson('# just a heading\n\nsome prose')).toThrow(/frontmatter/);
  });

  it('throws when required field "id" is missing', () => {
    expect(() => parseLesson('---\ntitle: X\n---\nbody')).toThrow(/"id"/);
  });

  it('throws when required field "title" is missing', () => {
    expect(() => parseLesson('---\nid: x\n---\nbody')).toThrow(/"title"/);
  });

  it('accepts a minimal frontmatter with only the required fields', () => {
    const { frontmatter } = parseLesson('---\nid: x\ntitle: X\n---\nbody');
    expect(frontmatter.id).toBe('x');
    expect(frontmatter.title).toBe('X');
    expect(frontmatter.difficulty).toBeUndefined();
  });
});

describe('parseLesson — segments', () => {
  it('produces prose and block segments in file order', () => {
    const { segments } = parseLesson(FULL_LESSON);
    expect(segments.map((s) => s.type)).toEqual(['prose', 'block', 'prose', 'block', 'block']);
  });

  it('parses each block kind and its YAML content', () => {
    const { segments } = parseLesson(FULL_LESSON);
    const setup = segments[1];
    const check = segments[3];
    const teardown = segments[4];
    expect(setup).toMatchObject({ type: 'block', block: { kind: 'setup', data: { by: 'course', apply: 'fixtures/web-deployment.yaml', into: ['student', 'teacher'] } } });
    expect(check).toMatchObject({
      type: 'block',
      block: { kind: 'check', data: { kind: 'inventory', namespace: 'student-workloads-03', expect: { source: 'answerKey', id: 'teacher-workloads-03' } } },
    });
    expect(teardown).toMatchObject({ type: 'block', block: { kind: 'teardown', data: { 'delete-namespace': 'student-workloads-03' } } });
  });

  it('preserves prose text verbatim (trimmed)', () => {
    const { segments } = parseLesson(FULL_LESSON);
    expect(segments[0]).toEqual({ type: 'prose', markdown: "Deployments manage replica counts for you. Let's scale one up." });
  });

  it('handles a lesson with no fenced blocks at all — just one prose segment', () => {
    const { segments } = parseLesson('---\nid: x\ntitle: X\n---\nJust some prose, nothing fancy.');
    expect(segments).toEqual([{ type: 'prose', markdown: 'Just some prose, nothing fancy.' }]);
  });

  it('handles a lesson that starts immediately with a block, no leading prose', () => {
    const { segments } = parseLesson('---\nid: x\ntitle: X\n---\n```vpk-check\nkind: cluster\nassert: contextReachable\n```\n');
    expect(segments).toEqual([{ type: 'block', block: { kind: 'check', data: { kind: 'cluster', assert: 'contextReachable' } } }]);
  });

  it('handles a block with empty content as undefined data rather than throwing', () => {
    const { segments } = parseLesson('---\nid: x\ntitle: X\n---\n```vpk-detect\n\n```\n');
    expect(segments).toEqual([{ type: 'block', block: { kind: 'detect', data: undefined } }]);
  });

  it('throws a clear error on malformed YAML inside a block', () => {
    const bad = '---\nid: x\ntitle: X\n---\n```vpk-check\nkind: [unterminated\n```\n';
    expect(() => parseLesson(bad)).toThrow(/Malformed vpk-check block/);
  });

  it('supports two blocks of the same kind in one lesson', () => {
    const src = '---\nid: x\ntitle: X\n---\n```vpk-check\nkind: cluster\nassert: contextReachable\n```\n```vpk-check\nkind: cluster\nassert: multiNode\n```\n';
    const { segments } = parseLesson(src);
    expect(segments.filter((s) => s.type === 'block')).toHaveLength(2);
  });
});

describe('blocksOfKind', () => {
  it('returns every block of the requested kind, in order', () => {
    const lesson = parseLesson(FULL_LESSON);
    expect(blocksOfKind(lesson, 'check')).toHaveLength(1);
    expect(blocksOfKind(lesson, 'setup')).toHaveLength(1);
    expect(blocksOfKind(lesson, 'teardown')).toHaveLength(1);
    expect(blocksOfKind(lesson, 'detect')).toHaveLength(0);
    expect(blocksOfKind(lesson, 'quiz')).toHaveLength(0);
  });
});

// Round-trip against the real, authored Lesson Zero content (courses/getting-started/00-get-a-cluster-
// running.md) — catches drift between this module's contract and the actual content the moment either one
// changes, the same way core's projection tests run against real captured snapshots rather than fixtures
// alone.
describe('the real Lesson Zero file (courses/getting-started/00-get-a-cluster-running.md)', () => {
  const source = readFileSync(new URL('../../../courses/getting-started/00-get-a-cluster-running.md', import.meta.url), 'utf8');
  const lesson = parseLesson(source);

  it('parses without throwing and has the expected frontmatter', () => {
    expect(lesson.frontmatter).toMatchObject({
      id: 'getting-started-00-cluster',
      title: 'Get a Cluster Running',
      provisioning: true,
      passWhen: 'functional',
      floor: 'loose',
      timeoutMs: 300000,
      pollMs: 5000,
    });
  });

  it('has exactly one vpk-detect block and two vpk-check blocks, no setup/teardown (nothing to seed pre-cluster)', () => {
    expect(blocksOfKind(lesson, 'detect')).toHaveLength(1);
    expect(blocksOfKind(lesson, 'check')).toHaveLength(2);
    expect(blocksOfKind(lesson, 'setup')).toHaveLength(0);
    expect(blocksOfKind(lesson, 'teardown')).toHaveLength(0);
  });

  it('both check blocks parse as real, evaluatable ClusterChecks — not just arbitrary YAML', () => {
    const checks = blocksOfKind(lesson, 'check').map((b) => b.data as PureCheck);
    const reachable: ClusterFacts = {
      contextReachable: true,
      nodes: { total: 2, ready: 2 },
      capabilities: { multiNode: true },
    };
    for (const check of checks) {
      const result = evaluateCheck(check, { graph: { nodes: new Map(), edges: [], byUid: new Map(), deduped: 0 }, cluster: reachable, answerKey: () => [] });
      expect(result.functional).toBe('working');
    }
  });
});

// Round-trip against the real, ported "Using oc" course (courses/course02/00-using-oc.md) — same discipline
// as Lesson Zero: parse the actual file and run its checks through the REAL evaluator, not just assert the
// YAML happens to look right.
describe('the real "Using oc" course (courses/course02/00-using-oc.md)', () => {
  const source = readFileSync(new URL('../../../courses/course02/00-using-oc.md', import.meta.url), 'utf8');
  const lesson = parseLesson(source);
  const reachable: ClusterFacts = { contextReachable: true, nodes: { total: 1, ready: 1 }, capabilities: { multiNode: true } };

  it('parses with the expected frontmatter, including the oc CLI target', () => {
    expect(lesson.frontmatter).toMatchObject({ id: 'openshift-02-using-oc', title: 'Using the oc CLI', cli: ['oc'] });
  });

  it('has exactly 4 check blocks, no setup/teardown/quiz', () => {
    expect(blocksOfKind(lesson, 'check')).toHaveLength(4);
    expect(blocksOfKind(lesson, 'setup')).toHaveLength(0);
    expect(blocksOfKind(lesson, 'teardown')).toHaveLength(0);
    expect(blocksOfKind(lesson, 'quiz')).toHaveLength(0);
  });

  it('the ClusterCheck evaluates against a reachable cluster', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 'oc-context-reachable')?.data as PureCheck;
    const result = evaluateCheck(check, { graph: buildGraph([]), cluster: reachable, answerKey: () => [] });
    expect(result.functional).toBe('working');
  });

  it('the deployment-created InventoryCheck matches once the Deployment exists and is Ready', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 'oc-deployment-created')?.data as PureCheck;
    const deployment: RawObject = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { uid: 'd1', name: 'oc-course-web', namespace: 'default', labels: { app: 'oc-course' } },
      spec: { replicas: 1 },
      status: { readyReplicas: 1 },
    };
    const result = evaluateCheck(check, { graph: buildGraph([deployment]), cluster: reachable, answerKey: () => [] });
    expect(result.conformance).toBe('matched');
    expect(result.functional).toBe('working');
  });

  it('the labeled/annotated FieldsCheck matches once the pod has both, and diverges when either is missing', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 'oc-pod-labeled-annotated')?.data as PureCheck;
    const labeledPod: RawObject = {
      kind: 'Pod',
      metadata: { uid: 'p1', name: 'oc-course-web-abc', namespace: 'default', labels: { app: 'oc-course', work: 'training' }, annotations: { play: 'gaming' } },
      status: { phase: 'Running' },
    };
    const unlabeledPod: RawObject = {
      kind: 'Pod',
      metadata: { uid: 'p1', name: 'oc-course-web-abc', namespace: 'default', labels: { app: 'oc-course' } },
      status: { phase: 'Running' },
    };
    expect(evaluateCheck(check, { graph: buildGraph([labeledPod]), cluster: reachable, answerKey: () => [] }).conformance).toBe('matched');
    expect(evaluateCheck(check, { graph: buildGraph([unlabeledPod]), cluster: reachable, answerKey: () => [] }).conformance).toBe('divergent');
  });

  it('the cleanup InventoryCheck matches an empty namespace and diverges when the Deployment lingers', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 'oc-cleanup-complete')?.data as PureCheck;
    const leftover: RawObject = { kind: 'Deployment', metadata: { uid: 'd1', name: 'oc-course-web', namespace: 'default' } };
    expect(evaluateCheck(check, { graph: buildGraph([]), cluster: reachable, answerKey: () => [] }).conformance).toBe('matched');
    expect(evaluateCheck(check, { graph: buildGraph([leftover]), cluster: reachable, answerKey: () => [] }).conformance).toBe('divergent');
  });
});

// Round-trip against the real "Using Docker" course (courses/course03/00-using-docker.md) — deliberately
// informational-only (no vpk-check blocks): docker isn't a supported command-runner target (see command.ts's
// checkCommandPolicy, which requires the command to start with the configured kubectl-compatible cli), so
// this course has nothing to grade, only content to work through.
describe('the real "Using Docker" course (courses/course03/00-using-docker.md)', () => {
  const source = readFileSync(new URL('../../../courses/course03/00-using-docker.md', import.meta.url), 'utf8');
  const lesson = parseLesson(source);

  it('parses with the expected frontmatter and no cli override (docker is not kubectl-compatible)', () => {
    expect(lesson.frontmatter).toMatchObject({ id: 'docker-03-using-docker', title: 'Using Docker' });
    expect(lesson.frontmatter.cli).toBeUndefined();
  });

  it('has no check/setup/teardown/quiz/detect blocks — purely informational content', () => {
    for (const kind of ['check', 'setup', 'teardown', 'quiz', 'detect'] as const) {
      expect(blocksOfKind(lesson, kind)).toHaveLength(0);
    }
  });

  it('has a single prose segment (no vpk-* fences) covering all 9 original tasks', () => {
    expect(lesson.segments).toHaveLength(1);
    expect(lesson.segments[0]?.type).toBe('prose');
    for (const heading of ['Info', 'Pull', 'Dockerfile', 'Build', 'Run', 'History', 'Stats', 'Inspect', 'Events']) {
      expect((lesson.segments[0] as { type: 'prose'; markdown: string }).markdown).toContain(`## ${heading}`);
    }
  });
});

// Round-trip against the real "Troubleshooting" course (courses/course04/00-troubleshooting.md) — 17 labs
// ported from the original's diagnose-and-fix format. Most labs get a real InventoryCheck/FieldsCheck/
// ValueCheck; Routes (OpenShift-only) and Forward (streaming port-forward) are reference-only with no check.
describe('the real "Troubleshooting" course (courses/course04/00-troubleshooting.md)', () => {
  const source = readFileSync(new URL('../../../courses/course04/00-troubleshooting.md', import.meta.url), 'utf8');
  const lesson = parseLesson(source);
  const reachable: ClusterFacts = { contextReachable: true, nodes: { total: 1, ready: 1 }, capabilities: { multiNode: true } };

  it('parses with the expected frontmatter, including the oc CLI target', () => {
    expect(lesson.frontmatter).toMatchObject({ id: 'troubleshooting-04-diagnose-and-fix', title: 'Troubleshooting Kubernetes', cli: ['oc'] });
  });

  it('has exactly 15 check blocks (context-reachable + one per fully-portable lab)', () => {
    expect(blocksOfKind(lesson, 'check')).toHaveLength(15);
  });

  it('the ClusterCheck evaluates against a reachable cluster', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 't-context-reachable')?.data as PureCheck;
    const result = evaluateCheck(check, { graph: buildGraph([]), cluster: reachable, answerKey: () => [] });
    expect(result.functional).toBe('working');
  });

  it('t-create InventoryCheck matches once the Deployment exists and is Ready', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 't-create-deployed')?.data as PureCheck;
    const deployment: RawObject = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { uid: 'd1', name: 't-create', namespace: 'default', labels: { app: 't-create' } },
      spec: { replicas: 1 },
      status: { readyReplicas: 1 },
    };
    const result = evaluateCheck(check, { graph: buildGraph([deployment]), cluster: reachable, answerKey: () => [] });
    expect(result.conformance).toBe('matched');
    expect(result.functional).toBe('working');
  });

  it('t-networking ValueCheck matches when targetPort equals 80, diverges when it does not', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 't-networking-port-correct')?.data as PureCheck;
    const fixedSvc: RawObject = {
      kind: 'Service',
      metadata: { uid: 's1', name: 't-networking', namespace: 'default' },
      spec: { ports: [{ port: 80, targetPort: 80 }] },
    };
    const brokenSvc: RawObject = {
      kind: 'Service',
      metadata: { uid: 's1', name: 't-networking', namespace: 'default' },
      spec: { ports: [{ port: 80, targetPort: 8080 }] },
    };
    expect(evaluateCheck(check, { graph: buildGraph([fixedSvc]), cluster: reachable, answerKey: () => [] }).conformance).toBe('matched');
    expect(evaluateCheck(check, { graph: buildGraph([brokenSvc]), cluster: reachable, answerKey: () => [] }).conformance).toBe('divergent');
  });

  it('t-downward ValueCheck matches once request equals limit, diverges when they differ', () => {
    const check = blocksOfKind(lesson, 'check').find((b) => (b.data as PureCheck).id === 't-downward-healthy')?.data as PureCheck;
    const fixedDeploy: RawObject = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { uid: 'd1', name: 't-downward', namespace: 'default' },
      spec: { template: { spec: { containers: [{ name: 'web', resources: { requests: { memory: '64Mi' }, limits: { memory: '64Mi' } } }] } } },
    };
    const brokenDeploy: RawObject = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { uid: 'd1', name: 't-downward', namespace: 'default' },
      spec: { template: { spec: { containers: [{ name: 'web', resources: { requests: { memory: '32Mi' }, limits: { memory: '64Mi' } } }] } } },
    };
    expect(evaluateCheck(check, { graph: buildGraph([fixedDeploy]), cluster: reachable, answerKey: () => [] }).conformance).toBe('matched');
    expect(evaluateCheck(check, { graph: buildGraph([brokenDeploy]), cluster: reachable, answerKey: () => [] }).conformance).toBe('divergent');
  });

  it('Routes and Forward labs have no check blocks (OpenShift-only / streaming command)', () => {
    const checkIds = blocksOfKind(lesson, 'check').map((b) => (b.data as PureCheck).id);
    expect(checkIds).not.toContain('t-routes-healthy');
    expect(checkIds).not.toContain('t-forward-healthy');
  });
});
