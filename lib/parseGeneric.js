/*
Copyright (c) 2018-2022 K8Debug

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

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
var hierarchy = require('../lib/hierarchy');

//------------------------------------------------------------------------------
var parseGeneric = function (ns, kind, name, fnum) {
    try {
        // build the key and save the data
        var lkey = ns + '.' + kind + '.' + name;
        utl.checkType(kind, lkey);
        var item = {
            'namespace': ns,
            'kind': kind,
            'objName': name,
            'fnum': fnum
        }

        vpk[kind][lkey].push(item);
        utl.checkKind(kind);

        // add the information to cluster hierarchy
        hierarchy.addEntry(ns, kind, name, fnum)

    } catch (err) {
        utl.logMsg('vpkGEN001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkGEN001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    parse: function (ns, kind, name, fnum) {
        parseGeneric(ns, kind, name, fnum);
    }
};