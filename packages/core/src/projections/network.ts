import { allServiceBackingPods } from './serviceBackends';
import type { ResourceGraph } from '../graph';
import type { Resource } from '../types';

interface NodeAddress {
  type?: string;
  address?: string;
}
interface ServicePort {
  name?: string;
  port?: number;
  protocol?: string;
  targetPort?: number | string;
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
 * (with pod/node IPs), joined via the Service's Endpoints AND EndpointSlice objects (targetRef — see
 * serviceBackends.ts for why both sources matter), not label-selector matching (targetRef is authoritative
 * and cheaper than re-deriving selector matches).
 */
export function projectNetworkServicesToPods(graph: ResourceGraph, namespace?: string): NetworkServiceCard[] {
  const nodeIpByName = new Map<string, string>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Node') continue;
    const addresses = (r.raw.status as { addresses?: NodeAddress[] } | undefined)?.addresses ?? [];
    const internal = addresses.find((a) => a.type === 'InternalIP');
    if (internal?.address) nodeIpByName.set(r.name, internal.address);
  }

  const backingByService = allServiceBackingPods(graph);

  const cards: NetworkServiceCard[] = [];
  for (const service of graph.nodes.values()) {
    if (service.kind !== 'Service') continue;
    if (namespace && service.namespace !== namespace) continue;

    const spec = service.raw.spec as { clusterIP?: string; ports?: ServicePort[] } | undefined;
    const pods = (backingByService.get(service.id) ?? [])
      .map((backing): NetworkPodEntry | undefined => {
        const pod = graph.nodes.get(backing.uid);
        if (!pod) return undefined;
        return {
          pod,
          podIp: backing.ip,
          ready: backing.ready,
          nodeName: backing.nodeName,
          nodeIp: backing.nodeName ? nodeIpByName.get(backing.nodeName) : undefined,
        };
      })
      .filter((e): e is NetworkPodEntry => e !== undefined);

    cards.push({ service, clusterIp: spec?.clusterIP, ports: spec?.ports ?? [], pods });
  }
  return cards.sort((a, b) => a.service.name.localeCompare(b.service.name));
}

export interface NodeIpPod {
  pod: Resource;
  podIp?: string;
}

export interface NodeIpCard {
  node: Resource;
  internalIp?: string;
  podCidr?: string;
  pods: NodeIpPod[];
}

/**
 * "Node & Pod IPs" network mode (DESIGN §6.10): one containment card per Node — its host InternalIP + podCIDR
 * (host-network subnet vs pod-network subnet), and every Pod scheduled to it with its podIP. Prefix-range
 * aggregation of pod IPs is a presentation concern, left to the view layer.
 */
export function projectNetworkNodeIps(graph: ResourceGraph): NodeIpCard[] {
  const podsByNode = new Map<string, NodeIpPod[]>();
  for (const pod of graph.nodes.values()) {
    if (pod.kind !== 'Pod') continue;
    const nodeName = (pod.raw.spec as { nodeName?: string } | undefined)?.nodeName;
    if (!nodeName) continue;
    const list = podsByNode.get(nodeName) ?? [];
    list.push({ pod, podIp: (pod.raw.status as { podIP?: string } | undefined)?.podIP });
    podsByNode.set(nodeName, list);
  }

  const cards: NodeIpCard[] = [];
  for (const node of graph.nodes.values()) {
    if (node.kind !== 'Node') continue;
    const addresses = (node.raw.status as { addresses?: NodeAddress[] } | undefined)?.addresses ?? [];
    const internalIp = addresses.find((a) => a.type === 'InternalIP')?.address;
    const podCidr = (node.raw.spec as { podCIDR?: string } | undefined)?.podCIDR;
    const pods = (podsByNode.get(node.name) ?? []).sort((a, b) => a.pod.name.localeCompare(b.pod.name));
    cards.push({ node, internalIp, podCidr, pods });
  }
  return cards.sort((a, b) => a.node.name.localeCompare(b.node.name));
}
