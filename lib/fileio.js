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
Component that reads, parses, and stores the yaml file information.
*/
'use strict';

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import afterParse from '../lib/afterParse.js';
import controllerRevisionParse from '../lib/parseControllerRevision.js';
import csiParse from '../lib/parseCSI.js';
import crdParse from '../lib/parseCRD.js';
import endpointsParse from '../lib/parseEndpoints.js';
import endpointSliceParse from '../lib/parseEndpointSlice.js';
import eventParse from '../lib/parseEvent.js';
import genericParse from '../lib/parseGeneric.js';
import hpaParse from '../lib/parseHPA.js';
import nodeParse from '../lib/parseNode.js';
import persistentVolumeParse from '../lib/parsePersistentVolume.js';
import persistentVolumeClaimParse from '../lib/parsePersistentVolumeClaim.js';
import roleBindingParse from '../lib/parseBinding.js';
import roleParse from '../lib/parseRole.js';
import secretParse from '../lib/parseSecret.js';
import serviceParse from '../lib/parseService.js';
import serviceAccountParse from '../lib/parseServiceAccount.js';
import storageClassParse from '../lib/parseStorageClass.js';
import volumeAttachment from '../lib/parseVolumeAttachment.js';
import workloadParse from '../lib/parseWorkload.js';
import lbl from '../lib/labels.js';
import xref from '../lib/xreference.js';

import fs from 'fs';
import path from 'path';
import security from './security.js';
import YAML from 'js-yaml';

var fnum;
var fp;
var oRef;
var cStatus;
var statusPhase = '';

// //------------------------------------------------------------------------------
// // read directory and populate file array 
// //------------------------------------------------------------------------------
// var readDIR = function (p) {
//     vpk.baseFS = [];
//     try {
//         utl.logMsg('vpkFIO901 - Processing snapshot directory');

//         //clear vpk
//         delete vpk.hierarchy
//         delete vpk.relMap
//         vpk.hierarchy = {};
//         vpk.relMap = '';

//         vpk.baseFS = fs.readdirSync(p);
//     } catch (err) {
//         utl.logMsg('vpkFIO001 - Error - Reading directory, message: = ' + err);
//         // clear the file array since there is an error and not able to process
//         vpk.baseFS = [];
//     }
// };


// //------------------------------------------------------------------------------
// // loop through the results of the directory read
// //------------------------------------------------------------------------------
// var loopBaseFS = function (client) {
//     vpk.childUids = [];

//     var hl = vpk.baseFS.length; // number of files in file array
//     var fn; // filename
//     var rf; // real file not a directory
//     var increment = Math.round(hl / 5);
//     var nowCnt = 0;
//     var msg;

//     for (var i = 0; i < hl; i++) {
//         nowCnt++;
//         if (nowCnt >= increment) {
//             nowCnt = 0;
//             msg = 'Progress - parsed files: ' + i + ' of ' + hl;
//             client.emit('parseStatus', { 'msg': msg });
//             utl.logMsg('vpkFIO021 - ' + msg);
//         }

//         // build file name to process
//         fn = path.join(vpk.dirname, vpk.baseFS[i]);

//         // is this a file or a directory
//         rf = fs.statSync(fn).isFile();

//         if (rf) {
//             vpk.fCnt++;
//             loadFILE(fn);
//         } else {
//             // Not a file, so it's a directory, add to directory array to process
//             //TODO - add capability to check if sub-dir processing is defined
//             vpk.dCnt++;
//             vpk.dirFS.push(fn);
//         }
//     }

//     // done processing files in directory, clear the file array
//     vpk.baseFS = [];
//     vpk.uid = [];

// };


// //------------------------------------------------------------------------------
// // using yamljs read and parse the file
// //------------------------------------------------------------------------------
// var loadFILE = function (fn) {
//     if (fn.endsWith('explains.json')) {
//         // the expains.json file gets skipped
//         return;
//     }
//     var contents;
//     var hl = 0;
//     var part = 0;
//     vpk.yaml = '';
//     var contents2;
//     var contents3;
//     var fnum = fn.split('/config')
//     var numb;

//     try {

//         numb = fnum[1].split('.')
//         numb = parseInt(numb[0])
//         contents2 = vpk.k8sResc[numb]; //js-yaml 
//         vpk.yaml = contents2;
//         processYAML(fn, part);

