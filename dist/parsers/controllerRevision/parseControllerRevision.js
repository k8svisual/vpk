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
Parse the controller revision
*/
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
//------------------------------------------------------------------------------
export function controllerRevisionParse(ns, y_kind, name, obj, fnum) {
    try {
        let oKind = '';
        let oName = '';
        let oUid = '';
        if (typeof obj.metadata !== 'undefined') {
            if (typeof obj.metadata.name !== 'undefined') {
                if (typeof vpk.controllerRevision[fnum] === 'undefined') {
                    vpk.controllerRevision[fnum] = [];
                }
                if (typeof obj.metadata.ownerReferences !== 'undefined') {
                    if (typeof obj.metadata.ownerReferences[0].kind !== 'undefined') {
                        oKind = obj.metadata.ownerReferences[0].kind;
                    }
                    if (typeof obj.metadata.ownerReferences[0].name !== 'undefined') {
                        oName = obj.metadata.ownerReferences[0].name;
                    }
                    if (typeof obj.metadata.ownerReferences[0].uid !== 'undefined') {
                        oUid = obj.metadata.ownerReferences[0].uid;
                    }
                }
                vpk.controllerRevision[fnum].push({
                    name: obj.metadata.name,
                    fnum: fnum,
                    namespace: ns,
                    ownerKind: oKind,
                    ownerName: oName,
                    ownerUid: oUid,
                });
            }
        }
    }
    catch (err) {
        logMessage('CRV001 - Error processing file fnum: ' + fnum + ' kind: ' + y_kind + ' message: ' + err);
        logMessage('CRV001 - Stack: ' + err.stack);
    }
}
