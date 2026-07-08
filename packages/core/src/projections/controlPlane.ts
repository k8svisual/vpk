import { projectContainerImages } from './containerImages';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

/**
 * The 3D wheel's "Control Plane" layer (DESIGN §6.8 follow-on, ported from the legacy app's Babylon.js
 * Control-Plane ring/components/registry-stack/resource-planes — see vpk3dCluster.js `buildControlPlane`,
 * `buildKublet`, `buildControlPlaneComponents`, `buildRegistry`, `buildOtherPlane`/`buildOtherComponents`).
 * Unlike the legacy app's hand-rolled Workload/Service/ConfigStorage/... resource taxonomy, `paneForResource`
 * below is grounded in the CURRENT official Kubernetes API reference's own API-group organization (verified
 * against kubernetes.io, not assumed from memory) rather than a fixed per-kind list that drifts as the API
 * evolves — a resource's pane falls out of its own `apiVersion` group, so arbitrary CRDs/third-party operators
 * are placed automatically instead of needing to be enumerated by hand.
 */

export interface WheelPoint {
  id: ResourceId;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
}

/** A shared shape for every non-pod/non-tier "informational" item this layer introduces — the legacy app drew
 *  several kinds of things here (some backed by a real resource, most purely decorative) and this is the one
 *  place all of them funnel through, so Scene3D/PropertiesPanel only need one union to render any of them. */
export interface WheelInfoItem extends WheelPoint {
  popupKind: 'kubelet' | 'kube-proxy' | 'kubectl' | 'control-plane-ring' | 'control-plane-component' | 'kind-summary' | 'image-registry';
  title: string;
  description?: string;
  /** Set ONLY when a real resource backs this item (e.g. a matched ComponentStatus) — lets the Properties
   *  popup open a real editor. Absent = purely decorative, nothing to open (matches the legacy app's Kubelet/
   *  Kube-Proxy/kubectl popups, which show `<none>` for Name and have no definition link at all). */
  resourceId?: ResourceId;
  /** Set for 'kind-summary' items: the Kind this single representative sphere stands in for, and how many
   *  real instances of it exist — the Properties popup shows this count and a Search button scoped to it. */
  kind?: string;
  count?: number;
  /** Set for 'kubelet'/'kube-proxy': which Node they belong to, so Scene3D can draw the connecting line
   *  without a separate edge list (same technique as WheelCsiNodeDriver/WheelLocalStorage). */
  nodeId?: ResourceId;
}

export interface WheelPlane {
  name: string;
  color: string;
  /** Wall geometry (a translucent panel behind this plane's spheres, matching the legacy app's per-plane
   *  wall) — an arc at `radius` spanning `startAngle`..`endAngle`, from y=0.5 up to `height`+0.5. */
  radius: number;
  startAngle: number;
  endAngle: number;
  height: number;
  items: WheelInfoItem[];
}

export interface ControlPlaneScene {
  /** Ring radius/height/Y — the CSI ring's client-side geometry constant is mirrored the same way; this one
   *  is sent explicitly since components/kubectl/registry stack all anchor relative to it. */
  radius: number;
  y: number;
  height: number;
  kubelets: WheelInfoItem[];
  kubeProxies: WheelInfoItem[];
  /** API Server, Scheduler, Controller Manager, etcd — always exactly these 4, in this order. */
  components: WheelInfoItem[];
  kubectl: WheelInfoItem;
  /** Green stack, sorted by use-count descending (index 0 = most-used registry, topmost cylinder). */
  imageRegistries: WheelInfoItem[];
  planes: WheelPlane[];
}

/** Kinds that already get their own dedicated wheel tier elsewhere (Network/Ingress/Storage/CSI/Nodes/Pods) —
 *  excluded here so a resource is never drawn twice under two different visual concepts. */
const ALREADY_MODELED_KINDS = new Set([
  'Pod',
  'Node',
  'Service',
  'Endpoints',
  'EndpointSlice',
  'Ingress',
  'HTTPRoute',
  'Route',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
  'VolumeAttachment',
  'CSIDriver',
  'CSINode',
]);

const PANE_COLORS: Record<string, string> = {
  Workload: '#972aff',
  Networking: '#88bbdd',
  Storage: '#4477aa',
  Config: '#ff4500',
  RBAC: '#cc9900',
  Authentication: '#ffbed7',
  Policy: '#66cc99',
  Extend: '#ffabab',
  Cluster: '#baeee5',
  ThirdParty: '#ff0099',
};

