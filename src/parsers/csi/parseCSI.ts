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
Parse the CSINode and CSIDriver 
*/
'use strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';

//------------------------------------------------------------------------------
export function csiParse(kind: string, name: string, obj: any, fnum: any) {
    try {
        if (kind === 'CSINode') {
            if (typeof vpk.csiNodeFnum[fnum] === 'undefined') {
                vpk.csiNodeFnum[fnum] = [];
            }
            vpk.csiNodeFnum[fnum].push({
                fnum: fnum,
                name: name,
                drivers: obj.spec.drivers,
            });
        } else if (kind === 'CSIDriver') {
            if (typeof vpk.csiDriverName[name] === 'undefined') {
                vpk.csiDriverName[name] = [];
            }
            vpk.csiDriverName[name].push({
                fnum: fnum,
                name: name,
            });
        }
    } catch (err) {
        logMessage('CSI001 - Error processing StorageClass for fnum: ' + fnum + ' message: ' + err);
        logMessage('CSI001 - Stack: ' + err.stack);
    }
}
