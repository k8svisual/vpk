import type { ResourceId } from './identity';

/** A raw Kubernetes object as returned by the API / CLI (loosely typed). */
export interface RawObject {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    uid?: string;
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp?: string;
    managedFields?: unknown;
    ownerReferences?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** A normalized graph node: identity + indexed fields + a reference to the (trimmed) raw object. */
export interface Resource {
  id: ResourceId;
  uid?: string;
  kind: string;
  apiVersion: string;
  name: string;
  namespace?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  creationTimestamp?: string;
  raw: RawObject;
  /** True for synthesized owner placeholders (an owner was referenced but not present in the snapshot). */
  placeholder?: boolean;
}
