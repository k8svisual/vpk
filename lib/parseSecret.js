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

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
var parseSecret = function (ns, kind, name, obj, fnum) {
    let type = '';
    try {
        if (typeof vpk.secretFnum[fnum] === 'undefined') {
            vpk.secretFnum[fnum] = []
        }
        type = obj.type;
        vpk.secretFnum[fnum].push({
            'name': name,
            'fnum': fnum,
            'type': type,
            'api': obj.apiVersion,
            'namespace': ns
        });
    } catch (err) {
        utl.logMsg('vpkSEC001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkSEC001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    parse: function (ns, kind, name, obj, fnum) {
        parseSecret(ns, kind, name, obj, fnum);
    }
};