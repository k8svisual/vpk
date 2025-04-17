//------------------------------------------------------------------------------
// Build the hierarchy of Subject binding to Role
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function filterSecurityRules(data: any) {
    let vset = data.vset;
    let rsc = data.rsc;
    let apiG = data.apiG;
    let ns = data.ns;
    let first = true;
    let newData;
    let i;
    try {
        if (vset !== null) {
            if (vset.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < vset.length; i++) {
                    newData = newData.filter((rec) => rec.vset.indexOf(vset[i]) > -1);
                }
            }
        }
        if (rsc !== null) {
            if (rsc.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < rsc.length; i++) {
                    newData = newData.filter((rec) => rec.rsc.indexOf(rsc[i]) > -1);
                }
            }
        }
        if (apiG !== null) {
            if (apiG.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < apiG.length; i++) {
                    newData = newData.filter((rec) => rec.apiG.indexOf(apiG[i]) > -1);
                }
            }
        }
        if (ns !== null) {
            if (ns.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < ns.length; i++) {
                    newData = newData.filter((rec) => rec.ns.indexOf(ns[i]) > -1);
                }
            }
        }
    } catch (err) {
        logMessage('SEC005 - Error filtering security data' + 'message: ' + err);
        logMessage('SEC006 - Stack: ' + err.stack);
    }

    return newData;
}
