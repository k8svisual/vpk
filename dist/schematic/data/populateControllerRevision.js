//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
export function populateControllerRevision() {
    let keys = Object.keys(vpk.controllerRevision);
    let key = '';
    let cKey = '';
    for (let k = 0; k < keys.length; k++) {
        key = keys[k];
        if (typeof vpk.controllerRevision[key][0].ownerUid !== 'undefined') {
            cKey = vpk.controllerRevision[key][0].ownerUid;
            // check the ownerUids
            if (typeof vpk.ownerUids[cKey] !== 'undefined') {
                for (let h = 0; h < vpk.ownerUids[cKey].length; h++) {
                    if (vpk.ownerUids[cKey][h].selfKind === 'Pod') {
                        let pKey = vpk.ownerUids[cKey][h].selfFnum;
                        if (typeof vpk.pods[pKey] !== 'undefined') {
                            if (typeof vpk.pods[pKey]['ControllerRevision'] === 'undefined') {
                                vpk.pods[pKey]['ControllerRevision'] = [];
                            }
                            vpk.pods[pKey]['ControllerRevision'].push({
                                name: vpk.controllerRevision[key][0].name,
                                fnum: vpk.controllerRevision[key][0].fnum,
                            });
                        }
                    }
                }
            }
            else {
                logMessage('SCM061 - Error processing ControllerRevision: ' + cKey + ' name: ' + vpk.controllerRevision[key][0].name);
            }
        }
    }
}
