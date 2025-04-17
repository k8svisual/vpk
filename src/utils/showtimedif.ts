//------------------------------------------------------------------------------
// calculate the size of a value that ends with text identifier
//------------------------------------------------------------------------------

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function showTimeDiff(start: any, stop: any, what: any) {
    try {
        if (stop >= start) {
            if (typeof vpk.stats.durations === 'undefined') {
                vpk.stats.durations = [];
            }
            vpk.stats.durations.push({ what: what, time: stop - start });
        } else {
            logMessage(`UTL289a - Start time ${start}, is greater than stop time ${stop}`);
        }
    } catch (err) {
        logMessage(`UTL289 - Error calculating time milliseconds duration, message: ${err}`);
        logMessage(`UTL289 - Error stack: ${err.stack}`);
        return 0;
    }
}
