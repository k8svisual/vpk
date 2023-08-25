/*
Copyright (c) 2018-2023 k8sVisual

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
import anno from '../lib/annotations.js';
import xref from '../lib/xreference.js';
import oRefBld from '../lib/ownerRefBuild.js';
import owner from '../lib/ownerRef.js';

var fnum;
var oRef;
var cStatus;
var statusPhase = '';

//------------------------------------------------------------------------------
// process the vpk.k8sResc object to parse the defitions 
//------------------------------------------------------------------------------

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
function processYAML(fn, part) {
    var valid = true; // indicate if yaml is valid, true = yes, false = no
    var y_ns = '';
    var y_kind = '';
    var y_name = '';

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


            //==================================================//
            // Build index like entires for this resource       //
            //==================================================//


            // Add to located list of namespaces
            utl.checkDefinedNamespace(y_ns);

            // Check the kind definition 
            utl.checkKind(y_kind);

            // Namespace, Kind, Name, Fnum array
            vpk.allKeys.push(
                {
                    'apiVersion': vpk.yaml.apiVersion,
                    'namespace': vpk.yaml.metadata.namespace,
                    'kind': vpk.yaml.kind,
                    'name': vpk.yaml.metadata.name,
                    'fnum': fnum
                }
            );

            // UID 
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

            // If Pod then special handling
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

            // check if metadata.annotations exists
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.annotations !== 'undefined') {
                    anno.checkAnnotations(vpk.yaml.metadata.annotations, fnum)
                }
            }

            // check metadata.labels exists
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.labels !== 'undefined') {
                    lbl.checkLabels(y_ns, 'Labels', y_name, vpk.yaml.metadata, fnum);
                }
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

            //ToDo: does checkOwnerReferences need to deal with multiple containers
            oRef = oRefBld.checkOwnerReferences(y_name, y_ns, fnum);
            //oRef = oRefBld.checkOwnerReferences(y_kind, y_name, y_ns);

            // OwnerRef structure
            if (typeof vpk.yaml.metadata.ownerReferences !== 'undefined') {
                let pKind;
                let pName;
                let key;
                if (typeof vpk.yaml.metadata.uid !== 'undefined') {
                    key = vpk.yaml.metadata.uid
                } else {
                    utl.logMsg(`vpkFIO444 - No UID for kind:${y_kind}  namespace:${y_ns}  name:${y_name}`)
                    key = fnum
                }
                for (let i = 0; i < vpk.yaml.metadata.ownerReferences.length; i++) {
                    // Use temp vars in case the ownerReference is missing 
                    // the parent name or kind
                    if (typeof vpk.yaml.metadata.ownerReferences[i].kind !== 'undefined') {
                        pKind = vpk.yaml.metadata.ownerReferences[i].kind
                    } else {
                        pKind = 'unknown';
                    }
                    if (typeof vpk.yaml.metadata.ownerReferences[i].name !== 'undefined') {
                        pName = vpk.yaml.metadata.ownerReferences[i].name
                    } else {
                        pName = 'unknown';
                    }
                    vpk.oRefLinks.push(
                        {
                            'child': key,
                            'childFnum': fnum,
                            'childKind': y_kind,
                            'childName': y_name,
                            'ns': y_ns,
                            'parent': vpk.yaml.metadata.ownerReferences[i].uid,
                            'parentFnum': '',   // Updated in the afterParse.js 
                            'parentKind': pKind,
                            'parentName': pName
                        }
                    );
                }
            }

            buildIndexes(fnum, y_kind, y_ns, y_name)

            // increment counter
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
            // File skipped not valid for processing 
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
function processContainer(y_ns, y_kind, y_name, fn, part) {
    workloadParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum, oRef, cStatus, statusPhase, fn, part)
};


function buildIndexes(fnum, kind, ns, name) {
    //console.log(typeof (fnum))

    vpk.idxFnum[fnum] = { "ns": ns, "kind": kind, "name": name }

    if (typeof vpk.idxKind[kind] === 'undefined') {
        vpk.idxKind[kind] = []
    }
    vpk.idxKind[kind].push(fnum)

    if (typeof vpk.idxNS[ns] === 'undefined') {
        vpk.idxNS[ns] = []
    }
    vpk.idxNS[ns].push(fnum)

    if (typeof vpk.idxName[name] === 'undefined') {
        vpk.idxName[name] = []
    }
    vpk.idxName[name].push(fnum)

    if (typeof vpk.idxFullName[ns + '.' + kind + '.' + name] === 'undefined') {
        vpk.idxFullName[ns + '.' + kind + '.' + name] = []
    }
    vpk.idxFullName[ns + '.' + kind + '.' + name].push(fnum)
}

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    checkDir: function (client) {
        let tmp;
        try {
            loadResources();
            owner.chkUidChain();
            afterParse.process(client);
        } catch (err) {
            utl.logMsg('vpkFIO129 - Error: ' + err);
            utl.logMsg('vpkFIO128 - Error: ' + err.stack);
        }

        // done with this directory
        utl.logMsg(`vpkFIO140 - ${vpk.oRefLinks.length} OwnerReference links were located`);
        return;

    }

};
