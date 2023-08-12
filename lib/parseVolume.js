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
Parse the volumes object
*/

var vpk = require('./vpk');
var utl = require('./utl');
var hierarchy = require('./hierarchy');

//------------------------------------------------------------------------------
var parseVolume = function (ns, kind, name, obj, fnum, node) {
    var v_name = '';
    var item;
    var vkey;
    var podPVCClaimName = '';
    var configMapName = '';
    var secretName = '';
    var chkVol;

    try {
        for (let e = 0; e < obj.length; e++) {
            v_name = '';
            chkVol = true;
            if (typeof obj[e] !== 'undefined') {
                v_name = obj[e].name;
                podPVCClaimName = '';
                configMapName = '';
                secretName = '';

                // check for pvc ref
                if (typeof obj[e].persistentVolumeClaim !== 'undefined') {
                    // checking the Pod to determine if there are PVC references
                    if (typeof obj[e].persistentVolumeClaim.claimName !== 'undefined') {
                        podPVCClaimName = obj[e].persistentVolumeClaim.claimName;
                        // not added to the hierarchy
                    }
                }

                // check for configMap reference
                if (typeof obj[e].configMap !== 'undefined') {
                    if (typeof obj[e].configMap.name !== 'undefined') {
                        configMapName = obj[e].configMap.name;
                        hierarchy.addEntry(ns, kind, name, fnum, 'Volume', v_name, 'ConfigMap', configMapName);
                        chkVol = false;     // ignore configMap and secrets when building volume structure
                    }
                }

                // check for secret reference
                if (typeof obj[e].secret !== 'undefined') {
                    if (typeof obj[e].secret.secretName !== 'undefined') {
                        secretName = obj[e].secret.secretName;
                        hierarchy.addEntry(ns, kind, name, fnum, 'Volume', v_name, 'Secret', secretName);
                        chkVol = false;     // ignore configMap and secrets when building volume structure
                    }
                }

                // vkey = ns + '.' + kind + '.' + v_name;
                // utl.checkType('Volumes', '');

                // // add volume info to vpk.Volumes
                // if (typeof vpk['Volumes'][vkey] === 'undefined') {
                //     vpk['Volumes'][vkey] = [];
                // }
                // item = {
                //     'namespace': ns,
                //     'kind': kind,
                //     'objName': v_name,
                //     'fnum': fnum
                // };
                // vpk['Volumes'][vkey].push(item);
                // add the information to cluster hierarchy
                hierarchy.addEntry(ns, kind, name, fnum, 'Volume', v_name)
                utl.containerLink(fnum, 'Volume', v_name)

                if (chkVol === true && kind === 'Pod') {
                    // add volume info to vpk.volumeInfo
                    item = {
                        'ns': ns,
                        'kind': kind,
                        'name': name,
                        'fnum': fnum,
                        'data': obj[e],
                        'node': node
                    }
                    vpk.volumeInfo.push(item);

                    let keys = Object.keys(obj[e]);
                    for (let k = 0; k < keys.length; k++) {
                        if (keys[k] !== 'name') {
                            if (typeof vpk.volumeTypes[keys[k]] === 'undefined') {
                                vpk.volumeTypes[keys[k]] = 1;
                            } else {
                                vpk.volumeTypes[keys[k]] = vpk.volumeTypes[keys[k]] + 1;
                            }
                        }
                    }
                }

                // updata container with related information
                if (podPVCClaimName !== '') {
                    if (typeof vpk.pods[fnum]['PersistentVolumeClaim'] === 'undefined') {
                        vpk.pods[fnum]['PersistentVolumeClaim'] = [];
                    }
                    // add the pvcRef to the container
                    vpk.pods[fnum]['PersistentVolumeClaim'].push({
                        'name': obj[e].name,
                        'podPVCClaimName': podPVCClaimName,
                        'configMapName': configMapName,
                        'secretName': secretName
                    });
                }

                // update container ConfigMap
                if (configMapName !== '') {
                    if (typeof vpk.pods[fnum]['ConfigMap'] === 'undefined') {
                        vpk.pods[fnum]['ConfigMap'] = [];
                    }
                    // add the pvcRef to the container
                    vpk.pods[fnum]['ConfigMap'].push({
                        'name': configMapName,
                        'use': 'Volume'
                    });
                }

                // update container Secret
                if (secretName !== '') {
                    if (typeof vpk.pods[fnum]['Secret'] === 'undefined') {
                        vpk.pods[fnum]['Secret'] = [];
                    }
                    // add the pvcRef to the container
                    vpk.pods[fnum]['Secret'].push({
                        'name': secretName,
                        'use': 'Volume'
                    });
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkVLP001 - Error processing file fnum: ' + fnum + '  message: ' + err);
        utl.logMsg('vpkVLP001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

    parse: function (ns, kind, name, obj, fnum, node) {
        parseVolume(ns, kind, name, obj, fnum, node);
    }
};