import { describe, it, expect } from 'vitest';
import { iconForKind, iconPathForKind } from './kindIcons';

describe('iconForKind', () => {
  it('returns the real Kubernetes icon filename for a listed kind', () => {
    expect(iconForKind('Pod')).toBe('pod.svg');
    expect(iconForKind('Service')).toBe('svc.svg');
    expect(iconForKind('Endpoints')).toBe('ep.svg');
  });

  it('falls back to the generic k8 icon for an unlisted kind', () => {
    expect(iconForKind('SomeCustomResource')).toBe('k8.svg');
  });
});

describe('iconPathForKind', () => {
  it('returns the built-in Kubernetes icon path for a listed kind, ignoring apiVersion', () => {
    expect(iconPathForKind('Pod', 'v1')).toBe('/icons/k8/pod.svg');
  });

  it('resolves a vendor icon by apiVersion group for an unlisted kind', () => {
    expect(iconPathForKind('Certificate', 'cert-manager.io/v1')).toBe('/icons/other/cert-manager.svg');
    expect(iconPathForKind('CiliumNetworkPolicy', 'cilium.io/v2')).toBe('/icons/other/cilium.svg');
  });

  it('resolves commercial-vendor icons (Elastic, HashiCorp, Oracle, SUSE, etc.) by apiVersion group', () => {
    expect(iconPathForKind('Elasticsearch', 'elasticsearch.k8s.io/v1')).toBe('/icons/other/elasticsearch.svg');
    expect(iconPathForKind('Kibana', 'kibana.k8s.io/v1')).toBe('/icons/other/kibana.svg');
    expect(iconPathForKind('VaultAuth', 'secrets.hashicorp.com/v1beta1')).toBe('/icons/other/vault.svg');
    expect(iconPathForKind('OracleRestDataService', 'database.oracle.com/v4')).toBe('/icons/other/oracle.svg');
    expect(iconPathForKind('NvSecurityRule', 'neuvector.com/v1')).toBe('/icons/other/suse.svg');
    expect(iconPathForKind('MongoDBCommunity', 'mongodbcommunity.mongodb.org/v1')).toBe('/icons/other/mongodb.svg');
  });

  it('resolves the major cloud providers (EKS, GKE, AKS) by their operator/controller CRD groups', () => {
    expect(iconPathForKind('TargetGroupBinding', 'elbv2.k8s.aws/v1beta1')).toBe('/icons/other/aws.svg');
    expect(iconPathForKind('Bucket', 's3.services.k8s.aws/v1alpha1')).toBe('/icons/other/aws.svg');
    expect(iconPathForKind('Project', 'resourcemanager.cnrm.cloud.google.com/v1beta1')).toBe('/icons/other/google-cloud.svg');
    expect(iconPathForKind('ResourceGroup', 'resources.azure.com/v1api20200601')).toBe('/icons/other/azure.svg');
  });

  it('resolves Kubernetes-partner platform CRDs (Gardener, Alibaba Cloud) by apiVersion group', () => {
    expect(iconPathForKind('Shoot', 'core.gardener.cloud/v1beta1')).toBe('/icons/other/gardener.svg');
    expect(iconPathForKind('PodNetworking', 'network.alibabacloud.com/v1beta1')).toBe('/icons/other/alibaba-cloud.svg');
  });

  it('falls back to the generic k8 icon when neither a built-in kind nor a vendor match is found', () => {
    expect(iconPathForKind('SomeCustomResource', 'acme.example.com/v1')).toBe('/icons/k8/k8.svg');
    expect(iconPathForKind('SomeCustomResource')).toBe('/icons/k8/k8.svg');
  });
});
