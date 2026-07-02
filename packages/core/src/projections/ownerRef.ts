import type { ResourceId } from '../identity';
import type { Resource } from '../types';
import type { Relationship, ResourceGraph } from '../graph';

export interface OwnerRefView {
  nodes: Resource[];
  edges: Relationship[];
}

export type OwnerRefFocus = { resourceId: ResourceId } | { namespace: string };

/**
 * Connected owner subgraph around a focus (a resource, or a whole namespace). Traverses ancestors AND
 * descendants to unbounded depth, cycle-safe — replacing the legacy hand-unrolled 5-level walk.
 */
export function projectOwnerRef(graph: ResourceGraph, focus: OwnerRefFocus): OwnerRefView {
  const ownerEdges = graph.edges.filter((e) => e.type === 'ownerReference');

  const parents = new Map<ResourceId, ResourceId[]>();
  const children = new Map<ResourceId, ResourceId[]>();
  for (const e of ownerEdges) {
    push(children, e.from, e.to);
    push(parents, e.to, e.from);
  }

  const seen = new Set<ResourceId>();
  const stack = seedIds(graph, focus);
  while (stack.length > 0) {
    const id = stack.pop() as ResourceId;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const p of parents.get(id) ?? []) if (!seen.has(p)) stack.push(p);
    for (const c of children.get(id) ?? []) if (!seen.has(c)) stack.push(c);
  }

  const nodes = [...seen]
    .map((id) => graph.nodes.get(id))
    .filter((r): r is Resource => r !== undefined);
  const edges = ownerEdges.filter((e) => seen.has(e.from) && seen.has(e.to));
  return { nodes, edges };
}

function seedIds(graph: ResourceGraph, focus: OwnerRefFocus): ResourceId[] {
  if ('resourceId' in focus) return graph.nodes.has(focus.resourceId) ? [focus.resourceId] : [];
  return [...graph.nodes.values()].filter((r) => r.namespace === focus.namespace).map((r) => r.id);
}

function push(map: Map<ResourceId, ResourceId[]>, key: ResourceId, value: ResourceId): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
