//-----------------------------------------------------------------------------
// Get data for request
// kga (Kubernetes Get Array)
//-----------------------------------------------------------------------------
'use strict';
import { logMessage } from '../utils/logging.js';
import { showTimeDiff } from '../utils/showtimedif.js';
import { getPTime } from '../utils/getptime.js';
import { processDir } from './processDir.js';
export function reloadSnapshot(dir, client) {
    let startT = getPTime();
    logMessage(`SNP002 - snapshot reload invoked for: ${dir}`);
    processDir(dir, client);
    let stopT = getPTime();
    showTimeDiff(startT, stopT, 'snapshot.reload()');
}
