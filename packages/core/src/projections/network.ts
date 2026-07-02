import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

interface EndpointAddress {
  ip?: string;
  nodeName?: string;
  targetRef?: { kind?: string; uid?: string };
}
interface EndpointSubset {
  addresses?: EndpointAddress[];
  notReadyAddresses?: EndpointAddress[];
  ports?: { name?: string; port?: number; protocol?: string }[];
}
interface ServicePort {
  name?: string;
  port?: number;
  protocol?: string;
  targetPort?: number | string;
}
interface NodeAddress {
  type?: string;
  address?: string;
}

export interface NetworkPodEntry {
  pod: Resource;
  podIp?: string;
  ready: boolean;
  nodeName?: string;
  nodeIp?: string;
}

export interface NetworkServiceCard {
  service: Resource;
  clusterIp?: string;
  ports: ServicePort[];
  pods: NetworkPodEntry[];
}

/**
 * "Services-To-Pods" network mode (DESIGN §6.10): one containment card per Service — ClusterIP → pods
 * (with pod/node IPs), joined via the Service's Endpoints object (targetRef), not label-selector matching
 * (targetRef is authoritative and cheaper than re-deriving selector matches).
 */
export function projectNetworkServicesToPods(graph: ResourceGraph, namespace?: string): NetworkServiceCard[] {
  const nodeIpByName = new Map<string, string>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Node') continue;
    const addresses = (r.raw.status as { addresses?: NodeAddress[] } | undefined)?.addresses ?? [];
    const internal = addresses.find((a) => a.type === 'InternalIP');
    if (internal?.address) nodeIpByName.set(r.name, internal.address);
  }

  const endpointsByServiceKey = new Map<string, Resource>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Endpoints') continue;
    endpointsByServiceKey.set(`${r.namespace ?? ''}/${r.name}`, r);
  }

  const cards: NetworkServiceCard[] = [];
  for (const service of graph.nodes.values()) {
    if (service.kind !== 'Service') continue;
    if (namespace && service.namespace !== namespace) continue;

    const spec = service.raw.spec as { clusterIP?: string; ports?: ServicePort[] } | undefined;
    const endpoints = endpointsByServiceKey.get(`${service.namespace ?? ''}/${service.name}`);
    const pods = endpoints ? podsFromEndpoints(endpoints, graph, nodeIpByName) : [];

    cards.push({ service, clusterIp: spec?.clusterIP, ports: spec?.ports ?? [], pods });
  }
  return cards.sort((a, b) => a.service.name.localeCompare(b.service.name));
}

function podsFromEndpoints(
  endpoints: Resource,
  graph: ResourceGraph,
  nodeIpByName: Map<string, string>,
): NetworkPodEntry[] {
  const subsets = (endpoints.raw.subsets as EndpointSubset[] | undefined) ?? [];
  const entries: (NetworkPodEntry | undefined)[] = [];
  for (const subset of subsets) {
    for (const addr of subset.addresses ?? []) entries.push(toEntry(addr, true, graph, nodeIpByName));
    for (const addr of subset.notReadyAddresses ?? []) entries.push(toEntry(addr, false, graph, nodeIpByName));
  }
  return entries.filter((e): e is NetworkPodEntry => e !== undefined);
}

function toEntry(
  addr: EndpointAddress,
  ready: boolean,
  graph: ResourceGraph,
  nodeIpByName: Map<string, string>,
): NetworkPodEntry | undefined {
  const podId: ResourceId | undefined = addr.targetRef?.kind === 'Pod' ? addr.targetRef.uid : undefined;
  const pod = podId ? graph.nodes.get(podId) : undefined;
  if (!pod) return undefined;
  return {
    pod,
    podIp: addr.ip,
    ready,
    nodeName: addr.nodeName,
    nodeIp: addr.nodeName ? nodeIpByName.get(addr.nodeName) : undefined,
  };
}
