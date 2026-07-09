import type { ResourceGraph } from '../graph';

/**
 * Best-effort inference of network-plane facts a `get` snapshot doesn't state outright (CNI plugin, overlay
 * encapsulation, data-plane mechanism, cluster Pod CIDR) from the fingerprints it DOES carry. Detection is
 * DATA-DRIVEN: each supported network is a declarative `NETWORK_CATALOG` entry (its DaemonSet names, node-
 * annotation prefixes, CRD groups, namespaces, OpenShift Network-CR type, and an overlay resolver) — adding
 * support for another CNI is one catalog row, not a logic change. Every returned fact carries an `evidence`
 * string naming what it was inferred from, so renderers present these as educated guesses WITH their basis,
 * never fabricated (mirrors the app's "honest about what's real" convention). A field with no `value` means
 * nothing was detectable — the caller falls back to its generic label.
 *
 * Detection matches EXACT DaemonSet names / annotation-key prefixes / CRD groups, never loose substrings —
 * real OpenShift snapshots contain resources whose names merely include "cilium"/"antrea", which naive
 * substring matching would misread as those CNIs.
 */
export interface NetworkInference {
  value?: string;
  evidence?: string;
}
export interface NetworkPlane {
  cni: NetworkInference;
  overlay: NetworkInference;
  dataPlane: NetworkInference;
  clusterPodCidr: NetworkInference;
}

interface NetworkCrData {
  networkType?: string;
  clusterNetwork?: { cidr?: string; hostPrefix?: number }[];
}

/** Everything the catalog's detectors read, gathered from one pass over the graph. */
interface DetectContext {
  dsNames: Set<string>;
  nodeAnnoKeys: Set<string>;
  crdGroups: Set<string>;
  namespaces: Set<string>;
  networkCrType?: string;
  cm: (name: string) => Record<string, string> | undefined;
  hasAnnoPrefix: (p: string) => boolean;
  hasAnnoSuffix: (s: string) => boolean;
  nodeAnnoValue: (key: string) => string | undefined;
  nodeHasPodCidr: boolean;
}

const RANK = { authoritative: 3, high: 2, medium: 1 } as const;
type Confidence = keyof typeof RANK;

interface CatalogEntry {
  id: string;
  name: string;
  /** Authoritative match: the OpenShift Network CR's networkType equals this. */
  networkCrType?: string;
  daemonSets?: string[];
  crdGroups?: string[];
  annoPrefixes?: string[];
  namespaces?: string[];
  /** Cloud-managed CNIs vary by version/config — their DaemonSet match is treated as medium, not high. */
  heuristic?: boolean;
  overlay: (ctx: DetectContext) => NetworkInference;
}

interface Match {
  confidence: Confidence;
  evidence: string;
}

/** First matching signal wins, strongest-first (CR > DaemonSet > CRD group > annotation > namespace). */
function matchEntry(e: CatalogEntry, ctx: DetectContext): Match | undefined {
  if (e.networkCrType && ctx.networkCrType === e.networkCrType) {
    return { confidence: 'authoritative', evidence: `Network CR networkType=${ctx.networkCrType}` };
  }
  const ds = e.daemonSets?.find((d) => ctx.dsNames.has(d));
  if (ds) return { confidence: e.heuristic ? 'medium' : 'high', evidence: `${ds} DaemonSet` };
  const crd = e.crdGroups?.find((g) => ctx.crdGroups.has(g));
  if (crd) return { confidence: 'high', evidence: `${crd} CRDs` };
  const anno = e.annoPrefixes?.find((p) => ctx.hasAnnoPrefix(p));
  if (anno) return { confidence: 'high', evidence: `${anno} node annotations` };
  const ns = e.namespaces?.find((n) => ctx.namespaces.has(n));
  if (ns) return { confidence: 'medium', evidence: `${ns} namespace` };
  return undefined;
}

// ---- The catalog --------------------------------------------------------------------------------------------
// Order matters only as a tie-break when two entries match at equal confidence; put the more specific/common
// first. Authoritative (Network CR) always wins regardless of position.

