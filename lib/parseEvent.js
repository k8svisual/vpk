/*
Copyright (c) 2018-2023 k8sVisual

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

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
var parseEvent = function (ns, kind, name, obj, fnum) {
    let msg = '';
    let eKind = kind;
    let eNamespace = ns;
    let eName = name;
    let iName = '';
    let iKind = '';
    let iUid = '';
    let iApiVersion = '';
    let type = '';
    let reason = '';
    let reasonComponent = '';
    let reasonInstance = '';
    let firstTime = 'Unknown';
    let lastTime = 'Unknown';
    let count = 'UnKnown';
    let source = '';


    try {
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
        if (typeof obj.reasonComponent !== 'undefined') {
            reasonComponent = obj.reasonComponent;
        }
        if (typeof obj.reasonInstance !== 'undefined') {
            reasonInstance = obj.reasonInstance;
        }

        if (typeof obj.count !== 'undefined') {
            count = obj.count;
        }
        if (typeof obj.firstTimestamp !== 'undefined') {
            firstTime = obj.firstTimestamp;
        }

        if (typeof obj.lastTimestamp !== 'undefined') {
            lastTime = obj.lastTimestamp;
        }

        if (typeof obj.source !== 'undefined') {
            if (typeof obj.source.component !== 'undefined') {
                source = obj.source.component;
            }
        }

        let key = eKind + '.' + eNamespace + '.' + eName;
        vpk.eventMessage.push({
            'key': key,
            'name': eName,
            'namespace': eNamespace,
            'involvedApiVersion': iApiVersion,
            'involvedKind': iKind,
            'involvedName': iName,
            'involvedUid': iUid,
            'fnum': fnum,
            'message': msg,
            'firstTime': firstTime,
            'lastTime': lastTime,
            'count': count,
            'reason': reason,
            'type': type,
            'sourceComponent': source,
            'reasonComponent': reasonComponent,
            'reasonInstance': reasonInstance
        });

    } catch (err) {
        utl.logMsg('vpkEVT001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkEVT001 - Stack: ' + err.stack)
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    parse: function (ns, kind, name, obj, fnum) {
        parseEvent(ns, kind, name, obj, fnum);
    }
};