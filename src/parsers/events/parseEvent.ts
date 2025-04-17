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
Parse events
*/
'use strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';

//------------------------------------------------------------------------------
export function eventParse(ns: string, kind: string, name: string, obj: any, fnum: any) {
    let msg: string = '';
    let eKind: string = kind;
    let eNamespace: string = ns;
    let eName: string = name;
    let iName: string = 'Unknown';
    let iKind: string = 'Unknown';
    let iUid = 'Unknown';
    let iApiVersion: string = 'Unknown';
    let type: string = 'Unknown';
    let reason: string = 'Unknown';
    let reportingComponent: string = 'Unknown';
    let reportingInstance: string = 'Unknown';
    let firstTime: string = 'Unknown';
    let lastTime: string = 'Unknown';
    let createTime: string = 'Unknown';
    let count: string = 'UnKnown';
    let source: string = 'Unknown';
    let sourceHost: string = '';

    try {
        if (typeof obj.metadata.creationTimestamp !== 'undefined') {
            createTime = obj.metadata.creationTimestamp;
        }

        if (typeof obj.firstTimestamp !== 'undefined') {
            firstTime = obj.firstTimestamp;
        }

        if (typeof obj.lastTimestamp !== 'undefined') {
            lastTime = obj.lastTimestamp;
        }

        if (typeof obj.involvedObject.kind !== 'undefined') {
            iKind = obj.involvedObject.kind;
        }

        if (typeof obj.involvedObject.name !== 'undefined') {
            iName = obj.involvedObject.name;
        }

        if (typeof obj.involvedObject.apiVersion !== 'undefined') {
            iApiVersion = obj.involvedObject.apiVersion;
        }

        if (typeof obj.involvedObject.uid !== 'undefined') {
            iUid = obj.involvedObject.uid;
        }

        if (typeof obj.message !== 'undefined') {
            msg = obj.message;
        }

        if (typeof obj.type !== 'undefined') {
            type = obj.type;
        }

        if (typeof obj.reason !== 'undefined') {
            reason = obj.reason;
        }

        if (typeof obj.reportingComponent !== 'undefined') {
            reportingComponent = obj.reportingComponent;
        }
        if (reportingComponent === '') {
            reportingComponent = 'Unknown';
        }

        if (typeof obj.reportingInstance !== 'undefined') {
            reportingInstance = obj.reportingInstance;
        }
        if (reportingInstance === '') {
            reportingInstance = 'Unknown';
        }

        if (typeof obj.count !== 'undefined') {
            count = obj.count;
        }
        if (count === '') {
            count = '0';
        }

        if (typeof obj.source !== 'undefined') {
            if (typeof obj.source.component !== 'undefined') {
                source = obj.source.component;
            } else {
                source = obj.reportingComponent;
            }
            let sourceKeys = Object.keys(obj.source);
            if (sourceKeys.length > 1) {
                if (sourceKeys[1] !== 'host') {
                    sourceHost = sourceKeys[1];
                }
            }
        } else {
            source = obj.reportingComponent;
        }

        if (source === '') {
            source = 'Unknown';
        }

        // if (lastTime !== 'Unknown' && lastTime !== null) {
        //     if (lastTime !== createTime) {
        //         console.log(`LastTime !== createTime   lastTime: ${lastTime}   createTime: ${createTime}   iKind: ${iKind}   iName: ${iName}   `)
        //     }
        // }

        // Save overall first and last times
        if (firstTime < vpk.evtFirstTime) {
            vpk.evtFirstTime = firstTime;
        }
        if (lastTime > vpk.evtLastTime) {
            vpk.evtLastTime = lastTime;
        }

        let key = eKind + '.' + eNamespace + '.' + eName;
        vpk.eventMessage.push({
            key: key,
            name: eName,
            namespace: eNamespace,
            involvedApiVersion: iApiVersion,
            involvedKind: iKind,
            involvedName: iName,
            involvedUid: iUid,
            fnum: fnum,
            message: msg,
            firstTime: firstTime,
            lastTime: lastTime,
            createTime: createTime,
            count: count,
            reason: reason,
            type: type,
            sourceComponent: source,
            reportingComponent: reportingComponent,
            reportingInstance: reportingInstance,
            sourceHost: sourceHost,
            sortKey: iUid + ':' + createTime,
        });
    } catch (err) {
        logMessage('EVT001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('EVT001 - Stack: ' + err.stack);
    }
}
