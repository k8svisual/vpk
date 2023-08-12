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
Called from fileio.js to process labels;  
*/

'use strict';

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

    //------------------------------------------------------------------------------
    // metadata.labels 
    // spec.template.metadata.labels 
    //------------------------------------------------------------------------------

    //------------------------------------------------------------------------------
    checkLabels: function (ns, kind, name, metadata, fnum) {
        try {
            // grab labels if they exist
            if (typeof metadata !== 'undefined') {
                if (typeof metadata.labels !== 'undefined') {
                    for (var key in metadata.labels) {
                        var value = metadata.labels[key];
                        var labelKey = ns + '.' + kind + '.' + key + '.' + value;
                        utl.checkLabel(key, value, fnum)
                        utl.checkType(kind, labelKey);
                        var tmp = vpk[kind][labelKey];
                        var item = {
                            'namespace': ns,
                            'kind': kind,
                            'objName': name,
                            'key': key,
                            'value': value,
                            'fnum': fnum
                        };
                        tmp.push(item);
                        vpk[kind][labelKey] = tmp;
                    }
                }
            }
        } catch (err) {
            utl.logMsg('vpkLBL555 - Error processing file fnum: ' + fnum + ' message: ' + err);
            utl.logMsg('vpkLBL555 - Stack: ' + err.stack);
        }
    },

    //------------------------------------------------------------------------------
    // spec.selector.matchLabels 
    //------------------------------------------------------------------------------
    checkMatchLabels: function (ns, kind, name, matchLabels, fnum) {

        try {
            // grab matchLabels if they exist
            if (typeof matchLabels !== 'undefined') {
                for (var key in matchLabels) {
                    var value = matchLabels[key];
                    var labelKey = ns + '.' + kind + '.' + key + '.' + value;
                    utl.checkType(kind, labelKey);
                    var tmp = vpk[kind][labelKey];
                    var item = {
                        'namespace': ns,
                        'kind': kind,
                        'objName': name,
                        'key': key,
                        'value': value,
                        'fnum': fnum
                    };
                    tmp.push(item);
                    vpk[kind][labelKey] = tmp;
                }
            }
        } catch (err) {
            utl.logMsg('vpkLBL557 - Error processing file fnum: ' + fnum + ' message: ' + err);
            utl.logMsg('vpkLBL557 - Stack: ' + err.stack);
        }
    }

    //end of export    
};