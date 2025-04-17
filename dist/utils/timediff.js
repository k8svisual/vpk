//------------------------------------------------------------------------------
// Routine to calculate the total seconds of duration from first date time to
// end date time. As currently written the routine only handles maximum of
// two consecutive days.
//------------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
export function timeDiff(startTime, endTime) {
    try {
        if (startTime === '' || endTime === '') {
            return 0;
        }
        if (startTime === endTime) {
            return 0;
        }
        let start = new Date(startTime);
        let end = new Date(endTime);
        var seconds = (end.getTime() - start.getTime()) / 1000;
        return parseInt(seconds);
    }
    catch (err) {
        logMessage(`UTL089 - Error calculating time duration, message: ${err}`);
        logMessage(`UTL089 - Error stack: ${err.stack}`);
        return 0;
    }
}