/** Fixed display order — matches the legacy app's plane sequence where the concepts carry over 1:1. */
const PANE_ORDER = ['Workload', 'Networking', 'Storage', 'Config', 'RBAC', 'Authentication', 'Policy', 'Extend', 'Cluster', 'ThirdParty'];

function apiGroupOf(apiVersion: string): string {
  const slash = apiVersion.indexOf('/');
  return slash === -1 ? '' : apiVersion.slice(0, slash);
}

/**
 * Which pane a Kind belongs in, derived from its OWN `apiVersion` group rather than a fixed per-kind list —
 * verified against the current kubernetes.io API reference's own group organization (apps/batch/autoscaling,
 * rbac.authorization.k8s.io, networking.k8s.io, storage.k8s.io, apiextensions.k8s.io, etc.), so a Kind this
 * tool has never seen before still lands somewhere sensible. Returns null for a Kind that's either already
 * modeled elsewhere in the wheel, or (ComponentStatus) consumed to back the Control Plane components instead.
 */
export function paneForResource(kind: string, apiVersion: string): string | null {
  if (ALREADY_MODELED_KINDS.has(kind)) return null;
  if (kind === 'ComponentStatus') return null;

  const group = apiGroupOf(apiVersion);
  if (group === 'apps' || group === 'batch' || group === 'autoscaling' || kind === 'PodDisruptionBudget') return 'Workload';
  if (group === 'networking.k8s.io' || group === 'discovery.k8s.io') return 'Networking';
  if (group === 'storage.k8s.io') return 'Storage';
  if (kind === 'ConfigMap' || kind === 'Secret') return 'Config';
  if (group === 'rbac.authorization.k8s.io') return 'RBAC';
  if (
    kind === 'ServiceAccount' ||
    kind === 'Authentication' ||
    group === 'certificates.k8s.io' ||
    group === 'oauth.openshift.io' ||
    group === 'user.openshift.io'
  ) {
    return 'Authentication';
  }
  if (group === 'admissionregistration.k8s.io' || group === 'security.openshift.io' || group === 'policy') return 'Policy';
  if (
    group === 'apiextensions.k8s.io' ||
    group === 'apiregistration.k8s.io' ||
    group === 'operators.coreos.com' ||
    group === 'packages.operators.coreos.com'
  ) {
    return 'Extend';
  }
  // Everything else still under an official/platform namespace (bare core, any other *.k8s.io, or any
  // *.openshift.io group not already claimed above) reads as "cluster-level plumbing" rather than a
  // third-party addition.
  if (group === '' || group.endsWith('.k8s.io') || group.endsWith('.openshift.io')) return 'Cluster';
  return 'ThirdParty';
}

/** name.startsWith(...) match, same technique the legacy app used against the (largely deprecated but still
 *  occasionally populated) `ComponentStatus` API — case-insensitive since real clusters vary in casing. */
function matchComponentStatus(graph: ResourceGraph): Map<'etcd' | 'scheduler' | 'controller-manager', Resource> {
  const result = new Map<'etcd' | 'scheduler' | 'controller-manager', Resource>();
  for (const r of graph.nodes.values()) {
    if (r.kind !== 'ComponentStatus') continue;
    const name = r.name.toLowerCase();
    if (name.startsWith('etcd') && !result.has('etcd')) result.set('etcd', r);
    else if (name.startsWith('sched') && !result.has('scheduler')) result.set('scheduler', r);
    else if (name.startsWith('control') && !result.has('controller-manager')) result.set('controller-manager', r);
  }
  return result;
}

const IMPLICIT_REGISTRY = 'docker.io';

/** Groups by REGISTRY HOSTNAME, not by full image reference (docker.io/library/nginx:1.27 and
 *  docker.io/library/nginx:1.28 count as the same registry) — matches the legacy app's `buildRegistry`
 *  exactly, which stacks one cylinder per distinct registry, not per image. */
