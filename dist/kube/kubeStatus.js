//-----------------------------------------------------------------------------
// Issue command to dump the cluster info for the cluster
//-----------------------------------------------------------------------------
'use strict';
import { execSync } from 'child_process';
import { logMessage } from '../utils/logging.js';
import { parseStatus } from './parseStatus.js';
export function kubeStatus(glbGet, glbSSH) {
    try {
        let out = '';
        let cmd = '';
        const getParts = glbGet.split(' ');
        cmd = getParts.length > 1 ? getParts[0] + ' cluster-info dump ' : glbGet + ' cluster-info dump ';
        logMessage('KUB042 - ' + cmd);
        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'";
            logMessage('KUB042 - Command modified to use SSH to call Host machine');
        }
        out = execSync(cmd).toString();
        return out ? parseStatus(out) : { components: [] };
    }
    catch (err) {
        logMessage('KUB053 - Error getting Components information.  message: ' + err);
        return { components: [], error: err };
    }
}
