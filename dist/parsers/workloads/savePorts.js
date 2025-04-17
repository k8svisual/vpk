import vpk from '../../lib/vpk.js';
import { containerLink } from '../../utils/containerlink.js';
export function savePorts(obj, e, fnum) {
    if (typeof obj[e].ports === 'undefined') {
        return;
    }
    for (let p = 0; p < obj[e].ports.length; p++) {
        if (typeof obj[e].ports[p].containerPort !== 'undefined') {
            containerLink(fnum, 'Ports', obj[e].ports[p].containerPort, '', obj[e].ports[p]);
            vpk.pods[fnum].ports.push(obj[e].ports[p].containerPort);
        }
    }
}
