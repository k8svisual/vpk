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
Parse service account
*/
'use strict';
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
//------------------------------------------------------------------------------
export function serviceAccountParse(ns, kind, name, obj, fnum) {
    let imagePullSecrets;
    let secrets;
    try {
        if (typeof vpk.serviceAccounts[fnum] === 'undefined') {
            vpk.serviceAccounts[fnum] = [];
        }
        if (typeof obj.imagePullSecrets === 'undefined') {
            imagePullSecrets = [];
        }
        else {
            imagePullSecrets = obj.imagePullSecrets;
        }
        if (typeof obj.secrets === 'undefined') {
            secrets = [];
        }
        else {
            secrets = obj.secrets;
        }
        vpk.serviceAccounts[fnum].push({
            name: obj.metadata.name,
            fnum: fnum,
            imagePullSecrets: imagePullSecrets,
            secrets: secrets,
            namespace: obj.metadata.namespace,
        });
    }
    catch (err) {
        logMessage('SVA001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
    }
}
