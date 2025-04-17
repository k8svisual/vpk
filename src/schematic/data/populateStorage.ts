//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

export function populateStorage() {
    let keys: any[];
    let key: string;
    let pvc: any;
    let claimFnum: any;
    let cName: any;
    let pvcName: string = '';
    let pvcFnum: string = '';
    let pvcStorageClass: string = '';
    let pvcVolumeName: string = '';
    let pvcSelectorLabel: string = '';
    let pvcSpace: number = 0;
    let pvName: string = '';
    let pvFnum: string = '';
    let pvLocalPath: string = '';
    let pvHostPath: string = '';
    let pvNFSPath: string = '';
    let scName: string = '';
    let scFnum: string = '';
    let pvKeys: any[] = Object.keys(vpk.pvFnum);
    //let pvKey: string;
    try {
        keys = Object.keys(vpk.pods);
        for (let i: number = 0; i < keys.length; i++) {
            key = keys[i];
            pvcSpace = 0;
            if (typeof vpk.pods[key].PersistentVolumeClaim !== 'undefined') {
                for (let p: number = 0; p < vpk.pods[key].PersistentVolumeClaim.length; p++) {
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
                                    pvFnum = '<ukn>';
                                    for (let v: number = 0; v < pvKeys.length; v++) {
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
        logMessage('SCM031 - Error processing schematic, message: ' + err.stack);
    }
}
