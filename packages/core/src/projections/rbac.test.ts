import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectRbacSubject } from './rbac';
import type { RawObject } from '../types';

const sa: RawObject = {
  apiVersion: 'v1',
  kind: 'ServiceAccount',
  metadata: { uid: 'sa1', name: 'my-sa', namespace: 'app-ns' },
};
const role: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'Role',
  metadata: { uid: 'role1', name: 'edit-pods', namespace: 'app-ns' },
  rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] }],
};
const roleBinding: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'RoleBinding',
  metadata: { uid: 'rb1', name: 'edit-pods-binding', namespace: 'app-ns' },
  roleRef: { kind: 'Role', name: 'edit-pods' },
  subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
};
// The one-object-two-scopes case: ONE ClusterRole referenced BOTH by a RoleBinding (namespace-scoped grant)
// and by a ClusterRoleBinding (cluster-wide grant).
const clusterRole: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'ClusterRole',
  metadata: { uid: 'cr1', name: 'view' },
  rules: [{ apiGroups: [''], resources: ['configmaps'], verbs: ['get'] }],
};
const roleBindingToClusterRole: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'RoleBinding',
  metadata: { uid: 'rb2', name: 'view-in-ns', namespace: 'app-ns' },
  roleRef: { kind: 'ClusterRole', name: 'view' },
  subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
};
const clusterRoleBinding: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'ClusterRoleBinding',
  metadata: { uid: 'crb1', name: 'view-everywhere' },
  roleRef: { kind: 'ClusterRole', name: 'view' },
  subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
};

describe('projectRbacSubject', () => {
  const g = buildGraph([sa, role, roleBinding, clusterRole, roleBindingToClusterRole, clusterRoleBinding]);
  const view = projectRbacSubject(g, 'ServiceAccount', 'my-sa', 'app-ns');

  it('resolves the subject with its own ServiceAccount resource id', () => {
    expect(view?.subject).toEqual({ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns', id: 'sa1' });
  });

  it('splits bindings by kind and dedupes the shared ClusterRole into one node', () => {
    expect(view?.roleBindings.map((b) => b.name).sort()).toEqual(['edit-pods-binding', 'view-in-ns']);
    expect(view?.clusterRoleBindings.map((b) => b.name)).toEqual(['view-everywhere']);
    expect(view?.roles.map((r) => r.name)).toEqual(['edit-pods']);
    // 'view' is referenced by BOTH rb2 and crb1 — one ClusterRole node, not two.
    expect(view?.clusterRoles).toHaveLength(1);
    expect(view?.clusterRoles[0]?.name).toBe('view');
  });

  it('keeps the same ClusterRole rule at BOTH scopes — namespace via RoleBinding, cluster via ClusterRoleBinding', () => {
    const viewRules = view?.rules.filter((r) => r.resources.includes('configmaps')) ?? [];
    expect(viewRules).toHaveLength(2);
    expect(viewRules.map((r) => r.scope).sort()).toEqual(['cluster', 'namespace']);
    const nsRule = viewRules.find((r) => r.scope === 'namespace');
    expect(nsRule?.namespace).toBe('app-ns');
    expect(nsRule?.roleId).toBe('cr1');
  });

  it('orders namespace-scoped rules before cluster-wide ones and carries the rule index for focus paths', () => {
    const scopes = view?.rules.map((r) => r.scope) ?? [];
    expect(scopes.indexOf('cluster')).toBeGreaterThan(scopes.lastIndexOf('namespace') === -1 ? -1 : 0);
    for (const r of view?.rules ?? []) expect(r.ruleIndex).toBe(0); // all fixture roles have a single rule
  });

  it('returns undefined for a subject no binding grants to', () => {
    expect(projectRbacSubject(g, 'ServiceAccount', 'nobody', 'app-ns')).toBeUndefined();
  });
});
