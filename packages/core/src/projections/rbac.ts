import { projectSecuritySubjects } from './security';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

/**
 * Per-subject RBAC schematic (DESIGN §6.10 follow-on): everything the RBAC diagram needs for ONE subject —
 * its bindings split by scope, the distinct roles they resolve to, and the flattened "effective permissions"
 * rule list. The key nuance this projection preserves (and the diagram exists to show): a ClusterRole is one
 * reusable object whose EFFECTIVE scope comes from the binding that references it — via a RoleBinding its
 * rules apply only in that binding's namespace, via a ClusterRoleBinding they apply cluster-wide.
 */

export interface RbacRule {
  verbs: string[];
  apiGroups: string[];
  resources: string[];
  resourceNames: string[];
  nonResourceURLs: string[];
  /** How this rule reached the subject: through a RoleBinding (namespace-scoped) or a ClusterRoleBinding. */
  scope: 'namespace' | 'cluster';
  /** The RoleBinding's namespace, for scope === 'namespace'. */
  namespace?: string;
  /** The Role/ClusterRole owning this rule + its index in that object's `rules` array — a FocusPath straight
   *  to the rule in the editor, same mechanism as the Container Images page's container rows. */
  roleId?: ResourceId;
  ruleIndex: number;
}

export interface RbacBindingNode {
  id: ResourceId;
  name: string;
  namespace?: string;
  /** Key into `roles`/`clusterRoles` (`kind|namespace|name`) — which role this binding resolves to. */
  roleKey: string;
}

export interface RbacRoleNode {
  key: string;
  kind: 'Role' | 'ClusterRole';
  name: string;
  namespace?: string;
  /** Absent when the referenced role isn't in the snapshot (dangling roleRef) — drawn but not clickable. */
  id?: ResourceId;
  ruleCount: number;
}

export interface RbacSubjectView {
  subject: { kind: string; name: string; namespace?: string; id?: ResourceId };
  roleBindings: RbacBindingNode[];
  clusterRoleBindings: RbacBindingNode[];
  /** Namespace-scoped Roles (referenced by RoleBindings only). */
  roles: RbacRoleNode[];
  /** ClusterRoles — referenced by ClusterRoleBindings AND/OR by RoleBindings (the one-object-two-scopes case). */
  clusterRoles: RbacRoleNode[];
  /** Union of every rule that reached the subject, deduped per (rule signature, scope). */
  rules: RbacRule[];
}

interface RuleRaw {
  verbs?: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

export function projectRbacSubject(
  graph: ResourceGraph,
  subjectKind: string,
  subjectName: string,
  subjectNamespace?: string,
): RbacSubjectView | undefined {
  const subject = projectSecuritySubjects(graph).find(
    (s) => s.kind === subjectKind && s.name === subjectName && (s.namespace ?? '') === (subjectNamespace ?? ''),
  );
  if (!subject) return undefined;

  let subjectId: ResourceId | undefined;
  if (subjectKind === 'ServiceAccount') {
    for (const r of graph.nodes.values()) {
      if (r.kind === 'ServiceAccount' && r.name === subjectName && r.namespace === subjectNamespace) {
        subjectId = r.id;
        break;
      }
    }
  }

  const roleBindings: RbacBindingNode[] = [];
  const clusterRoleBindings: RbacBindingNode[] = [];
  const roles = new Map<string, RbacRoleNode>();
  const clusterRoles = new Map<string, RbacRoleNode>();
  const rules: RbacRule[] = [];
  const seenRules = new Set<string>();

  for (const b of subject.bindings) {
    // A Role referenced by a RoleBinding lives in the BINDING's namespace (roleRef has no namespace field).
    const roleNamespace = b.roleKind === 'Role' ? b.namespace : undefined;
    const roleKey = `${b.roleKind}|${roleNamespace ?? ''}|${b.roleName}`;
    const rolePool = b.roleKind === 'Role' ? roles : clusterRoles;
    if (!rolePool.has(roleKey)) {
      rolePool.set(roleKey, {
        key: roleKey,
        kind: b.roleKind,
        name: b.roleName,
        namespace: roleNamespace,
        id: b.roleId,
        ruleCount: b.rules.length,
      });
    }

    const node: RbacBindingNode = { id: b.bindingId, name: b.bindingName, namespace: b.namespace, roleKey };
    if (b.bindingKind === 'RoleBinding') roleBindings.push(node);
    else clusterRoleBindings.push(node);

    const scope = b.bindingKind === 'RoleBinding' ? 'namespace' : 'cluster';
    (b.rules as RuleRaw[]).forEach((raw, i) => {
      const rule: RbacRule = {
        verbs: raw.verbs ?? [],
        apiGroups: raw.apiGroups ?? [],
        resources: raw.resources ?? [],
        resourceNames: raw.resourceNames ?? [],
        nonResourceURLs: raw.nonResourceURLs ?? [],
        scope,
        namespace: scope === 'namespace' ? b.namespace : undefined,
        roleId: b.roleId,
        ruleIndex: i,
      };
      // Dedup per (signature, scope, namespace): the same ClusterRole bound both ways yields the same rule at
      // TWO scopes — both rows are kept, because that difference is the entire point of the diagram.
      const sig = JSON.stringify([rule.verbs, rule.apiGroups, rule.resources, rule.resourceNames, rule.nonResourceURLs, rule.scope, rule.namespace]);
      if (seenRules.has(sig)) return;
      seenRules.add(sig);
      rules.push(rule);
    });
  }

  // Namespace-scoped rows first (the tighter grant), then cluster-wide, each group ordered by first resource.
  rules.sort(
    (a, b) =>
      (a.scope === 'cluster' ? 1 : 0) - (b.scope === 'cluster' ? 1 : 0) ||
      (a.resources[0] ?? a.nonResourceURLs[0] ?? '').localeCompare(b.resources[0] ?? b.nonResourceURLs[0] ?? ''),
  );

  return {
    subject: { kind: subject.kind, name: subject.name, namespace: subject.namespace, id: subjectId },
    roleBindings,
    clusterRoleBindings,
    roles: [...roles.values()],
    clusterRoles: [...clusterRoles.values()],
    rules,
  };
}
