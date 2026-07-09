import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph';
import { inferNetworkPlane, inferNetworkEdge } from './networkInference';
import type { RawObject } from '../types';

const ds = (name: string): RawObject => ({ apiVersion: 'apps/v1', kind: 'DaemonSet', metadata: { uid: `ds-${name}`, name, namespace: 'kube-system' } });
const node = (name: string, annotations?: Record<string, string>): RawObject => ({
  apiVersion: 'v1',
  kind: 'Node',
  metadata: { uid: `node-${name}`, name, annotations },
});

describe('inferNetworkPlane', () => {
  it('reads the OpenShift Network CR for CNI, overlay, and cluster CIDR (authoritative)', () => {
    const networkCr: RawObject = {
      apiVersion: 'config.openshift.io/v1',
      kind: 'Network',
      metadata: { uid: 'net', name: 'cluster' },
      spec: { networkType: 'OpenShiftSDN', clusterNetwork: [{ cidr: '10.128.0.0/14', hostPrefix: 23 }] },
      status: { networkType: 'OpenShiftSDN', clusterNetwork: [{ cidr: '10.128.0.0/14', hostPrefix: 23 }] },
    };
    const plane = inferNetworkPlane(buildGraph([networkCr, ds('sdn')]));
    expect(plane.cni).toEqual({ value: 'OpenShift SDN', evidence: 'Network CR networkType=OpenShiftSDN' });
    expect(plane.overlay.value).toBe('VXLAN');
    expect(plane.clusterPodCidr).toEqual({ value: '10.128.0.0/14 (/23 per node)', evidence: 'Network CR clusterNetwork' });
  });

  it('detects OVN-Kubernetes (Geneve, built-in data plane) from the ovnkube-node DaemonSet', () => {
    const plane = inferNetworkPlane(buildGraph([ds('ovnkube-node'), node('a', { 'k8s.ovn.org/node-subnets': '{}' })]));
    expect(plane.cni.value).toBe('OVN-Kubernetes');
    expect(plane.overlay.value).toBe('Geneve');
    expect(plane.dataPlane.value).toContain('OVN-Kubernetes built-in');
  });

  it('detects Calico + IP-in-IP from the projectcalico.org tunnel annotation', () => {
    const plane = inferNetworkPlane(
      buildGraph([ds('calico-node'), ds('kube-proxy'), node('a', { 'projectcalico.org/IPv4IPIPTunnelAddr': '10.0.0.1' })]),
    );
    expect(plane.cni.value).toBe('Calico');
    expect(plane.overlay).toEqual({ value: 'IP-in-IP', evidence: 'projectcalico.org/IPv4IPIPTunnelAddr annotation' });
  });

  it('reads Flannel backend-type + cluster CIDR from the node annotation and kube-flannel-cfg', () => {
    const flannelCfg: RawObject = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { uid: 'fc', name: 'kube-flannel-cfg', namespace: 'kube-flannel' },
      data: { 'net-conf.json': JSON.stringify({ Network: '10.244.0.0/16', Backend: { Type: 'vxlan' } }) },
    };
    const plane = inferNetworkPlane(
      buildGraph([ds('kube-flannel-ds'), flannelCfg, node('a', { 'flannel.alpha.coreos.com/backend-type': 'vxlan' })]),
    );
    expect(plane.cni.value).toBe('Flannel');
    expect(plane.overlay.value).toBe('VXLAN');
    expect(plane.clusterPodCidr).toEqual({ value: '10.244.0.0/16', evidence: 'kube-flannel-cfg net-conf.json Network' });
  });

  it('parses the kube-proxy ConfigMap mode, treating an empty mode as the iptables default', () => {
    const kpEmpty: RawObject = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { uid: 'kp', name: 'kube-proxy', namespace: 'kube-system' },
      data: { 'config.conf': 'kind: KubeProxyConfiguration\nmode: ""\n' },
    };
    const plane = inferNetworkPlane(buildGraph([ds('kube-proxy'), kpEmpty]));
    expect(plane.dataPlane.value).toBe('kube-proxy (iptables)');

    const kpIpvs: RawObject = { ...kpEmpty, data: { 'config.conf': 'mode: "ipvs"\n' } };
    expect(inferNetworkPlane(buildGraph([ds('kube-proxy'), kpIpvs])).dataPlane.value).toBe('kube-proxy (ipvs)');
  });

  it('infers eBPF data-plane for Cilium when no kube-proxy DaemonSet is present', () => {
    const plane = inferNetworkPlane(buildGraph([ds('cilium')]));
    expect(plane.cni.value).toBe('Cilium');
    expect(plane.dataPlane.value).toContain('eBPF');
  });

  it('returns empty inferences (no fabrication) when the snapshot has no network fingerprints', () => {
    const plane = inferNetworkPlane(buildGraph([node('a')]));
    expect(plane.cni.value).toBeUndefined();
    expect(plane.overlay.value).toBeUndefined();
    expect(plane.dataPlane.value).toBeUndefined();
    expect(plane.clusterPodCidr.value).toBeUndefined();
  });

  it('detects AWS VPC CNI (no overlay, VPC-native IPs) from the aws-node DaemonSet', () => {
    const plane = inferNetworkPlane(buildGraph([ds('aws-node'), ds('kube-proxy')]));
    expect(plane.cni.value).toBe('AWS VPC CNI');
    expect(plane.overlay.value).toContain('VPC-native');
  });

  it('detects a CNI from its CRD group even without the DaemonSet (e.g. cilium.io)', () => {
    const crd: RawObject = {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: { uid: 'crd-1', name: 'ciliumnetworkpolicies.cilium.io' },
      spec: { group: 'cilium.io' },
    };
    const plane = inferNetworkPlane(buildGraph([crd]));
    expect(plane.cni).toEqual({ value: 'Cilium', evidence: 'cilium.io CRDs' });
  });

  it('appends a Multus note to the primary CNI without letting Multus override it', () => {
    const plane = inferNetworkPlane(buildGraph([ds('calico-node'), ds('multus'), node('a')]));
    expect(plane.cni.value).toBe('Calico');
    expect(plane.cni.evidence).toContain('Multus multi-network present');
  });

  it('falls back to kubenet/undetected when a node has a podCIDR but no CNI fingerprint', () => {
    const withCidr: RawObject = { apiVersion: 'v1', kind: 'Node', metadata: { uid: 'n', name: 'n' }, spec: { podCIDR: '10.244.0.0/24' } };
    const plane = inferNetworkPlane(buildGraph([withCidr, ds('kube-proxy')]));
    expect(plane.cni.value).toBe('kubenet or undetected CNI');
  });

  it('prefers the authoritative Network CR over a DaemonSet match at lower confidence', () => {
    const networkCr: RawObject = {
      apiVersion: 'config.openshift.io/v1',
      kind: 'Network',
      metadata: { uid: 'net', name: 'cluster' },
      status: { networkType: 'OVNKubernetes' },
    };
    // A stray 'sdn' DaemonSet must NOT win over the CR that says OVNKubernetes.
    const plane = inferNetworkPlane(buildGraph([networkCr, ds('sdn'), ds('ovnkube-node')]));
    expect(plane.cni.value).toBe('OVN-Kubernetes');
    expect(plane.cni.evidence).toContain('Network CR');
  });
});

