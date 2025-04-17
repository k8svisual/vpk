//-----------------------------------------------------------------------------
// save status message that occur during processing
//-----------------------------------------------------------------------------
'use strict';
import { logMessage } from '../utils/logging.js';
export function saveStatMsg(msg, cnt, statMessages, dashline) {
    if (msg === 'dl') {
        logMessage(dashline);
    }
    else {
        if (cnt === 0) {
            return;
        }
        //           1234567890123456789012345678901234567890123456789012345678901234567890
        msg = msg + '                                                            ';
        msg = msg.substring(0, 60);
        logMessage(msg + cnt);
        statMessages.push(msg + '::' + cnt);
    }
}
