//-----------------------------------------------------------------------------
// Add node to networkNodes
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function ripNodes(data: any) {
    try {
        if (typeof data.addresses !== 'undefined') {
            for (let i: number = 0; i < data.addresses.length; i++) {
                if (typeof data.addresses[i] !== 'undefined') {
                    if (data.addresses[i].type === 'InternalIP') {
                        if (typeof vpk.ipsNode[data.addresses[i].address] === 'undefined') {
                            vpk.ipsNode[data.addresses[i].address] = [];
                        }
                        vpk.ipsNode[data.addresses[i].address].push(data.fnum);
                    }
                }
            }
        }
    } catch (err) {
        logMessage('AFT245 - Error processing ripNodes, message: ' + err);
        logMessage('AFT245 - Stack: ' + err.stack);
    }
}
