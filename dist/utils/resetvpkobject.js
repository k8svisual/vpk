//------------------------------------------------------------------------------
// reset the vpk object
//------------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function resetVpkObject() {
    // clean up any old kinds in vpk object
    let totId = vpk.kindList;
    let cCnt = 0;
    if (totId.length > 0) {
        for (let c = 0; c < totId.length; c++) {
            let kind = totId[c];
            kind = kind.trim();
            if (kind.length > 0) {
                if (typeof vpk[kind] !== 'undefined') {
                    let keys = Object.keys(vpk[kind]);
                    for (let i = 0; i < keys.length; i++) {
                        let key = keys[i];
                        let hl = vpk[kind][key].length;
                        for (let d = 0; d < hl; d++) {
                            vpk[kind][key].pop();
                            if (vpk[kind][key].length === hl) {
                            }
                        }
                        delete vpk[kind][key];
                    }
                    delete vpk[kind];
                    cCnt++;
                    delete vpk.kinds[kind];
                    let chkCntId = kind + 'Cnt';
                    if (typeof vpk[chkCntId] !== 'undefined') {
                        delete vpk[chkCntId];
                    }
                }
            }
        }
        logMessage(`UTL694 - Reset ${cCnt} vpk. objects`);
    }
    vpk.kindList = [];
}
