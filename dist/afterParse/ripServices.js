//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function ripServices(data) {
    try {
        if (typeof data.obj.clusterIPs !== 'undefined') {
            for (let i = 0; i < data.obj.clusterIPs.length; i++) {
                if (typeof vpk.ipsService[data.obj.clusterIPs[i]] === 'undefined') {
                    vpk.ipsService[data.obj.clusterIPs[i]] = [];
                }
                vpk.ipsService[data.obj.clusterIPs[i]].push(data.fnum);
                if (typeof vpk.ipsServiceFnums[data.fnum] === 'undefined') {
                    vpk.ipsServiceFnums[data.fnum] = [];
                }
                vpk.ipsServiceFnums[data.fnum].push(data.obj.clusterIPs[i]);
            }
        }
    }
    catch (err) {
        logMessage('AFT274 - Error processing ripServices, message: ' + err);
        logMessage('AFT274 - Stack: ' + err.stack);
    }
}
