//------------------------------------------------------------------------------
// Routine to calculate the total seconds of duration from first date time to
// end date time. As currently written the routine only handles maximum of
// two consecutive days.
//------------------------------------------------------------------------------

import { logMessage } from '../utils/logging.js';

export function timeDiff(startTime: any, endTime: any) {
    try {
        if (startTime === '' || endTime === '') {
            return 0;
        }
        if (startTime === endTime) {
            return 0;
        }
        let start: any = new Date(startTime);
        let end: any = new Date(endTime);
        var seconds: any = (end.getTime() - start.getTime()) / 1000;
        return parseInt(seconds);
    } catch (err) {
        logMessage(`UTL089 - Error calculating time duration, message: ${err}`);
        logMessage(`UTL089 - Error stack: ${err.stack}`);
        return 0;
    }
}
