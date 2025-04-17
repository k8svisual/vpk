//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function ripEndpoints(data: any) {
    let addr: any;
    try {
        if (typeof data.subsets !== 'undefined') {
            for (let i: number = 0; i < data.subsets.length; i++) {
                if (typeof data.subsets[i] !== 'undefined') {
                    if (typeof data.subsets[i].addresses !== 'undefined') {
                        addr = data.subsets[i].addresses;
                        for (let a: number = 0; a < addr.length; a++) {
                            if (typeof addr[a] !== 'undefined') {
                                if (typeof vpk.ipsEP[addr[a].ip] === 'undefined') {
                                    vpk.ipsEP[addr[a].ip] = [];
                                }
                                vpk.ipsEP[addr[a].ip].push(data.fnum);
                            }
                        }
                    } else {
                        logMessage('AFT244 - Endpoints has no addresses section');
                    }
                }
            }
        }
    } catch (err) {
        logMessage('AFT243 - Error processing ripEndpoints, message: ' + err);
        logMessage('AFT243 - Stack: ' + err.stack);
    }
}
