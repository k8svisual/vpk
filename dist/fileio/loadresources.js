//------------------------------------------------------------------------------
// process the vpk.k8sResc object to parse the defitions
//------------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { processYAML } from './processYAML.js';
import { logMessage } from '../utils/logging.js';
export function loadResources(client, fnum, oRef, cStatus, statusPhase) {
    vpk.childUids = [];
    let keys = [];
    if (typeof vpk.k8sResc !== 'undefined') {
        keys = Object.keys(vpk.k8sResc);
    }
    else {
        logMessage(`FIO200 - Skipped processing k8sResc is undefined`);
    }
    let key;
    let k = 0;
    let contents;
    let hl = vpk.k8sResc.length;
    let increment = Math.round(hl / 5);
    let nowCnt = 0;
    let msg;
    //clear vpk
    delete vpk.relMap;
    vpk.relMap = '';
    try {
        for (k = 0; k < keys.length; k++) {
            nowCnt++;
            if (nowCnt >= increment) {
                nowCnt = 0;
                msg = 'Progress - parsed files: ' + k + ' of ' + hl;
                client.emit('parseStatus', { msg: msg });
                logMessage('FIO021 - ' + msg);
            }
            key = parseInt(keys[k]);
            contents = vpk.k8sResc[key];
            vpk.yaml = contents;
            processYAML(keys[k], fnum, oRef, cStatus, statusPhase);
        }
    }
    catch (err) {
        logMessage('FIO001 - Skipped, unable to parse key: ' + keys[k] + ' Error: ' + err);
    }
    // reset vpk values
    vpk.baseFS = [];
    vpk.uid = [];
}
