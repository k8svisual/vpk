/**
 * Extracts volume information from the workload and updates relevant data structures.
 * @param c_name Container name
 * @param c_image Container image name
 * @param ctyoe Container type
 * @param fnum File number identifier
 */

import vpk from '../../lib/vpk.js';

export function saveImageInfo(c_name: string, c_image: any, ctype: string, fnum: any) {
    // save image data
    vpk.pods[fnum].containerNames.push({
        c_name: c_name,
        c_image: c_image,
    });
    // Update container type counts
    if (ctype === 'I') {
        vpk.pods[fnum].typeIcnt = vpk.pods[fnum].typeIcnt + 1;
    } else {
        vpk.pods[fnum].typeCcnt = vpk.pods[fnum].typeCcnt + 1;
    }
}
