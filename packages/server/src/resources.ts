import type { ResourceGraph } from '@vpk/core';

/** Flat row for the Search view table — one per node, no raw payload. */
export interface ResourceRow {
  id: string;
  kind: string;
  apiVersion: string;
  namespace?: string;
  name: string;
  creationTimestamp?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  /** True when this resource is OWNED by something (appears as the `to` side of an ownerReference edge) —
   *  the OwnerRef view's Namespace→Resource picker uses this to only ever offer resources that actually have
   *  something to show. Derived from the graph's own edges, not `raw.metadata.ownerReferences`, so it agrees
   *  exactly with what projectOwnerRef would draw. */
  hasOwnerRefs: boolean;
  placeholder: boolean;
}

/** Project the graph to the flat rows the Search table (and OwnerRef's picker) need. Excludes raw payloads
 *  (kept server-side only). */
export function listResources(graph: ResourceGraph): ResourceRow[] {
  const owned = new Set<string>();
  for (const e of graph.edges) if (e.type === 'ownerReference') owned.add(e.to);

  return [...graph.nodes.values()].map((r) => ({
    id: r.id,
    kind: r.kind,
    apiVersion: r.apiVersion,
    namespace: r.namespace,
    name: r.name,
    creationTimestamp: r.creationTimestamp,
    labels: r.labels,
    annotations: r.annotations,
    hasOwnerRefs: owned.has(r.id),
    placeholder: r.placeholder ?? false,
  }));
}
