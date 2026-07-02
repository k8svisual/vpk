import { resourceId, type ResourceId } from './identity';
import type { RawObject, Resource } from './types';

export interface NormalizeResult {
  nodes: Map<ResourceId, Resource>;
  byUid: Map<string, ResourceId>;
  /** How many raw objects collapsed onto an already-seen identity (legacy snapshots double-store some kinds). */
  deduped: number;
}

/**
 * Turn raw K8s objects into normalized graph nodes (DESIGN §4.1, §5.1).
 * - **Always strips `metadata.managedFields`** — noise, never rendered. Modern `kubectl get -o json`
 *   already omits it, but `--watch` and some CLIs (e.g. `oc`) still emit it, so we strip unconditionally.
 * - Assigns stable identity and indexes by `uid`.
 * - Keeps `status` (needed for health/schematic/node sizing); nothing else is dropped here.
 * - Pure: does not mutate the input objects.
 */
export function normalize(objects: readonly RawObject[]): NormalizeResult {
  const nodes = new Map<ResourceId, Resource>();
  const byUid = new Map<string, ResourceId>();
  let deduped = 0;

  for (const obj of objects) {
    const raw = stripManagedFields(obj);
    const id = resourceId(raw);
    const md = raw.metadata ?? {};
    if (nodes.has(id)) deduped++;
    nodes.set(id, {
      id,
      uid: md.uid,
      kind: raw.kind ?? '',
      apiVersion: raw.apiVersion ?? '',
      name: md.name ?? '',
      namespace: md.namespace,
      labels: md.labels ?? {},
      annotations: md.annotations ?? {},
      creationTimestamp: md.creationTimestamp,
      raw,
    });
    if (md.uid) byUid.set(md.uid, id);
  }

  return { nodes, byUid, deduped };
}

function stripManagedFields(obj: RawObject): RawObject {
  if (!obj.metadata || obj.metadata.managedFields === undefined) return obj;
  const metadata = { ...obj.metadata };
  delete metadata.managedFields;
  return { ...obj, metadata };
}