function aggregateImageRegistries(graph: ResourceGraph): { registry: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const usage of projectContainerImages(graph)) {
    const registry = usage.registry ?? IMPLICIT_REGISTRY;
    counts.set(registry, (counts.get(registry) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([registry, count]) => ({ registry, count }))
    .sort((a, b) => b.count - a.count || a.registry.localeCompare(b.registry));
}

const CONTROL_PLANE_RADIUS_OFFSET = 3.5;
const CONTROL_PLANE_HEIGHT = 0.5;
const COMPONENT_RADIUS_OFFSET = CONTROL_PLANE_RADIUS_OFFSET + 1;
const KUBECTL_RADIUS_OFFSET = CONTROL_PLANE_RADIUS_OFFSET + 4;
const RESOURCE_PLANE_RADIUS_OFFSET = 4.5;
const KUBELET_Y = 1.5;
const KUBE_PROXY_Y = 0.95;
// One distinct-but-related color per Control Plane sub-group (previously all one shared CONTROL_PLANE_COLOR,
// which the ring itself — a separate, client-only constant in FilterPanel.tsx/Scene3D.tsx, unchanged — still
// uses on its own). All four sit in the same purple/violet family as the ring's own color, varying mainly in
// lightness so each group reads as a distinct item in the Filter panel's swatches without looking unrelated.
const KUBELET_KUBE_PROXY_COLOR = '#6f5aa3';
const CONTROL_PLANE_COMPONENTS_COLOR = '#4e3d75';
const KUBECTL_COLOR = '#b39ddb';
const REGISTRY_COLOR = '#7e57a3';
/** Angular width dedicated to the 4 fixed components, centered on "north" (the same -90° start every other
 *  ring in this wheel uses) — everything else (registry stack, resource planes) starts right after it. */
const COMPONENT_ARC = Math.PI / 6;
const START_ANGLE = -Math.PI / 2;
/** A resource plane's kind-summary spheres stack vertically at one angle; once a stack would get taller than
 *  this many items it wraps to an adjacent angle within the same plane's slice (mirrors the legacy app's
 *  column-wrap-after-17, at a smaller threshold since a plane can realistically hold dozens of distinct Kinds
 *  in a large cluster). Kept tight (MAX_STACK large, angle step/gap small) so even the biggest real clusters'
 *  cumulative angular budget across all 10 panes stays well within a quarter-turn of START_ANGLE — the wheel's
 *  default camera frames the "far" side (where every node/CSI/control-plane item already sits) head-on, so
 *  drifting the pane sequence far enough to wrap onto the NEAR side would make the last couple of panes
 *  visually swamp the default view instead of sitting harmlessly with everything else on the far side. */
const MAX_STACK = 18;
const STACK_SPACING = 0.4;
const COLUMN_ANGLE_STEP = 0.025;
/** Angular gap left between adjacent planes' slices so two planes' outermost columns never visually merge. */
const PLANE_GAP = 0.05;

interface NodeInput {
  id: ResourceId;
  name: string;
  x: number;
  z: number;
}

export function projectControlPlane(graph: ResourceGraph, nodes: NodeInput[], outerRadius: number): ControlPlaneScene {
  const radius = outerRadius + CONTROL_PLANE_RADIUS_OFFSET;
  const componentRadius = outerRadius + COMPONENT_RADIUS_OFFSET;
  const kubectlRadius = outerRadius + KUBECTL_RADIUS_OFFSET;
  const planeRadius = outerRadius + RESOURCE_PLANE_RADIUS_OFFSET;

  const kubelets: WheelInfoItem[] = nodes.map((n) => ({
    id: `kubelet:${n.id}`,
    name: 'Kubelet',
    x: n.x,
    y: KUBELET_Y,
    z: n.z,
    color: KUBELET_KUBE_PROXY_COLOR,
    popupKind: 'kubelet',
    title: 'Kubelet',
    description: 'The primary node agent that runs on every Node, registering it with the API server and managing its Pods.',
    nodeId: n.id,
  }));
  const kubeProxies: WheelInfoItem[] = nodes.map((n) => ({
    id: `kube-proxy:${n.id}`,
    name: 'Kube-Proxy',
    x: n.x,
    y: KUBE_PROXY_Y,
    z: n.z,
    color: KUBELET_KUBE_PROXY_COLOR,
    popupKind: 'kube-proxy',
    title: 'Kube-Proxy',
    description: 'Maintains network rules on the Node, allowing Services to route traffic to the right Pods.',
    nodeId: n.id,
  }));

  const componentStatus = matchComponentStatus(graph);
  const componentDefs: { key: 'api-server' | 'etcd' | 'scheduler' | 'controller-manager'; title: string; description: string }[] = [
    { key: 'api-server', title: 'API Server', description: 'The front end of the control plane — exposes the Kubernetes API that every other component and client talks to.' },
    { key: 'scheduler', title: 'Scheduler', description: 'Watches for newly created Pods with no assigned Node and picks one for them to run on.' },
    { key: 'controller-manager', title: 'Controller Manager', description: 'Runs the core controller loops (e.g. node, replication, endpoints) that drive cluster state toward its desired state.' },
    { key: 'etcd', title: 'etcd', description: "Kubernetes' backing key-value store — holds all cluster state." },
  ];
  const components: WheelInfoItem[] = componentDefs.map((def, i) => {
    const angle = START_ANGLE - COMPONENT_ARC / 2 + (COMPONENT_ARC / (componentDefs.length - 1)) * i;
    // API Server is never backed by a real resource — even on clusters where ComponentStatus is populated,
    // it never reports an "apiserver" entry (matches the legacy app's synthetic fnum '888.8' stand-in).
    const backing = def.key === 'api-server' ? undefined : componentStatus.get(def.key);
    return {
      id: `control-plane-component:${def.key}`,
      name: def.title,
      x: componentRadius * Math.cos(angle),
      y: 0,
      z: componentRadius * Math.sin(angle),
      color: CONTROL_PLANE_COMPONENTS_COLOR,
      popupKind: 'control-plane-component',
      title: def.title,
      description: def.description,
      resourceId: backing?.id,
    };
  });

  const apiServerAngle = START_ANGLE - COMPONENT_ARC / 2;
  const kubectl: WheelInfoItem = {
    id: 'kubectl',
    name: 'kubectl',
    x: kubectlRadius * Math.cos(apiServerAngle),
    y: 0,
    z: kubectlRadius * Math.sin(apiServerAngle),
    color: KUBECTL_COLOR,
    popupKind: 'kubectl',
    title: 'kubectl',
    description: 'CLI (Command Line Interface) that communicates with the cluster. Normally installed on a user, developer, or administrator machine.',
  };

  const registryAngle = START_ANGLE + COMPONENT_ARC / 2 + PLANE_GAP;
  const imageRegistries: WheelInfoItem[] = aggregateImageRegistries(graph).map((r, i) => ({
    id: `image-registry:${r.registry}`,
    name: r.registry,
    x: kubectlRadius * Math.cos(registryAngle),
    y: -i * 0.3,
    z: kubectlRadius * Math.sin(registryAngle),
    color: REGISTRY_COLOR,
    popupKind: 'image-registry',
    title: r.registry,
    kind: r.registry,
    count: r.count,
  }));

  const kindCounts = new Map<string, { count: number; apiVersion: string }>();
  for (const r of graph.nodes.values()) {
    const pane = paneForResource(r.kind, r.apiVersion);
    if (!pane) continue;
    const key = `${pane} ${r.kind}`;
    const entry = kindCounts.get(key);
    if (entry) entry.count++;
    else kindCounts.set(key, { count: 1, apiVersion: r.apiVersion });
  }

  let cursorAngle = START_ANGLE + COMPONENT_ARC / 2 + PLANE_GAP * 3; // leave room for the registry anchor too
  const planes: WheelPlane[] = [];
  for (const paneName of PANE_ORDER) {
    const kinds = [...kindCounts.entries()]
      .filter(([key]) => key.startsWith(`${paneName} `))
      .map(([key, v]) => ({ kind: key.slice(paneName.length + 1), count: v.count }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
    if (kinds.length === 0) continue;

    const color = PANE_COLORS[paneName] as string;
    const columns = Math.ceil(kinds.length / MAX_STACK);
    const entryAngle = cursorAngle;
    const items: WheelInfoItem[] = kinds.map(({ kind, count }, i) => {
      const col = Math.floor(i / MAX_STACK);
      const row = i % MAX_STACK;
      const angle = entryAngle + col * COLUMN_ANGLE_STEP;
      return {
        id: `kind-summary:${paneName}:${kind}`,
        name: kind,
        x: planeRadius * Math.cos(angle),
        y: 1 + row * STACK_SPACING,
        z: planeRadius * Math.sin(angle),
        color,
        popupKind: 'kind-summary',
        title: kind,
        kind,
        count,
      };
    });
    const rowsInTallestColumn = Math.min(kinds.length, MAX_STACK);
    planes.push({
      name: paneName,
      color,
      radius: planeRadius,
      startAngle: entryAngle - COLUMN_ANGLE_STEP / 2,
      endAngle: entryAngle + (columns - 1) * COLUMN_ANGLE_STEP + COLUMN_ANGLE_STEP / 2,
      height: rowsInTallestColumn * STACK_SPACING + 0.5,
      items,
    });
    cursorAngle = entryAngle + columns * COLUMN_ANGLE_STEP + PLANE_GAP;
  }

  return {
    radius,
    y: 0,
    height: CONTROL_PLANE_HEIGHT,
    kubelets,
    kubeProxies,
    components,
    kubectl,
    imageRegistries,
    planes,
  };
}
