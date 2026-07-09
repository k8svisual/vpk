import { inferNetworkPlane, inferNetworkEdge } from './networkInference';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

// ---------------------------------------------------------------------------------------------------------
// Shared network-diagram projections (DESIGN §6.10 Network view — the five data-bound diagram types plus the
// conceptual "layers" listing). Everything here reads only fields a `get` snapshot actually carries; facts a
// snapshot can't contain (overlay/tunnel type, kube-proxy-vs-eBPF, a declared cluster Pod CIDR) are surfaced
// as clearly-labelled generic placeholders by the renderers, never fabricated as if real (mirrors the
// FilterPanel's "honest about what's real" convention).
// ---------------------------------------------------------------------------------------------------------

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
interface EndpointAddress {
  ip?: string;
  nodeName?: string;
  targetRef?: { kind?: string; uid?: string };
}
interface EndpointSubset {
  addresses?: EndpointAddress[];
  notReadyAddresses?: EndpointAddress[];
}

export interface DiagramPod {
  id: ResourceId;
  name: string;
  namespace?: string;
  podIp?: string;
  ready: boolean;
  nodeName?: string;
  nodeIp?: string;
}

export interface DiagramIngress {
  id: ResourceId;
  name: string;
  kind: string;
  /** Externally-facing hostname/host this entry routes from, when the object declares one. */
  host?: string;
}

export interface DiagramEndpointSlice {
  id: ResourceId;
  name: string;
  /** discovery.k8s.io addressType (IPv4/IPv6/FQDN) when the object declares one. */
  addressType?: string;
  /** Total addresses across this slice's endpoints — a slice's own "how many backends" count. */
  endpointCount: number;
}

export interface DiagramNodeGroup {
  id?: ResourceId;
  name: string;
  ip?: string;
  pods: DiagramPod[];
}

export interface ServiceNetworkView {
  service: {
    id: ResourceId;
    name: string;
    namespace?: string;
    clusterIp?: string;
    type: string;
    ports: ServicePort[];
  };
  selector: Record<string, string>;
  /** Ingress/Route objects whose backend targets this Service — the north-south entry points. */
  ingresses: DiagramIngress[];
  /** Backing pods (from the Service's Endpoints, targetRef-authoritative — same source as the cards view). */
  pods: DiagramPod[];
  /** The same pods regrouped by the Node they run on — drives the "Service × Nodes" diagram. */
  nodes: DiagramNodeGroup[];
  /** The real EndpointSlice objects backing this Service (discovery.k8s.io, matched by the standard
   *  `kubernetes.io/service-name` label) — usually exactly one, but Kubernetes splits into multiple when the
   *  endpoint count exceeds a slice's own cap, or per address family for dual-stack Services. */
  endpointSlices: DiagramEndpointSlice[];
}

function nodeIpMap(graph: ResourceGraph): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Node') continue;
    const internal = ((r.raw.status as { addresses?: NodeAddress[] } | undefined)?.addresses ?? []).find(
      (a) => a.type === 'InternalIP',
    );
    if (internal?.address) m.set(r.name, internal.address);
  }
  return m;
}

function nodeIdMap(graph: ResourceGraph): Map<string, ResourceId> {
  const m = new Map<string, ResourceId>();
  for (const r of graph.nodes.values()) if (r.kind === 'Node') m.set(r.name, r.id);
  return m;
}

/** Ingress/Route objects (same namespace) whose backend names `serviceName` — covers networking.k8s.io
 *  Ingress (defaultBackend + rules[].http.paths[].backend.service.name) and OpenShift Route (spec.to.name +
 *  alternateBackends[].name), the two north-south entry kinds real target clusters use. */
