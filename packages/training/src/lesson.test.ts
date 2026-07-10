import { describe, expect, it } from 'vitest';
import { blocksOfKind, parseLesson } from './lesson';

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
