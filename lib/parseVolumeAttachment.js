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

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
var parseVolumeAttachment = function (kind, name, obj, fnum) {

    let attacher = 'none';
    let nodeName = 'none';
    let pvName = 'none';

    try {
        if (typeof vpk.volumeAttachment[name] === 'undefined') {
            vpk.volumeAttachment[name] = []
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
            'fnum': fnum,
            'name': name,
            'attacher': attacher,
            'nodeName': nodeName,
            'pvName': pvName
        })

    } catch (err) {
        utl.logMsg('vpkVAT001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkVAT001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    parse: function (kind, name, obj, fnum) {
        parseVolumeAttachment(kind, name, obj, fnum);
    }
};