//         // contents = YAML.safeLoadAll(fs.readFileSync(fn)); //js-yaml 

//         // // determine if this is a valid kubernetes yaml file			
//         // if (typeof contents[0] !== 'undefined' && contents[0] !== null) {
//         //     hl = contents.length;
//         // } else {
//         //     hl = 1;
//         // }

//         // if (contents[0] !== null) {
//         //     for (part = 0; part < hl; part++) {
//         //         vpk.yaml = contents[part];
//         //         processYAML(fn, part);
//         //     }
//         // } else {
//         //     utl.count('_blank', '_blank', '_blank');
//         // }
//     } catch (err) {
//         utl.logMsg('vpkFIO001 - Skipped file, unable to parse as YAML, file name: ' + fn);
//         vpk.xCnt++;
//     }
// };

function loadResources(client) {
    vpk.childUids = [];
    let keys = Object.keys(vpk.k8sResc);
    let key;
    let k;
    let contents;
    let hl = vpk.k8sResc.length;
    let increment = Math.round(hl / 5);
    var nowCnt = 0;
    var msg;

    //clear vpk
    delete vpk.hierarchy
    delete vpk.relMap
    vpk.hierarchy = {};
    vpk.relMap = '';

    try {
        for (k = 0; k < keys.length; k++) {
            nowCnt++;
            if (nowCnt >= increment) {
                nowCnt = 0;
                msg = 'Progress - parsed files: ' + i + ' of ' + hl;
                client.emit('parseStatus', { 'msg': msg });
                utl.logMsg('vpkFIO021 - ' + msg);
            }
            key = parseInt(keys[k])
            contents = vpk.k8sResc[key]
            vpk.yaml = contents;
            processYAML(keys[k], 0);
        }
    } catch (err) {
        utl.logMsg('vpkFIO001 - Skipped, unable to parse key: ' + keys[k] + ' Error: ' + err);
    }
    vpk.baseFS = [];
    vpk.uid = [];
}