const NETWORK_CATALOG: CatalogEntry[] = [
  {
    id: 'ovn-kubernetes',
    name: 'OVN-Kubernetes',
    networkCrType: 'OVNKubernetes',
    daemonSets: ['ovnkube-node'],
    annoPrefixes: ['k8s.ovn.org/'],
    overlay: () => ({ value: 'Geneve', evidence: 'OVN-Kubernetes encapsulates with Geneve' }),
  },
  {
    id: 'openshift-sdn',
    name: 'OpenShift SDN',
    networkCrType: 'OpenShiftSDN',
    daemonSets: ['sdn'],
    namespaces: ['openshift-sdn'],
    overlay: () => ({ value: 'VXLAN', evidence: 'OpenShift SDN encapsulates with VXLAN' }),
  },
  {
    id: 'calico',
    name: 'Calico',
    networkCrType: 'Calico',
    daemonSets: ['calico-node'],
    crdGroups: ['crd.projectcalico.org'],
    annoPrefixes: ['projectcalico.org/'],
    namespaces: ['calico-system', 'tigera-operator'],
    overlay: (ctx) => {
      if (ctx.hasAnnoSuffix('IPv4IPIPTunnelAddr')) return { value: 'IP-in-IP', evidence: 'projectcalico.org/IPv4IPIPTunnelAddr annotation' };
      if (ctx.hasAnnoSuffix('IPv4VXLANTunnelAddr')) return { value: 'VXLAN', evidence: 'projectcalico.org/IPv4VXLANTunnelAddr annotation' };
      return { value: 'BGP (no overlay)', evidence: 'Calico with no tunnel annotation present' };
    },
  },
  {
    id: 'cilium',
    name: 'Cilium',
    daemonSets: ['cilium'],
    crdGroups: ['cilium.io'],
    overlay: (ctx) => {
      const cfg = ctx.cm('cilium-config');
      if (cfg?.['routing-mode'] === 'native') return { value: 'native routing (no overlay)', evidence: 'cilium-config routing-mode=native' };
      const tunnel = cfg?.['tunnel-protocol'] ?? cfg?.['tunnel'];
      if (tunnel) return { value: tunnel.toUpperCase(), evidence: `cilium-config tunnel=${tunnel}` };
      return { value: 'VXLAN', evidence: 'Cilium default tunnel' };
    },
  },
  {
    id: 'flannel',
    name: 'Flannel',
    daemonSets: ['kube-flannel-ds'],
    annoPrefixes: ['flannel.alpha.coreos.com/'],
    overlay: (ctx) => {
      const bt = ctx.nodeAnnoValue('flannel.alpha.coreos.com/backend-type') ?? flannelBackendType(ctx);
      if (bt) return { value: bt === 'host-gw' ? 'host-gw (no overlay)' : bt.toUpperCase(), evidence: `flannel backend-type=${bt}` };
      return { value: 'VXLAN', evidence: 'Flannel default backend' };
    },
  },
  {
    id: 'canal',
    name: 'Canal (Flannel + Calico)',
    daemonSets: ['canal'],
    overlay: () => ({ value: 'VXLAN (Flannel) + Calico policy', evidence: 'canal DaemonSet' }),
  },
  {
    id: 'antrea',
    name: 'Antrea',
    daemonSets: ['antrea-agent'],
    crdGroups: ['antrea.io', 'crd.antrea.io'],
    overlay: (ctx) => {
      const cfg = ctx.cm('antrea-config');
      const tt = cfg?.['antrea-agent.conf']?.match(/tunnelType:\s*(\w+)/)?.[1];
      if (tt) return { value: tt.toUpperCase(), evidence: `antrea-config tunnelType=${tt}` };
      return { value: 'Geneve', evidence: 'Antrea default tunnel (Geneve)' };
    },
  },
  {
    id: 'aws-vpc-cni',
    name: 'AWS VPC CNI',
    daemonSets: ['aws-node'],
    crdGroups: ['crd.k8s.amazonaws.com'],
    overlay: () => ({ value: 'none — VPC-native pod IPs (ENI)', evidence: 'AWS VPC CNI assigns real VPC IPs' }),
  },
  {
    id: 'azure-cni',
    name: 'Azure CNI',
    daemonSets: ['azure-cns', 'azure-npm'],
    heuristic: true,
    overlay: () => ({ value: 'none / Azure CNI Overlay (config-dependent)', evidence: 'Azure CNI DaemonSet' }),
  },
  {
    id: 'gke-dataplane-v2',
    name: 'GKE Dataplane V2',
    daemonSets: ['anetd'],
    overlay: () => ({ value: 'native (Google fabric)', evidence: 'GKE Dataplane V2 (anetd/Cilium)' }),
  },
  {
    id: 'gke-classic',
    name: 'GKE (classic)',
    daemonSets: ['netd'],
    heuristic: true,
    overlay: () => ({ value: 'native (Google fabric)', evidence: 'GKE netd DaemonSet' }),
  },
  {
    id: 'weave',
    name: 'Weave Net',
    daemonSets: ['weave-net'],
    overlay: () => ({ value: 'VXLAN (fast datapath) / sleeve fallback', evidence: 'weave-net DaemonSet' }),
  },
  {
    id: 'kube-router',
    name: 'Kube-router',
    daemonSets: ['kube-router'],
    overlay: () => ({ value: 'none (BGP) / optional IPIP', evidence: 'kube-router DaemonSet' }),
  },
  {
    id: 'kindnet',
    name: 'kindnet',
    daemonSets: ['kindnet'],
    overlay: () => ({ value: 'none (direct host routing)', evidence: 'kindnet routes via the host, no overlay' }),
  },
];

