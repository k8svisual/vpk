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
Parse Node
*/

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');

var stripKi = function (amt) {
    let newAmt = amt.substring(0, amt.length - 2);
    newAmt = parseInt(newAmt);
    newAmt = newAmt * 1024;
    newAmt = utl.formatBytes(newAmt);
    return newAmt.substring(3);
}

//------------------------------------------------------------------------------
var parseNode = function (ns, kind, name, obj, fnum) {
    let type = '';
    let capac = {};
    let alloc = {};
    let conditions = [];
    const masterKey = 'node-role.kubernetes.io/master';
    const controlPlane = 'node-role.kubernetes.io/control-plane';
    // console.log(JSON.stringify(obj, null, 2))
    try {
        if (typeof vpk.nodesFnum[fnum] === 'undefined') {
            vpk.nodesFnum[fnum] = []
        }
        // build node type, default is worker
        type = 'w'  // worker node
        if (typeof obj.metadata.labels[masterKey] !== 'undefined') {
            type = 'm'  // master node
        }
        if (typeof obj.metadata.labels[controlPlane] !== 'undefined') {
            type = 'm'  // master node
        }

        // populate node allocatable and capacity
        if (typeof obj.status.capacity !== 'undefined') {
            capac = obj.status.capacity
        }
        if (typeof obj.status.allocatable !== 'undefined') {
            alloc = obj.status.allocatable
        }

        // populate conditions info
        if (typeof obj.status.conditions !== 'undefined') {
            conditions = obj.status.conditions;
        }

        vpk.nodesFnum[fnum].push({
            'name': name,
            'fnum': fnum,
            'type': type,
            'api': obj.apiVersion,
            'a_cpu': alloc.cpu,
            'a_memory': alloc.memory,
            'a_memory-gb': stripKi(alloc.memory),
            'a_pods': alloc.pods,
            'c_cpu': capac.cpu,
            'c_memory': capac.memory,
            'c_memory-gb': stripKi(capac.memory),
            'c_pods': capac.pods,
            'conditions': conditions,
            'csiNodes': []
        });


    } catch (err) {
        utl.logMsg('vpkNOD001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkNOD001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    parse: function (ns, kind, name, obj, fnum) {
        parseNode(ns, kind, name, obj, fnum);
    }
};