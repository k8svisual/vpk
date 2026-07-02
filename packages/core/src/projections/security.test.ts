import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { projectSecuritySubjects } from './security';
import type { RawObject } from '../types';

const role: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'Role',
  metadata: { uid: 'role1', name: 'kube-proxy', namespace: 'kube-system' },
  rules: [{ apiGroups: [''], resources: ['configmaps'], verbs: ['get'], resourceNames: ['kube-proxy'] }],
};
const roleBinding: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'RoleBinding',
  metadata: { uid: 'rb1', name: 'kube-proxy', namespace: 'kube-system' },
  roleRef: { kind: 'Role', name: 'kube-proxy', apiGroup: 'rbac.authorization.k8s.io' },
  subjects: [{ kind: 'Group', name: 'system:bootstrappers:kubeadm:default-node-token' }],
};
const clusterRole: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'ClusterRole',
  metadata: { uid: 'crole1', name: 'cluster-admin' },
  rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }],
};
const clusterRoleBinding: RawObject = {
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'ClusterRoleBinding',
  metadata: { uid: 'crb1', name: 'cluster-admin' },
  roleRef: { kind: 'ClusterRole', name: 'cluster-admin', apiGroup: 'rbac.authorization.k8s.io' },
  subjects: [{ kind: 'ServiceAccount', name: 'default', namespace: 'kube-system' }],
};

describe('projectSecuritySubjects', () => {
  const g = buildGraph([role, roleBinding, clusterRole, clusterRoleBinding]);
  const subjects = projectSecuritySubjects(g);

  it('resolves a Role-scoped RoleBinding subject with the Role rules attached', () => {
    const group = subjects.find((s) => s.kind === 'Group');
    expect(group?.name).toBe('system:bootstrappers:kubeadm:default-node-token');
    expect(group?.bindings).toHaveLength(1);
    const binding = group?.bindings[0];
    expect(binding?.bindingKind).toBe('RoleBinding');
    expect(binding?.roleId).toBe('role1');
    expect(binding?.rules).toEqual(role.rules);
  });

  it('resolves a ClusterRole-scoped ClusterRoleBinding subject, tracking the ServiceAccount namespace', () => {
    const sa = subjects.find((s) => s.kind === 'ServiceAccount');
    expect(sa?.namespace).toBe('kube-system');
    const binding = sa?.bindings[0];
    expect(binding?.bindingKind).toBe('ClusterRoleBinding');
    expect(binding?.roleId).toBe('crole1');
    expect(binding?.rules).toEqual(clusterRole.rules);
  });

  it('leaves rules empty (not a crash) when the referenced Role/ClusterRole is absent from the snapshot', () => {
    const dangling: RawObject = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { uid: 'rb2', name: 'ghost-binding', namespace: 'ns' },
      roleRef: { kind: 'Role', name: 'ghost-role' },
      subjects: [{ kind: 'User', name: 'alice' }],
    };
    const g2 = buildGraph([dangling]);
    const alice = projectSecuritySubjects(g2).find((s) => s.name === 'alice');
    expect(alice?.bindings[0]?.rules).toEqual([]);
    expect(alice?.bindings[0]?.roleId).toBeUndefined();
  });
});