/** Data-plane mechanisms per matched CNI when no kube-proxy DaemonSet is present. */
const DATAPLANE_WITHOUT_KUBEPROXY: Record<string, NetworkInference> = {
  cilium: { value: 'eBPF (Cilium kube-proxy replacement)', evidence: 'cilium present, no kube-proxy DaemonSet' },
  'gke-dataplane-v2': { value: 'eBPF (GKE Dataplane V2)', evidence: 'anetd present, no kube-proxy DaemonSet' },
  'ovn-kubernetes': { value: 'OVN-Kubernetes built-in (no kube-proxy)', evidence: 'OVN with no kube-proxy DaemonSet' },
  'openshift-sdn': { value: 'iptables (OpenShift SDN)', evidence: 'OpenShift SDN with no kube-proxy DaemonSet' },
  'kube-router': { value: 'IPVS (kube-router)', evidence: 'kube-router with no kube-proxy DaemonSet' },
};

function parseKubeProxyMode(data: Record<string, string> | undefined): string {
  if (!data) return 'iptables';
  const m = /(?:^|\n)\s*mode:\s*"?([a-zA-Z]*)"?/.exec(Object.values(data).join('\n'));
  const mode = m?.[1]?.trim();
  return mode ? mode : 'iptables'; // empty `mode: ""` is the iptables default
}

function flannelBackendType(ctx: DetectContext): string | undefined {
  const cfg = ctx.cm('kube-flannel-cfg');
  if (!cfg?.['net-conf.json']) return undefined;
  try {
    return (JSON.parse(cfg['net-conf.json']) as { Backend?: { Type?: string } }).Backend?.Type;
  } catch {
    return undefined;
  }
}

