//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { timeDiff } from '../utils/timediff.js';
/**
 *
 * Event TimeStamp
 *
 * Creation Timestamp: This is the time when the event object was created in
 * the Kubernetes system. It is set at the moment the event is initially recorded.
 *
 * First Timestamp: This represents the time when the first occurrence of the
 * event happened. For events that can happen multiple times, this helps to
 * identify when the event was first observed.
 *
 * Last Timestamp: This represents the time of the most recent occurrence of
 * the event. It is updated every time the event is recorded.
 *
 * These timestamps are useful for understanding the chronological order of
 * events and for troubleshooting issues within the cluster. By examining
 * these timestamps, you can identify when an event was first observed,
 * when subsequent occurrences happened, and when the most recent occurrence
 * took place.
 */
export function setEvtTimes() {
    try {
        vpk.eventGraphics = new Object(vpk.eventMessage);
        let offset = 0;
        let duration = 0;
        let durationFromFirst = 0;
        let dGTZ = 0;
        let minutes = [];
        let ns = {};
        let nsSum = {};
        let tmp = 0;
        let totalMinutes;
        // Calculate overall timespan for all Events based on createDate value
        vpk.evtTotalDuration = timeDiff(vpk.evtFirstTime, vpk.evtLastTime);
        // totalMinutes = parseInt(vpk.evtTotalDuration / 60);
        totalMinutes = vpk.evtTotalDuration / 60;
        totalMinutes = totalMinutes + 1;
        for (let m = 0; m <= totalMinutes; m++) {
            minutes[m] = 0;
        }
        for (let i = 0; i < vpk.eventGraphics.length; i++) {
            if (typeof vpk.eventGraphics[i].firstTime !== 'undefined' && vpk.eventGraphics[i].firstTime !== null) {
                if (vpk.eventGraphics[i].firstTime !== '0') {
                    durationFromFirst = timeDiff(vpk.eventGraphics[i].firstTime, vpk.eventGraphics[i].createTime);
                }
                else {
                    durationFromFirst = 0;
                }
            }
            else {
                durationFromFirst = 0;
            }
            // New time caluculations
            offset = timeDiff(vpk.evtFirstTime, vpk.eventGraphics[i].createTime);
            duration = 0;
            vpk.eventGraphics[i].offset = offset;
            vpk.eventGraphics[i].duration = duration;
            vpk.eventGraphics[i].durationFromFirst = durationFromFirst;
            if (duration > 1) {
                dGTZ++;
            }
            // Stats for event message
            if (offset < 60) {
                tmp = 0;
            }
            else {
                tmp = offset / 60;
            }
            minutes[tmp] = minutes[tmp] + 1;
            if (typeof ns[vpk.eventGraphics[i].namespace] === 'undefined') {
                ns[vpk.eventGraphics[i].namespace] = [];
                for (let p = 0; p <= totalMinutes; p++) {
                    ns[vpk.eventGraphics[i].namespace][p] = 0;
                }
                nsSum[vpk.eventGraphics[i].namespace] = 0;
            }
            ns[vpk.eventGraphics[i].namespace][tmp] = ns[vpk.eventGraphics[i].namespace][tmp] + 1;
            nsSum[vpk.eventGraphics[i].namespace] = nsSum[vpk.eventGraphics[i].namespace] + 1;
        }
        vpk.evtMinutes = minutes;
        vpk.evtNs = ns;
        vpk.evtNsSum = nsSum;
        logMessage('AFT232 - Count of durations greater than one: ' + dGTZ);
    }
    catch (err) {
        logMessage('AFT237 - Error processing Event times, message: ' + err);
        logMessage('AFT237 - Stack: ' + err.stack);
    }
}
