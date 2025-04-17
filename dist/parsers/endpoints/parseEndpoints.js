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
/*------------------------------------------------------------------------------
Parse endpoints
*/
'use strict';
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
//------------------------------------------------------------------------------
export function endpointsParse(ns, kind, name, obj, fnum) {
    let oRef;
    let targetUid;
    try {
        if (typeof obj.metadata !== 'undefined') {
            if (typeof obj.metadata.ownerReferences !== 'undefined') {
                oRef = obj.metadata.ownerReferences;
            }
            else {
                oRef = [];
            }
            targetUid = '';
            if (typeof obj.subsets !== 'undefined') {
                if (typeof obj.subsets[0] !== 'undefined') {
                    // Network related info saved
                    let netKey = kind + ':' + ns + ':' + name;
                    let netInfo = {};
                    netInfo.subsets = obj.subsets;
                    netInfo.fnum = fnum;
                    if (typeof vpk.netInfo[netKey] === 'undefined') {
                        vpk.netInfo[netKey] = netInfo;
                    }
                    if (typeof obj.subsets[0].addresses !== 'undefined') {
                        if (typeof obj.subsets[0].addresses[0] !== 'undefined') {
                            if (typeof obj.subsets[0].addresses[0].targetRef !== 'undefined') {
                                if (typeof obj.subsets[0].addresses[0].targetRef.uid !== 'undefined') {
                                    targetUid = obj.subsets[0].addresses[0].targetRef.uid;
                                }
                            }
                        }
                    }
                }
            }
            if (typeof vpk.endpointsLinks[fnum] === 'undefined') {
                vpk.endpointsLinks[fnum] = [];
            }
            vpk.endpointsLinks[fnum].push({
                name: obj.metadata.name,
                oRef: oRef,
                fnum: fnum,
                targetUid: targetUid,
            });
        }
    }
    catch (err) {
        logMessage('EPX001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('EPX001 - Stack: ' + err.stack);
    }
}
