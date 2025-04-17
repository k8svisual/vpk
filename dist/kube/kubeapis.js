// Issue command to get the list of all resource types in the cluster
//-----------------------------------------------------------------------------
// Issue command to dump the cluster info for the cluster
//-----------------------------------------------------------------------------
'use strict';
import { execSync } from 'child_process';
import { logMessage } from '../utils/logging.js';
export function kubeapis(kinfo, glbGet) {
    try {
        let cmd = glbGet + ' api-resources -o wide';
        let glbSSH = '';
        logMessage('KUB072 - ' + cmd);
        if (typeof kinfo.host_ip !== 'undefined') {
            glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `;
            cmd = glbSSH + "'" + cmd + "'";
            logMessage('KUB054 - Command modified to use SSH to call Host machine');
        }
        else {
            glbSSH = '';
        }
        const out = execSync(cmd).toString();
        return out;
    }
    catch (err) {
        logMessage('KUB071 - Error getting api-resource information.  message: ' + err);
        return { items: [], error: err };
    }
}
