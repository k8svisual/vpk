//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';

export function populateDaemonSetPods() {
    let keys: any[] = Object.keys(vpk.pods);
    let key: string;

    for (let k = 0; k < keys.length; k++) {
        key = keys[k];
        if (!key.startsWith('0000')) {
            if (vpk.daemonSetPods.includes(key)) {
                vpk.pods[key].daemonSetPod = true;
            } else {
                vpk.pods[key].daemonSetPod = false;
            }
        }
    }
}
