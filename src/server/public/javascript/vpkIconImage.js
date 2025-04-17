/*
Copyright (c) 2018-2023 Dave Weilert

Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
and associated documentation files (the "Software"), to deal in the Software without restriction, 
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

//----------------------------------------------------------
// Find associated Icon image
//----------------------------------------------------------

function checkImage(kind, api) {
    let image;
    if (kind === 'k8') {
        image = 'k8.svg';
    } else if (kind === 'API' || kind === 'Api' || kind === 'APIService') {
        image = 'k8/api.svg';
    } else if (kind === 'Alertmanager') {
        image = 'other/ocp.svg';
    } else if (kind === 'CatalogSource') {
        image = 'other/ocp.svg';
    } else if (kind === 'CephCluster') {
        image = 'other/rook2.svg';
    } else if (kind === 'Certificate') {
        image = 'k8/cert.svg';
    } else if (kind === 'CertificateRequest') {
        image = 'k8/certReq.svg';
    } else if (kind === 'CertificateSigningRequest') {
        image = 'k8/k8.svg';
    } else if (kind === 'ClusterRole') {
        image = 'k8/c-role.svg';
    } else if (kind === 'ClusterRoleBinding') {
        image = 'k8/crb.svg';
    } else if (kind === 'ComponentStatus') {
        image = 'k8/k8.svg';
    } else if (kind === 'ConfigMap') {
        image = 'k8/cm.svg';
    } else if (kind === 'ControllerRevision') {
        image = 'k8/c-rev.svg';
    } else if (kind === 'CronJob') {
        image = 'k8/cronjob.svg';
    } else if (kind === 'CSIDriver') {
        image = 'k8/csidriver.svg';
    } else if (kind === 'CSINode') {
        image = 'k8/csinode.svg';
    } else if (kind === 'CustomResourceDefinition' || kind === 'CRD') {
        image = 'k8/crd.svg';
    } else if (kind === 'DaemonSet') {
        image = 'k8/ds.svg';
    } else if (kind === 'Deployment') {
        image = 'k8/deploy.svg';
    } else if (kind === 'DeploymentConfig') {
        image = 'other/ocp.svg';
    } else if (kind === 'DNS') {
        image = 'other/ocp.svg';
    } else if (kind === 'Endpoints') {
        image = 'k8/ep.svg';
    } else if (kind === 'EndpointSlice') {
        image = 'k8/eps.svg';
    } else if (kind === 'Etcd') {
        image = 'k8/etcd.svg';
    } else if (kind === 'Event') {
        image = 'k8/evt.svg';
    } else if (kind === 'FlowSchema') {
        image = 'k8/k8.svg';
    } else if (kind === 'HorizontalPodAutoscaler') {
        image = 'k8/hpa.svg';
    } else if (kind === 'Ingress') {
        image = 'k8/ing.svg';
    } else if (kind === 'Job') {
        image = 'k8/job.svg';
    } else if (kind === 'Lease') {
        image = 'k8/k8.svg';
    } else if (kind === 'LimitRange') {
        image = 'k8/limits.svg';
    } else if (kind === 'MutatingWebhookConfiguration') {
        image = 'k8/k8.svg';
    } else if (kind === 'Namespace') {
        image = 'k8/ns.svg';
    } else if (kind === 'Network') {
        image = 'other/ocp.svg';
    } else if (kind === 'NetworkPolicy') {
        image = 'k8/netpol.svg';
    } else if (kind === 'NooBaa') {
        image = 'other/redhat.svg';
    } else if (kind === 'Node') {
        image = 'k8/node.svg';
    } else if (kind === 'OCP-CRD') {
        image = 'other/ocp.svg';
    } else if (kind === 'PersistentVolumeClaim') {
        image = 'k8/pvc.svg';
    } else if (kind === 'PersistentVolume') {
        image = 'k8/pv.svg';
    } else if (kind === 'Pod') {
        image = 'k8/pod.svg';
    } else if (kind === 'PodDisruptionBudget') {
        image = 'k8/k8.svg';
    } else if (kind === 'PodSecurityPolicy') {
        image = 'k8/psp.svg';
    } else if (kind === 'PodTemplate') {
        image = 'k8/k8.svg';
    } else if (kind === 'Prometheus') {
        image = 'other/ocp.svg';
    } else if (kind === 'PriorityClass') {
        image = 'k8/k8.svg';
    } else if (kind === 'ReplicaSet') {
        image = 'k8/rs.svg';
    } else if (kind === 'ReplicationController') {
        image = 'k8/rc.svg';
    } else if (kind === 'ResourceQuota') {
        image = 'k8/quota.svg';
    } else if (kind === 'Role') {
        image = 'k8/role.svg';
    } else if (kind === 'RoleBinding') {
        image = 'k8/rb.svg';
    } else if (kind === 'RuntimeClass') {
        image = 'k8/k8.svg';
    } else if (kind === 'Secret') {
        image = 'k8/secret.svg';
    } else if (kind === 'Service') {
        image = 'k8/svc.svg';
    } else if (kind === 'ServiceAccount') {
        image = 'k8/sa.svg';
    } else if (kind === 'StatefulSet') {
        image = 'k8/sts.svg';
    } else if (kind === 'StorageClass') {
        image = 'k8/sc.svg';
    } else if (kind === 'ValidatingWebhookConfiguration') {
        image = 'k8/k8.svg';
    } else if (kind === 'VolumeAttachment') {
        image = 'k8/va.svg';
    } else if (kind === 'Unknown') {
        image = 'other/unk.svg';
    } else {
        image = 'other/unk.svg';
    }

    // if unknown use the apiGroup to determine image to display
    if (image === 'other/unk.svg') {
        if (typeof api !== 'undefined') {
            if (api.indexOf('openshift') > -1) {
                image = 'other/ocp.svg';
            } else if (api.indexOf('.coreos') > -1) {
                image = 'other/ocp.svg';
            } else if (api.indexOf('k8s.io') > -1) {
                image = 'k8/k8.svg';
            } else if (api.indexOf('.ibm.') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('.open-cluster-management.') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('.ansible.com') > -1) {
                image = 'other/redhat.svg';
            } else if (api.indexOf('core.hybridapp.io') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('tools.hybridapp.io') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('deploy.hybridapp.io') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('noobaa.io') > -1) {
                image = 'other/redhat.svg';
            } else if (api.indexOf('.rook.') > -1) {
                image = 'other/rook2.svg';
            } else if (api.indexOf('.konghq.com') > -1) {
                image = 'other/kong.svg';
            } else if (api.indexOf('.cattle.') > -1) {
                image = 'other/rancher.svg';
            } else if (api.indexOf('.volcano.') > -1) {
                image = 'other/volcano.svg';
            } else if (api.indexOf('.fluentd.') > -1) {
                image = 'other/fluentd.svg';
            } else if (api.indexOf('.fluentd.') > -1) {
                image = 'other/coreDNS2.svg';
            }
        }
    }

    return image;
}

//----------------------------------------------------------
console.log('loaded vpkIconImage.js');
