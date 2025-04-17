//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
export function populateDaemonSetPods() {
    let keys = Object.keys(vpk.pods);
    let key;
    for (let k = 0; k < keys.length; k++) {
        key = keys[k];
        if (!key.startsWith('0000')) {
            if (vpk.daemonSetPods.includes(key)) {
                vpk.pods[key].daemonSetPod = true;
            }
            else {
                vpk.pods[key].daemonSetPod = false;
            }
        }
    }
}