//------------------------------------------------------------------------------
// using yamljs read and parse the file
//------------------------------------------------------------------------------
var processYAML = function (fn, part) {
    var valid = true; // indicate if yaml is valid, true = yes, false = no
    var y_ns = '';
    var y_kind = '';
    var y_name = '';

    // fp = fn.indexOf('config');
    // fnum = fn.substring(fp + 6, fn.length - 5) + '.' + part;

    fnum = fn + '.' + part

    try {
        // determine if this is a valid kubernetes yaml file			
        if (typeof vpk.yaml !== 'undefined') {
            if (typeof vpk.yaml.apiVersion !== 'undefined') {
                //y_apiV = vpk.yaml.apiVersion;
                if (typeof vpk.yaml.kind !== 'undefined') {
                    y_kind = vpk.yaml.kind;
                } else {
                    valid = false;
                }
            } else {
                valid = false;
            }
        }

        // check if metadata tag is found
        if (valid) {
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.name !== 'undefined') {
                    y_name = vpk.yaml.metadata.name;
                } else {
                    valid = false;
                    utl.logMsg('vpkFIO036 - Missing metadata.name located ' + y_kind + ' fnum: ' + fnum);
                }
            }
        }

        // set namespace 
        if (typeof vpk.yaml.metadata.namespace !== 'undefined') {
            y_ns = vpk.yaml.metadata.namespace;
        } else {
            // no namespace defined, will treat as cluster level resource
            y_ns = 'cluster-level';
        }

        xref.checkXrefs(fnum);

        // if valid yaml 
        if (valid) {
            // check if yaml status should be dropped
            if (vpk.dropStatus) {
                if (y_kind === 'Pod') {
                    if (typeof vpk.yaml.status !== 'undefined') {
                        cStatus = vpk.yaml.status
                        if (typeof vpk.yaml.status.phase !== 'undefined') {
                            statusPhase = vpk.yaml.status.phase;
                        }
                    } else {
                        cStatus = {};
                    }
                }
            }

            vpk.apiFnum[fnum] = {
                'apiVersion': vpk.yaml.apiVersion,
                'namespace': y_ns,
                'kind': y_kind
            }

            // add resource to global vpk
            let item = {
                'apiVersion': vpk.yaml.apiVersion,
                'namespace': vpk.yaml.metadata.namespace,
                'kind': vpk.yaml.kind,
                'name': vpk.yaml.metadata.name,
                'fnum': fnum
            };
            vpk.allKeys.push(item);

            // add uid to global vpk
            if (typeof vpk.allUids[vpk.yaml.metadata.uid] === 'undefined') {
                if (typeof vpk.yaml.metadata.uid !== 'undefined') {
                    vpk.allUids[vpk.yaml.metadata.uid] = {
                        'fnum': fnum,
                        'namespace': vpk.yaml.metadata.namespace,
                        'kind': vpk.yaml.kind,
                        'name': vpk.yaml.metadata.name,
                        'api': vpk.yaml.apiVersion
                    }
                } else {
                    vpk.allUids[fn] = {     // no system uid, using generated id
                        'fnum': fnum,
                        'namespace': vpk.yaml.metadata.namespace,
                        'kind': vpk.yaml.kind,
                        'name': vpk.yaml.metadata.name,
                        'api': vpk.yaml.apiVersion
                    };
                }
            }

            if (y_kind === 'Pod') {
                if (typeof vpk.podList[fnum] === 'undefined') {
                    vpk.podList[fnum] = { 'fnum': fnum, 'namespace': y_ns };

                    if (typeof vpk.yaml.metadata.ownerReferences !== 'undefined') {
                        vpk.podList[fnum].owners = vpk.yaml.metadata.ownerReferences;

                        if (typeof vpk.yaml.metadata.ownerReferences[0].kind !== 'undefined') {
                            if (vpk.yaml.metadata.ownerReferences[0].kind === 'DaemonSet') {
                                if (typeof vpk.daemonSetPods[fnum] === 'undefined') {
                                    vpk.daemonSetPods.push(fnum);
                                }
                            }
                        }
                    }
                }
            }

            // add to located list of namespaces
            utl.checkDefinedNamespace(y_ns);

            // check the kind definition 
            utl.checkKind(y_kind);


            // check metadata.labels exists
            if (typeof vpk.yaml.metadata !== 'undefined') {
                lbl.checkLabels(y_ns, 'Labels', y_name, vpk.yaml.metadata, fnum);
            }

            // check spec.template labels exist
            if (typeof vpk.yaml.spec !== 'undefined' && vpk.yaml.spec !== null) {
                if (typeof vpk.yaml.spec.template !== 'undefined') {
                    if (typeof vpk.yaml.spec.template.metadata !== 'undefined') {
                        lbl.checkLabels(y_ns, 'PodLabels', y_name, vpk.yaml.spec.template.metadata, fnum);
                    }
                }
            }

            // check if spec.selector.matchLabels exist
            if (typeof vpk.yaml.spec !== 'undefined' && vpk.yaml.spec !== null) {
                if (typeof vpk.yaml.spec.selector !== 'undefined') {
                    if (typeof vpk.yaml.spec.selector.matchLabels !== 'undefined') {
                        lbl.checkMatchLabels(y_ns, 'MatchLabels', y_name, vpk.yaml.spec.selector.matchLabels, fnum);
                    }
                }
            }

            // if (typeof vpk.apis[vpk.yaml.apiVersion] === 'undefined') {
            //     vpk.apis[vpk.yaml.apiVersion] = [];
            // }

            var api = vpk.yaml.apiVersion;
            var apiParts = api.split('/');
            // if (typeof apiParts[0] !== 'undefined') {
            //     var apiKey = apiParts[0];
            //     if (typeof vpk.k8apis[apiKey] === 'undefined') {
            //         if (typeof vpk.apis[vpk.yaml.apiVersion][y_kind] === 'undefined') {
            //             vpk.apis[vpk.yaml.apiVersion][y_kind] = 1
            //         } else {
            //             vpk.apis[vpk.yaml.apiVersion][y_kind] = vpk.apis[vpk.yaml.apiVersion][y_kind] + 1;
            //         }
            //     } else {
            //         // do nothing a valid k8 api type is located
            //     }
            // }

            //ToDo: does checkOwnerReferences need to deal with multiple containers
            oRef = checkOwnerReferences(y_kind, y_name, y_ns);

            // increment yaml counter
            vpk.yCnt++;

            //
            if (typeof y_ns === 'undefined' || y_ns === null || y_ns === '') {
                utl.count(y_kind, 'cluster-level', y_name)
            } else {
                utl.count(y_kind, y_ns, y_name);
            }

            // check if Services should be run through generic
            genericParse.parse(y_ns, y_kind, y_name, fnum);

            // parse and populate
            switch (y_kind) {
                case 'ClusterRole':
                    roleParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'ClusterRoleBinding':
                    roleBindingParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'ControllerRevision':
                    controllerRevisionParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'CronJob':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'CSIDriver':
                    csiParse.parse(y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'CSINode':
                    csiParse.parse(y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'CustomResourceDefinition':
                    crdParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'DaemonSet':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'Deployment':
                    //(ns, kind, name, obj, containerType, fnum)
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'Endpoints':
                    endpointsParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'EndpointSlice':
                    endpointSliceParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Event':
                    eventParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'HorizontalPodAutoscaler':
                    hpaParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Job':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'Node':
                    nodeParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'PersistentVolume':
                    persistentVolumeParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'PersistentVolumeClaim':
                    persistentVolumeClaimParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Pod':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'ReplicaSet':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'ReplicationController':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'Role':
                    roleParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'RoleBinding':
                    roleBindingParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Secret':
                    secretParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Service':
                    serviceParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'ServiceAccount':
                    serviceAccountParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'StatefulSet':
                    processContainer(y_ns, y_kind, y_name, fn, part);
                    break;
                case 'StorageClass':
                    storageClassParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'VolumeAttachment':
                    volumeAttachment.parse(y_kind, y_name, vpk.yaml, fnum)
                    break;
                default:
                    if (typeof vpk.yaml.spec !== 'undefined') {
                        if (vpk.yaml.spec !== null) {
                            if (typeof vpk.yaml.spec.containers !== 'undefined') {
                                processContainer(y_ns, y_kind, y_name, fn, part);
                            } else {
                                if (typeof vpk.yaml.spec.template !== 'undefined') {
                                    if (typeof vpk.yaml.spec.template.spec !== 'undefined') {
                                        if (typeof vpk.yaml.spec.template.spec.containers !== 'undefined') {
                                            processContainer(y_ns, y_kind, y_name, fn, part);
                                        }
                                    }
                                }
                            }
                        }
                    }
            }

        } else {
            // utl.logMsg('vpkFIO095 - File skipped not valid for processing file: ' + fn );
            // increment x counter, x = not Kube YAML
            vpk.xCnt++;
        }

    } catch (err) {
        utl.logMsg('vpkFIO005 - Error processing error file fnum: ' + fnum + ' message: ' + err.message);
        utl.logMsg('vpkFIO005 - stack: ' + err.stack);
        vpk.xCnt++;
    }
};


