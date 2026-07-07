import { projectSecuritySubjects, type SecurityBinding } from './security';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

/**
 * "Who can …" RBAC query (DESIGN §6.10 follow-on). Inverts projectSecuritySubjects: instead of "given a
 * subject, what can it do", answers "given a (verbs, resources, namespace), which subjects can do it". The
 * matching semantics are the load-bearing part — see the notes on each helper. Only answers what the snapshot
 * encodes: subjects NAMED in bindings. It cannot expand externally-asserted User/Group memberships (OIDC,
 * certs), so a grant to a Group is reported as-is ("all members of X"), not fanned out.
 */

interface Rule {
  verbs?: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

export interface WhoCanResourceRef {
  /** '' for the core API group (shown as "core" by the UI). */
  apiGroup: string;
  resource: string;
}

export interface WhoCanQuery {
  /** Empty = any verb. */
  verbs: string[];
  /** Empty = any resource. */
  resources: WhoCanResourceRef[];
  /** undefined/'' = any namespace. */
  namespace?: string;
  /** With 2+ requested cells (verbs × resources): 'any' = covers at least one, 'all' = covers every one. */
  mode: 'any' | 'all';
}

export interface WhoCanGrant {
  bindingId: ResourceId;
  bindingKind: 'RoleBinding' | 'ClusterRoleBinding';
  bindingName: string;
  bindingNamespace?: string;
  roleKind: 'Role' | 'ClusterRole';
  roleName: string;
  roleId?: ResourceId;
  /** cluster = via ClusterRoleBinding (every namespace); namespace = via RoleBinding (its namespace only). */
  scope: 'namespace' | 'cluster';
  /** True when this grant only reached the query via resourceNames-limited rules (specific named objects). */
  restricted: boolean;
  resourceNames: string[];
}

export interface WhoCanMatch {
  subject: { kind: string; name: string; namespace?: string; id?: ResourceId };
  grants: WhoCanGrant[];
  /** True when the match relies on resourceNames-limited rules — the subject can act on SOME objects, not all. */
  partial: boolean;
}

export interface WhoCanVocabulary {
  verbs: string[];
  resources: WhoCanResourceRef[];
}

const STANDARD_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', 'deletecollection'];

/** A single (verb, resource) target cell. null on either axis means "any" (an unconstrained query dimension). */
interface Cell {
  verb: string | null;
  resource: WhoCanResourceRef | null;
}

/**
 * Does one rule cover one target cell? Verbs/resources match by exact string OR the `*` wildcard; a bare
 * `pods` rule does NOT cover the `pods/log` subresource (only `*` does). apiGroup must also match (pods live
 * in core `''`, deployments in `apps`) — the same resource name can exist in two groups.
 */
function ruleCovers(rule: Rule, cell: Cell): boolean {
  const verbs = rule.verbs ?? [];
  const verbOk = cell.verb === null || verbs.includes(cell.verb) || verbs.includes('*');
  if (!verbOk) return false;
  if (cell.resource === null) return true;
  const groups = rule.apiGroups ?? [];
  const resources = rule.resources ?? [];
  const groupOk = groups.includes(cell.resource.apiGroup) || groups.includes('*');
  const resOk = resources.includes(cell.resource.resource) || resources.includes('*');
  return groupOk && resOk;
}

/**
 * Does a binding's grant reach `namespace`? A ClusterRoleBinding applies in EVERY namespace; a RoleBinding
 * only in its own. Crucially the scope comes from the BINDING, not the role — a RoleBinding in app-ns that
 * references an all-powerful ClusterRole grants nothing in kube-system.
 */
function scopeMatches(b: SecurityBinding, namespace?: string): boolean {
  if (!namespace) return true;
  if (b.bindingKind === 'ClusterRoleBinding') return true;
  return b.namespace === namespace;
}

function buildServiceAccountIds(graph: ResourceGraph): Map<string, ResourceId> {
  const ids = new Map<string, ResourceId>();
  for (const r of graph.nodes.values()) {
    if (r.kind === 'ServiceAccount') ids.set(`${r.namespace ?? ''}|${r.name}`, r.id);
  }
  return ids;
}

export function whoCan(graph: ResourceGraph, query: WhoCanQuery): WhoCanMatch[] {
  const verbs: (string | null)[] = query.verbs.length ? query.verbs : [null];
  const resources: (WhoCanResourceRef | null)[] = query.resources.length ? query.resources : [null];
  const cells: Cell[] = [];
  for (const v of verbs) for (const r of resources) cells.push({ verb: v, resource: r });

  const saIds = buildServiceAccountIds(graph);
  const matches: WhoCanMatch[] = [];

  for (const subject of projectSecuritySubjects(graph)) {
    const inScope = subject.bindings.filter((b) => scopeMatches(b, query.namespace));
    if (inScope.length === 0) continue;

    const cellCovered = new Array<boolean>(cells.length).fill(false);
    const cellFull = new Array<boolean>(cells.length).fill(false); // covered by an UNrestricted rule
    const grantsByBinding = new Map<string, { binding: SecurityBinding; anyUnrestricted: boolean; names: Set<string> }>();

    for (const b of inScope) {
      let contributes = false;
      let anyUnrestricted = false;
      const names = new Set<string>();
      for (const rule of b.rules as Rule[]) {
        const restricted = (rule.resourceNames ?? []).length > 0;
        let coversAnyCell = false;
        cells.forEach((cell, ci) => {
          if (!ruleCovers(rule, cell)) return;
          coversAnyCell = true;
          cellCovered[ci] = true;
          if (!restricted) cellFull[ci] = true;
        });
        if (coversAnyCell) {
          contributes = true;
          if (restricted) for (const n of rule.resourceNames ?? []) names.add(n);
          else anyUnrestricted = true;
        }
      }
      if (contributes) grantsByBinding.set(b.bindingId, { binding: b, anyUnrestricted, names });
    }

    const matched = query.mode === 'all' ? cellCovered.every(Boolean) : cellCovered.some(Boolean);
    if (!matched) continue;

    // ALL: partial if any required cell is only reachable through a restricted rule. ANY: partial unless at
    // least one covered cell has a full (unrestricted) grant.
    const partial =
      query.mode === 'all'
        ? cellCovered.some((c, i) => c && !cellFull[i])
        : !cellCovered.some((c, i) => c && cellFull[i]);

    const grants: WhoCanGrant[] = [...grantsByBinding.values()].map(({ binding, anyUnrestricted, names }) => ({
      bindingId: binding.bindingId,
      bindingKind: binding.bindingKind,
      bindingName: binding.bindingName,
      bindingNamespace: binding.namespace,
      roleKind: binding.roleKind,
      roleName: binding.roleName,
      roleId: binding.roleId,
      scope: binding.bindingKind === 'ClusterRoleBinding' ? 'cluster' : 'namespace',
      restricted: !anyUnrestricted,
      resourceNames: anyUnrestricted ? [] : [...names].sort(),
    }));

    matches.push({
      subject: {
        kind: subject.kind,
        name: subject.name,
        namespace: subject.namespace,
        id: subject.kind === 'ServiceAccount' ? saIds.get(`${subject.namespace ?? ''}|${subject.name}`) : undefined,
      },
      grants,
      partial,
    });
  }

  // Full matches before partial ones, then by kind and name.
  matches.sort(
    (a, b) =>
      Number(a.partial) - Number(b.partial) ||
      a.subject.kind.localeCompare(b.subject.kind) ||
      a.subject.name.localeCompare(b.subject.name),
  );
  return matches;
}

/** Distinct verbs and (group, resource) pairs actually present in the snapshot's Roles/ClusterRoles, for the
 *  query builder's autocomplete. `*` is excluded (not a useful pick), the standard verbs are always included. */
export function rbacVocabulary(graph: ResourceGraph): WhoCanVocabulary {
  const verbs = new Set<string>(STANDARD_VERBS);
  const resources = new Map<string, WhoCanResourceRef>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Role' && r.kind !== 'ClusterRole') continue;
    for (const rule of (r.raw.rules as Rule[] | undefined) ?? []) {
      for (const v of rule.verbs ?? []) if (v !== '*') verbs.add(v);
      const groups = rule.apiGroups ?? [];
      for (const res of rule.resources ?? []) {
        if (res === '*') continue;
        for (const g of groups) {
          if (g === '*') continue;
          const key = `${g}|${res}`;
          if (!resources.has(key)) resources.set(key, { apiGroup: g, resource: res });
        }
      }
    }
  }
  return {
    verbs: [...verbs].sort(),
    resources: [...resources.values()].sort((a, b) => a.resource.localeCompare(b.resource) || a.apiGroup.localeCompare(b.apiGroup)),
  };
}
