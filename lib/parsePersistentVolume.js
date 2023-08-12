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
Process PV data
*/

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
var hierarchy = require('../lib/hierarchy');

//------------------------------------------------------------------------------
var parsePersistentVolume = function (ns, kind, name, obj, fnum) {
    //var persistentVolume = {};
    var storClass = '';
    var hostPath = '';
    var nfsPath = '';
    var localPath = '';
    var keys;
    var key;
    var label;
    var data;
    var cRefName = '';
    var cRefKind = '';
    var cRefNS = '';
    var cRefUid = '';
    var capacity = '';
    var csi = '';
    var spaceReq = 0;
    var capNumber = 0;
    try {

        // This code will be deprecated at some point in time per:
        // https://kubernetes.io/docs/concepts/storage/persistent-volumes/
        if (typeof obj.metadata.annotations !== 'undefined') {
            let find = 'volume.beta.kubernetes.io/storage-class'
            let keys = Object.keys(obj.metadata.annotations)
            for (let k = 0; k < keys.length; k++) {
                if (obj.metadata.annotations[keys[k]] === find) {
                    storClass = obj.metadata.annotations[keys[k]];
                }
            }
        }

        if (typeof obj.metadata.labels !== 'undefined') {
            if (typeof obj.metadata.labels !== 'undefined') {
                label = obj.metadata.labels;
                keys = Object.keys(obj.metadata.labels);
                key = keys[0];
                data = key + ': ' + label[keys[0]]
            }
        } else {
            data = '';
        }

        obj = obj.spec;

        if (typeof obj.csi !== 'undefined') {
            csi = obj.csi;
            if (typeof csi.driver !== 'undefined') {
                if (typeof vpk.pvCsi[csi.driver]) {
                    vpk.pvCsi[csi.driver] = [];
                }
                vpk.pvCsi[csi.driver].push({
                    'name': name,
                    'ns': ns,
                    'fnum': fnum,
                    'csi': csi
                })
            }
        }

        // persistentVolume = {
        //     'namespace': ns,
        //     'kind': kind,
        //     'objName': name
        // };

        if (typeof obj.capacity !== 'undefined') {
            if (typeof obj.capacity.storage !== 'undefined') {
                capacity = obj.capacity.storage;
                //persistentVolume.storage = obj.capacity.storage;
            }
        }

        if (typeof obj.persistentVolumeReclaimPolicy !== 'undefined') {
            //persistentVolume.reclaim = obj.persistentVolumeReclaimPolicy;
        }

        if (typeof obj.storageClassName !== 'undefined') {
            //persistentVolume.storageClass = obj.storageClassName;
            storClass = obj.storageClassName;
        } else {
            storClass = '';
        }

        if (typeof obj.accessModes !== 'undefined') {
            var hl = obj.accessModes.length;
            var modes = [];
            for (var m = 0; m < hl; m++) {
                modes.push(obj.accessModes[m]);
            }
            //persistentVolume.accessModes = modes;
        }

        if (typeof obj.hostPath !== 'undefined') {
            if (typeof obj.hostPath.path !== 'undefined') {
                hostPath = obj.hostPath.path;
                //persistentVolume.hostPath = obj.hostPath.path;
            }
        }

        if (typeof obj.nfs !== 'undefined') {
            if (typeof obj.nfs.path !== 'undefined') {
                nfsPath = obj.nfs.path;
                //persistentVolume.nfsPath = obj.nfs.path;
            }
            if (typeof obj.nfs.server !== 'undefined') {
                //persistentVolume.nfsServer = obj.nfs.server;
            }
        }

        if (typeof obj.local !== 'undefined' && obj.local !== null) {
            if (typeof obj.local.path !== 'undefined') {
                localPath = obj.local.path;
                //persistentVolume.local = obj.local.path;
            }
        }

        if (typeof obj.claimRef !== 'undefined') {
            if (typeof obj.claimRef.kind !== 'undefined') {
                cRefKind = obj.claimRef.kind;
            }
            if (typeof obj.claimRef.name !== 'undefined') {
                cRefName = obj.claimRef.name;
            }
            if (typeof obj.claimRef.namespace !== 'undefined') {
                cRefNS = obj.claimRef.namespace;
            }
            if (typeof obj.claimRef.uid !== 'undefined') {
                cRefUid = obj.claimRef.uid;
            }
        }

        // track the space requested by storage class;
        if (capacity !== '') {
            spaceReq = utl.spaceCalc(capacity)
            capNumber = spaceReq;
            if (typeof vpk.spaceReqSC[storClass] !== 'undefined') {
                spaceReq = vpk.spaceReqSC[storClass].space + spaceReq;
            }
            vpk.spaceReqSC[storClass] =
            {
                'space': spaceReq,
                'fmtSpc': utl.formatBytes(spaceReq)
            }

        }

        if (typeof vpk.pvcFnum[fnum] === 'undefined') {
            vpk.pvFnum[fnum] = [];
        }
        vpk.pvFnum[fnum].push({
            'name': name,
            'fnum': fnum,
            'label': data,
            'storageClass': storClass,
            'hostPath': hostPath,
            'localPath': localPath,
            'nfsPath': nfsPath,
            'cRefKind': cRefKind,
            'cRefName': cRefName,
            'cRefNS': cRefNS,
            'cRefUid': cRefUid,
            'spaceReq': spaceReq,
            'fmtSpc': utl.formatBytes(capNumber)
        })

        if (typeof vpk.pvLabels[data] === 'undefined') {
            vpk.pvLabels[data] = []
        }
        vpk.pvLabels[data].push({
            'name': name,
            'fnum': fnum,
            'label': data,
            'storageClass': storClass,
            'hostPath': hostPath,
            'localPath': localPath,
            'nfsPath': nfsPath,
            'cRefKind': cRefKind,
            'cRefName': cRefName,
            'cRefNS': cRefNS,
            'cRefUid': cRefUid,
            'spaceReq': spaceReq,
            'fmtSpc': utl.formatBytes(capNumber)
        });

        // if (storClass !== '') {
        //     if (typeof vpk.storageClassLinks[storClass] === 'undefined') {
        //         vpk.storageClassLinks[storClass] = [];
        //     }
        //     vpk.storageClassLinks[storClass].push({
        //         'usedByPV': name,
        //         'fnum': fnum
        //     });
        // }



        // var lkey = ns + '.' + kind + '.' + name;
        // utl.checkType('PersistentVolume', lkey);
        // persistentVolume.fnum = fnum;

        // vpk['PersistentVolume'][lkey].push(persistentVolume);
        // utl.checkKind('PersistentVolume');





        // add the information to cluster hierarchy
        hierarchy.addEntry(ns, kind, name, fnum)

        // // check storage class name
        // if (storClass !== '') {
        //     // xref storage class
        //     var xkey = ns + '.' + 'StorageClass' + '.' + storClass;
        //     utl.checkType('StorageClass', xkey);
        //     tmp = vpk['StorageClass'][xkey];
        //     item = {
        //         'namespace': ns,
        //         'kind': 'StorageClass',
        //         'objName': storClass,
        //         'fnum': fnum
        //     };
        //     tmp.push(item);
        //     vpk['StorageClass'][xkey] = tmp;
        //     hierarchy.addEntry(ns, kind, name, fnum, 'StorageClass', storClass)
        // }


    } catch (err) {
        utl.logMsg('vpkPVP001 - Error processing file fnum: ' + fnum + ' message: ' + err);
        utl.logMsg('vpkPVP001 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

    parse: function (ns, kind, name, obj, fnum) {
        parsePersistentVolume(ns, kind, name, obj, fnum);
    }
};