const deploy = (name: string): RawObject => ({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: { uid: `dep-${name}`, name, namespace: 'kube-system' } });
const ingressClass = (controller: string): RawObject => ({
  apiVersion: 'networking.k8s.io/v1',
  kind: 'IngressClass',
  metadata: { uid: `ic-${controller}`, name: controller.split('/').pop() ?? 'ic' },
  spec: { controller },
});
const lbService = (name: string, withIp = true): RawObject => ({
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { uid: `svc-${name}`, name, namespace: 'default' },
  spec: { type: 'LoadBalancer' },
  status: withIp ? { loadBalancer: { ingress: [{ ip: '1.2.3.4' }] } } : {},
});

describe('inferNetworkEdge', () => {
  it('identifies the Ingress controller authoritatively from IngressClass.spec.controller', () => {
    const edge = inferNetworkEdge(buildGraph([ingressClass('k8s.io/ingress-nginx')]));
    expect(edge.ingress).toEqual({ value: 'NGINX Ingress', evidence: 'IngressClass controller' });
  });

  it('maps the OpenShift ingress-to-route controller and counts Routes as ingress records', () => {
    const route = (n: string): RawObject => ({ apiVersion: 'route.openshift.io/v1', kind: 'Route', metadata: { uid: n, name: n, namespace: 'default' }, spec: {} });
    const edge = inferNetworkEdge(buildGraph([ingressClass('openshift.io/ingress-to-route'), route('r1'), route('r2')]));
    expect(edge.ingress.value).toBe('OpenShift Router');
    expect(edge.ingressRouteCount).toBe(2);
  });

  it('reports a cloud/external LoadBalancer when LB Services exist but no in-cluster impl is present', () => {
    const edge = inferNetworkEdge(buildGraph([lbService('a'), lbService('b')]));
    expect(edge.loadBalancer.value).toBe('cloud provider / external LB');
    expect(edge.loadBalancerServiceCount).toBe(2);
    expect(edge.loadBalancer.evidence).toContain('ingress IP assigned');
  });

  it('detects MetalLB from its namespace/CRD ahead of the cloud fallback', () => {
    const crd: RawObject = { apiVersion: 'apiextensions.k8s.io/v1', kind: 'CustomResourceDefinition', metadata: { uid: 'c', name: 'ipaddresspools.metallb.io' }, spec: { group: 'metallb.io' } };
    const edge = inferNetworkEdge(buildGraph([crd, lbService('a')]));
    expect(edge.loadBalancer.value).toBe('MetalLB');
  });

  it('detects OpenShift CoreDNS from the dns-default DaemonSet, not just a coredns Deployment', () => {
    const dnsDefault: RawObject = { apiVersion: 'apps/v1', kind: 'DaemonSet', metadata: { uid: 'dd', name: 'dns-default', namespace: 'openshift-dns' } };
    expect(inferNetworkEdge(buildGraph([dnsDefault])).dns.value).toBe('CoreDNS');
    expect(inferNetworkEdge(buildGraph([deploy('coredns')])).dns.value).toBe('CoreDNS');
  });

  it('identifies the Gateway-API implementation from GatewayClass.spec.controllerName', () => {
    const gc: RawObject = { apiVersion: 'gateway.networking.k8s.io/v1', kind: 'GatewayClass', metadata: { uid: 'gc', name: 'istio' }, spec: { controllerName: 'istio.io/gateway-controller' } };
    const httproute: RawObject = { apiVersion: 'gateway.networking.k8s.io/v1', kind: 'HTTPRoute', metadata: { uid: 'h', name: 'h', namespace: 'default' } };
    const edge = inferNetworkEdge(buildGraph([gc, httproute]));
    expect(edge.gateway.value).toBe('Istio');
    expect(edge.gatewayResourceCount).toBe(1);
  });

  it('returns empty edge inferences (no fabrication) for a cluster with no edge fingerprints', () => {
    const edge = inferNetworkEdge(buildGraph([deploy('nothing-relevant')]));
    expect(edge.loadBalancer.value).toBeUndefined();
    expect(edge.dns.value).toBeUndefined();
    expect(edge.ingress.value).toBeUndefined();
    expect(edge.gateway.value).toBeUndefined();
    expect(edge.serviceMesh.value).toBeUndefined();
    expect(edge.meshSidecarPods).toBe(0);
  });
});

