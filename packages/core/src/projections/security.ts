import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

interface RbacSubjectRaw {
  kind?: string;
  name?: string;
  namespace?: string;
}
interface RoleRefRaw {
  kind?: string;
  name?: string;
}
interface PolicyRuleRaw {
  apiGroups?: string[];
  resources?: string[];
  verbs?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

export interface SecurityBinding {
  bindingId: ResourceId;
  bindingKind: 'RoleBinding' | 'ClusterRoleBinding';
  bindingName: string;
  namespace?: string;
  roleKind: 'Role' | 'ClusterRole';
  roleName: string;
  roleId?: ResourceId;
  rules: PolicyRuleRaw[];
}

export interface SecuritySubject {
  kind: string; // User | Group | ServiceAccount
  name: string;
  namespace?: string;
  bindings: SecurityBinding[];
}

/**
 * RBAC subject hierarchy (DESIGN §6.10 Security view): every Subject (User/Group/ServiceAccount) → the
 * Role/ClusterRoleBindings that grant it access → the resolved Role/ClusterRole's rules. "Who can do what."
 * Legacy equivalent: src/security/createSubjectHierarchy.ts.
 */
export function projectSecuritySubjects(graph: ResourceGraph): SecuritySubject[] {
  const rolesByKey = new Map<string, PolicyRuleRaw[]>();
  const roleIdByKey = new Map<string, ResourceId>();
  const clusterRolesByName = new Map<string, PolicyRuleRaw[]>();
  const clusterRoleIdByName = new Map<string, ResourceId>();

  for (const r of graph.nodes.values()) {
    if (r.kind === 'Role') {
      const key = `${r.namespace ?? ''}/${r.name}`;
      rolesByKey.set(key, (r.raw.rules as PolicyRuleRaw[] | undefined) ?? []);
      roleIdByKey.set(key, r.id);
    } else if (r.kind === 'ClusterRole') {
      clusterRolesByName.set(r.name, (r.raw.rules as PolicyRuleRaw[] | undefined) ?? []);
      clusterRoleIdByName.set(r.name, r.id);
    }
  }

  const subjects = new Map<string, SecuritySubject>();

  for (const r of graph.nodes.values()) {
    const isRoleBinding = r.kind === 'RoleBinding';
    const isClusterRoleBinding = r.kind === 'ClusterRoleBinding';
    if (!isRoleBinding && !isClusterRoleBinding) continue;

    const roleRef = (r.raw.roleRef as RoleRefRaw | undefined) ?? {};
    const roleKind: 'Role' | 'ClusterRole' = roleRef.kind === 'ClusterRole' ? 'ClusterRole' : 'Role';
    const roleName = roleRef.name ?? '';
    const rules =
      roleKind === 'ClusterRole'
        ? (clusterRolesByName.get(roleName) ?? [])
        : (rolesByKey.get(`${r.namespace ?? ''}/${roleName}`) ?? []);
    const roleId =
      roleKind === 'ClusterRole' ? clusterRoleIdByName.get(roleName) : roleIdByKey.get(`${r.namespace ?? ''}/${roleName}`);

    const binding: SecurityBinding = {
      bindingId: r.id,
      bindingKind: isRoleBinding ? 'RoleBinding' : 'ClusterRoleBinding',
      bindingName: r.name,
      namespace: r.namespace,
      roleKind,
      roleName,
      roleId,
      rules,
    };

    for (const raw of (r.raw.subjects as RbacSubjectRaw[] | undefined) ?? []) {
      const kind = raw.kind ?? 'Unknown';
      const name = raw.name ?? '';
      const namespace = kind === 'ServiceAccount' ? raw.namespace : undefined;
      const key = `${kind}|${namespace ?? ''}|${name}`;
      let subject = subjects.get(key);
      if (!subject) {
        subject = { kind, name, namespace, bindings: [] };
        subjects.set(key, subject);
      }
      subject.bindings.push(binding);
    }
  }

  return [...subjects.values()].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
  );
}
