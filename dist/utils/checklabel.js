//-----------------------------------------------------------------------------
// check if label is in array
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function checkLabel(label, value, fnum) {
    value = value.trim();
    label = label.trim();
    try {
        if (typeof vpk.labelKeys[label + ': ' + value] === 'undefined') {
            vpk.labelKeys[label + ': ' + value] = [];
            vpk.labelKeys[label + ': ' + value].push(fnum);
        }
        else {
            let key = label + ': ' + value;
            let tmp = vpk.labelKeys[key];
            let add = true;
            for (let i = 0; i < tmp.length; i++) {
                if (tmp[i] === fnum) {
                    add = false;
                }
            }
            if (add === true) {
                tmp.push(fnum);
                vpk.labelKeys[label + ': ' + value] = tmp;
            }
        }
    }
    catch (err) {
        logMessage(`UTL279 - Error checking labels , message: ' ${err}`);
    }
}
