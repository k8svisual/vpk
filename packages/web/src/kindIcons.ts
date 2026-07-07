/**
 * Kind -> filename of the real Kubernetes resource icon, served statically from `public/icons/k8/` (ported
 * from the legacy app's `src/server/public/images/k8/*.svg`). Kept as a small client-side duplicate of
 * `@vpk/core`'s kindIcons rather than a workspace import — @vpk/web is a thin renderer that never depends on
 * @vpk/core (DESIGN.md: browser never touches domain logic, only server-computed JSON).
 */
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

export function iconUrlForKind(kind: string): string {
  return `/icons/k8/${KIND_ICON[kind] ?? FALLBACK_ICON}`;
}
