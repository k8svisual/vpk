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
Parse storage class
*/
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
//------------------------------------------------------------------------------
export function storageClassParse(ns, kind, name, obj, fnum) {
    try {
        if (typeof obj.metadata !== 'undefined') {
            let name = obj.metadata.name;
            if (typeof vpk.storageClassName[name] === 'undefined') {
                vpk.storageClassName[name] = {
                    name: name,
                    fnum: fnum,
                };
                if (typeof obj.parameters !== 'undefined') {
                    vpk.storageClassName[name].parameters = obj.parameters;
                }
                if (typeof obj.provisioner !== 'undefined') {
                    vpk.storageClassName[name].provisioner = obj.provisioner;
                }
            }
        }
    }
    catch (err) {
        logMessage('STC001 - Error processing StorageClass for fnum: ' + fnum + ' message: ' + err);
        logMessage('STC001 - Stack ' + err.stack);
    }
}
