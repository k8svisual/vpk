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
Parse horizontal pod autoscaler
*/
'use strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';
//------------------------------------------------------------------------------
export function hpaParse(ns: string, kind: string, name: string, obj: any, fnum: any) {
    try {
        if (typeof obj.spec !== 'undefined') {
            if (typeof obj.spec.scaleTargetRef !== 'undefined') {
                let hpaLinkKind = '';
                let hpaLinkName = '';
                if (typeof obj.spec.scaleTargetRef.kind !== 'undefined') {
                    hpaLinkKind = obj.spec.scaleTargetRef.kind;
                }
                if (typeof obj.spec.scaleTargetRef.name !== 'undefined') {
                    hpaLinkName = obj.spec.scaleTargetRef.name;
                }
                if (typeof vpk.hpaLinks[fnum] === 'undefined') {
                    vpk.hpaLinks[fnum] = [];
                }
                vpk.hpaLinks[fnum].push({
                    hpaLinkName: hpaLinkName,
                    hpaLinkKind: hpaLinkKind,
                    fnum: fnum,
                    name: name,
                    spec: obj.spec,
                    namespace: ns,
                });
            }
        }
    } catch (err) {
        logMessage('HPA001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('HPA001 - Stack: ' + err.stack);
    }
}
