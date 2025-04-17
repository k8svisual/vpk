//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

export function populateOwnerChain(podNS) {
    let keys: any[];
    let key: string;
    let level1Kind: string;
    let level2Kind: string;
    let chain: any;
    let cUid: string;
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
                        vpk.pods[key].creationChain.level1API = 'Unknown';
                    }
                    level1Kind = chain[1].kind;

                    // check CRDs
                    if (typeof vpk.crds[level1Kind] !== 'undefined') {
                        if (typeof vpk.pods[key].CRD === 'undefined') {
                            vpk.pods[key].CRD = [];
                        }
                        vpk.pods[key].CRD.push({
                            level1CRD: true,
                            level1Fnum: vpk.crds[level1Kind][0].fnum,
                            level1Name: vpk.crds[level1Kind][0].name,
                        });
                    }

                    if (typeof chain[2] !== 'undefined') {
                        vpk.pods[key].creationChain.level2Fnum = chain[2].fnum;
                        vpk.pods[key].creationChain.level2Kind = chain[2].kind;
                        vpk.pods[key].creationChain.level2Name = chain[2].name;
                        if (typeof chain[2].api !== 'undefined') {
                            vpk.pods[key].creationChain.level2API = chain[2].api;
                        } else {
                            vpk.pods[key].creationChain.level2API = 'Unknown';
                        }
                        level2Kind = chain[2].kind;

                        if (typeof vpk.crds[level2Kind] !== 'undefined') {
                            if (typeof vpk.pods[key].CRD === 'undefined') {
                                vpk.pods[key].CRD = [];
                            }
                            vpk.pods[key].CRD.push({
                                level2CRD: true,
                                level2Fnum: vpk.crds[level2Kind][0].fnum,
                                level2Name: vpk.crds[level2Kind][0].name,
                            });
                        }
                    }
                } else {
                    vpk.pods[key].creationChain.level1Kind = chain[0].ownerKind;
                    if (typeof vpk.allUids[chain[0].ownerUid] !== 'undefined') {
                        let tmp = vpk.allUids[chain[0].ownerUid];
                        vpk.pods[key].creationChain.level1Fnum = tmp.fnum;
                        vpk.pods[key].creationChain.level1Kind = tmp.kind;
                        vpk.pods[key].creationChain.level1Name = tmp.name;
                        vpk.pods[key].creationChain.level1API = 'unknown';
                    }
                }
            } else {
                // logMessage(`SCM221 - Did not find childUid ${cUid}`);
            }
        }
    } catch (err1) {
        logMessage('SCM021 - Error processing level1 and level2 uids, message: ' + err1);
        logMessage('SCM121 - Stack: ' + err1.stack);
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
                    let ns = vpk.pods[key].namespace;
                    if (typeof podNS[ns] === 'undefined') {
                        podNS.push(ns);
                    }
                }
            }
        }
        //logMessage('SCM025 - Flagged ' + displayCnt + ' active containers to display');
    } catch (err) {
        logMessage('SCM030 - Error processing schematic, message: ' + err.stack);
    }
}
