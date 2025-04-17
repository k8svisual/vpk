/**
 * Extracts volume information from the workload and updates relevant data structures.
 * @param obj Array of volume objects
 * @param kind Workload kind
 * @param ns Namespace
 * @param name Workload name
 * @param fnum File number identifier
 * @param nodeName Node name
 */
import vpk from '../../lib/vpk.js';
import { addToVolumeCounts } from './addToVolumeCounts.js';
import { logMessage } from '../../utils/logging.js';
export function getVolumes(obj, kind, ns, name, fnum, nodeName, allVolumes) {
    if (kind !== 'Pod') {
        return;
    }
    try {
        if (typeof vpk.storageVolumes[`${kind}::${ns}::${name}`] === 'undefined') {
            vpk.storageVolumes[`${kind}::${ns}::${name}`] = {
                obj,
                fnum,
                node: nodeName,
            };
        }
        else {
            logMessage('CON644 - Duplicate key located in vpk.storageVolumes, key: ' + `${kind}::${ns}::${name}`);
        }
        for (let p = 0; p < obj.length; p++) {
            const pName = obj[p].name;
            allVolumes[obj[p].name] = obj[p];
            const keys = Object.keys(allVolumes[pName]);
            for (let k = 0; k < keys.length; k++) {
                addToVolumeCounts(nodeName, ns, keys[k], fnum);
            }
        }
    }
    catch (err) {
        logMessage('CON405 - Error processing Pod Volumes: ' + err.message);
        logMessage('CON405 - stack: ' + err.stack);
    }
}