export function inferNetworkPlane(graph: ResourceGraph): NetworkPlane {
  const dsNames = new Set<string>();
  const nodeAnnoKeys = new Set<string>();
  const crdGroups = new Set<string>();
  const namespaces = new Set<string>();
  const cms = new Map<string, Record<string, string>>();
  let networkCr: NetworkCrData | undefined;
  let nodeHasPodCidr = false;
  let multusPresent = false;

  for (const r of graph.nodes.values()) {
    if (r.kind === 'DaemonSet') {
      const n = r.name.toLowerCase();
      dsNames.add(n);
      if (n === 'multus') multusPresent = true;
    } else if (r.kind === 'Node') {
      const md = r.raw.metadata as { annotations?: Record<string, string> } | undefined;
      for (const k of Object.keys(md?.annotations ?? {})) nodeAnnoKeys.add(k);
      if ((r.raw.spec as { podCIDR?: string } | undefined)?.podCIDR) nodeHasPodCidr = true;
    } else if (r.kind === 'ConfigMap') {
      if (!cms.has(r.name)) cms.set(r.name, (r.raw.data as Record<string, string> | undefined) ?? {});
    } else if (r.kind === 'Namespace' || r.kind === 'Project') {
      namespaces.add(r.name);
    } else if (r.kind === 'CustomResourceDefinition') {
      const g = (r.raw.spec as { group?: string } | undefined)?.group;
      if (g) crdGroups.add(g);
      if (g === 'k8s.cni.cncf.io') multusPresent = true;
    } else if (r.kind === 'Network') {
      const spec = r.raw.spec as NetworkCrData | undefined;
      const status = r.raw.status as NetworkCrData | undefined;
      const merged: NetworkCrData = {
        networkType: status?.networkType ?? spec?.networkType,
        clusterNetwork: status?.clusterNetwork ?? spec?.clusterNetwork,
      };
      if (!networkCr || (merged.clusterNetwork?.length && !networkCr.clusterNetwork?.length)) networkCr = merged;
    }
  }

  const ctx: DetectContext = {
    dsNames,
    nodeAnnoKeys,
    crdGroups,
    namespaces,
    networkCrType: networkCr?.networkType,
    cm: (name) => cms.get(name),
    hasAnnoPrefix: (p) => [...nodeAnnoKeys].some((k) => k.startsWith(p)),
    hasAnnoSuffix: (s) => [...nodeAnnoKeys].some((k) => k.endsWith(s)),
    nodeAnnoValue: (key) => {
      for (const r of graph.nodes.values()) {
        if (r.kind !== 'Node') continue;
        const v = (r.raw.metadata as { annotations?: Record<string, string> } | undefined)?.annotations?.[key];
        if (v) return v;
      }
      return undefined;
    },
    nodeHasPodCidr,
  };

  // Pick the strongest-confidence catalog match (tie → catalog order).
  let best: { entry: CatalogEntry; match: Match } | undefined;
  for (const entry of NETWORK_CATALOG) {
    const match = matchEntry(entry, ctx);
    if (match && (!best || RANK[match.confidence] > RANK[best.match.confidence])) best = { entry, match };
  }

  const cni = resolveCni();
  const overlay = best ? best.entry.overlay(ctx) : {};
  const dataPlane = resolveDataPlane();
  const clusterPodCidr = resolvePodCidr();
  return { cni, overlay, dataPlane, clusterPodCidr };

  function resolveCni(): NetworkInference {
    if (best) {
      const multus = multusPresent ? ' · Multus multi-network present' : '';
      return { value: best.entry.name, evidence: best.match.evidence + multus };
    }
    // Fallback: no CNI fingerprint, but nodes carry a podCIDR → likely kubenet or an undetected plugin.
    if (nodeHasPodCidr) return { value: 'kubenet or undetected CNI', evidence: 'node.spec.podCIDR set, no CNI DaemonSet/CRD detected' };
    return {};
  }

  function resolveDataPlane(): NetworkInference {
    if (dsNames.has('kube-proxy')) {
      const cfg = cms.get('kube-proxy') ?? cms.get('kube-proxy-config');
      return { value: `kube-proxy (${parseKubeProxyMode(cfg)})`, evidence: cfg ? 'kube-proxy ConfigMap mode' : 'kube-proxy DaemonSet' };
    }
    return (best && DATAPLANE_WITHOUT_KUBEPROXY[best.entry.id]) ?? {};
  }

  function resolvePodCidr(): NetworkInference {
    const cn = networkCr?.clusterNetwork?.[0];
    if (cn?.cidr) return { value: `${cn.cidr}${cn.hostPrefix ? ` (/${cn.hostPrefix} per node)` : ''}`, evidence: 'Network CR clusterNetwork' };
    const kubeadm = cms.get('kubeadm-config');
    if (kubeadm) {
      const m = /podSubnet:\s*([\d./]+)/.exec(Object.values(kubeadm).join('\n'));
      if (m) return { value: m[1], evidence: 'kubeadm-config podSubnet' };
    }
    const flannel = cms.get('kube-flannel-cfg');
    if (flannel?.['net-conf.json']) {
      try {
        const net = (JSON.parse(flannel['net-conf.json']) as { Network?: string }).Network;
        if (net) return { value: net, evidence: 'kube-flannel-cfg net-conf.json Network' };
      } catch {
        // malformed net-conf — fall through
      }
    }
    return {};
  }
}

