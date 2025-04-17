//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

export function populatePodsToShow(podNS) {
    let ns: string;
    let key: string;
    try {
        for (let i = 0; i < podNS.length; i++) {
            ns = podNS[i];
            key = '0000-' + ns;
            if (typeof vpk.pods[key].Pods === 'undefined') {
                vpk.pods[key].Pods = true;
            }
        }
        podNS = null;
    } catch (err) {
        logMessage('SCM830 - Error building container Pods flag, message: ' + err);
        logMessage(err.stack);
    }
}
