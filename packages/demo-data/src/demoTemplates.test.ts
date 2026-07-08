import { describe, it, expect } from 'vitest';
import { DEMO_TEMPLATES } from './demoTemplates';

const TARGET_KINDS = [
  'CSIDriver', 'CSINode', 'ClusterRole', 'ClusterRoleBinding', 'ConfigMap', 'CronJob',
  'DaemonSet', 'Deployment', 'Endpoints', 'Event', 'Gateway',
  'GatewayClass', 'HTTPRoute', 'Job', 'LimitRange', 'Namespace',
  'NetworkPolicy', 'Node', 'PersistentVolume', 'PersistentVolumeClaim', 'Pod',
  'ReplicaSet', 'ResourceQuota', 'Role', 'RoleBinding', 'Secret', 'Service',
  'ServiceAccount', 'StatefulSet', 'StorageClass', 'VolumeAttachment',
];

describe('DEMO_TEMPLATES', () => {
  it('has one template for every curated Kind', () => {
    expect(Object.keys(DEMO_TEMPLATES).sort()).toEqual([...TARGET_KINDS].sort());
  });

  it('every template carries a matching kind field and a {{name}} placeholder', () => {
    for (const [kind, obj] of Object.entries(DEMO_TEMPLATES)) {
      expect(obj.kind).toBe(kind);
      expect(obj.metadata?.name).toBe('{{name}}');
    }
  });

  it('strips instance-identity fields that would collide across generated copies', () => {
    for (const obj of Object.values(DEMO_TEMPLATES)) {
      expect(obj.metadata?.uid).toBeUndefined();
      expect(obj.metadata?.resourceVersion).toBeUndefined();
      expect(obj.metadata?.ownerReferences).toBeUndefined();
    }
  });

  it("namespaces Pod's spec.nodeName as a placeholder", () => {
    const pod = DEMO_TEMPLATES.Pod as { spec?: { nodeName?: string } };
    expect(pod.spec?.nodeName).toBe('{{nodeName}}');
  });

  it("drops Node's bulk status.images inventory", () => {
    const node = DEMO_TEMPLATES.Node as { status?: { images?: unknown } };
    expect(node.status?.images).toBeUndefined();
  });

  it('hand-authored Gateway API templates (no source snapshot had these) parent/back-ref placeholders', () => {
    const route = DEMO_TEMPLATES.HTTPRoute as {
      spec?: { parentRefs?: { name?: string }[]; rules?: { backendRefs?: { name?: string }[] }[] };
    };
    expect(route.spec?.parentRefs?.[0]?.name).toBe('{{gatewayName}}');
    expect(route.spec?.rules?.[0]?.backendRefs?.[0]?.name).toBe('{{serviceName}}');

    const gatewayClass = DEMO_TEMPLATES.GatewayClass as { spec?: { controllerName?: string } };
    expect(gatewayClass.spec?.controllerName).toBeTruthy();

    const gateway = DEMO_TEMPLATES.Gateway as { spec?: { gatewayClassName?: string; listeners?: unknown[] } };
    expect(gateway.spec?.gatewayClassName).toBeTruthy();
    expect(gateway.spec?.listeners?.length).toBeGreaterThan(0);
  });
});
