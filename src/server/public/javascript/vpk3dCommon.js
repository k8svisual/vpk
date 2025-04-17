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
// common variables for 3d cluster
//----------------------------------------------------------

let canvas = document.getElementById('clusterCanvas');
var engine = null;
var camera = null;
var createDefaultEngine;
var scene = null;
var sceneToRender = null;

let foundServices = {};
let foundNSNames = [];
let foundStorageClasses = {};
let foundCSINames = [];
let foundCSINamesFnum = [];
let foundPVC = {};
let foundPVs = {};
let cluster = {};
let meshArray = []; // Array of all meshes
let podArray = []; // Array of displayed pods using fnum
let sliceArray = []; // Array of slice rings
let resourceArray = []; // Array of memory and cpu info
let controlPlaneArray = [];
let mstCount = 0;
let nodeSpace = {};
let compStatus = {};

let clusterOtherKeys = [];

let clusterRescWorkload = [];
let clusterRescService = [];
let clusterRescConfigStorage = [];
let clusterRescAuthentication = [];
let clusterRescAuthorization = [];
let clusterRescPolicy = [];
let clusterRescExtend = [];
let clusterRescCluster = [];
let clusterRescOther = [];
let clusterRescThirdPArty = [];
let volAttach = {};

let configMapsFound = false;
let secretsFound = false;

let ingressArray = [];

let rescWorkload = [
    'Binding',
    'ControllerRevision',
    'HorizontialPodAutoscaler',
    'PriorityClass',
    'PodSchedulingContext',
    'ReplicationController',
    'ReplicaSet',
    'ResourceClaim',
    'ResourceClaimTemplate',
    'ResourceClass',
];

let rescService = [];

let rescConfigStorage = ['ConfigMap', 'Secret', 'Volume', 'VolumeAttributesClass', 'StorageVersionMigration', 'CSIStorageCapacity'];

let rescAuthentication = [
    'ServiceAccount',
    'TokenRequest',
    'TokenReview',
    'CertificateSigningRequest',
    'CertificateTrustBundle',
    'SelfSubjectReview',
];

let rescAuthorization = [
    'LocalSubjectAccessReview',
    'SelfSubjectAccessReview',
    'SelfSubjectRulesReview',
    'SubjectAccessReview',
    'ClusterRole',
    'ClusterRoleBinding',
    'Role',
    'RoleBinding',
];

let rescPolicy = [
    'FlowSchema',
    'LimitRange',
    'ResourceQuota',
    'NetworkPolicy',
    'PodDistributionBudget',
    'PriorityLevelConfiguration',
    'ValidatingAdmissionPolicy',
    'ValidatingAdmissionPolicyBinding',
];

let rescExtend = [
    'CustomResourceDefinition',
    'DeviceClass',
    'MutatingWebhookConfiguration',
    'ValidatingWebhookConfiguration',
    'ValidatingAdmissionPolicy',
];

let rescCluster = [
    'APIService',
    'ComponentStatus',
    'Event',
    'IPAddress',
    'Lease',
    'LeaseCandidate',
    'Namespace',
    'RuntimeClass',
    'FlowSchema',
    'PriorityLevelConfiguration',
    'ClusterCIDR',
    'VolumeSnapshotClass',
];

let rescOther = ['ValidatingAdmissionPolicyBinding'];

let rescSkip = [
    'ComponentStatus',
    'CronJob',
    'CSIDriver',
    'CSINode',
    'CSIStorageCapacity',
    'DaemonSet',
    'Endpoint',
    'EndpointSlice',
    'Ingress',
    'IngressClass',
    'Job',
    'Node',
    'PersistentVolume',
    'PersistentVolumeClaim',
    'Pod',
    'PodTemplate',
    'Service',
    'StorageClass',
    'VolumeAttachment',
];

let networkLinks = {};
let pvLinks = []; // Array of PVs that are biult
let pvcLinks = {};
let pvcBuild = {};
let pvToVolAttLinks = {};
let maxPodCount = 0;
let maxNodeCount = 0;
// statistics on number of located resources for each node
let nodeStats = {};
let slice = 'x';

let bn = [
    1024, //Ki
    1048576, //Mi
    1073741824, //Gi
    1099511627776, //Ti
    1125899906842620, //Pi
    1152921504606850000, //Ei
    1180591620717410000000, //Zi
    1208925819614630000000000, //Yi
];

let bt = [1000, 1000000, 1000000000, 1000000000000, 1000000000000000, 1000000000000000000, 1000000000000000000000, 1000000000000000000000000];

//----------------------------------------------------------
console.log('loaded vpk3dCommon.js');
