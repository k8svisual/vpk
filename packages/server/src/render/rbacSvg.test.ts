import { describe, it, expect } from 'vitest';
import { buildGraph, projectRbacSubject } from '@vpk/core';
import type { RawObject } from '@vpk/core';
import { renderRbacSvg } from './rbacSvg';

const objects: RawObject[] = [
  { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { uid: 'sa1', name: 'my-sa', namespace: 'app-ns' } },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: { uid: 'role1', name: 'edit-pods', namespace: 'app-ns' },
    rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
  },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { uid: 'rb1', name: 'edit-pods-binding', namespace: 'app-ns' },
    roleRef: { kind: 'Role', name: 'edit-pods' },
    subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
  },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: { uid: 'cr1', name: 'view' },
    rules: [{ apiGroups: [''], resources: ['configmaps'], verbs: ['get'] }],
  },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { uid: 'rb2', name: 'view-in-ns', namespace: 'app-ns' },
    roleRef: { kind: 'ClusterRole', name: 'view' },
    subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
  },
  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: { uid: 'crb1', name: 'view-everywhere' },
    roleRef: { kind: 'ClusterRole', name: 'view' },
    subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
  },
];

describe('renderRbacSvg', () => {
  const graph = buildGraph(objects);
  const view = projectRbacSubject(graph, 'ServiceAccount', 'my-sa', 'app-ns');
  const svg = renderRbacSvg(view!);

  it('renders both scope banners and the subject card', () => {
    expect(svg).toContain('Namespace Level');
    expect(svg).toContain('Cluster Level');
    expect(svg).toContain('ServiceAccount: my-sa'.split(':')[0] as string);
    expect(svg).toContain('data-resource-id="sa1"');
  });

  it('makes every binding and role icon clickable with its resource id', () => {
    for (const id of ['rb1', 'rb2', 'crb1', 'role1', 'cr1']) expect(svg).toContain(`data-resource-id="${id}"`);
  });

  it('renders the shared ClusterRole exactly once despite two bindings referencing it', () => {
    expect(svg.split('data-names="[&quot;view&quot;]"').length - 1).toBe(1);
  });

  it('emits effective-permission rows with focus paths into the owning role rules array', () => {
    expect(svg).toContain('Effective permissions (3 rules)');
    expect(svg).toContain('data-focus-path="[&quot;rules&quot;,0]"');
    expect(svg).toContain('cluster-wide');
    expect(svg).toContain('app-ns'); // the namespace-scope pill shows the actual namespace
  });

  it('collapses bindings beyond the cap into a +N more row instead of growing unboundedly', () => {
    const many: RawObject[] = [...objects];
    for (let i = 0; i < 15; i++) {
      many.push({
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: { uid: `rb-extra-${i}`, name: `extra-${i}`, namespace: 'app-ns' },
        roleRef: { kind: 'Role', name: 'edit-pods' },
        subjects: [{ kind: 'ServiceAccount', name: 'my-sa', namespace: 'app-ns' }],
      });
    }
    const bigSvg = renderRbacSvg(projectRbacSubject(buildGraph(many), 'ServiceAccount', 'my-sa', 'app-ns')!);
    expect(bigSvg).toContain('more</text>');
    expect(bigSvg).toContain('RoleBindings (17)');
  });
});
