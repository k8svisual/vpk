import { projectPodSchematic, type ResourceGraph } from '@vpk/core';

export interface SchematicDto {
  podId: string;
  podName: string;
  namespace?: string;
  phase?: string;
  conditions: { type?: string; status?: string }[];
  containers: { name: string; image?: string; ready?: boolean; restartCount?: number; stateLabel?: string }[];
  initContainers: { name: string; image?: string; ready?: boolean; restartCount?: number; stateLabel?: string }[];
  ownerChain: { id: string; kind: string; name: string; crdLetter?: string }[];
  generatorLabel?: string;
  config: { configMaps: { id: string; name: string }[]; secrets: { id: string; name: string }[] };
  network: { services: { id: string; name: string }[] };
  storage: {
    pvcs: { id: string; name: string }[];
    pvs: { id: string; name: string }[];
    storageClasses: { id: string; name: string }[];
    volumeAttachments: { id: string; name: string }[];
  };
  security: { serviceAccount?: { id: string; name: string } };
  /** The Node the Pod runs on — cluster-scoped, rendered in the "Cluster level resources" box. */
  node?: { id: string; name: string };
  /** CustomResourceDefinitions backing any custom-resource owner in `ownerChain`, lettered to match. */
  crds: { letter: string; id: string; name: string }[];
  /** Namespace-scoped governance resources that apply to this Pod — rendered as a row at the bottom of the
   *  namespace box (NetworkPolicy via podSelector match, ResourceQuota/LimitRange namespace-wide, RoleBinding
   *  via a subject naming this Pod's ServiceAccount). */
  policies: {
    networkPolicies: { id: string; name: string }[];
    resourceQuotas: { id: string; name: string }[];
    limitRanges: { id: string; name: string }[];
    roleBindings: { id: string; name: string }[];
  };
}

export function getSchematic(graph: ResourceGraph, podId: string): SchematicDto | undefined {
  const s = projectPodSchematic(graph, podId);
  if (!s) return undefined;
  return {
    podId: s.pod.id,
    podName: s.pod.name,
    namespace: s.pod.namespace,
    phase: s.phase,
    conditions: s.conditions,
    containers: s.containers,
    initContainers: s.initContainers,
    ownerChain: s.ownerChain.map((o) => ({ id: o.id, kind: o.kind, name: o.name, crdLetter: o.crdLetter })),
    generatorLabel: s.generatorLabel,
    config: {
      configMaps: s.config.configMaps.map((c) => ({ id: c.id, name: c.name })),
      secrets: s.config.secrets.map((c) => ({ id: c.id, name: c.name })),
    },
    network: { services: s.network.services.map((sv) => ({ id: sv.id, name: sv.name })) },
    storage: {
      pvcs: s.storage.pvcs.map((p) => ({ id: p.id, name: p.name })),
      pvs: s.storage.pvs.map((p) => ({ id: p.id, name: p.name })),
      storageClasses: s.storage.storageClasses.map((p) => ({ id: p.id, name: p.name })),
      volumeAttachments: s.storage.volumeAttachments.map((p) => ({ id: p.id, name: p.name })),
    },
    security: s.security.serviceAccount
      ? { serviceAccount: { id: s.security.serviceAccount.id, name: s.security.serviceAccount.name } }
      : {},
    node: s.node ? { id: s.node.id, name: s.node.name } : undefined,
    crds: s.crds,
    policies: {
      networkPolicies: s.policies.networkPolicies.map((r) => ({ id: r.id, name: r.name })),
      resourceQuotas: s.policies.resourceQuotas.map((r) => ({ id: r.id, name: r.name })),
      limitRanges: s.policies.limitRanges.map((r) => ({ id: r.id, name: r.name })),
      roleBindings: s.policies.roleBindings.map((r) => ({ id: r.id, name: r.name })),
    },
  };
}
