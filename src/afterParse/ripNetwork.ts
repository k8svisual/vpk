//-----------------------------------------------------------------------------
// Flip the data to the fnum the key and the repository the data
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { ripEndpointSlices } from './ripEndpointSlices.js';
import { ripEndpoints } from './ripEndpoints.js';
import { ripNodes } from './ripNodes.js';
import { ripPods } from './ripPods.js';
import { ripServices } from './ripServices.js';
import { ripIPS } from './ripIPs.js';

export function ripNetwork() {
    vpk.ipsPod = {};
    vpk.ipsNode = {};
    vpk.ipsService = {};
    vpk.ipsEPS = {};
    vpk.ipsEP = {};
    vpk.hostnameNode = {};
    vpk.ipsServiceFnums = {};
    // let base;

    try {
        let keys: any[] = Object.keys(vpk.netInfo);
        for (let i: number = 0; i < keys.length; i++) {
            if (keys[i].startsWith('Endpoints')) {
                ripEndpoints(vpk.netInfo[keys[i]]);
            } else if (keys[i].startsWith('Node')) {
                ripNodes(vpk.netInfo[keys[i]]);
            } else if (keys[i].startsWith('Pod')) {
                ripPods(vpk.netInfo[keys[i]]);
            } else if (keys[i].startsWith('Service')) {
                ripServices(vpk.netInfo[keys[i]]);
            } else if (keys[i].startsWith('EndpointSlice')) {
                ripEndpointSlices(vpk.netInfo[keys[i]]);
            } else {
                logMessage(`AFT266 - ripNetwork did not process ${keys[i]}`);
            }
        }

        // Save IP root for each type
        keys = Object.keys(vpk.ipsEP);
        vpk.networkIPCounts['EP'] = ripIPS(keys);

        keys = Object.keys(vpk.ipsEPS);
        vpk.networkIPCounts['EPS'] = ripIPS(keys);

        keys = Object.keys(vpk.ipsNode);
        vpk.networkIPCounts['Node'] = ripIPS(keys);

        keys = Object.keys(vpk.ipsPod);
        vpk.networkIPCounts['Pod'] = ripIPS(keys);

        // Save all IPs for Service
        keys = Object.keys(vpk.ipsService);
        vpk.networkIPCounts['Service'] = keys;
    } catch (err) {
        logMessage('AFT267 - Error processing flipRepoFirst, message: ' + err);
        logMessage('AFT267 - Stack: ' + err.stack);
    }
}
