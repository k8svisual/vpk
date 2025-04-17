import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
const validVolumeTypes = [
    'awsElasticBlockStore',
    'azureDisk',
    'azureFile',
    'cephfs',
    'cinder',
    'configMap',
    'downwardAPI',
    'emptyDir',
    'fc',
    'gcePersistentDisk',
    'gitRepo',
    'glusterFS',
    'hostPath',
    'iscsi',
    'local',
    'nfs',
    'persistentVolumeClaim',
    'portworxVolume',
    'projected',
    'rdb',
    'secret',
    'vsphereVolume',
    'ephemeral',
    'csi',
];
export function addToVolumeCounts(nodeName, ns, key, fnum) {
    try {
        if (validVolumeTypes.includes(key)) {
            key = 'Type=' + key;
            //---- Type Level -------------------------------------------------
            if (typeof vpk.volumeCountsType[key] === 'undefined') {
                vpk.volumeCountsType[key] = 1;
            }
            else {
                vpk.volumeCountsType[key] = vpk.volumeCountsType[key] + 1;
            }
            //----
            if (typeof vpk.volumeCountsType[key + '::' + nodeName] === 'undefined') {
                vpk.volumeCountsType[key + '::' + nodeName] = 1;
            }
            else {
                vpk.volumeCountsType[key + '::' + nodeName] = vpk.volumeCountsType[key + '::' + nodeName] + 1;
            }
            //----
            if (typeof vpk.volumeCountsType[key + '::' + nodeName + '::' + ns] === 'undefined') {
                vpk.volumeCountsType[key + '::' + nodeName + '::' + ns] = 1;
            }
            else {
                vpk.volumeCountsType[key + '::' + nodeName + '::' + ns] = vpk.volumeCountsType[key + '::' + nodeName + '::' + ns] + 1;
            }
            //----
            if (typeof vpk.volumeCountsType[key + '::' + nodeName + '::' + ns + '::' + fnum] === 'undefined') {
                vpk.volumeCountsType[key + '::' + nodeName + '::' + ns + '::' + fnum] = 1;
            }
            else {
                vpk.volumeCountsType[key + '::' + nodeName + '::' + ns + '::' + fnum]++;
            }
            //---- Node Level -------------------------------------------------
            if (typeof vpk.volumeCountsNode[nodeName] === 'undefined') {
                vpk.volumeCountsNode[nodeName] = 1;
            }
            else {
                vpk.volumeCountsNode[nodeName] = vpk.volumeCountsNode[nodeName] + 1;
            }
            //---- Node Level & volume type
            if (typeof vpk.volumeCountsNode[nodeName + '::' + key] === 'undefined') {
                vpk.volumeCountsNode[nodeName + '::' + key] = 1;
            }
            else {
                vpk.volumeCountsNode[nodeName + '::' + key] = vpk.volumeCountsNode[nodeName + '::' + key] + 1;
            }
            //---- Node Level & Namespace & volume type
            if (typeof vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns] === 'undefined') {
                vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns] = 1;
            }
            else {
                vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns] = vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns] + 1;
            }
            //---- Node Level & Namespace & volume type
            if (typeof vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns + '::' + fnum] === 'undefined') {
                vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns + '::' + fnum] = 1;
            }
            else {
                vpk.volumeCountsNode[nodeName + '::' + key + '::' + ns + '::' + fnum]++;
            }
            //-----------------------------------------------------------------
            //  Namespace Level
            if (typeof vpk.volumeCountsNS[ns] === 'undefined') {
                vpk.volumeCountsNS[ns] = 1;
            }
            else {
                vpk.volumeCountsNS[ns] = vpk.volumeCountsNS[ns] + 1;
            }
            //  Namespace Level & volume type
            if (typeof vpk.volumeCountsNS[ns + '::' + key] === 'undefined') {
                vpk.volumeCountsNS[ns + '::' + key] = 1;
            }
            else {
                vpk.volumeCountsNS[ns + '::' + key] = vpk.volumeCountsNS[ns + '::' + key] + 1;
            }
            //  Namespace Level & pod(fnum)
            if (typeof vpk.volumeCountsNS[ns + '::' + key + '::' + fnum] === 'undefined') {
                vpk.volumeCountsNS[ns + '::' + key + '::' + fnum] = 1;
            }
            else {
                vpk.volumeCountsNS[ns + '::' + key + '::' + fnum] = vpk.volumeCountsNS[ns + '::' + key + '::' + fnum] + 1;
            }
            //-----------------------------------------------------------------
            //  Pod Level
            if (typeof vpk.volumeCountsPod[fnum] === 'undefined') {
                vpk.volumeCountsPod[fnum] = 1;
            }
            else {
                vpk.volumeCountsPod[fnum] = vpk.volumeCountsPod[fnum] + 1;
            }
            //  Pod Level & volume type
            if (typeof vpk.volumeCountsPod[fnum + '::' + key] === 'undefined') {
                vpk.volumeCountsPod[fnum + '::' + key] = 1;
            }
            else {
                vpk.volumeCountsPod[fnum + '::' + key] = vpk.volumeCountsPod[fnum + '::' + key] + 1;
            }
        }
        else {
            if (key !== 'name') {
                if (typeof vpk.volumeCountsType[key] === 'undefined') {
                    logMessage('vpkCON407 - Added unknown Volume type count for key: ' + key);
                    vpk.volumeCountsType[key] = 1;
                }
                else {
                    vpk.volumeCountsType[key] = vpk.volumeCountsType[key] + 1;
                }
            }
        }
    }
    catch (err) {
        logMessage('vpkCON406 - Error processing Pod Volumes counts: ' + err.message);
        logMessage('vpkCON406 - stack: ' + err.stack);
    }
}
