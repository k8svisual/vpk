//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

export function populateEndpointSlice() {
    let ckeys: any[] = Object.keys(vpk.pods);
    let ekeys: any[] = Object.keys(vpk.endpointSliceService);
    let ckey: string;
    let ekey: string;
    let eFnum: string;
    let pName: string;
    let lName: string;
    try {
        for (let e = 0; e < ekeys.length; e++) {
            ekey = ekeys[e];
            pName = vpk.endpointSliceService[ekey][0].targetName;
            eFnum = vpk.endpointSliceService[ekey][0].fnum;
            lName = vpk.endpointSliceService[ekey][0].labelServiceName;

            if (pName === '') {
                for (let c = 0; c < ckeys.length; c++) {
                    ckey = ckeys[c];
                    if (typeof vpk.pods[ckey].Services !== 'undefined') {
                        if (typeof vpk.pods[ckey].Services[0] !== 'undefined') {
                            if (typeof vpk.pods[ckey].Services[0].name !== 'undefined') {
                                if (vpk.pods[ckey].Services[0].name === lName) {
                                    vpk.pods[ckey].Services[0].eps = eFnum;
                                }
                            }
                        }
                    }
                }
            } else {
                for (let c = 0; c < ckeys.length; c++) {
                    ckey = ckeys[c];
                    if (vpk.pods[ckey].name === pName) {
                        if (typeof vpk.pods[ckey].Services !== 'undefined') {
                            vpk.pods[ckey].Services[0].eps = eFnum;
                        }
                    }
                }
            }
        }
    } catch (err) {
        logMessage('SCM033 - Error processing schematic, message: ' + err.stack);
    }
}