/** The set of networks the inference engine can identify, for reference/UI listing. */
export const SUPPORTED_NETWORKS: { id: string; name: string }[] = NETWORK_CATALOG.map((e) => ({ id: e.id, name: e.name }));

// ---- Edge / north-south stack (LoadBalancer, DNS, Ingress, Gateway) -----------------------------------------

/**
 * Inference for the north-south / edge network stack — WHO provides LoadBalancer Services, cluster DNS, the
 * Ingress controller(s), and the Gateway-API implementation. Same evidence-carrying, honest-fallback contract
 * as `inferNetworkPlane`. The authoritative identifiers are `IngressClass.spec.controller` and
 * `GatewayClass.spec.controllerName` (verified across real snapshots) — those are preferred over noisy
 * name/namespace heuristics (OpenShift OperatorHub catalogs contain resources merely NAMED "ingress-nginx"/
 * "kong", so substring matching on Deployment names would false-positive).
 */
export interface NetworkEdge {
  loadBalancer: NetworkInference;
  loadBalancerServiceCount: number;
  dns: NetworkInference;
  ingress: NetworkInference;
  /** Ingress + Route objects (both are ingress records; Route is OpenShift's). */
  ingressRouteCount: number;
  gateway: NetworkInference;
  /** Gateway + HTTPRoute objects. */
  gatewayResourceCount: number;
  /** East-west L7 service mesh (Istio/Linkerd/Consul/...) when detectable, else empty. */
  serviceMesh: NetworkInference;
  /** Pods carrying a known mesh sidecar container — the real adoption signal. */
  meshSidecarPods: number;
}

/**
 * Service-mesh catalog. Detection priority: CRD group (authoritative) > control-plane Deployment > ambient
 * DaemonSet > injected sidecar container > namespace. `sidecar` is the mesh's data-plane container name — a
 * pod literally running it is proof of injection (and a strong id signal even without the control plane in
 * this snapshot).
 */
interface MeshEntry {
  id: string;
  name: string;
  crdGroups?: string[];
  deploys?: string[];
  daemonSets?: string[];
  /** Sidecar / data-plane container name injected into meshed pods. */
  sidecar?: string;
  namespaces?: string[];
}
const MESH_CATALOG: MeshEntry[] = [
  { id: 'istio', name: 'Istio', crdGroups: ['install.istio.io', 'networking.istio.io', 'security.istio.io'], deploys: ['istiod'], daemonSets: ['ztunnel'], sidecar: 'istio-proxy', namespaces: ['istio-system'] },
  // OpenShift Service Mesh IS Istio — identified by its own maistra.io CRD; its pods run the shared
  // `istio-proxy` sidecar, which the plain Istio entry above already attributes (a sidecar alone can't
  // distinguish OSSM from upstream Istio anyway), so no separate sidecar mapping here.
  { id: 'openshift-service-mesh', name: 'OpenShift Service Mesh (Istio)', crdGroups: ['maistra.io'] },
  { id: 'linkerd', name: 'Linkerd', crdGroups: ['linkerd.io', 'policy.linkerd.io'], deploys: ['linkerd-destination', 'linkerd-identity', 'linkerd-proxy-injector'], sidecar: 'linkerd-proxy', namespaces: ['linkerd'] },
  { id: 'consul', name: 'Consul', crdGroups: ['consul.hashicorp.com'], deploys: ['consul-connect-injector'], sidecar: 'consul-dataplane', namespaces: ['consul'] },
  { id: 'kuma', name: 'Kuma / Kong Mesh', crdGroups: ['kuma.io'], deploys: ['kuma-control-plane'], sidecar: 'kuma-sidecar', namespaces: ['kuma-system'] },
  { id: 'osm', name: 'Open Service Mesh', crdGroups: ['config.openservicemesh.io'], deploys: ['osm-controller'], namespaces: ['osm-system'] },
  { id: 'appmesh', name: 'AWS App Mesh', crdGroups: ['appmesh.k8s.aws'], deploys: ['appmesh-controller'] },
];
/** All known mesh sidecar container names → owning mesh id, for the injection scan. */
const MESH_SIDECARS = new Map<string, string>(MESH_CATALOG.filter((m) => m.sidecar).map((m) => [m.sidecar!, m.id]));

