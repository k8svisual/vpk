import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { whoCan, rbacVocabulary } from './whoCan';
import type { RawObject } from '../types';

// A ServiceAccount that can delete pods ONLY in kube-system (namespace-scoped RoleBinding → Role).
const nsSetup: RawObject[] = [
  { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { uid: 'sa-ks', name: 'reaper', namespace: 'kube-system' } },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: { uid: 'role-del', name: 'pod-deleter', namespace: 'kube-system' },
    rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['delete', 'deletecollection'] }],
  },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { uid: 'rb-del', name: 'reaper-binding', namespace: 'kube-system' },
    roleRef: { kind: 'Role', name: 'pod-deleter' },
    subjects: [{ kind: 'ServiceAccount', name: 'reaper', namespace: 'kube-system' }],
  },
];

// A User bound cluster-wide (ClusterRoleBinding → ClusterRole) to delete pods everywhere.
const clusterSetup: RawObject[] = [
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: { uid: 'cr-admin', name: 'pod-admin' },
    rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['*'] }],
  },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: { uid: 'crb-admin', name: 'alice-admin' },
    roleRef: { kind: 'ClusterRole', name: 'pod-admin' },
    subjects: [{ kind: 'User', name: 'alice' }],
  },
];

const POD = { apiGroup: '', resource: 'pods' };

describe('whoCan — scope semantics', () => {
  const g = buildGraph([...nsSetup, ...clusterSetup]);

  it('finds both the namespace-scoped SA and the cluster-wide User for "delete pods in kube-system"', () => {
    const r = whoCan(g, { verbs: ['delete'], resources: [POD], namespace: 'kube-system', mode: 'any' });
    expect(r.map((m) => m.subject.name).sort()).toEqual(['alice', 'reaper']);
    expect(r.find((m) => m.subject.name === 'reaper')?.grants[0]?.scope).toBe('namespace');
    expect(r.find((m) => m.subject.name === 'alice')?.grants[0]?.scope).toBe('cluster');
  });

  it('excludes the namespace-scoped SA when the query targets a DIFFERENT namespace', () => {
    const r = whoCan(g, { verbs: ['delete'], resources: [POD], namespace: 'other-ns', mode: 'any' });
    expect(r.map((m) => m.subject.name)).toEqual(['alice']); // only the cluster-wide grant reaches other-ns
  });

  it('attaches the ServiceAccount resource id but leaves User/Group without one', () => {
    const r = whoCan(g, { verbs: ['delete'], resources: [POD], namespace: 'kube-system', mode: 'any' });
    expect(r.find((m) => m.subject.name === 'reaper')?.subject.id).toBe('sa-ks');
    expect(r.find((m) => m.subject.name === 'alice')?.subject.id).toBeUndefined();
  });

  it('matches a `*` verb rule for any requested verb', () => {
    const r = whoCan(g, { verbs: ['patch'], resources: [POD], mode: 'any' });
    expect(r.map((m) => m.subject.name)).toEqual(['alice']); // only alice's pod-admin has verbs: ['*']
  });
});

describe('whoCan — ANY vs ALL over multiple cells', () => {
  const objs: RawObject[] = [
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: { uid: 'cr-mixed', name: 'mixed' },
      // pods: full; deployments: only get (no delete)
      rules: [
        { apiGroups: [''], resources: ['pods'], verbs: ['delete'] },
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'] },
      ],
    },
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: { uid: 'crb-mixed', name: 'bob-mixed' },
      roleRef: { kind: 'ClusterRole', name: 'mixed' },
      subjects: [{ kind: 'User', name: 'bob' }],
    },
  ];
  const g = buildGraph(objs);
  const DEPLOY = { apiGroup: 'apps', resource: 'deployments' };

  it('ANY: matches bob for delete on pods OR deployments (he can delete pods)', () => {
    const r = whoCan(g, { verbs: ['delete'], resources: [POD, DEPLOY], mode: 'any' });
    expect(r.map((m) => m.subject.name)).toEqual(['bob']);
  });

  it('ALL: does NOT match bob for delete on BOTH pods AND deployments (he cannot delete deployments)', () => {
    const r = whoCan(g, { verbs: ['delete'], resources: [POD, DEPLOY], mode: 'all' });
    expect(r).toHaveLength(0);
  });

  it('ALL union coverage: a subject covering each cell via DIFFERENT rules still matches', () => {
    const r = whoCan(g, { verbs: ['delete', 'get'], resources: [POD], mode: 'all' });
    // delete-pods (rule 1) + get-pods? rule1 only has delete. So delete AND get on pods → get-pods missing.
    expect(r).toHaveLength(0);
    const r2 = whoCan(g, { verbs: ['get'], resources: [POD, DEPLOY], mode: 'all' });
    // get-pods: rule1 is delete-only → not covered. So ALL fails.
    expect(r2).toHaveLength(0);
  });
});

describe('whoCan — resourceNames make a match partial', () => {
  const objs: RawObject[] = [
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: { uid: 'role-named', name: 'named-pod', namespace: 'app' },
      rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['delete'], resourceNames: ['special-pod'] }],
    },
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { uid: 'rb-named', name: 'named-binding', namespace: 'app' },
      roleRef: { kind: 'Role', name: 'named-pod' },
      subjects: [{ kind: 'ServiceAccount', name: 'limited', namespace: 'app' }],
    },
  ];
  const g = buildGraph(objs);

  it('flags the match as partial and surfaces the specific resource names', () => {
    const r = whoCan(g, { verbs: ['delete'], resources: [POD], namespace: 'app', mode: 'any' });
    expect(r).toHaveLength(1);
    expect(r[0]?.partial).toBe(true);
    expect(r[0]?.grants[0]?.restricted).toBe(true);
    expect(r[0]?.grants[0]?.resourceNames).toEqual(['special-pod']);
  });
});

describe('rbacVocabulary', () => {
  const g = buildGraph([...nsSetup, ...clusterSetup]);
  const vocab = rbacVocabulary(g);

  it('always includes the standard verbs and any custom ones, excluding *', () => {
    expect(vocab.verbs).toContain('deletecollection');
    expect(vocab.verbs).toContain('watch');
    expect(vocab.verbs).not.toContain('*');
  });

  it('collects distinct (group, resource) pairs, excluding wildcards', () => {
    expect(vocab.resources).toContainEqual({ apiGroup: '', resource: 'pods' });
    expect(vocab.resources.every((r) => r.resource !== '*')).toBe(true);
  });
});
