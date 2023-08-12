/*
Copyright (c) 2018-2022 K8Debug

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

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');

//------------------------------------------------------------------------------
var parseEvent = function (ns, kind, name, obj, fnum) {
    let msg = '';
    let eNamespace = '';
    let type = '';
    let eKind = '';
    let eName = '';
    let reason = '';
    let firstTime = '';
    let lastTime = '';
    let count = '';
    try {
        if (typeof obj.involvedObject.kind !== 'undefined') {
            eKind = obj.involvedObject.kind;
        }
        if (typeof obj.involvedObject.name !== 'undefined') {
            eName = obj.involvedObject.name;
        }
        if (typeof obj.involvedObject.namespace !== 'undefined') {
            eNamespace = obj.involvedObject.namespace;
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
        if (typeof obj.count !== 'undefined') {
            count = obj.count;
        }
        if (typeof obj.firstTimestamp !== 'undefined') {
            firstTime = obj.firstTimestamp;
        }
        if (typeof obj.lastTimestamp !== 'undefined') {
            lastTime = obj.lastTimestamp;
        }

        let key = eKind + '.' + eNamespace + '.' + eName;
        vpk.eventMessage.push({
            'key': key,
            'kind': eKind,
            'name': eName,
            'involvedKind': eKind,
            'involvedNamespace': eNamespace,
            'involvedName': eName,
            'fnum': fnum,
            'message': msg,
            'firstTime': firstTime,
            'lastTime': lastTime,
            'count': count,
            'reason': reason,
            'type': type
        });

    } catch (err) {
        utl.logMsg('vpkEVT001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkEVT001 - Stack: ' + err.stack)
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    parse: function (ns, kind, name, obj, fnum) {
        parseEvent(ns, kind, name, obj, fnum);
    }
};