/** IngressClass.spec.controller → friendly name. Unlisted controllers fall through to the raw string. */
const INGRESS_CONTROLLERS: Record<string, string> = {
  'k8s.io/ingress-nginx': 'NGINX Ingress',
  'openshift.io/ingress-to-route': 'OpenShift Router',
  'traefik.io/ingress-controller': 'Traefik',
  'haproxy.org/ingress-controller': 'HAProxy Ingress',
  'projectcontour.io/contour': 'Contour',
  'projectcontour.io/ingress-controller': 'Contour',
  'kong.io/ingress-controller': 'Kong',
  'acnodal.io/purelb': 'PureLB',
};
/** GatewayClass.spec.controllerName → friendly name. */
const GATEWAY_CONTROLLERS: Record<string, string> = {
  'istio.io/gateway-controller': 'Istio',
  'gateway.envoyproxy.io/gatewayclass-controller': 'Envoy Gateway',
  'cilium.io/gateway-controller': 'Cilium Gateway',
  'nginx.org/gateway-controller': 'NGINX Gateway Fabric',
  'gateway.nginx.org/nginx-gateway-fabric': 'NGINX Gateway Fabric',
  'haproxy.org/gateway-controller': 'HAProxy',
  'openshift.io/gateway-controller/v1': 'OpenShift Gateway',
};

