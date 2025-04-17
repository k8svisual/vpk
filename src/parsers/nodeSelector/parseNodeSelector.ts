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
NodeSelector processing  
*/
'use strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';
import { checkType } from '../../utils/checktype.js';

//------------------------------------------------------------------------------
export function nodeSelectorParse(ns: string, kind: string, name: string, obj: any, yk: string, fnum: any) {
    try {
        if (typeof obj !== 'undefined') {
            for (item in obj) {
                var nkey = '';
                var key = item;
                var value = obj[item];

                nkey = ns + '.' + kind + '.' + key + '.' + value;
                checkType(kind, nkey);
                if (typeof vpk[kind][nkey] === 'undefined') {
                    vpk[kind][nkey] = [];

                    var tmp = vpk[kind][nkey];
                    var item = {
                        namespace: ns,
                        kind: kind,
                        objName: name,
                        key: key,
                        value: value,
                        fnum: fnum,
                    };
                    tmp.push(item);
                    vpk[kind][nkey] = tmp;
                }
            }
        }
    } catch (err) {
        logMessage('NOD001 - Error processing file fnum: ' + fnum + ' message: ' + err);
        logMessage('NOD001 - Stack: ' + err.stack);
    }
}
