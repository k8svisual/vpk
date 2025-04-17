//------------------------------------------------------------------------------
// estabilsh owner if possible
//------------------------------------------------------------------------------
'use strict';
import vpk from './vpk.js';
import { logMessage } from '../utils/logging.js';
export function checkOwnerReferences(name, ns, fnum) {
    try {
        let oRef;
        let uid = vpk.yaml.metadata.uid;
        let kind = vpk.yaml.kind;
        let ownerId = 'self';
        let ownKind = 'self';
        let childAPI = vpk.yaml.apiVersion;
        let ownAPI;
        if (typeof vpk.yaml.metadata.uid !== 'undefined') {
            uid = vpk.yaml.metadata.uid;
            kind = vpk.yaml.kind;
            ownerId = 'self';
            ownKind = 'self';
            childAPI = vpk.yaml.apiVersion;
            ownAPI;
            if (typeof vpk.yaml.metadata.ownerReferences !== 'undefined') {
                if (typeof vpk.ownerRefs[vpk.yaml.metadata.ownerReferences[0].uid] === 'undefined') {
                    vpk.ownerRefs[vpk.yaml.metadata.ownerReferences[0].uid] = [];
                }
                vpk.ownerRefs[vpk.yaml.metadata.ownerReferences[0].uid].push({
                    parentUid: vpk.yaml.metadata.ownerReferences[0].uid,
                    parentKind: vpk.yaml.metadata.ownerReferences[0].kind,
                    parentName: vpk.yaml.metadata.ownerReferences[0].name,
                    parentAPI: vpk.yaml.metadata.ownerReferences[0].apiVersion,
                    childUid: vpk.yaml.metadata.uid,
                    childKind: vpk.yaml.kind,
                    childAPI: vpk.yaml.apiVersion,
                    childName: vpk.yaml.metadata.name,
                    childFnum: fnum,
                });
                if (typeof vpk.childRefs[vpk.yaml.metadata.uid] === 'undefined') {
                    vpk.childRefs[vpk.yaml.metadata.uid] = [];
                }
                vpk.childRefs[vpk.yaml.metadata.uid].push({
                    parentUid: vpk.yaml.metadata.ownerReferences[0].uid,
                    parentKind: vpk.yaml.metadata.ownerReferences[0].kind,
                    parentName: vpk.yaml.metadata.ownerReferences[0].name,
                    parentAPI: vpk.yaml.metadata.ownerReferences[0].apiVersion,
                    childUid: vpk.yaml.metadata.uid,
                    childKind: vpk.yaml.kind,
                    childAPI: vpk.yaml.apiVersion,
                    childName: vpk.yaml.metadata.name,
                    childFnum: fnum,
                });
                oRef = vpk.yaml.metadata.ownerReferences;
                for (let i = 0; i < vpk.yaml.metadata.ownerReferences.length; i++) {
                    ownerId = '';
                    ownKind = 'self';
                    if (typeof vpk.yaml.metadata.ownerReferences[i].uid !== 'undefined') {
                        ownerId = vpk.yaml.metadata.ownerReferences[i].uid;
                    }
                    else {
                        ownerId = 'none';
                    }
                    if (typeof vpk.yaml.metadata.ownerReferences[i].kind !== 'undefined') {
                        ownKind = vpk.yaml.metadata.ownerReferences[i].kind;
                    }
                    else {
                        ownKind = 'none';
                    }
                    if (typeof vpk.yaml.metadata.ownerReferences[i].apiVersion !== 'undefined') {
                        ownAPI = vpk.yaml.metadata.ownerReferences[i].apiVersion;
                    }
                    else {
                        ownAPI = 'none';
                    }
                    let oTemp = [];
                    if (typeof vpk.ownerUids[ownerId] === 'undefined') {
                        vpk.ownerUids[ownerId] = [];
                    }
                    else {
                        oTemp = vpk.ownerUids[ownerId];
                    }
                    oTemp.push({
                        ownerId: ownerId,
                        ownerKind: ownKind,
                        ownerAPI: ownAPI,
                        childAPI: childAPI,
                        childUid: uid,
                        childFnum: fnum,
                        childKind: kind,
                        childName: name,
                        childNS: ns,
                    });
                    vpk.ownerUids[ownerId] = oTemp;
                    if (typeof vpk.childUids[uid] === 'undefined') {
                        vpk.childUids[uid] = {
                            parentUid: ownerId,
                            parentKind: ownKind,
                            parentAPI: ownAPI,
                            childAPI: childAPI,
                            childKind: kind,
                            childFnum: fnum,
                            childName: name,
                            childNS: ns,
                            parentMulti: [],
                        };
                    }
                    else {
                        vpk.childUids[uid].parentMulti.push({
                            id: ownerId,
                            kind: ownKind,
                        });
                    }
                }
            }
            else {
                // no ownerReference defined
                if (typeof vpk.ownerUids[uid] === 'undefined') {
                    vpk.ownerUids[uid] = [];
                }
                if (typeof vpk.ownerUids[uid][0] === 'undefined') {
                    vpk.ownerUids[uid].push({
                        ownerId: 'self',
                        ownerKind: kind,
                        childAPI: childAPI,
                        childUid: uid,
                        childFnum: fnum,
                        childKind: kind,
                        childName: name,
                        childNS: ns,
                    });
                }
            }
        }
        else {
            // no uid found in yaml
            vpk.ownerNumber = vpk.ownerNumber + 1;
            let sid = 'sys' + vpk.ownerNumber;
            if (typeof vpk.ownerUids[sid] === 'undefined') {
                vpk.ownerUids[sid] = [];
            }
            if (typeof vpk.ownerUids[sid][0] === 'undefined') {
                vpk.ownerUids[sid].push({
                    ownerId: 'self',
                    ownerKind: kind,
                    childUid: sid,
                    childFnum: fnum,
                    childKind: kind,
                    childName: name,
                    childNS: ns,
                });
            }
        }
        return oRef;
    }
    catch (err) {
        logMessage('FIO095 - Error processing ownerChain, message: ' + err);
        logMessage(err.stack);
        console.log(JSON.stringify(vpk.yaml, null, 4));
        return [];
    }
}