export function inferNetworkEdge(graph: ResourceGraph): NetworkEdge {
  const deployNames = new Set<string>();
  const dsNames = new Set<string>();
  const namespaces = new Set<string>();
  const crdGroups = new Set<string>();
  const cms = new Map<string, boolean>();
  const ingressClassControllers = new Set<string>();
  const gatewayClassControllers = new Set<string>();
  let lbSvc = 0;
  let lbSvcWithIp = 0;
  let ingressRouteCount = 0;
  let gatewayResourceCount = 0;
  let meshSidecarPods = 0;
  const meshSidecarIds = new Set<string>();

  for (const r of graph.nodes.values()) {
    switch (r.kind) {
      case 'Deployment':
        deployNames.add(r.name.toLowerCase());
        break;
      case 'DaemonSet':
        dsNames.add(r.name.toLowerCase());
        break;
      case 'Namespace':
      case 'Project':
        namespaces.add(r.name);
        break;
      case 'ConfigMap':
        cms.set(r.name, true);
        break;
      case 'CustomResourceDefinition': {
        const g = (r.raw.spec as { group?: string } | undefined)?.group;
        if (g) crdGroups.add(g);
        break;
      }
      case 'Service':
        if ((r.raw.spec as { type?: string } | undefined)?.type === 'LoadBalancer') {
          lbSvc++;
          const ing = (r.raw.status as { loadBalancer?: { ingress?: unknown[] } } | undefined)?.loadBalancer?.ingress;
          if (ing && ing.length > 0) lbSvcWithIp++;
        }
        break;
      case 'IngressClass': {
        const c = (r.raw.spec as { controller?: string } | undefined)?.controller;
        if (c) ingressClassControllers.add(c);
        break;
      }
      case 'GatewayClass': {
        const c = (r.raw.spec as { controllerName?: string } | undefined)?.controllerName;
        if (c) gatewayClassControllers.add(c);
        break;
      }
      case 'Ingress':
      case 'Route':
        ingressRouteCount++;
        break;
      case 'Gateway':
      case 'HTTPRoute':
        gatewayResourceCount++;
        break;
      case 'Pod': {
        const containers = (r.raw.spec as { containers?: { name?: string }[] } | undefined)?.containers ?? [];
        let injected = false;
        for (const c of containers) {
          const meshId = c.name ? MESH_SIDECARS.get(c.name) : undefined;
          if (meshId) {
            meshSidecarIds.add(meshId);
            injected = true;
          }
        }
        if (injected) meshSidecarPods++;
        break;
      }
    }
  }

  return {
    loadBalancer: detectLoadBalancer(),
    loadBalancerServiceCount: lbSvc,
    dns: detectDns(),
    ingress: detectIngress(),
    ingressRouteCount,
    gateway: detectGateway(),
    gatewayResourceCount,
    serviceMesh: detectMesh(),
    meshSidecarPods,
  };

  function detectMesh(): NetworkInference {
    for (const m of MESH_CATALOG) {
      const crd = m.crdGroups?.find((g) => crdGroups.has(g));
      if (crd) return meshResult(m, `${crd} CRDs`);
      const dep = m.deploys?.find((d) => deployNames.has(d));
      if (dep) return meshResult(m, `${dep} Deployment`);
      const ds = m.daemonSets?.find((d) => dsNames.has(d));
      if (ds) return meshResult(m, `${ds} DaemonSet`);
      if (m.sidecar && meshSidecarIds.has(m.id)) return meshResult(m, `${m.sidecar} sidecar container`);
      const ns = m.namespaces?.find((n) => namespaces.has(n));
      if (ns) return meshResult(m, `${ns} namespace`);
    }
    return {};
  }
  function meshResult(m: MeshEntry, evidence: string): NetworkInference {
    const sidecars = m.sidecar && meshSidecarIds.has(m.id) && !evidence.includes('sidecar') ? ` + ${m.sidecar} sidecars` : '';
    return { value: m.name, evidence: evidence + sidecars };
  }

  function detectLoadBalancer(): NetworkInference {
    if (namespaces.has('metallb-system') || crdGroups.has('metallb.io') || dsNames.has('speaker')) return { value: 'MetalLB', evidence: 'MetalLB (metallb-system / metallb.io)' };
    if (dsNames.has('kube-vip') || dsNames.has('kube-vip-ds')) return { value: 'kube-vip', evidence: 'kube-vip DaemonSet' };
    if (namespaces.has('purelb') || crdGroups.has('purelb.io')) return { value: 'PureLB', evidence: 'PureLB (purelb / purelb.io)' };
    if (deployNames.has('openelb-manager') || crdGroups.has('network.kubesphere.io')) return { value: 'OpenELB', evidence: 'OpenELB' };
    if (lbSvc > 0) return { value: 'cloud provider / external LB', evidence: `${lbSvc} LoadBalancer Service${lbSvc === 1 ? '' : 's'}${lbSvcWithIp ? ', ingress IP assigned' : ''}` };
    return {};
  }

  function detectDns(): NetworkInference {
    const nodeLocal = dsNames.has('node-local-dns') ? ' + NodeLocal DNSCache' : '';
    if (deployNames.has('coredns')) return { value: `CoreDNS${nodeLocal}`, evidence: 'coredns Deployment' };
    if (dsNames.has('dns-default') || namespaces.has('openshift-dns')) return { value: `CoreDNS${nodeLocal}`, evidence: 'dns-default DaemonSet (openshift-dns)' };
    if (cms.has('coredns')) return { value: `CoreDNS${nodeLocal}`, evidence: 'coredns ConfigMap' };
    if (deployNames.has('kube-dns')) return { value: `kube-dns${nodeLocal}`, evidence: 'kube-dns Deployment' };
    return {};
  }

  function detectIngress(): NetworkInference {
    if (ingressClassControllers.size) {
      const names = [...ingressClassControllers].map((c) => INGRESS_CONTROLLERS[c] ?? c);
      return { value: names.join(', '), evidence: `IngressClass controller${ingressClassControllers.size > 1 ? 's' : ''}` };
    }
    if (deployNames.has('router-default')) return { value: 'OpenShift Router', evidence: 'router-default Deployment (openshift-ingress)' };
    if (deployNames.has('ingress-nginx-controller')) return { value: 'NGINX Ingress', evidence: 'ingress-nginx-controller Deployment' };
    if (deployNames.has('traefik')) return { value: 'Traefik', evidence: 'traefik Deployment' };
    return {};
  }

  function detectGateway(): NetworkInference {
    if (gatewayClassControllers.size) {
      const names = [...gatewayClassControllers].map((c) => GATEWAY_CONTROLLERS[c] ?? c);
      return { value: names.join(', '), evidence: `GatewayClass controllerName${gatewayClassControllers.size > 1 ? 's' : ''}` };
    }
    if (gatewayResourceCount > 0) return { value: 'Gateway API in use (controller not identified)', evidence: `${gatewayResourceCount} Gateway/HTTPRoute object(s)` };
    return {};
  }
}
