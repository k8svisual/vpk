import { buildGraph, type RawObject, type ResourceGraph } from '@vpk/core';

/**
 * The isolated snapshot behind the Course view's embedded graphic panel. A lesson can capture the student's
 * LIVE cluster and see it rendered right beside the terminal — but that capture must NOT disturb the single
 * globally-loaded snapshot every main view (3D Cluster, Schematic, OwnerRef, …) renders (server.ts's `graph`/
 * `currentPath`). So the course graphic keeps its OWN graph here, entirely separate: capturing for the course
 * never calls setSnapshot, and the main dropdown/views are untouched.
 *
 * Deliberately module-level singleton state, mirroring server.ts's own `graph` — VpK is single-tenant (one
 * user, one running server), so there's exactly one "current course capture" at a time. It's in-memory only
 * (no file written): it's a transient, re-capturable view of a live cluster, not a saved snapshot the student
 * would ever pick from the catalog.
 */

let courseGraph: ResourceGraph | null = null;
let capturedAt: string | null = null;

/** Replace the course graphic's isolated graph with a freshly captured set of objects. */
export function setCourseGraph(items: readonly RawObject[]): void {
  courseGraph = buildGraph(items);
  capturedAt = new Date().toISOString();
}

export function getCourseGraph(): ResourceGraph | null {
  return courseGraph;
}

export interface CoursePodRef {
  id: string;
  name: string;
  namespace?: string;
}

/** Pods in the current course capture, newest first — the panel's picker defaults to the top one so "what you
 *  just deployed" is what shows without the student hunting for it. */
export function courseGraphPods(): CoursePodRef[] {
  if (!courseGraph) return [];
  return [...courseGraph.nodes.values()]
    .filter((r) => r.kind === 'Pod' && !r.placeholder)
    .sort((a, b) => (b.creationTimestamp ?? '').localeCompare(a.creationTimestamp ?? '') || a.name.localeCompare(b.name))
    .map((r) => ({ id: r.id, name: r.name, namespace: r.namespace }));
}

export function courseGraphState(): { capturedAt: string | null; pods: CoursePodRef[] } {
  return { capturedAt, pods: courseGraphPods() };
}
