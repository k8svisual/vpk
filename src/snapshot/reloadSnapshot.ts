//-----------------------------------------------------------------------------
// Get data for request
// kga (Kubernetes Get Array)
//-----------------------------------------------------------------------------
'use strict';

import { logMessage } from '../utils/logging.js';
import { showTimeDiff } from '../utils/showtimedif.js';
import { getPTime } from '../utils/getptime.js';
import { processDir } from './processDir.js';

export function reloadSnapshot(dir: any, client: any) {
    let startT: any = getPTime();
    logMessage(`SNP002 - snapshot reload invoked for: ${dir}`);
    processDir(dir, client);
    let stopT: any = getPTime();
    showTimeDiff(startT, stopT, 'snapshot.reload()');
}
