//-----------------------------------------------------------------------------
// Issue command from UI
//-----------------------------------------------------------------------------
'use strict';

import { execSync } from 'child_process';
import { logMessage } from '../utils/logging.js';

export function runCommand(cmd: string) {
    try {
        logMessage('KUB101 - Command to run: ' + cmd);
        const out = execSync(cmd).toString();
        const result = out.length > 0 ? out.split('\n') : ['OK'];
        return { output: result, status: 'pass' };
    } catch (err) {
        logMessage('KUB102 - Error from command, message: ' + err);
        const errorMsg = typeof err.message !== 'undefined' ? [err.message] : ['Command failed to run properly'];
        return { output: errorMsg, status: 'fail' };
    }
}
