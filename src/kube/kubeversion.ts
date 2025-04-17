//-----------------------------------------------------------------------------
// Issue command to get the cluster version
//-----------------------------------------------------------------------------
'use strict';

import { logMessage } from '../utils/logging.js';
import { execSync } from 'child_process';

export function kubeversion(glbGet: string, glbSSH: string) {
    try {
        let cmd = '';
        const getParts = glbGet.split(' ');
        cmd = getParts.length > 1 ? getParts[0] + ' version -o json' : glbGet + ' version -o json';

        logMessage('KUB052 - ' + cmd);

        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'";
            logMessage('KUB054 - Command modified to use SSH to call Host machine');
        }

        const out = execSync(cmd).toString();
        return JSON.parse(out);
    } catch (err) {
        logMessage('KUB053 - Error getting version information.  message: ' + err);
        return { items: [], error: err };
    }
}
