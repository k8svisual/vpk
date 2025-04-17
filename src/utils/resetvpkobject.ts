//------------------------------------------------------------------------------
// reset the vpk object
//------------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function resetVpkObject() {
    // clean up any old kinds in vpk object
    let totId: any[] = vpk.kindList;
    let cCnt: number = 0;
    if (totId.length > 0) {
        for (let c: number = 0; c < totId.length; c++) {
            let kind: any = totId[c];
            kind = kind.trim();
            if (kind.length > 0) {
                if (typeof vpk[kind] !== 'undefined') {
                    let keys: any[] = Object.keys(vpk[kind]);
                    for (let i: number = 0; i < keys.length; i++) {
                        let key: string = keys[i];
                        let hl: number = vpk[kind][key].length;
                        for (let d: number = 0; d < hl; d++) {
                            vpk[kind][key].pop();
                            if (vpk[kind][key].length === hl) {
                            }
                        }
                        delete vpk[kind][key];
                    }
                    delete vpk[kind];
                    cCnt++;
                    delete vpk.kinds[kind];
                    let chkCntId: string = kind + 'Cnt';
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
