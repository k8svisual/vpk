import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';

/**
 * Cluster-wide "ports in use" projection (Network → Ports view). One flat row per declared port across every
 * source a `get` snapshot carries: Service `spec.ports` (typed by the Service's own type — ClusterIP/NodePort/
 * LoadBalancer/ExternalName) and Pod container ports (`containerPort`, or `hostPort` when the container binds
 * one on the host). Host-level sources (NodePort/LoadBalancer/hostPort) are their own categories so the view
 * can flag them distinctly. Aggregation-by-port and filtering are view concerns over this flat list.
 */
export type PortSource = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' | 'containerPort' | 'hostPort';

/** Host-level exposure — a port reachable from outside the pod network (worth flagging in the view). */
export const HOST_LEVEL_SOURCES: PortSource[] = ['NodePort', 'LoadBalancer', 'hostPort'];

export interface PortUsage {
  port: number;
  protocol: string;
  source: PortSource;
  name?: string;
  targetPort?: string | number;
  nodePort?: number;
  hostPort?: number;
  containerName?: string;
  resourceId: ResourceId;
  resourceName: string;
  resourceKind: string;
  namespace?: string;
  namespaceId?: ResourceId;
}

interface ServicePortRaw {
  name?: string;
  port?: number;
  protocol?: string;
  targetPort?: string | number;
  nodePort?: number;
}
interface ContainerPortRaw {
  name?: string;
  containerPort?: number;
  protocol?: string;
  hostPort?: number;
}

const SERVICE_TYPE_SOURCE: Record<string, PortSource> = {
  ClusterIP: 'ClusterIP',
  NodePort: 'NodePort',
  LoadBalancer: 'LoadBalancer',
  ExternalName: 'ExternalName',
};

export function projectPortUsage(graph: ResourceGraph): PortUsage[] {
  const namespaceIds = new Map<string, ResourceId>();
  for (const r of graph.nodes.values()) if (r.kind === 'Namespace' || r.kind === 'Project') namespaceIds.set(r.name, r.id);
  const nsId = (ns?: string) => (ns ? namespaceIds.get(ns) : undefined);

  const usages: PortUsage[] = [];
  for (const r of graph.nodes.values()) {
    if (r.kind === 'Service') {
      const spec = r.raw.spec as { type?: string; ports?: ServicePortRaw[] } | undefined;
      const source = SERVICE_TYPE_SOURCE[spec?.type ?? 'ClusterIP'] ?? 'ClusterIP';
      for (const p of spec?.ports ?? []) {
        if (p.port === undefined) continue;
        usages.push({
          port: p.port,
          protocol: p.protocol ?? 'TCP',
          // A LoadBalancer entry that actually allocated a nodePort (the common case — a cloud LB Service
          // implicitly gets one too) is the host-level fact worth surfacing; a bare LoadBalancer with no
          // nodePort stays typed as LoadBalancer. `source === 'ClusterIP'` was checked here previously, but a
          // ClusterIP Service can never have ports[].nodePort set at all (the API rejects that combination),
          // so that check was unreachable dead code and this comment's actual intent never fired.
          source: p.nodePort && source === 'LoadBalancer' ? 'NodePort' : source,
          name: p.name,
          targetPort: p.targetPort,
          nodePort: p.nodePort,
          resourceId: r.id,
          resourceName: r.name,
          resourceKind: 'Service',
          namespace: r.namespace,
          namespaceId: nsId(r.namespace),
        });
      }
    } else if (r.kind === 'Pod') {
      const containers = (r.raw.spec as { containers?: { name?: string; ports?: ContainerPortRaw[] }[] } | undefined)?.containers ?? [];
      for (const c of containers) {
        for (const p of c.ports ?? []) {
          if (p.containerPort === undefined) continue;
          usages.push({
            port: p.containerPort,
            protocol: p.protocol ?? 'TCP',
            source: p.hostPort ? 'hostPort' : 'containerPort',
            name: p.name,
            hostPort: p.hostPort,
            containerName: c.name,
            resourceId: r.id,
            resourceName: r.name,
            resourceKind: 'Pod',
            namespace: r.namespace,
            namespaceId: nsId(r.namespace),
          });
        }
      }
    }
  }
  return usages.sort((a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol) || a.resourceName.localeCompare(b.resourceName));
}
