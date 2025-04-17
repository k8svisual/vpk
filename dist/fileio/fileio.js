//-----------------------------------------------------------------------------
// Process the JSON structures that comprise the resources in the K8s cluster.
// This is performed any time a snapshot is to be read.
//-----------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
import { showTimeDiff } from '../utils/showtimedif.js';
import { getPTime } from '../utils/getptime.js';
import { processAfterParse } from '../afterParse/processAfterParse.js';
import { chkUidChain } from '../ownerRefs/chkUidChain.js';
import { loadResources } from './loadresources.js';
let fnum;
let oRef;
let cStatus;
let statusPhase = '';
export function fileio(client) {
    try {
        // reading all resouces found in cluster
        logMessage(`FIO100 - Processing K8s resources`);
        let startT = getPTime();
        loadResources(client, fnum, oRef, cStatus, statusPhase);
        let stopT = getPTime();
        showTimeDiff(startT, stopT, 'fileio.loadResources();');
    }
    catch (err) {
        logMessage('FIO229 - Error: ' + err);
        logMessage('FIO229 - Error: ' + err.stack);
    }
    try {
        // checking the resource uid chains
        let startT = getPTime();
        chkUidChain();
        let stopT = getPTime();
        showTimeDiff(startT, stopT, 'owner.chkUidChain();');
    }
    catch (err) {
        logMessage('FIO129 - Error: ' + err);
        logMessage('FIO129 - Error: ' + err.stack);
    }
    try {
        processAfterParse(client);
    }
    catch (err) {
        logMessage('FIO329 - Error: ' + err);
        logMessage('FIO329 - Error: ' + err.stack);
    }
}