// workload processing logic
var processContainer = function (y_ns, y_kind, y_name, fn, part) {
    workloadParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum, oRef, cStatus, statusPhase, fn, part)
};

// estabilsh owner if possible
var checkOwnerReferences = function (kind, name, ns) {
    try {
        let oRef = [];
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
                    vpk.ownerRefs[vpk.yaml.metadata.ownerReferences[0].uid] = []
                }

                vpk.ownerRefs[vpk.yaml.metadata.ownerReferences[0].uid].push(
                    {
                        'parentUid': vpk.yaml.metadata.ownerReferences[0].uid,
                        'parentKind': vpk.yaml.metadata.ownerReferences[0].kind,
                        'parentName': vpk.yaml.metadata.ownerReferences[0].name,
                        'parentAPI': vpk.yaml.metadata.ownerReferences[0].apiVersion,
                        'childUid': vpk.yaml.metadata.uid,
                        'childKind': vpk.yaml.kind,
                        'childAPI': vpk.yaml.apiVersion,
                        'childName': vpk.yaml.metadata.name,
                        'childFnum': fnum
                    }
                )

                if (typeof vpk.childRefs[vpk.yaml.metadata.uid] === 'undefined') {
                    vpk.childRefs[vpk.yaml.metadata.uid] = []
                }
                vpk.childRefs[vpk.yaml.metadata.uid].push(
                    {
                        'parentUid': vpk.yaml.metadata.ownerReferences[0].uid,
                        'parentKind': vpk.yaml.metadata.ownerReferences[0].kind,
                        'parentName': vpk.yaml.metadata.ownerReferences[0].name,
                        'parentAPI': vpk.yaml.metadata.ownerReferences[0].apiVersion,
                        'childUid': vpk.yaml.metadata.uid,
                        'childKind': vpk.yaml.kind,
                        'childAPI': vpk.yaml.apiVersion,
                        'childName': vpk.yaml.metadata.name,
                        'childFnum': fnum
                    }
                )





                oRef = vpk.yaml.metadata.ownerReferences;

                for (let i = 0; i < vpk.yaml.metadata.ownerReferences.length; i++) {
                    ownerId = '';
                    ownKind = 'self';

                    if (typeof vpk.yaml.metadata.ownerReferences[i].uid !== 'undefined') {
                        ownerId = vpk.yaml.metadata.ownerReferences[i].uid;
                        if (ownerId === uid) {
                            console.log('Matching UIDs')
                        }
                    } else {
                        ownerId = 'none';
                    }

                    if (typeof vpk.yaml.metadata.ownerReferences[i].kind !== 'undefined') {
                        ownKind = vpk.yaml.metadata.ownerReferences[i].kind;
                    } else {
                        ownKind = 'none';
                    }

                    if (typeof vpk.yaml.metadata.ownerReferences[i].apiVersion !== 'undefined') {
                        ownAPI = vpk.yaml.metadata.ownerReferences[i].apiVersion;
                    } else {
                        ownAPI = 'none';
                    }

                    let oTemp = [];
                    if (typeof vpk.ownerUids[ownerId] === 'undefined') {
                        vpk.ownerUids[ownerId] = [];
                    } else {
                        oTemp = vpk.ownerUids[ownerId];
                    }

                    oTemp.push({
                        'ownerId': ownerId,
                        'ownerKind': ownKind,
                        'ownerAPI': ownAPI,
                        'childAPI': childAPI,
                        'childUid': uid,
                        'childFnum': fnum,
                        'childKind': kind,
                        'childName': name,
                        'childNS': ns
                    })

                    vpk.ownerUids[ownerId] = oTemp;

                    if (typeof vpk.childUids === 'undefined') {
                        console.log("X")
                    }

                    if (typeof vpk.childUids[uid] === 'undefined') {
                        vpk.childUids[uid] = {
                            'parentUid': ownerId,
                            'parentKind': ownKind,
                            'parentAPI': ownAPI,
                            'childAPI': childAPI,
                            'childKind': kind,
                            'childFnum': fnum,
                            'childName': name,
                            'childNS': ns,
                            'parentMulti': []
                        }
                    } else {
                        vpk.childUids[uid].parentMulti.push({
                            'id': ownerId,
                            'kind': ownKind
                        })
                        //console.log('multi-parent: kind: ' + kind + ' fnum: ' + fnum + ' oSize: ' 
                        //+ vpk.childUids[uid].parentMulti.length + ' ownerKind: ' + ownKind + ' id: ' + ownerId)
                    }

                }
            } else { // no ownerReference defined

                if (typeof vpk.ownerUids[uid] === 'undefined') {
                    vpk.ownerUids[uid] = [];
                }
                if (typeof vpk.ownerUids[uid][0] === 'undefined') {
                    vpk.ownerUids[uid].push({
                        'ownerId': 'self',
                        'ownerKind': kind,
                        'childAPI': childAPI,
                        'childUid': uid,
                        'childFnum': fnum,
                        'childKind': kind,
                        'childName': name,
                        'childNS': ns
                    })
                }
            }
        } else {  // no uid found in yaml
            vpk.ownerNumber = vpk.ownerNumber + 1;
            let sid = 'sys' + vpk.ownerNumber;
            if (typeof vpk.ownerUids[sid] === 'undefined') {
                vpk.ownerUids[sid] = [];
            }
            if (typeof vpk.ownerUids[sid][0] === 'undefined') {
                vpk.ownerUids[sid].push({
                    'ownerId': 'self',
                    'ownerKind': kind,
                    'childUid': sid,
                    'childFnum': fnum,
                    'childKind': kind,
                    'childName': name,
                    'childNS': ns
                })
            }
        }
    } catch (err) {
        utl.logMsg('vpkFIO095 - Error processing ownerChain, message: ' + err);
        utl.logMsg(err.stack);
        console.log(JSON.stringify(vpk.yaml, null, 4))
    }
    return oRef;
}


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    checkDir: function (client) {
        let tmp;
        try {
            loadResources();
            afterParse.process();
        } catch (err) {
            utl.logMsg('vpkFIO129 - Error: ' + err);
            utl.logMsg('vpkFIO128 - Error: ' + err.stack);
        }

        // done with this directory
        return;

    }

};
