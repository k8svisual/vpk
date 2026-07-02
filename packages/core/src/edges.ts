import { CLUSTER_SCOPE, type ResourceId } from './identity';
import type { RawObject, Resource } from './types';
import type { Relationship } from './graph';

interface OwnerRef {
  uid?: string;
  kind?: string;
  name?: string;
  apiVersion?: string;
  controller?: boolean;
}

export interface OwnerEdgeResult {
  edges: Relationship[];
  /** Placeholder nodes for owners referenced but not present in the snapshot. */
  missing: Resource[];
}

/**
 * Extract `ownerReference` edges (parent → child). Handles multiple owners per child, and synthesizes a
 * placeholder node for any owner not in the snapshot (DESIGN §6 / ownerref-slice). No 5-level cap.
 */
export function extractOwnerEdges(
  nodes: Map<ResourceId, Resource>,
  byUid: Map<string, ResourceId>,
): OwnerEdgeResult {
  const edges: Relationship[] = [];
  const missing = new Map<ResourceId, Resource>();

  for (const child of nodes.values()) {
    for (const o of ownerRefsOf(child.raw)) {
      const from = resolveOwner(o, byUid, missing, child.namespace);
      edges.push({ type: 'ownerReference', from, to: child.id, meta: { controller: o.controller === true } });
    }
  }

  return { edges, missing: [...missing.values()] };
}

function ownerRefsOf(raw: RawObject): OwnerRef[] {
  const refs = raw.metadata?.ownerReferences;
  return Array.isArray(refs) ? (refs as OwnerRef[]) : [];
}

function resolveOwner(
  o: OwnerRef,
  byUid: Map<string, ResourceId>,
  missing: Map<ResourceId, Resource>,
  childNamespace: string | undefined,
): ResourceId {
  if (o.uid) {
    const existing = byUid.get(o.uid);
    if (existing) return existing;
  }
  const id = o.uid ?? `${o.apiVersion ?? ''}|${o.kind ?? ''}|${childNamespace ?? CLUSTER_SCOPE}|${o.name ?? ''}`;
  if (!missing.has(id)) {
    missing.set(id, {
      id,
      uid: o.uid,
      kind: o.kind ?? '',
      apiVersion: o.apiVersion ?? '',
      name: o.name ?? '',
      namespace: childNamespace,
      labels: {},
      annotations: {},
      placeholder: true,
      raw: { apiVersion: o.apiVersion, kind: o.kind, metadata: { uid: o.uid, name: o.name, namespace: childNamespace } },
    });
  }
  return id;
}
