//-----------------------------------------------------------------------------
// communicating with Kubernetes via CLI to get readyz info
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

import { logMessage } from '../utils/logging.js';
import { kubeReadyZ } from './kubeReadyZ.js';
import { kubeStatus } from './kubeStatus.js';
import { kubeversion } from './kubeversion.js';
import { kubeapis } from './kubeapis.js';
import { parseAPIs } from './parseAPIs.js';

export function getAPIs(kinfo: any) {
    let glbGet: string = kinfo.command;
    let glbSSH: string = '';

    if (glbGet.indexOf(' ')) {
        const tmp = glbGet.split(' ');
        glbGet = tmp[0];
    }

    if (typeof kinfo.host_ip !== 'undefined') {
        glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `;
    }

    // Get the cluster software version
    vpk.version = kubeversion(glbGet, glbSSH);

    kubeReadyZ(glbGet, glbSSH);
    kubeStatus(glbGet, glbSSH);

    // getKindList = '::';
    const apidata: any = kubeapis(kinfo, glbGet);

    if (typeof apidata.error !== 'undefined') {
        logMessage('KUB017 - Error processing, message: ' + apidata.error);
        return 'FAIL';
    }

    // Build kga (Kubernetes Get Array) from the results of the api-resources command
    const kga = parseAPIs(apidata);
    return kga;
}
