import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

interface EndpointAddressRaw {
  ip?: string;
  nodeName?: string;
  targetRef?: { kind?: string; uid?: string };
}
interface EndpointSubsetRaw {
  addresses?: EndpointAddressRaw[];
  notReadyAddresses?: EndpointAddressRaw[];
}
interface EndpointSliceEndpointRaw {
  addresses?: string[];
  conditions?: { ready?: boolean };
  nodeName?: string;
  targetRef?: { kind?: string; uid?: string };
}

export interface ServiceBackendPod {
  uid: ResourceId;
  ip?: string;
  ready: boolean;
  nodeName?: string;
}

function addFromEndpoints(byUid: Map<ResourceId, ServiceBackendPod>, addr: EndpointAddressRaw, ready: boolean): void {
  if (addr.targetRef?.kind !== 'Pod' || !addr.targetRef.uid) return;
  byUid.set(addr.targetRef.uid, { uid: addr.targetRef.uid, ip: addr.ip, ready, nodeName: addr.nodeName });
}

/**
 * serviceId -> every Pod backing it, sourced from BOTH the legacy Endpoints object (ns/name match) and any
 * EndpointSlice objects (kubernetes.io/service-name label match) — a real cluster may publish either or both,
 * and the Endpoints API is deprecated as of Kubernetes 1.33, so a snapshot that only carries EndpointSlices
 * must still resolve Service->Pod membership the same way an Endpoints-only snapshot does. Every call site
 * that previously read only `Endpoints.subsets` (wheel.ts, network.ts, networkDiagrams.ts) silently dropped
 * every Pod on an EndpointSlice-only snapshot before this existed.
 *
 * Deduped by Pod uid per service (a Pod can appear in both the legacy Endpoints object and a slice) — the
 * Endpoints-sourced entry wins on conflict, since it's the shape every existing call site already expected
 * (no material difference from a slice-sourced entry, which carries the same ip/ready/nodeName fields).
 * Computed for every Service in one pass (not on demand per service) so repeated lookups — one per Service
 * card, one per Wheel pod-to-service edge — don't each re-scan the whole graph for Endpoints/EndpointSlices.
 */
export function allServiceBackingPods(graph: ResourceGraph): Map<ResourceId, ServiceBackendPod[]> {
  const endpointsByNsName = new Map<string, Resource>();
  const slicesByNsService = new Map<string, Resource[]>();
  for (const r of graph.nodes.values()) {
    if (r.kind === 'Endpoints') {
      endpointsByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);
    } else if (r.kind === 'EndpointSlice') {
      const svcName = r.labels['kubernetes.io/service-name'];
      if (!svcName) continue;
      const key = `${r.namespace ?? ''}/${svcName}`;
      const list = slicesByNsService.get(key) ?? [];
      list.push(r);
      slicesByNsService.set(key, list);
    }
  }

  const result = new Map<ResourceId, ServiceBackendPod[]>();
  for (const svc of graph.nodes.values()) {
    if (svc.kind !== 'Service') continue;
    const key = `${svc.namespace ?? ''}/${svc.name}`;
    const byUid = new Map<ResourceId, ServiceBackendPod>();

    const endpoints = endpointsByNsName.get(key);
    for (const subset of (endpoints?.raw.subsets as EndpointSubsetRaw[] | undefined) ?? []) {
      for (const addr of subset.addresses ?? []) addFromEndpoints(byUid, addr, true);
      for (const addr of subset.notReadyAddresses ?? []) addFromEndpoints(byUid, addr, false);
    }

    for (const slice of slicesByNsService.get(key) ?? []) {
      for (const ep of (slice.raw.endpoints as EndpointSliceEndpointRaw[] | undefined) ?? []) {
        if (ep.targetRef?.kind !== 'Pod' || !ep.targetRef.uid) continue;
        if (byUid.has(ep.targetRef.uid)) continue; // an Endpoints-sourced entry, if any, already won
        byUid.set(ep.targetRef.uid, {
          uid: ep.targetRef.uid,
          ip: ep.addresses?.[0],
          ready: ep.conditions?.ready ?? true,
          nodeName: ep.nodeName,
        });
      }
    }

    result.set(svc.id, [...byUid.values()]);
  }
  return result;
}
