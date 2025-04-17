//------------------------------------------------------------------------------
// process defined resource kind and create selected data in memory
//------------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { processContainer } from './processContainer.js';
import { logMessage } from '../utils/logging.js';
import { controllerRevisionParse } from '../parsers/controllerRevision/parseControllerRevision.js';
import { csiParse } from '../parsers/csi/parseCSI.js';
import { crdParse } from '../parsers/crd/parseCRD.js';
import { endpointsParse } from '../parsers/endpoints/parseEndpoints.js';
import { endpointSliceParse } from '../parsers/endpointSlice/parseEndpointSlice.js';
import { eventParse } from '../parsers/events/parseEvent.js';
import { hpaParse } from '../parsers/hpa/parseHPA.js';
import { nodeParse } from '../parsers/node/parseNode.js';
import { pvcParse } from '../parsers/persistentVolumeClaim/parsePersistentVolumeClaim.js';
import { pvParse } from '../parsers/persistentVolume/parsePersistentVolume.js';
import { roleBindingParse } from '../parsers/roleBinding/parseRoleBinding.js';
import { roleParse } from '../parsers/role/parseRole.js';
import { secretParse } from '../parsers/secret/parseSecret.js';
import { serviceAccountParse } from '../parsers/serviceAccount/parseServiceAccount.js';
import { serviceParse } from '../parsers/service/parseService.js';
import { storageClassParse } from '../parsers/storageClass//parseStorageClass.js';
import { volumeAttachmentParse } from '../parsers/volumeAttachments/parseVolumeAttachment.js';
export function populate(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase) {
    // parse and populate
    try {
        switch (y_kind) {
            case 'ClusterRole':
                roleParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'ClusterRoleBinding':
                roleBindingParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'ControllerRevision':
                controllerRevisionParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'CronJob':
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'CSIDriver':
                csiParse(y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'CSINode':
                csiParse(y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'CustomResourceDefinition':
                crdParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'DaemonSet':
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'Deployment':
                //(ns, kind, name, obj, containerType, fnum)
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'Endpoints':
                endpointsParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'EndpointSlice':
                endpointSliceParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'Event':
                eventParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'HorizontalPodAutoscaler':
                hpaParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'Job':
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'Node':
                nodeParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'PersistentVolume':
                pvParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'PersistentVolumeClaim':
                pvcParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'Pod':
                // Save network realted information
                let netWrite = false;
                let netInfo = {};
                // populate network info
                if (typeof vpk.yaml.spec.hostNetwork !== 'undefined') {
                    netInfo.hostNetwork = vpk.yaml.spec.hostNetwork;
                    netWrite = true;
                }
                else {
                    netInfo.hostNetwork = false;
                    netWrite = true;
                }
                if (typeof vpk.yaml.status.podIP !== 'undefined') {
                    netInfo['podIP'] = vpk.yaml.status.podIP;
                    netWrite = true;
                }
                if (typeof vpk.yaml.status.podIPs !== 'undefined') {
                    netInfo.podIPs = vpk.yaml.status.podIPs;
                    netWrite = true;
                }
                if (typeof vpk.yaml.status.qosClass !== 'undefined') {
                    netInfo.qosClass = vpk.yaml.status.qosClass;
                    netWrite = true;
                }
                if (netWrite === true) {
                    netInfo.fnum = fnum;
                    netInfo.nodeName = y_node;
                    let netKey = y_kind + ':' + y_ns + ':' + y_name;
                    if (typeof vpk.netInfo[netKey] === 'undefined') {
                        vpk.netInfo[netKey] = netInfo;
                    }
                    else {
                        logMessage(`FIO26 - netInfo key: ${netKey} already exists`);
                    }
                }
                // Process the containers
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'ReplicaSet':
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'ReplicationController':
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'Role':
                roleParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'RoleBinding':
                roleBindingParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'Secret':
                secretParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'Service':
                serviceParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'ServiceAccount':
                serviceAccountParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'StatefulSet':
                processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                break;
            case 'StorageClass':
                storageClassParse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                break;
            case 'VolumeAttachment':
                volumeAttachmentParse(y_kind, y_name, vpk.yaml, fnum);
                break;
            default:
                if (typeof vpk.yaml.spec !== 'undefined') {
                    if (vpk.yaml.spec !== null) {
                        if (typeof vpk.yaml.spec.containers !== 'undefined') {
                            processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                        }
                        else {
                            if (typeof vpk.yaml.spec.template !== 'undefined') {
                                if (typeof vpk.yaml.spec.template.spec !== 'undefined') {
                                    if (typeof vpk.yaml.spec.template.spec.containers !== 'undefined') {
                                        processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase);
                                    }
                                }
                            }
                        }
                    }
                }
        }
    }
    catch (err) {
        logMessage('FIOPOP329 - Error: ' + err);
        logMessage('FIOPOP329 - Error: ' + err.stack);
    }
}
