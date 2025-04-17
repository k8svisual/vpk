//-----------------------------------------------------------------------------
// Flip the data to the fnum the key and the repository the data
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function ripEndpointSlices(data) {
    let addr;
    try {
        if (typeof data.endpoints !== 'undefined') {
            for (let i = 0; i < data.endpoints.length; i++) {
                if (typeof data.endpoints[i].addresses !== 'undefined') {
                    for (let a = 0; a < data.endpoints[i].addresses.length; a++) {
                        addr = data.endpoints[i].addresses[a];
                        if (typeof vpk.ipsEPS[addr] === 'undefined') {
                            vpk.ipsEPS[addr] = [];
                        }
                        vpk.ipsEPS[addr].push(data.fnum);
                    }
                }
            }
        }
    }
    catch (err) {
        logMessage('AFT274 - Error processing ripServices, message: ' + err);
        logMessage('AFT274 - Stack: ' + err.stack);
    }
}
