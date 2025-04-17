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
Parse secret
*/
'use strict';

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

//------------------------------------------------------------------------------
export function secretParse(ns: string, kind: string, name: string, obj: any, fnum: any) {
    let type: string = '';

    try {
        if (typeof vpk.secretFnum[fnum] === 'undefined') {
            vpk.secretFnum[fnum] = [];
        }
        type = obj.type;
        vpk.secretFnum[fnum].push({
            name: name,
            fnum: fnum,
            type: type,
            api: obj.apiVersion,
            namespace: ns,
        });
    } catch (err) {
        logMessage('SEC001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('SEC001 - Stack: ' + err.stack);
    }
}
