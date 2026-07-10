import type { ResourceGraph } from '../graph';
import type { RawObject, Resource } from '../types';
import type { ResourceSelector } from './types';

function matchesLabels(actual: Record<string, string>, want: Record<string, string>): boolean {
  return Object.entries(want).every(([k, v]) => actual[k] === v);
}

/** Resources of `selector.kind` (optionally further narrowed by name/labels) in `namespace`. Synthesized
 *  owner placeholders (§graph.ts) never match — a placeholder isn't a resource the student created. */
export function selectResources(graph: ResourceGraph, namespace: string, selector: ResourceSelector): Resource[] {
  const out: Resource[] = [];
  for (const r of graph.nodes.values()) {
    if (r.placeholder) continue;
    if (r.namespace !== namespace) continue;
    if (r.kind !== selector.kind) continue;
    if (selector.name !== undefined && r.name !== selector.name) continue;
    if (selector.labels && !matchesLabels(r.labels, selector.labels)) continue;
    out.push(r);
  }
  return out;
}

/** Every real (non-placeholder) resource in `namespace`, any kind. */
export function resourcesInNamespace(graph: ResourceGraph, namespace: string): Resource[] {
  const out: Resource[] = [];
  for (const r of graph.nodes.values()) {
    if (r.placeholder) continue;
    if (r.namespace !== namespace) continue;
    out.push(r);
  }
  return out;
}

/** `{ kind -> count }` for every real resource in `namespace` — the basis of InventoryCheck. */
export function inventoryOf(graph: ResourceGraph, namespace: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of resourcesInNamespace(graph, namespace)) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return counts;
}

/** Same idea as inventoryOf, but over an authored fixture manifest (RawObject[]) instead of a live graph —
 *  used to resolve an InventoryCheck's `answerKey` expectation. */
export function inventoryOfObjects(objects: readonly RawObject[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of objects) {
    if (!o.kind) continue;
    counts[o.kind] = (counts[o.kind] ?? 0) + 1;
  }
  return counts;
}
