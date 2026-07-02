import { normalize } from './normalize';
import { extractOwnerEdges } from './edges';
import type { ResourceId } from './identity';
import type { RawObject, Resource } from './types';

/** Relationship kinds. Only `ownerReference` is extracted so far; others land in later slices. */
export type RelationshipType =
  | 'ownerReference'
  | 'labelSelector'
  | 'volume'
  | 'serviceEndpoint'
  | 'roleBinding'
  | 'storageClass'
  | 'csi';

export interface Relationship {
  type: RelationshipType;
  from: ResourceId; // parent / owner
  to: ResourceId; // child / owned
  meta?: Record<string, unknown>;
}

export interface ResourceGraph {
  nodes: Map<ResourceId, Resource>;
  edges: Relationship[];
  byUid: Map<string, ResourceId>;
  /** Raw objects that collapsed onto an existing identity during normalize (DESIGN §5.1). */
  deduped: number;
}

/** Build the full graph from raw objects: normalize → nodes, then extract edges. */
export function buildGraph(objects: readonly RawObject[]): ResourceGraph {
  const { nodes, byUid, deduped } = normalize(objects);
  const { edges, missing } = extractOwnerEdges(nodes, byUid);
  for (const m of missing) if (!nodes.has(m.id)) nodes.set(m.id, m);
  return { nodes, edges, byUid, deduped };
}
