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
  placeholder: boolean;
}

/** Project the graph to the flat rows the Search table needs. Excludes raw payloads (kept server-side only). */
export function listResources(graph: ResourceGraph): ResourceRow[] {
  return [...graph.nodes.values()].map((r) => ({
    id: r.id,
    kind: r.kind,
    apiVersion: r.apiVersion,
    namespace: r.namespace,
    name: r.name,
    creationTimestamp: r.creationTimestamp,
    labels: r.labels,
    placeholder: r.placeholder ?? false,
  }));
}
