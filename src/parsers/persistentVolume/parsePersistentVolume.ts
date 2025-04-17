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
Process PV data
*/
'use strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';
import { formatBytes } from '../../utils/formatbytes.js';
import { spaceCalc } from '../../utils/spacecalc.js';

//------------------------------------------------------------------------------
export function pvParse(ns: string, kind: string, name: string, obj: any, fnum: any) {
    //var persistentVolume = {};
    var storClass: string = '';
    var hostPath: string = '';
    var nfsPath: string = '';
    var localPath: string = '';
    var keys: any[];
    var key: string;
    var label: any;
    var data: any;
    var cRefName: string = '';
    var cRefKind: string = '';
    var cRefNS: string = '';
    var cRefUid: string = '';
    var capacity: string = '';
    var csi: any = '';
    var spaceReq: number = 0;
    var capNumber: number = 0;

    try {
        // This code will be deprecated at some point in time per:
        // https://kubernetes.io/docs/concepts/storage/persistent-volumes/
        if (typeof obj.metadata.annotations !== 'undefined') {
            let find: string = 'volume.beta.kubernetes.io/storage-class';
            let keys = Object.keys(obj.metadata.annotations);
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
                data = key + ': ' + label[keys[0]];
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
                    name: name,
                    ns: ns,
                    fnum: fnum,
                    csi: csi,
                });
            }
        }

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
            var modes: any = [];
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
            spaceReq = spaceCalc(capacity);
            capNumber = spaceReq;
            if (typeof vpk.spaceReqSC[storClass] !== 'undefined') {
                spaceReq = vpk.spaceReqSC[storClass].space + spaceReq;
            }
            vpk.spaceReqSC[storClass] = {
                space: spaceReq,
                fmtSpc: formatBytes(spaceReq),
            };
        }

        if (typeof vpk.pvcFnum[fnum] === 'undefined') {
            vpk.pvFnum[fnum] = [];
        }
        vpk.pvFnum[fnum].push({
            name: name,
            fnum: fnum,
            label: data,
            storageClass: storClass,
            hostPath: hostPath,
            localPath: localPath,
            nfsPath: nfsPath,
            cRefKind: cRefKind,
            cRefName: cRefName,
            cRefNS: cRefNS,
            cRefUid: cRefUid,
            spaceReq: spaceReq,
            fmtSpc: formatBytes(capNumber),
        });

        if (typeof vpk.pvLabels[data] === 'undefined') {
            vpk.pvLabels[data] = [];
        }
        vpk.pvLabels[data].push({
            name: name,
            fnum: fnum,
            label: data,
            storageClass: storClass,
            hostPath: hostPath,
            localPath: localPath,
            nfsPath: nfsPath,
            cRefKind: cRefKind,
            cRefName: cRefName,
            cRefNS: cRefNS,
            cRefUid: cRefUid,
            spaceReq: spaceReq,
            fmtSpc: formatBytes(capNumber),
        });
    } catch (err) {
        logMessage('PVP001 - Error processing file fnum: ' + fnum + ' message: ' + err);
        logMessage('PVP001 - Stack: ' + err.stack);
    }
}
