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
/*
Parse volume claim template
*/
'use strict';
import { logMessage } from '../../utils/logging.js';
import { checkType } from '../../utils/checktype.js';
import { containerLink } from '../../utils/containerlink.js';
//------------------------------------------------------------------------------
export function volumeClaimTemplateParse(ns, kind, name, obj, yk, fnum) {
    try {
        let storClass = '';
        let vctName = '';
        for (let v = 0; v < obj.length; v++) {
            if (typeof obj[v].spec !== 'undefined') {
                if (typeof obj[v].spec.storageClassName !== 'undefined') {
                    storClass = obj[v].spec.storageClassName;
                }
                else {
                    storClass = '';
                }
            }
            if (typeof obj[v].metadata !== 'undefined') {
                if (typeof obj[v].metadata.name !== 'undefined') {
                    vctName = obj[v].metadata.name;
                }
                else {
                    vctName = 'unknown';
                }
            }
            checkType('VolumeClaimTemplates', '');
            containerLink(fnum, 'VolumeClaimTemplates', vctName, '', obj[v].spec);
            if (storClass !== '') {
                containerLink(fnum, 'StorageClass', storClass, '', '');
            }
        }
    }
    catch (err) {
        logMessage('VCT001 - Error processing file fnum: ' + fnum + ' message: ' + err);
        logMessage('VCT001 - Stack: ' + err.stack);
    }
}
