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

/*----------------------------------------------------------
Build svg data from returned data
*/

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import flh from '../lib/fileHandler.js';

let data = '';
let podNS = [];

//----------------------------------------------------------
const parseSchematic = function () {

    podNS = [];
    data = vpk.allKeys;
    // sort by namespace & kind
    data.sort((a, b) => (a.namespace > b.namespace) ? 1 : (a.namespace === b.namespace) ? ((a.kind > b.kind) ? 1 : -1) : -1);

    populateBaseContainer(data);
    populateServices();
    populateServiceAccountSecrets();
    populateControllerRevision();
    populateNetwork();
    populateOwnerChain();
    populateStorage();
    populateHPA();
    populateDaemonSetPods();
    populatePodsToShow();
    vpk.pods['0000-@storageClass@'] = vpk.storageClassName;

    return;
};

const populateBaseContainer = function (data) {
    let e;
    let fnum;
    try {
        for (e = 0; e < data.length; e++) {
            fnum = data[e].fnum;
            checkUsage(data[e], fnum)
            if (typeof vpk.pods[fnum] !== 'undefined') {
                populateContainer(vpk.pods[fnum], fnum);
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM001 - Error processing schematic, fnum: ' + fnum + '  message: ' + err);
        utl.logMsg('vpkSCM101 - Stack: ' + err.stack);
    }
}

const populateDaemonSetPods = function () {
    let keys = Object.keys(vpk.pods);
    let key;

    for (let k = 0; k < keys.length; k++) {
        key = keys[k];
        if (!key.startsWith('0000')) {
            if (vpk.daemonSetPods.includes(key)) {
                vpk.pods[key].daemonSetPod = true;
            } else {
                vpk.pods[key].daemonSetPod = false;
            }
        }
    }
};



const populateNetwork = function () {
    try {
        populateEndpoints();
        populateEndpointSlice();
    } catch (err) {
        utl.logMsg('vpkSCM005 - Error processing schematic, message: ' + err);
        utl.logMsg('vpkSCM105 - Stack: ' + err.stack);
    }
};

const populateOwnerChain = function () {
    let keys;
    let key;
    let level1Kind;
    let level2Kind;
    let chain;
    let cUid;
    try {
        keys = Object.keys(vpk.pods);
        for (let k = 0; k < keys.length; k++) {
            key = keys[k];
            level1Kind = '';
            level2Kind = '';
            vpk.pods[key].display = '';
            cUid = vpk.pods[key].uid;

            if (typeof vpk.ownerChains[cUid] !== 'undefined') {
                chain = vpk.ownerChains[cUid];
                vpk.pods[key].creationChain = {};
                if (typeof chain[1] !== 'undefined') {
                    vpk.pods[key].creationChain.level1Fnum = chain[1].fnum;
                    vpk.pods[key].creationChain.level1Kind = chain[1].kind;
                    vpk.pods[key].creationChain.level1Name = chain[1].name;
                    if (typeof chain[1].api !== 'undefined') {
                        vpk.pods[key].creationChain.level1API = chain[1].api;
                    } else {
                        vpk.pods[key].creationChain.level1API = 'Unknown'
                    }
                    level1Kind = chain[1].kind;

                    // check CRDs
                    if (typeof vpk.crds[level1Kind] !== 'undefined') {
                        if (typeof vpk.pods[key].CRD === 'undefined') {
                            vpk.pods[key].CRD = [];
                        }
                        vpk.pods[key].CRD.push({
                            'level1CRD': true,
                            'level1Fnum': vpk.crds[level1Kind][0].fnum,
                            'level1Name': vpk.crds[level1Kind][0].name
                        })
                    }

                    if (typeof chain[2] !== 'undefined') {
                        vpk.pods[key].creationChain.level2Fnum = chain[2].fnum;
                        vpk.pods[key].creationChain.level2Kind = chain[2].kind;
                        vpk.pods[key].creationChain.level2Name = chain[2].name;
                        if (typeof chain[2].api !== 'undefined') {
                            vpk.pods[key].creationChain.level2API = chain[2].api;
                        } else {
                            vpk.pods[key].creationChain.level2API = 'Unknown'
                        }
                        level2Kind = chain[2].kind;

                        if (typeof vpk.crds[level2Kind] !== 'undefined') {
                            if (typeof vpk.pods[key].CRD === 'undefined') {
                                vpk.pods[key].CRD = [];
                            }
                            vpk.pods[key].CRD.push({
                                'level2CRD': true,
                                'level2Fnum': vpk.crds[level2Kind][0].fnum,
                                'level2Name': vpk.crds[level2Kind][0].name
                            })
                        }
                    }
                } else {
                    vpk.pods[key].creationChain.level1Kind = chain[0].ownerKind;
                    if (typeof vpk.allUids[chain[0].ownerUid] !== 'undefined') {
                        let tmp = vpk.allUids[chain[0].ownerUid]
                        vpk.pods[key].creationChain.level1Fnum = tmp.fnum;
                        vpk.pods[key].creationChain.level1Kind = tmp.kind;
                        vpk.pods[key].creationChain.level1Name = tmp.name;
                        vpk.pods[key].creationChain.level1API = 'unknown';
                    }
                }
            } else {
                // utl.logMsg(`vpkSCM221 - Did not find childUid ${cUid}`);
            }
        }
    } catch (err1) {
        utl.logMsg('vpkSCM021 - Error processing level1 and level2 uids, message: ' + (err1));
        utl.logMsg('vpkSCM121 - Stack: ' + err1.stack);
    }

    // populate display flag

    try {
        keys = Object.keys(vpk.pods);
        for (let k = 0; k < keys.length; k++) {
            key = keys[k];
            if (typeof vpk.pods[key] !== 'undefined') {
                if (typeof vpk.podList[key] === 'undefined') {
                    vpk.pods[key].display = false;
                } else {
                    vpk.pods[key].display = true;
                    //displayCnt++;
                    let ns = vpk.pods[key].namespace
                    if (typeof podNS[ns] === 'undefined') {
                        podNS.push(ns)
                    }
                }
            }
        }
        //utl.logMsg('vpkSCM025 - Flagged ' + displayCnt + ' active containers to display'); 
    } catch (err) {
        utl.logMsg('vpkSCM030 - Error processing schematic, message: ' + err.stack);
    }
};

const populatePodsToShow = function () {
    let ns;
    let key;
    try {
        for (let i = 0; i < podNS.length; i++) {
            ns = podNS[i];
            key = '0000-' + ns;
            if (typeof vpk.pods[key].Pods === 'undefined') {
                vpk.pods[key].Pods = true;
            }
        }
        podNS = null;
    } catch (err) {
        utl.logMsg('vpkSCM830 - Error building container Pods flag, message: ' + err);
        utl.logMsg(err.stack);
    }
};

const populateStorage = function () {
    let keys;
    let key;
    let pvc
    let claimFnum;
    let cName;
    let pvcName = '';
    let pvcFnum = '';
    let pvcStorageClass = '';
    let pvcVolumeName = '';
    let pvcSelectorLabel = '';
    let pvcSpace = 0;
    let pvName = '';
    let pvFnum = '';
    let pvLocalPath = '';
    let pvHostPath = '';
    let pvNFSPath = '';
    let scName = '';
    let scFnum = '';
    let pvKeys = Object.keys(vpk.pvFnum);
    let pvKey;
    try {
        keys = Object.keys(vpk.pods);
        for (let i = 0; i < keys.length; i++) {
            key = keys[i];
            pvcSpace = 0;
            if (typeof vpk.pods[key].PersistentVolumeClaim !== 'undefined') {
                for (let p = 0; p < vpk.pods[key].PersistentVolumeClaim.length; p++) {
                    pvc = vpk.pods[key].PersistentVolumeClaim[p];
                    if (typeof pvc.podPVCClaimName !== 'undefined') {
                        cName = pvc.podPVCClaimName;
                        if (typeof vpk.pvcNames[cName] !== 'undefined') {
                            claimFnum = vpk.pvcNames[cName][0].fnum;
                            pvcName = cName;

                            if (typeof vpk.pvcLinks[cName] !== 'undefined') {


                                if (typeof vpk.pvcLinks[cName][0] !== 'undefined') {
                                    pvcFnum = vpk.pvcLinks[cName][0].fnum;
                                    pvcStorageClass = vpk.pvcLinks[cName][0].storageClass;
                                    pvcVolumeName = vpk.pvcLinks[cName][0].volumeName;
                                    pvcSpace = vpk.pvcLinks[cName][0].space;
                                    // added to fix missing PV in schematics
                                    pvName = vpk.pvcLinks[cName][0].volumeName;
                                    pvFnum = '<ukn>'
                                    for (let v = 0; v < pvKeys.length; v++) {
                                        if (vpk.pvFnum[pvKeys[v]][0].name === pvName) {
                                            pvFnum = pvKeys[v];
                                            break;
                                        }
                                    }
                                    //---
                                    pvcSelectorLabel = vpk.pvcLinks[cName][0].pvSelectorLabel;
                                }
                                if (pvcStorageClass !== '') {
                                    if (typeof vpk.storageClassName[pvcStorageClass] !== 'undefined') {
                                        scName = vpk.storageClassName[pvcStorageClass].name;
                                        scFnum = vpk.storageClassName[pvcStorageClass].fnum;
                                    } else {
                                        // let msg = 'PVC is unable to locate StorageClass named: ' + pvcStorageClass;
                                        // putMsg(msg, 'Storage', key)
                                    }
                                }

                                if (pvcSelectorLabel !== '') {
                                    if (typeof vpk.pvLabels[pvcSelectorLabel] !== 'undefined') {
                                        pvName = vpk.pvLabels[pvcSelectorLabel][0].name;
                                        pvFnum = vpk.pvLabels[pvcSelectorLabel][0].fnum;
                                        pvLocalPath = vpk.pvLabels[pvcSelectorLabel][0].localPath;
                                        pvHostPath = vpk.pvLabels[pvcSelectorLabel][0].hostPath;
                                        pvNFSPath = vpk.pvLabels[pvcSelectorLabel][0].nfsPath;
                                        scName = vpk.pvLabels[pvcSelectorLabel][0].storageClass;
                                        if (scName !== '') {
                                            if (typeof vpk.storageClassName[scName] !== 'undefined') {
                                                scFnum = vpk.storageClassName[scName][0].fnum;
                                            } else {
                                                // let msg = 'PV label unable to locate StorageClass named: ' + scName;
                                                // putMsg(msg, 'Storage', key)
                                            }
                                        } else {
                                            scFnum = '0';
                                        }
                                    }
                                } else {

                                }
                            }

                            vpk.pods[key].PersistentVolumeClaim[p].claimFnum = claimFnum;
                            vpk.pods[key].PersistentVolumeClaim[p].pvcName = pvcName;
                            vpk.pods[key].PersistentVolumeClaim[p].pvcFnum = pvcFnum;
                            vpk.pods[key].PersistentVolumeClaim[p].pvcStorageClass = pvcStorageClass;
                            vpk.pods[key].PersistentVolumeClaim[p].pvcVolumeName = pvcVolumeName;
                            vpk.pods[key].PersistentVolumeClaim[p].pvcSelectorLabel = pvcSelectorLabel;
                            vpk.pods[key].PersistentVolumeClaim[p].pvcSpace = pvcSpace;
                            vpk.pods[key].PersistentVolumeClaim[p].pvName = pvName;
                            vpk.pods[key].PersistentVolumeClaim[p].pvFnum = pvFnum;
                            vpk.pods[key].PersistentVolumeClaim[p].pvLocalPath = pvLocalPath;
                            vpk.pods[key].PersistentVolumeClaim[p].pvHostPath = pvHostPath;
                            vpk.pods[key].PersistentVolumeClaim[p].pvNFSPath = pvNFSPath;
                            vpk.pods[key].PersistentVolumeClaim[p].storageClassName = scName;
                            vpk.pods[key].PersistentVolumeClaim[p].storageClassFnum = scFnum;

                        } else {
                            vpk.pods[key].PersistentVolumeClaim[p].claimFnum = '0';
                        }
                    }
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM031 - Error processing schematic, message: ' + err.stack);
    }
};

// sub-routines
const checkUsage = function (data, fnum) {

    if (data.kind === 'RoleBinding' || data.kind === 'Role') {
        return;
    }

    if (typeof data.namespace === 'undefined') {
        data.namespace = 'cluster-level'
    }

    if (data.namespace === '' || data.namespace === 'cluster-level') {
        clusterLevel(data, data.kind, fnum)
    } else {
        namespaceLevel(data, data.kind, fnum)
    }
};

const namespaceLevel = function (data, type, fnum) {
    let ns;
    let name;
    if (typeof data.namespace === 'undefined') {
        ns = 'Unknown';
    } else {
        ns = data.namespace;
    }

    let cName = '0000-' + ns;

    if (typeof data.value !== 'undefined') {
        name = data.value
    }
    if (typeof data.name !== 'undefined') {
        name = data.name
    }
    if (typeof vpk.pods[cName] === 'undefined') {
        vpk.pods[cName] = {};
    }
    if (typeof vpk.pods[cName][type] === 'undefined') {
        vpk.pods[cName][type] = [];
    }

    for (let i = 0; i < vpk.pods[cName][type].length; i++) {
        if (vpk.pods[cName][type][i].fnum === fnum) {
            return;
        }
    }

    vpk.pods[cName][type].push({
        'name': name,
        'fnum': fnum,
        'namespace': ns,
        'kind': data.kind,
        'api': data.apiVersion
    })
};

const clusterLevel = function (data, type, fnum) {
    let name;
    let cName = '0000-clusterLevel';

    if (typeof data.value !== 'undefined') {
        name = data.value
    }
    if (typeof data.name !== 'undefined') {
        name = data.name
    }

    if (typeof vpk.pods[cName] === 'undefined') {
        vpk.pods[cName] = {};
    }
    if (typeof vpk.pods[cName][type] === 'undefined') {
        vpk.pods[cName][type] = [];
    }

    for (let i = 0; i < vpk.pods[cName][type].length; i++) {
        if (vpk.pods[cName][type][i].fnum === fnum) {
            return;
        }
    }

    if (type === 'Node') {
        let tmpData
        if (typeof vpk.nodesFnum[fnum] !== 'undefined') {
            tmpData = vpk.nodesFnum[fnum]
            if (typeof tmpData[0] !== 'undefined') {
                tmpData[0].namespace = 'clusterLevel';
                tmpData[0].kind = data.kind;
                tmpData[0].api = data.apiVersion;
                vpk.pods[cName][type].push(tmpData[0])
            }
        }
    } else {
        vpk.pods[cName][type].push({
            'name': name,
            'fnum': fnum,
            'namespace': 'clusterLevel',
            'kind': data.kind,
            'api': data.apiVersion
        })
    }
};

const populateHPA = function () {
    let keys = Object.keys(vpk.hpaLinks);
    //let key;
    let hl = keys.length;
    let cKeys = Object.keys(vpk.pods);;
    let cKey;
    let chl = cKeys.length;
    let hKind;
    let hName;
    let found;
    let key;
    let pKey;
    try {
        for (let k = 0; k < keys.length; k++) {
            key = keys[k];
            // get the HPA TargetRef values
            hKind = vpk.hpaLinks[key][0].hpaLinkKind;
            hName = vpk.hpaLinks[key][0].hpaLinkName;
            found = false;
            for (let c = 0; c < chl; c++) {
                cKey = cKeys[c];
                found = false;
                if (typeof vpk.pods[cKey].creationChain !== 'undefined') {
                    if (vpk.pods[cKey].creationChain.level1Name === hName) {
                        if (vpk.pods[cKey].creationChain.level1Kind === hKind) {
                            found = true;
                        }
                    }

                    if (vpk.pods[cKey].creationChain.level2Name === hName) {
                        if (vpk.pods[cKey].creationChain.level2Kind === hKind) {
                            found = true;
                        }
                    }

                    if (found === true) {
                        vpk.pods[cKey].HPA = {
                            'fnum': vpk.hpaLinks[key][0].fnum,
                            'spec': vpk.hpaLinks[key][0].spec
                        }
                    }
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM069 - Error processing HPA, message: ' + err);
        utl.logMsg('vpkSCM169 - Stack: ' + err.stack);
    }
};

const populateServiceAccountSecrets = function () {
    let secKeys = Object.keys(vpk.secretFnum);
    let shl = secKeys.length;
    let fnum;
    let hl;
    let ns;
    let sourceRoot;
    let key;
    let keys;
    let already;
    try {
        keys = Object.keys(vpk.pods);
        for (let k = 0; k < keys.length; k++) {
            key = keys[k];
            if (key === 'undefined') {
                console.log(k)
            }

            if (key.startsWith('0000')) {
                continue;
            }
            if (typeof vpk.pods[key].ServiceAccount !== 'undefined') {
                if (typeof vpk.pods[key].ServiceAccount[0].fnum !== 'undefined') {
                    fnum = vpk.pods[key].ServiceAccount[0].fnum;
                    if (typeof vpk.serviceAccounts[fnum] !== 'undefined') {
                        // check for ImagePullSecrets
                        if (typeof vpk.serviceAccounts[fnum][0].imagePullSecrets !== 'undefined') {
                            hl = vpk.serviceAccounts[fnum][0].imagePullSecrets.length
                            ns = vpk.serviceAccounts[fnum][0].namespace;
                            for (let s = 0; s < hl; s++) {
                                if (typeof vpk.serviceAccounts[fnum][0].imagePullSecrets[s] !== 'undefined') {
                                    if (typeof vpk.serviceAccounts[fnum][0].imagePullSecrets[s].name !== 'undefined') {
                                        let secName = vpk.serviceAccounts[fnum][0].imagePullSecrets[s].name;
                                        for (let k = 0; k < shl; k++) {
                                            if (vpk.secretFnum[secKeys[k]][0].name === secName && vpk.secretFnum[secKeys[k]][0].namespace === ns) {
                                                // let fPart = vpk.secretFnum[secKeys[k]][0].fnum
                                                // let fParts = fPart.split('.');
                                                // let newFName = sourceRoot + fParts[0] + '.yaml';
                                                // let newPart = fParts[1];
                                                if (typeof vpk.pods[key].Secret === 'undefined') {
                                                    vpk.pods[key].Secret = [];
                                                }
                                                already = false;
                                                let work = vpk.pods[key].Secret
                                                let newName = vpk.secretFnum[secKeys[k]][0].name
                                                for (let h = 0; h < work.length; h++) {
                                                    let item = work[h];
                                                    if (item.name !== newName) {
                                                        continue;
                                                    } else {
                                                        if (item.use !== 'ServiceAccount-ImagePull') {
                                                            continue;
                                                        } else {
                                                            already = true;
                                                            //console.log('skipped already there')
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (already === false) {
                                                    vpk.pods[key].Secret.push({
                                                        'name': vpk.secretFnum[secKeys[k]][0].name,
                                                        'use': 'ServiceAccount-ImagePull',
                                                        'fnum': vpk.secretFnum[secKeys[k]][0].fnum
                                                    })
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // check for Secrets
                        if (typeof vpk.serviceAccounts[fnum][0].secrets !== 'undefined') {
                            hl = vpk.serviceAccounts[fnum][0].secrets.length
                            ns = vpk.serviceAccounts[fnum][0].namespace;
                            for (let s = 0; s < hl; s++) {
                                if (typeof vpk.serviceAccounts[fnum][0].secrets[s] !== 'undefined') {
                                    if (typeof vpk.serviceAccounts[fnum][0].secrets[s].name !== 'undefined') {
                                        let secName = vpk.serviceAccounts[fnum][0].secrets[s].name;
                                        for (let k = 0; k < shl; k++) {

                                            if (vpk.secretFnum[secKeys[k]][0].name === secName && vpk.secretFnum[secKeys[k]][0].namespace === ns) {
                                                let fPart = vpk.secretFnum[secKeys[k]][0].fnum
                                                // let fParts = fPart.split('.');
                                                // let newFName = sourceRoot + fParts[0] + '.yaml';
                                                // let newPart = fParts[1];
                                                if (typeof vpk.pods[key].Secret === 'undefined') {
                                                    vpk.pods[key].Secret = [];
                                                }
                                                already = false;
                                                let work = vpk.pods[key].Secret
                                                let newName = vpk.secretFnum[secKeys[k]][0].name
                                                for (let h = 0; h < work.length; h++) {
                                                    let item = work[h];
                                                    if (item.name !== newName) {
                                                        continue;
                                                    } else {
                                                        if (item.use !== 'ServiceAccount-Secret') {
                                                            continue;
                                                        } else {
                                                            vpk.pods[key].ServiceAccountSecret = true;
                                                            already = true;
                                                            break;
                                                        }
                                                    }
                                                }

                                                if (already === false) {
                                                    vpk.pods[key].Secret.push({
                                                        'name': vpk.secretFnum[secKeys[k]][0].name,
                                                        'use': 'ServiceAccount-Secret',
                                                        'fnum': vpk.secretFnum[secKeys[k]][0].fnum
                                                    })
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM052 - Error processing ServiceAccounts Secrets, message: ' + err);
        utl.logMsg('vpkSCM152 - Stack: ' + err.stack);
    }
};

const populateControllerRevision = function () {
    let keys = Object.keys(vpk.controllerRevision);
    let key = '';
    let cKey = '';
    for (let k = 0; k < keys.length; k++) {
        key = keys[k];
        if (typeof vpk.controllerRevision[key][0].ownerUid !== 'undefined') {
            cKey = vpk.controllerRevision[key][0].ownerUid;

            // check the ownerUids 
            if (typeof vpk.ownerUids[cKey] !== 'undefined') {
                for (let h = 0; h < vpk.ownerUids[cKey].length; h++) {
                    if (vpk.ownerUids[cKey][h].selfKind === 'Pod') {
                        let pKey = vpk.ownerUids[cKey][h].selfFnum;

                        if (typeof vpk.pods[pKey] !== 'undefined') {
                            if (typeof vpk.pods[pKey]['ControllerRevision'] === 'undefined') {
                                vpk.pods[pKey]['ControllerRevision'] = [];
                            }
                            vpk.pods[pKey]['ControllerRevision'].push({
                                'name': vpk.controllerRevision[key][0].name,
                                'fnum': vpk.controllerRevision[key][0].fnum
                            })
                        }
                    }
                }
            } else {
                utl.logMsg('vpkSCM061 - Error processing ControllerRevision: ' + cKey + ' name: ' + vpk.controllerRevision[key][0].name);
            }
        }
    }
};

const populateEndpoints = function () {
    let ckeys = Object.keys(vpk.pods);
    let ekeys = Object.keys(vpk.endpointsLinks);
    let ckey;
    let ekey;
    let sName;
    let eFnum;
    let tmp;
    try {
        // loop containers
        for (let c = 0; c < ckeys.length; c++) {
            ckey = ckeys[c];
            if (typeof vpk.pods[ckey].Services !== 'undefined') {
                sName = vpk.pods[ckey].Services[0].name;
                for (let e = 0; e < ekeys.length; e++) {
                    ekey = ekeys[e];
                    eFnum = '';
                    if (typeof vpk.endpointsLinks[ekey] !== 'undefined') {
                        if (typeof vpk.endpointsLinks[ekey][0].targetUid !== 'undefined') {
                            if (typeof vpk.allUids[vpk.endpointsLinks[ekey][0].targetUid] !== 'undefined') {
                                tmp = vpk.allUids[vpk.endpointsLinks[ekey][0].targetUid];
                                if (tmp.fnum === ckey) {
                                    eFnum = vpk.endpointsLinks[ekey][0].fnum
                                    vpk.pods[ckey].Services[0].ep = eFnum;
                                    vpk.pods[ckey].Services[0].epName = vpk.endpointsLinks[ekey][0].name;

                                    if (typeof vpk.networkServices[ckey] === 'undefined') {
                                        vpk.networkServices[ckey] = [];
                                    }
                                    vpk.networkServices[ckey].push(vpk.pods[ckey].Services);


                                    continue;
                                }
                            }
                        }

                        if (typeof vpk.endpointsLinks[ekey][0].oRef !== 'undefined') {
                            if (typeof vpk.endpointsLinks[ekey][0].oRef[0] !== 'undefined') {
                                if (typeof vpk.endpointsLinks[ekey][0].oRef[0].uid !== 'undefined') {

                                    if (typeof vpk.allUids[vpk.endpointsLinks[ekey][0].oRef[0].uid] !== 'undefined') {
                                        tmp = vpk.allUids[vpk.endpointsLinks[ekey][0].oRef[0].uid];
                                        if (tmp.fnum === ckey) {
                                            eFnum = vpk.endpointsLinks[ekey][0].fnum
                                            vpk.pods[ckey].Services[0].ep = eFnum;
                                            vpk.pods[ckey].Services[0].epName = eFnum = vpk.endpointsLinks[ekey][0].name;
                                            if (typeof vpk.networkServices[ckey] === 'undefined') {
                                                vpk.networkServices[ckey] = [];
                                            }
                                            vpk.networkServices[ckey].push(vpk.pods[ckey].Services);
                                            continue;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (typeof vpk.endpointsLinks[ekey] !== 'undefined') {
                        if (typeof vpk.endpointsLinks[ekey][0].name !== 'undefined') {
                            if (vpk.endpointsLinks[ekey][0].name === sName) {
                                vpk.pods[ckey].Services[0].ep = ekey;
                                vpk.pods[ckey].Services[0].epName = sName;

                                if (typeof vpk.networkServices[ckey] === 'undefined') {
                                    vpk.networkServices[ckey] = [];
                                }
                                vpk.networkServices[ckey].push(vpk.pods[ckey].Services);

                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM032 - Error processing schematic, message: ' + err.stack);
    }
};

const populateEndpointSlice = function () {
    let ckeys = Object.keys(vpk.pods);
    let ekeys = Object.keys(vpk.endpointSliceService);
    let ckey;
    let ekey;
    let eFnum;
    let pName;
    let lName;
    try {
        for (let e = 0; e < ekeys.length; e++) {
            ekey = ekeys[e];
            pName = vpk.endpointSliceService[ekey][0].targetName;
            eFnum = vpk.endpointSliceService[ekey][0].fnum;
            lName = vpk.endpointSliceService[ekey][0].labelServiceName;
            //utl.usedFnum(eFnum, 'EPS');

            if (pName === '') {
                for (let c = 0; c < ckeys.length; c++) {
                    ckey = ckeys[c];
                    if (typeof vpk.pods[ckey].Services !== 'undefined') {
                        if (typeof vpk.pods[ckey].Services[0] !== 'undefined') {
                            if (typeof vpk.pods[ckey].Services[0].name !== 'undefined') {
                                if (vpk.pods[ckey].Services[0].name === lName) {
                                    vpk.pods[ckey].Services[0].eps = eFnum;
                                }
                            }
                        }
                    }
                }
            } else {
                for (let c = 0; c < ckeys.length; c++) {
                    ckey = ckeys[c];
                    if (vpk.pods[ckey].name === pName) {
                        if (typeof vpk.pods[ckey].Services !== 'undefined') {
                            vpk.pods[ckey].Services[0].eps = eFnum;
                        }
                    }
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM033 - Error processing schematic, message: ' + err.stack);
    }
}

const populateServices = function () {
    let keys = Object.keys(vpk.serviceFnum);
    let key;
    let fnum;
    let labelFnums;
    let firstLabel;
    let fn;
    let fparts;
    let myLbls;
    let lblString;
    let keep;
    let labels;
    let chkLbl;
    let lblKeys;
    let keepFnums;
    let fileContent;
    try {
        for (let k = 0; k < keys.length; k++) {
            key = keys[k]; // the service spec.selector.label
            if (typeof vpk.serviceFnum[key][0].Labels !== 'undefined') {
                if (typeof vpk.serviceFnum[key][0].Labels[0] !== 'undefined') {
                    firstLabel = vpk.serviceFnum[key][0].Labels[0].label;
                    labels = vpk.serviceFnum[key][0].Labels;
                    lblString = '';
                    for (let y = 0; y < labels.length; y++) {
                        lblString = lblString + ':' + labels[y].label;
                    }
                    lblString = lblString + ':';
                    if (typeof vpk.labelKeys[firstLabel] !== 'undefined') {
                        labelFnums = vpk.labelKeys[firstLabel];
                        // check each item that has this label
                        keepFnums = [];
                        for (let c = 0; c < labelFnums.length; c++) {
                            fn = labelFnums[c];
                            keep = false;
                            // read file and get labels
                            fileContent = flh.readResourceFile(fn)
                            if (typeof fileContent.metadata.labels !== 'undefined') {
                                myLbls = fileContent.metadata.labels;
                            } else {
                                myLbls = {};
                            }
                            lblKeys = Object.keys(myLbls);
                            for (let u = 0; u < lblKeys.length; u++) {
                                //chkLbl = myLbl[u] + ': ' + 
                                chkLbl = ':' + lblKeys[u] + ': ' + myLbls[lblKeys[u]] + ':'
                                if (lblString.indexOf(chkLbl) > -1) {
                                    if (chkLbl !== key) {
                                        keepFnums.push(labelFnums[c])
                                    }
                                }
                            }
                            if (keepFnums.length > 0) {
                                let addCnt = 0;
                                for (let k = 0; k < keepFnums.length; k++) {
                                    if (typeof vpk.pods[keepFnums[k]] !== 'undefined') {
                                        // check if target is a Pod
                                        if (vpk.pods[keepFnums[k]].kind === 'Pod') {
                                            //
                                            if (typeof vpk.pods[keepFnums[k]].Services === 'undefined') {
                                                vpk.pods[keepFnums[k]].Services = [];
                                            }
                                            // check if already saved as a Service
                                            let saveIt = true;
                                            for (let c = 0; c < vpk.pods[keepFnums[k]].Services.length; c++) {
                                                if (vpk.pods[keepFnums[k]].Services[c].fnum === key) {
                                                    saveIt = false;
                                                    break;
                                                }
                                            }
                                            // save the service in the Pod
                                            if (saveIt === true) {
                                                vpk.pods[keepFnums[k]].Services.push({
                                                    'fnum': key,
                                                    'name': vpk.serviceFnum[key][0].name,
                                                    'namespace': vpk.serviceFnum[key][0].namespace,
                                                    'ep': '',
                                                    'eps': '',
                                                    'type': 'unk'
                                                });
                                                addCnt++;
                                            }
                                        }
                                    } else {
                                        //utl.logMsg('vpkSCM034 -  Did not locate container for fnum: ' + keepFnums[k]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM034 -  Error populating service for key: ' + key + ' fnum: ' + fnum);
        utl.logMsg('vpkSCM134 -  Error: ' + err.stack);
        console.log(err.stack)
    }
};

const populateContainer = function (container, fnum) {
    if (typeof container === 'undefined') {
        console.log('check this out')
    }
    container = checkType(container, 'Secret', fnum);
    container = checkType(container, 'ConfigMap', fnum);
    container = checkType(container, 'PersistentVolumeClaim', fnum);
    container = checkType(container, 'ServiceAccount', fnum);
    container = checkEvents(container);
};

const checkEvents = function (container) {
    let key = container.kind + '.' + container.namespace + '.' + container.name;
    let events = [];
    let hl = vpk.eventMessage.length;
    for (let e = 0; e < hl; e++) {
        if (vpk.eventMessage[e].key === key) {
            events.push(vpk.eventMessage[e]);
            vpk.eventMessage[e].used = true;
            continue;
            //utl.usedFnum(vpk.eventMessage[e].fnum, 'Event');
        }
        if (vpk.eventMessage[e].involvedName === container.name) {
            events.push(vpk.eventMessage[e]);
            vpk.eventMessage[e].used = true;
            continue;
            //utl.usedFnum(vpk.eventMessage[e].fnum, 'Event');
        }
    }
    container.Events = events;
};

const checkType = function (container, type, fnum) {
    let i;
    let name;
    let key;
    let nFnum;
    try {
        if (typeof container[type] !== 'undefined') {
            for (i = 0; i < container[type].length; i++) {
                name = container[type][i].name;
                key = container.namespace + '.' + type + '.' + name;
                if (typeof vpk[type] !== 'undefined') {
                    if (typeof vpk[type][key] !== 'undefined') {
                        if (typeof vpk[type][key][0] !== 'undefined') {
                            if (typeof vpk[type][key][0].fnum === 'undefined') {
                                utl.logMsg('vpkSCM149 - Kind:' + type + ' Key:' + key + ' has no FNUM')
                            }
                            if (typeof vpk[type][key][0].fnum !== 'undefined') {
                                nFnum = vpk[type][key][0].fnum
                            } else {
                                nFnum = 'missing';
                            }
                            container[type][i].fnum = nFnum;
                        }
                    } else {
                        container[type][i].notFound = true;
                        container[type][i].fnum = 'missing';
                    }
                } else {
                    utl.logMsg('VpKSCM428 - Fnum: ' + fnum + ' did not locate vpk.' + type + ' for key: ' + key)
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSCM035 -  Error fnum ' + fnum + ' container type: ' + type + ' at entry: ' + i + ' using key (namespace.kind.name): ' + key);
        utl.logMsg('vpkSCM135 -  Stack: ' + err.stack);
    }
    return container;
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    parse: function () {
        let startT = utl.getPTime();
        utl.logMsg('vpkSCM001 - svgSchematic invoked');
        parseSchematic();
        let stopT = utl.getPTime();
        utl.showTimeDiff(startT, stopT, 'svgSchematic.parseSchematic()')
        return;
    }
};