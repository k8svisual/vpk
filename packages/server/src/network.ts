import { projectNetworkServicesToPods, projectNetworkNodeIps, type ResourceGraph } from '@vpk/core';

/** Lean DTO for the Network (Services-To-Pods) view — no raw payloads over the wire. */
export interface NetworkServiceDto {
  id: string;
  name: string;
  namespace?: string;
  clusterIp?: string;
  ports: { name?: string; port?: number; protocol?: string; targetPort?: number | string }[];
  pods: {
    id: string;
    name: string;
    podIp?: string;
    ready: boolean;
    phase?: string;
    nodeName?: string;
    nodeIp?: string;
  }[];
}

export function listNetworkServices(graph: ResourceGraph, namespace?: string): NetworkServiceDto[] {
  return projectNetworkServicesToPods(graph, namespace).map((card) => ({
    id: card.service.id,
    name: card.service.name,
    namespace: card.service.namespace,
    clusterIp: card.clusterIp,
    ports: card.ports,
    pods: card.pods.map((p) => ({
      id: p.pod.id,
      name: p.pod.name,
      podIp: p.podIp,
      ready: p.ready,
      phase: (p.pod.raw.status as { phase?: string } | undefined)?.phase,
      nodeName: p.nodeName,
      nodeIp: p.nodeIp,
    })),
  }));
}

/** Lean DTO for the Node & Pod IPs network view mode — no raw payloads over the wire. */
export interface NetworkNodeDto {
  id: string;
  name: string;
  internalIp?: string;
  podCidr?: string;
  pods: { id: string; name: string; namespace?: string; podIp?: string }[];
}

export function listNetworkNodes(graph: ResourceGraph): NetworkNodeDto[] {
  return projectNetworkNodeIps(graph).map((card) => ({
    id: card.node.id,
    name: card.node.name,
    internalIp: card.internalIp,
    podCidr: card.podCidr,
    pods: card.pods.map((p) => ({ id: p.pod.id, name: p.pod.name, namespace: p.pod.namespace, podIp: p.podIp })),
  }));
}
