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

import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
var parseVolumeClaimTemplates = function (ns, kind, name, obj, yk, fnum) {

    try {
        var storClass = '';
        var vctName;

        for (var v = 0; v < obj.length; v++) {
            if (typeof obj[v].spec !== 'undefined') {
                if (typeof obj[v].spec.storageClassName !== 'undefined') {
                    storClass = obj[v].spec.storageClassName;
                } else {
                    storClass = '';
                }
            }

            if (typeof obj[v].metadata !== 'undefined') {
                if (typeof obj[v].metadata.name !== 'undefined') {
                    vctName = obj[v].metadata.name;
                } else {
                    vctName = 'unknown';
                }
            }

            utl.checkType('VolumeClaimTemplates', '');
            utl.containerLink(fnum, 'VolumeClaimTemplates', vctName, '', obj[v].spec)

            if (storClass !== '') {
                utl.containerLink(fnum, 'StorageClass', storClass)
            }
        }

    } catch (err) {
        utl.logMsg('vpkVCT001 - Error processing file fnum: ' + fnum + ' message: ' + err);
        utl.logMsg('vpkVCT001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    parse: function (ns, kind, name, obj, yk, fnum) {
        parseVolumeClaimTemplates(ns, kind, name, obj, yk, fnum);
    }
};