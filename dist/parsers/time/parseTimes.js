/*
Copyright (c) 2018-2023 Dave Weilert

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
//------------------------------------------------------------------------------
'use strict';
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
function trimTime(ds) {
    return ds.substring(0, 19);
}
//------------------------------------------------------------------------------
let parsePod = function (ns, kind, name, obj, fnum) {
    let createTime;
    let startTime;
    let finishTime;
    let fCnt;
    let cCnt;
    try {
        if (typeof obj.status !== 'undefined') {
            if (typeof obj.status.startTime !== 'undefined') {
                startTime = trimTime(obj.status.startTime);
                if (typeof vpk.timeline[startTime] === 'undefined') {
                    vpk.timeline[startTime] = [];
                }
                vpk.timeline[startTime].push({
                    fnum: fnum,
                    kind: kind,
                    ns: ns,
                    name: name,
                    act: 'start',
                });
            }
            if (typeof obj.status.containerStatuses !== 'undefined') {
                fCnt = 0;
                finishTime = '';
                cCnt = obj.status.containerStatuses.length;
                for (let i = 0; i < cCnt; i++) {
                    if (typeof obj.status.containerStatuses[i].state !== 'undefined') {
                        if (typeof obj.status.containerStatuses[i].state.terminated !== 'undefined') {
                            if (typeof obj.status.containerStatuses[i].state.terminated.finishedAt !== 'undefined') {
                                fCnt++;
                                if (obj.status.containerStatuses[i].state.terminated.finishedAt > finishTime) {
                                    finishTime = obj.status.containerStatuses[i].state.terminated.finishedAt;
                                    if (obj.status.containerStatuses[i].state.terminated.reason !== 'Completed') {
                                        finishTime = obj.status.containerStatuses[i].state.terminated.reason;
                                        logMessage(`TIM001 - Finish reason not Completed, is: ${finishTime}`);
                                    }
                                }
                            }
                        }
                    }
                }
                if (fCnt === cCnt) {
                    finishTime = trimTime(finishTime);
                    if (typeof vpk.timeline[finishTime] === 'undefined') {
                        vpk.timeline[finishTime] = [];
                    }
                    vpk.timeline[finishTime].push({
                        fnum: fnum,
                        kind: kind,
                        ns: ns,
                        name: name,
                        act: 'finish',
                    });
                }
            }
        }
        else {
            if (typeof obj.metadata.creationTimestamp !== 'undefined') {
                createTime = trimTime(obj.metadata.creationTimestamp);
                if (typeof vpk.timeline[createTime] === 'undefined') {
                    vpk.timeline[createTime] = [];
                }
                vpk.timeline[createTime].push({
                    fnum: fnum,
                    kind: kind,
                    ns: ns,
                    name: name,
                    act: 'create',
                });
            }
        }
    }
    catch (err) {
        logMessage('TIM001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('TIM001 - Stack: ' + err.stack);
    }
};
//------------------------------------------------------------------------------
let parseCreateTimestamp = function (ns, kind, name, obj, fnum) {
    let createTime;
    try {
        if (typeof obj.metadata.creationTimestamp !== 'undefined') {
            createTime = trimTime(obj.metadata.creationTimestamp);
            if (typeof vpk.timeline[createTime] === 'undefined') {
                vpk.timeline[createTime] = [];
            }
            vpk.timeline[createTime].push({
                fnum: fnum,
                kind: kind,
                ns: ns,
                name: name,
                act: 'create',
            });
        }
    }
    catch (err) {
        logMessage('TIM002 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('TIM002 - Stack: ' + err.stack);
    }
};
//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    //------------------------------------------------------------------------------
    // Process Pods
    //------------------------------------------------------------------------------
    checkPod: function (ns, kind, name, obj, fnum) {
        parsePod(ns, kind, name, obj, fnum);
    },
    //------------------------------------------------------------------------------
    // Process Node
    //------------------------------------------------------------------------------
    checkCreateTime: function (ns, kind, name, obj, fnum) {
        parseCreateTimestamp(ns, kind, name, obj, fnum);
    },
    //end of export
};
