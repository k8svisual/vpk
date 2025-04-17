//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { processSelected } from './processSelected.js';
export function checkEntireResource(what, fnumBase) {
    let keys = Object.keys(fnumBase);
    let key;
    let data;
    let keepFnum = [];
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        key = parseInt(key);
        data = vpk.k8sResc[key];
        // If managedFields are hidden do not search
        if (vpk.dropManagedFields === true) {
            if (typeof data.managedFields !== 'undefined') {
                delete data.managedFields;
            }
        }
        // If stats is hidden do not search
        if (vpk.dropStatus === true) {
            if (typeof data.status !== 'undefined') {
                delete data.status;
            }
        }
        data = JSON.stringify(data);
        if (data.indexOf(what) > -1) {
            keepFnum.push(keys[i]);
        }
        else {
            delete fnumBase[keys[i]];
        }
    }
    processSelected(keepFnum, fnumBase);
    return;
}
