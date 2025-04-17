//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
import vpk from './vpk.js';
import { logMessage } from '../utils/logging.js';
export function buildStorage() {
    vpk.storageInfo = {};
    try {
        vpk.storageInfo.StorageClass = vpk.storageClassName;
        vpk.storageInfo.PVinfo = vpk.pvFnum;
        vpk.storageInfo.PVCinfo = vpk.pvcFnum;
        vpk.storageInfo.CSIDriver = vpk.csiDriverName;
        vpk.storageInfo.CSINode = vpk.csiNodeFnum;
        vpk.storageInfo.SpaceReqSC = vpk.spaceReqSC;
        vpk.storageInfo.SpaceReqPVC = vpk.spaceReqPVC;
        return;
    }
    catch (err) {
        logMessage('STO001 - Error building storageInfo, message: ' + err);
        logMessage('STO001 - Stack: ' + err.stack);
        return '';
    }
}
