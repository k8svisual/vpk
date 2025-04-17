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
Generic template to parse kubernetes resource type/kind
*/
'use strict';

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

//------------------------------------------------------------------------------
export function volumeAttachmentParse(kind: string, name: string, obj: any, fnum: any) {
    let attacher: string = 'none';
    let nodeName: string = 'none';
    let pvName: string = 'none';

    try {
        if (typeof vpk.volumeAttachment[name] === 'undefined') {
            vpk.volumeAttachment[name] = [];
        }

        if (typeof obj.spec.attacher !== 'undefined') {
            attacher = obj.spec.attacher;
        }

        if (typeof obj.spec.nodeName !== 'undefined') {
            nodeName = obj.spec.nodeName;
        }

        if (typeof obj.spec.source !== 'undefined') {
            if (typeof obj.spec.source.persistentVolumeName !== 'undefined') {
                pvName = obj.spec.source.persistentVolumeName;
            }
        }

        vpk.volumeAttachment[name].push({
            fnum: fnum,
            name: name,
            attacher: attacher,
            nodeName: nodeName,
            pvName: pvName,
            pvFnum: 0, // Will be updated in afterParse
        });
    } catch (err) {
        logMessage('VAT001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('VAT001 - Stack: ' + err.stack);
    }
}