const istioProxyPod = (name: string): RawObject => ({
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: { uid: `pod-${name}`, name, namespace: 'default' },
  spec: { containers: [{ name: 'app' }, { name: 'istio-proxy' }] },
});
const meshCrd = (group: string): RawObject => ({
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: { uid: `crd-${group}`, name: `x.${group}` },
  spec: { group },
});

describe('inferNetworkEdge — service mesh', () => {
  it('identifies Istio from its CRD group and counts sidecar-injected pods', () => {
    const edge = inferNetworkEdge(buildGraph([meshCrd('networking.istio.io'), istioProxyPod('a'), istioProxyPod('b')]));
    expect(edge.serviceMesh.value).toBe('Istio');
    expect(edge.serviceMesh.evidence).toContain('networking.istio.io');
    expect(edge.meshSidecarPods).toBe(2);
  });

  it('identifies Linkerd from its control-plane Deployment', () => {
    const dep: RawObject = { apiVersion: 'apps/v1', kind: 'Deployment', metadata: { uid: 'd', name: 'linkerd-destination', namespace: 'linkerd' } };
    expect(inferNetworkEdge(buildGraph([dep])).serviceMesh.value).toBe('Linkerd');
  });

  it('identifies a mesh purely from an injected sidecar container when no control plane is in the snapshot', () => {
    const edge = inferNetworkEdge(buildGraph([istioProxyPod('only')]));
    expect(edge.serviceMesh.value).toBe('Istio');
    expect(edge.serviceMesh.evidence).toContain('istio-proxy sidecar');
    expect(edge.meshSidecarPods).toBe(1);
  });

  it('does not fabricate a mesh when none is present (pods have no mesh sidecar)', () => {
    const plainPod: RawObject = { apiVersion: 'v1', kind: 'Pod', metadata: { uid: 'p', name: 'p', namespace: 'default' }, spec: { containers: [{ name: 'app' }] } };
    const edge = inferNetworkEdge(buildGraph([plainPod]));
    expect(edge.serviceMesh.value).toBeUndefined();
    expect(edge.meshSidecarPods).toBe(0);
  });
});