function ingressesForService(graph: ResourceGraph, serviceName: string, namespace?: string): DiagramIngress[] {
  const out: DiagramIngress[] = [];
  for (const r of graph.nodes.values()) {
    if (r.namespace !== namespace) continue;
    if (r.kind === 'Route') {
      const spec = r.raw.spec as
        | { host?: string; to?: { name?: string }; alternateBackends?: { name?: string }[] }
        | undefined;
      const names = [spec?.to?.name, ...(spec?.alternateBackends ?? []).map((b) => b.name)];
      if (names.includes(serviceName)) out.push({ id: r.id, name: r.name, kind: 'Route', host: spec?.host });
    } else if (r.kind === 'Ingress') {
      const spec = r.raw.spec as
        | {
            defaultBackend?: { service?: { name?: string } };
            rules?: { host?: string; http?: { paths?: { backend?: { service?: { name?: string } } }[] } }[];
          }
        | undefined;
      const names = [
        spec?.defaultBackend?.service?.name,
        ...(spec?.rules ?? []).flatMap((rule) => (rule.http?.paths ?? []).map((p) => p.backend?.service?.name)),
      ];
      if (names.includes(serviceName)) {
        out.push({ id: r.id, name: r.name, kind: 'Ingress', host: (spec?.rules ?? []).find((ru) => ru.host)?.host });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Real EndpointSlice objects backing a Service, matched via the standard `kubernetes.io/service-name` label
 *  (same convention kube-controller-manager itself sets) rather than name/owner inference. */
function endpointSlicesForService(graph: ResourceGraph, serviceName: string, namespace?: string): DiagramEndpointSlice[] {
  const out: DiagramEndpointSlice[] = [];
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'EndpointSlice' || r.namespace !== namespace) continue;
    const labels = (r.raw.metadata as { labels?: Record<string, string> } | undefined)?.labels;
    if (labels?.['kubernetes.io/service-name'] !== serviceName) continue;
    const endpoints = (r.raw.endpoints as { addresses?: string[] }[] | undefined) ?? [];
    const endpointCount = endpoints.reduce((n, e) => n + (e.addresses?.length ?? 0), 0);
    out.push({ id: r.id, name: r.name, addressType: r.raw.addressType as string | undefined, endpointCount });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function podsForService(graph: ResourceGraph, service: Resource, nodeIps: Map<string, string>): DiagramPod[] {
  const endpoints = [...graph.nodes.values()].find(
    (r) => r.kind === 'Endpoints' && r.namespace === service.namespace && r.name === service.name,
  );
  if (!endpoints) return [];
  const subsets = (endpoints.raw.subsets as EndpointSubset[] | undefined) ?? [];
  const pods: DiagramPod[] = [];
  const push = (addr: EndpointAddress, ready: boolean) => {
    const uid = addr.targetRef?.kind === 'Pod' ? addr.targetRef.uid : undefined;
    const pod = uid ? graph.nodes.get(uid) : undefined;
    if (!pod) return;
    pods.push({
      id: pod.id,
      name: pod.name,
      namespace: pod.namespace,
      podIp: addr.ip,
      ready,
      nodeName: addr.nodeName,
      nodeIp: addr.nodeName ? nodeIps.get(addr.nodeName) : undefined,
    });
  };
  for (const s of subsets) {
    for (const a of s.addresses ?? []) push(a, true);
    for (const a of s.notReadyAddresses ?? []) push(a, false);
  }
  return pods;
}

/** All three Service-scoped diagrams (Client→Service→Pods, Ingress path, Service×Nodes) share this one
 *  projection over a chosen Service id — returns undefined if the id isn't a Service in the graph. */
export function projectServiceNetwork(graph: ResourceGraph, serviceId: ResourceId): ServiceNetworkView | undefined {
  const service = graph.nodes.get(serviceId);
  if (!service || service.kind !== 'Service') return undefined;

  const nodeIps = nodeIpMap(graph);
  const nodeIds = nodeIdMap(graph);
  const spec = service.raw.spec as
    | { clusterIP?: string; type?: string; ports?: ServicePort[]; selector?: Record<string, string> }
    | undefined;

  const pods = podsForService(graph, service, nodeIps);

  const byNode = new Map<string, DiagramPod[]>();
  for (const p of pods) {
    const key = p.nodeName ?? '(unscheduled)';
    const list = byNode.get(key) ?? [];
    list.push(p);
    byNode.set(key, list);
  }
  const nodes: DiagramNodeGroup[] = [...byNode.entries()]
    .map(([name, groupPods]) => ({ id: nodeIds.get(name), name, ip: nodeIps.get(name), pods: groupPods }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    service: {
      id: service.id,
      name: service.name,
      namespace: service.namespace,
      clusterIp: spec?.clusterIP,
      type: spec?.type ?? 'ClusterIP',
      ports: spec?.ports ?? [],
    },
    selector: spec?.selector ?? {},
    ingresses: ingressesForService(graph, service.name, service.namespace),
    pods,
    nodes,
    endpointSlices: endpointSlicesForService(graph, service.name, service.namespace),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Cluster topology (Node CIDR / overlay diagram)
// ---------------------------------------------------------------------------------------------------------

export interface TopologyNode {
  id: ResourceId;
  name: string;
  ip?: string;
  /** Declared spec.podCIDR when present. */
  podCidr?: string;
  /** Approximate /24 range(s) derived from the pods' actual IPs when podCIDR is absent — flagged as derived
   *  so the renderer can mark it (cloud/OpenShift nodes commonly omit spec.podCIDR). */
  derivedRanges: string[];
  podCount: number;
  pods: { id: ResourceId; name: string; podIp?: string }[];
}

export interface NetworkTopology {
  nodes: TopologyNode[];
  /** Overlay/tunnel encapsulation is a CNI-config fact, never in a get-snapshot — a fixed generic label the
   *  renderer draws as clearly not-from-snapshot. */
  overlayLabel: string;
}

/** How many pods to list inside each node box before the renderer collapses to "+N more" (podCount always
 *  reports the true total). */
const TOPOLOGY_PODS_PER_NODE = 6;

function derive24Ranges(podIps: string[]): string[] {
  const nets = new Set<string>();
  for (const ip of podIps) {
    const octets = ip.split('.');
    if (octets.length === 4) nets.add(`${octets[0]}.${octets[1]}.${octets[2]}.0/24`);
  }
  return [...nets].sort();
}

export function projectNetworkTopology(graph: ResourceGraph): NetworkTopology {
  const nodeIds = nodeIdMap(graph);
  const podsByNode = new Map<string, { id: ResourceId; name: string; podIp?: string }[]>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'Pod') continue;
    const nodeName = (r.raw.spec as { nodeName?: string } | undefined)?.nodeName;
    if (!nodeName) continue;
    const podIp = (r.raw.status as { podIP?: string } | undefined)?.podIP;
    const list = podsByNode.get(nodeName) ?? [];
    list.push({ id: r.id, name: r.name, podIp });
    podsByNode.set(nodeName, list);
  }

  const nodes: TopologyNode[] = [];
  for (const [name, id] of nodeIds) {
    const node = graph.nodes.get(id)!;
    const addresses = (node.raw.status as { addresses?: NodeAddress[] } | undefined)?.addresses ?? [];
    const ip = addresses.find((a) => a.type === 'InternalIP')?.address;
    const podCidr = (node.raw.spec as { podCIDR?: string } | undefined)?.podCIDR;
    const allPods = (podsByNode.get(name) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const derivedRanges = podCidr ? [] : derive24Ranges(allPods.map((p) => p.podIp).filter((x): x is string => !!x));
    nodes.push({
      id,
      name,
      ip,
      podCidr,
      derivedRanges,
      podCount: allPods.length,
      pods: allPods.slice(0, TOPOLOGY_PODS_PER_NODE),
    });
  }
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  return { nodes, overlayLabel: 'Overlay / Tunnel — VXLAN / Geneve / IP-in-IP (CNI-dependent)' };
}

// ---------------------------------------------------------------------------------------------------------
// Conceptual "layers" listing (the top-right reference block), enriched with real per-layer counts
// ---------------------------------------------------------------------------------------------------------

export interface NetworkLayerEntry {
  /** A real Kind count from this snapshot, or a generic mechanism with count omitted (count === undefined). */
  label: string;
  count?: number;
  /** When this entry's label is an INFERRED network-plane fact (not a raw count), the basis it was inferred
   *  from — so the view can show it as an educated guess with its evidence. */
  evidence?: string;
  /** The k8s Kind this entry represents, when it maps to one — the view renders its icon (background = the 3D
   *  wheel's kind color if the kind is drawn in the wheel, else light grey). Generic mechanisms (DNS, iptables,
   *  CNI, VPC…) leave it unset → no icon. */
  kind?: string;
  /** Node-kind entries render on the wheel's Worker-node background rather than the generic Node kind color. */
  nodeRole?: 'worker';
}
export interface NetworkLayer {
  title: string;
  entries: NetworkLayerEntry[];
}

export function projectNetworkLayers(graph: ResourceGraph): NetworkLayer[] {
  const counts = new Map<string, number>();
  let podsWithIp = 0;
  let lbServices = 0;
  for (const r of graph.nodes.values()) {
    counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    if (r.kind === 'Pod' && (r.raw.status as { podIP?: string } | undefined)?.podIP) podsWithIp++;
    if (r.kind === 'Service' && (r.raw.spec as { type?: string } | undefined)?.type === 'LoadBalancer') lbServices++;
  }
  const n = (k: string) => counts.get(k) ?? 0;
  // EndpointSlice is the modern discovery object; fall back to Endpoints if a snapshot only has those.
  const discovery: NetworkLayerEntry =
    n('EndpointSlice') > 0 ? { label: 'EndpointSlice', count: n('EndpointSlice'), kind: 'EndpointSlice' } : { label: 'Endpoints', count: n('Endpoints'), kind: 'Endpoints' };

  // Inferred plane facts upgrade the layers a snapshot can't count directly (data plane, CNI/overlay, and the
  // north-south DNS/LoadBalancer/Ingress/Gateway edge); when nothing's detectable the generic label stands.
  const plane = inferNetworkPlane(graph);
  const edge = inferNetworkEdge(graph);
  const dataPlaneEntry: NetworkLayerEntry = plane.dataPlane.value
    ? { label: plane.dataPlane.value, evidence: plane.dataPlane.evidence }
    : { label: 'kube-proxy / IPVS / iptables / eBPF' };
  const cniEntry: NetworkLayerEntry = plane.cni.value
    ? { label: `${plane.cni.value}${plane.overlay.value ? ` · ${plane.overlay.value}` : ''}`, evidence: [plane.cni.evidence, plane.overlay.evidence].filter(Boolean).join(' + ') }
    : { label: 'veth pairs / routing / overlay' };
  const dnsEntry: NetworkLayerEntry = edge.dns.value ? { label: edge.dns.value, evidence: edge.dns.evidence } : { label: 'DNS (CoreDNS)' };
  const lbEntry: NetworkLayerEntry = edge.loadBalancer.value
    ? { label: `LoadBalancer: ${edge.loadBalancer.value}`, count: edge.loadBalancerServiceCount, evidence: edge.loadBalancer.evidence, kind: 'Service' }
    : { label: 'LoadBalancer Services', count: lbServices, kind: 'Service' };
  const ingressEntry: NetworkLayerEntry = edge.ingress.value
    ? { label: `Ingress: ${edge.ingress.value}`, count: edge.ingressRouteCount, evidence: edge.ingress.evidence, kind: 'Ingress' }
    : { label: 'Ingress / Route', count: edge.ingressRouteCount, kind: 'Ingress' };
  const gatewayEntry: NetworkLayerEntry = edge.gateway.value
    ? { label: `Gateway API: ${edge.gateway.value}`, count: edge.gatewayResourceCount, evidence: edge.gateway.evidence, kind: 'Gateway' }
    : { label: 'Gateway API (not in use)', kind: 'Gateway' };
  const meshEntry: NetworkLayerEntry = edge.serviceMesh.value
    ? { label: `Mesh: ${edge.serviceMesh.value}`, count: edge.meshSidecarPods, evidence: edge.serviceMesh.evidence }
    : { label: 'Service Mesh (none detected)' };

  return [
    {
      title: 'Application Layer',
      entries: [
        { label: 'Deployment', count: n('Deployment'), kind: 'Deployment' },
        { label: 'ReplicaSet', count: n('ReplicaSet'), kind: 'ReplicaSet' },
        { label: 'StatefulSet', count: n('StatefulSet'), kind: 'StatefulSet' },
        { label: 'DaemonSet', count: n('DaemonSet'), kind: 'DaemonSet' },
        { label: 'Pod', count: n('Pod'), kind: 'Pod' },
      ],
    },
    {
      title: 'Ingress & Gateway (North-South)',
      entries: [ingressEntry, gatewayEntry],
    },
    {
      title: 'Service Mesh (L7, East-West)',
      entries: [meshEntry],
    },
    {
      title: 'Service Discovery Layer',
      entries: [{ label: 'Service', count: n('Service'), kind: 'Service' }, discovery, dnsEntry],
    },
    {
      title: 'Node Data Plane',
      entries: [{ label: 'Nodes', count: n('Node'), kind: 'Node', nodeRole: 'worker' }, dataPlaneEntry],
    },
    {
      title: 'CNI Network Layer',
      entries: [{ label: 'Pod IPs', count: podsWithIp, kind: 'Pod' }, cniEntry],
    },
    {
      title: 'Physical / Cloud Network',
      entries: [{ label: 'Node IPs', count: n('Node'), kind: 'Node', nodeRole: 'worker' }, lbEntry, { label: 'VPC / Subnet / firewall (cloud)' }],
    },
  ];
}
