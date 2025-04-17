//-----------------------------------------------------------------------------
// communicating with Kubernetes via CLI to get readyz info
//-----------------------------------------------------------------------------
'use strict';
import vpkSpan from '../lib/vpkSpan.js';
import { logMessage } from '../utils/logging.js';
import { execSync } from 'child_process';
// Issue command to get the ready status of resources in the cluster
export function kubeReadyZ(glbGet, glbSSH) {
    const cTxt = ' get --raw="/readyz?verbose"';
    try {
        let out = '';
        let cmd = '';
        const getParts = glbGet.split(' ');
        cmd = getParts.length > 1 ? getParts[0] + cTxt : glbGet + cTxt;
        logMessage('KUB022 - ' + cmd);
        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'";
            logMessage('KUB023 - Command modified to use SSH to call Host machine');
        }
        out = execSync(cmd).toString();
        vpkSpan.readyz = out ? out.split('\n') : [];
    }
    catch (err) {
        logMessage('KUB024 - Error getting ReadyZ information.  message: ' + err);
        vpkSpan.readyz = [];
    }
}
