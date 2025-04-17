//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
import { populateContainer } from './populateContainer.js';
import { checkUsage } from './checkUsage.js';
export function populateBaseContainer(data) {
    let e;
    let fnum;
    try {
        for (e = 0; e < data.length; e++) {
            fnum = data[e].fnum;
            checkUsage(data[e], fnum);
            if (typeof vpk.pods[fnum] !== 'undefined') {
                populateContainer(vpk.pods[fnum], fnum);
            }
        }
    }
    catch (err) {
        logMessage('SCM001 - Error processing schematic, fnum: ' + fnum + '  message: ' + err);
        logMessage('SCM101 - Stack: ' + err.stack);
    }
}
