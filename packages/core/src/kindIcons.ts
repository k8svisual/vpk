/**
 * Kind -> filename of the real Kubernetes resource icon (the authentic blue heptagon artwork, ported from the
 * legacy app's `src/server/public/images/k8/*.svg`, itself served by @vpk/web at `/icons/k8/<file>`). Every
 * icon is the SAME Kubernetes blue regardless of kind — differentiation in a diagram comes from the category
 * grouping (color) and the glyph baked into each icon, not from per-kind tinting (that's what `colorForKind`
 * is for, used only where a diagram genuinely needs kind-as-color, e.g. the 3D wheel).
 */
import { vendorIconFor } from './vendorIconOverrides';

const KIND_ICON: Record<string, string> = {
  Pod: 'pod.svg',
  Node: 'node.svg',
  Namespace: 'ns.svg',
  Deployment: 'deploy.svg',
  ReplicaSet: 'rs.svg',
  ReplicationController: 'rc.svg',
  StatefulSet: 'sts.svg',
  DaemonSet: 'ds.svg',
  Job: 'job.svg',
  CronJob: 'cronjob.svg',
  Service: 'svc.svg',
  Endpoints: 'ep.svg',
  EndpointSlice: 'eps.svg',
  Ingress: 'ing.svg',
  NetworkPolicy: 'netpol.svg',
  ConfigMap: 'cm.svg',
  Secret: 'secret.svg',
  ServiceAccount: 'sa.svg',
  PersistentVolumeClaim: 'pvc.svg',
  PersistentVolume: 'pv.svg',
  StorageClass: 'sc.svg',
  CSIDriver: 'csidriver.svg',
  CSINode: 'csinode.svg',
  VolumeAttachment: 'va.svg',
  Role: 'role.svg',
  RoleBinding: 'rb.svg',
  ClusterRole: 'c-role.svg',
  ClusterRoleBinding: 'crb.svg',
  CustomResourceDefinition: 'crd.svg',
  HorizontalPodAutoscaler: 'hpa.svg',
  ResourceQuota: 'quota.svg',
  LimitRange: 'limits.svg',
  Event: 'evt.svg',
  Gateway: 'gw.svg',
  GatewayClass: 'gwclass.svg',
  HTTPRoute: 'httproute.svg',
};

const FALLBACK_ICON = 'k8.svg';

export function iconForKind(kind: string): string {
  return KIND_ICON[kind] ?? FALLBACK_ICON;
}

/** Full icon path (unlike `iconForKind`, which returns a bare filename under `/icons/k8/`) for `kind` —
 *  checks the built-in Kubernetes icon set first, then falls back to a vendor icon matched off
 *  `apiVersion`'s group (see vendorIcons.ts) for CRDs whose kind isn't a real Kubernetes type, then finally
 *  the generic `/icons/k8/k8.svg` if neither resolves. */
export function iconPathForKind(kind: string, apiVersion?: string): string {
  const builtin = KIND_ICON[kind];
  if (builtin) return `/icons/k8/${builtin}`;
  return vendorIconFor(apiVersion) ?? `/icons/k8/${FALLBACK_ICON}`;
}
