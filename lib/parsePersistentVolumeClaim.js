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
Parse persistent volume claim
*/

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
var parsePVC = function (ns, kind, name, obj, fnum) {

    let pName = name;
    let namespace = ns;
    let label;
    let keys;
    let key;
    let data = '';
    let storageClass = '';
    let volumeName = '';
    let spaceReq = '';
    try {

        if (typeof obj.spec.storageClassName !== 'undefined') {
            storageClass = obj.spec.storageClassName;
        }

        if (typeof obj.spec.volumeName !== 'undefined') {
            volumeName = obj.spec.volumeName;
        }

        if (typeof obj.spec.selector !== 'undefined') {
            if (typeof obj.spec.selector.matchLabels !== 'undefined') {
                label = obj.spec.selector.matchLabels;
                keys = Object.keys(obj.spec.selector.matchLabels);
                if (typeof keys[0] !== 'undefined') {
                    key = keys[0];
                    data = key + ': ' + label[keys[0]]
                }
            }
        } else {
            data = '';
        }

        // track the space requested by PVC;
        if (typeof obj.spec.resources !== 'undefined') {
            if (typeof obj.spec.resources.requests !== 'undefined') {
                if (typeof obj.spec.resources.requests.storage !== 'undefined') {
                    spaceReq = utl.spaceCalc(obj.spec.resources.requests.storage)
                    vpk.spaceReqPVC.push({
                        'name': name,
                        'ns': ns,
                        'space': spaceReq,
                        'storageClass': storageClass,
                        'fmtSpc': utl.formatBytes(spaceReq)
                    })
                }
            }
        }

        // pvcFnum
        if (typeof vpk.pvcFnum[fnum] === 'undefined') {
            vpk.pvcFnum[fnum] = []
        }
        vpk.pvcFnum[fnum].push({
            'name': pName,
            'namespace': namespace,
            'fnum': fnum,
            'storageClass': storageClass,
            'volumeName': volumeName,
            'pvSelectorLabel': data,
            'space': spaceReq,
            'fmtSpc': utl.formatBytes(spaceReq)
        });


        // pvcLinks
        if (typeof vpk.pvcLinks[pName] === 'undefined') {
            vpk.pvcLinks[pName] = []
        }
        vpk.pvcLinks[pName].push({
            'name': pName,
            'namespace': namespace,
            'fnum': fnum,
            'storageClass': storageClass,
            'volumeName': volumeName,
            'pvSelectorLabel': data,
            'space': spaceReq,
            'fmtSpc': utl.formatBytes(spaceReq)
        });

        //pvcNames
        if (typeof vpk.pvcNames[name] === 'undefined') {
            vpk.pvcNames[name] = []
        }
        vpk.pvcNames[name].push({
            'name': name,
            'namespace': namespace,
            'fnum': fnum,
            'storageClass': storageClass,
            'volumeName': volumeName,
            'pvSelectorLabel': data,
            'space': spaceReq,
            'fmtSpc': utl.formatBytes(spaceReq)
        });

    } catch (err) {
        utl.logMsg('vpkPVC001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkPVC001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    parse: function (ns, kind, name, obj, fnum) {
        parsePVC(ns, kind, name, obj, fnum);
    }
};