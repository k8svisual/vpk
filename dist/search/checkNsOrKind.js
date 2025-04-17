//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { processSelected } from './processSelected.js';
export function checkNsOrKind(what, type, fnumBase) {
    let keepFnum = [];
    let key;
    let data;
    try {
        for (let i = 0; i < what.length; i++) {
            key = what[i];
            if (key !== '') {
                if (type === 'NS') {
                    if (typeof vpk.idxNS[key] !== 'undefined') {
                        data = vpk.idxNS[key];
                    }
                    else {
                        logMessage(`SCH017 - No namespace located with value: ${key}`);
                        data = [];
                    }
                }
                else if (type === 'KIND') {
                    if (typeof vpk.idxKind[key] !== 'undefined') {
                        data = vpk.idxKind[key];
                    }
                    else {
                        logMessage(`SCH018 - No KIND located with value: ${key}`);
                        data = [];
                    }
                }
                for (let d = 0; d < data.length; d++) {
                    keepFnum.push(data[d]);
                }
            }
        }
        processSelected(keepFnum, fnumBase);
    }
    catch (err) {
        logMessage('SCH015 - Error in checkNsOrKind, message: ' + err);
        logMessage('SCH015 - Stack: ' + err.stack);
        return;
    }
}
