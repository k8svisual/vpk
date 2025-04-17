//------------------------------------------------------------------------------
// process the vpk.k8sResc object to parse the defitions
//------------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import timeParse from '../parsers/time/parseTimes.js';
import { buildIndexes } from './buildIndexes.js';
import { populate } from './populate.js';
import { logMessage } from '../utils/logging.js';
import { redactSecret } from '../utils/redactsecret.js';
import { checkDefinedNamespace } from '../utils/checkdefinednamespace.js';
import { checkKind } from '../utils/checkkind.js';
import { countResources } from '../utils/countresources.js';
import { genericParse } from '../parsers/generic/parseGeneric.js';
import { checkLabels } from '../labels/checkLabels.js';
import { checkMatchLabels } from '../labels/checkMatchLabels.js';
import { checkOwnerReferences } from '../lib/checkOwnerReferences.js';
import { checkAnnotations } from '../lib/checkAnnotations.js';
export function validYAML(y_ns, y_kind, y_name, y_node, fn, fnum, oRef, cStatus, statusPhase) {
    if (typeof vpk.kindNSName[y_kind + '.' + y_ns + '.' + y_name] === 'undefined') {
        vpk.kindNSName[y_kind + '.' + y_ns + '.' + y_name] = [];
    }
    vpk.kindNSName[y_kind + '.' + y_ns + '.' + y_name].push(fnum);
    // Check if Secret redact should occur
    if (y_kind === 'Secret') {
        if (vpk.configFile.defaults.redactSecrets === true) {
            vpk.yaml = redactSecret(vpk.yaml);
        }
    }
    // check if yaml status should be dropped
    if (vpk.dropStatus) {
        if (y_kind === 'Pod') {
            if (typeof vpk.yaml.status !== 'undefined') {
                cStatus = vpk.yaml.status;
                if (typeof vpk.yaml.status.phase !== 'undefined') {
                    statusPhase = vpk.yaml.status.phase;
                    if (typeof vpk.podStatus[fnum] === 'undefined') {
                        vpk.podStatus[fnum] = { status: statusPhase, cnt: 1 };
                    }
                    else {
                        vpk.podStatus[fnum].cnt = vpk.podStatus[fnum].cnt + 1;
                    }
                    if (typeof vpk.stats['pods'] === 'undefined') {
                        vpk.stats['pods'] = {};
                    }
                    if (typeof vpk.stats['pods'][statusPhase] === 'undefined') {
                        vpk.stats['pods'][statusPhase] = { cnt: 0 };
                    }
                    vpk.stats['pods'][statusPhase].cnt = vpk.stats['pods'][statusPhase].cnt + 1;
                    // let x = 'x';
                }
            }
            else {
                cStatus = {};
            }
        }
    }
    // set node
    if (typeof vpk.yaml.spec !== 'undefined') {
        if (typeof vpk.yaml.spec.nodeName !== 'undefined') {
            y_node = vpk.yaml.spec.nodeName;
        }
        else {
            // no namespace defined, will treat as cluster level resource
            y_node = 'unknown';
        }
    }
    else {
        y_node = 'unknown';
    }
    if (y_kind === 'Pod') {
        timeParse.checkPod(y_ns, y_kind, y_name, vpk.yaml, fnum);
    }
    if (y_kind === 'Node' ||
        y_kind === 'PersistentVolumeClaim' ||
        y_kind === 'PersistentVolume' ||
        y_kind === 'StorageClass' ||
        y_kind === 'IngressClass' ||
        y_kind === 'Ingress' ||
        y_kind === 'IngressController' ||
        y_kind === 'Service' ||
        y_kind === 'Endpoints' ||
        y_kind === 'EndpointSlice' ||
        y_kind === 'CSINode') {
        timeParse.checkCreateTime(y_ns, y_kind, y_name, vpk.yaml, fnum);
    }
    //==================================================//
    // Build index like entires for this resource       //
    //==================================================//
    // Add to located list of namespaces
    checkDefinedNamespace(y_ns);
    // Check the kind definition
    checkKind(y_kind);
    // Namespace, Kind, Name, Fnum array
    vpk.allKeys.push({
        apiVersion: vpk.yaml.apiVersion,
        namespace: vpk.yaml.metadata.namespace,
        kind: vpk.yaml.kind,
        name: vpk.yaml.metadata.name,
        fnum: fnum,
    });
    // Check for Helm chart managed Resource
    if (typeof vpk.yaml.metadata.labels !== 'undefined') {
        if (typeof vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] !== 'undefined') {
            if (typeof vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] !== 'undefined') {
                if (vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] === 'Helm') {
                    let helmChart = 'na';
                    if (typeof vpk.yaml.metadata.labels['chart'] !== 'undefined') {
                        helmChart = vpk.yaml.metadata.labels['chart'];
                    }
                    else if (typeof vpk.yaml.metadata.labels['helm.sh/chart'] !== 'undefined') {
                        helmChart = vpk.yaml.metadata.labels['helm.sh/chart'];
                    }
                    if (typeof vpk.helm[helmChart] === 'undefined') {
                        vpk.helm[helmChart] = [];
                    }
                    vpk.helm[helmChart].push({ chart: helmChart, fnum: fnum, kind: y_kind, ns: y_ns, name: y_name });
                }
                else if (vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] === 'operator') {
                    vpk.operator.push({ fnum: fnum, kind: y_kind, ns: y_ns, name: y_name });
                }
                else {
                    // console.log(`manged-by: ${vpk.yaml.metadata.labels['app.kubernetes.io/managed-by']}`)
                }
            }
        }
    }
    // UID
    if (typeof vpk.allUids[vpk.yaml.metadata.uid] === 'undefined') {
        if (typeof vpk.yaml.metadata.uid !== 'undefined') {
            vpk.allUids[vpk.yaml.metadata.uid] = {
                fnum: fnum,
                namespace: vpk.yaml.metadata.namespace,
                kind: vpk.yaml.kind,
                name: vpk.yaml.metadata.name,
                api: vpk.yaml.apiVersion,
            };
        }
        else {
            vpk.allUids[fn] = {
                // no system uid, using generated id
                fnum: fnum,
                namespace: vpk.yaml.metadata.namespace,
                kind: vpk.yaml.kind,
                name: vpk.yaml.metadata.name,
                api: vpk.yaml.apiVersion,
            };
        }
    }
    // If Pod then special handling
    if (y_kind === 'Pod') {
        if (typeof vpk.podList[fnum] === 'undefined') {
            vpk.podList[fnum] = { fnum: fnum, namespace: y_ns };
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
            checkAnnotations(vpk.yaml.metadata.annotations, fnum);
        }
    }
    // check metadata.labels exists
    if (typeof vpk.yaml.metadata !== 'undefined') {
        if (typeof vpk.yaml.metadata.labels !== 'undefined') {
            checkLabels(y_ns, 'Labels', y_name, vpk.yaml.metadata, fnum);
        }
    }
    // check spec.template labels exist
    if (typeof vpk.yaml.spec !== 'undefined' && vpk.yaml.spec !== null) {
        if (typeof vpk.yaml.spec.template !== 'undefined') {
            if (typeof vpk.yaml.spec.template.metadata !== 'undefined') {
                checkLabels(y_ns, 'PodLabels', y_name, vpk.yaml.spec.template.metadata, fnum);
            }
        }
    }
    // check if spec.selector.matchLabels exist
    if (typeof vpk.yaml.spec !== 'undefined' && vpk.yaml.spec !== null) {
        if (typeof vpk.yaml.spec.selector !== 'undefined') {
            if (typeof vpk.yaml.spec.selector.matchLabels !== 'undefined') {
                checkMatchLabels(y_ns, 'MatchLabels', y_name, vpk.yaml.spec.selector.matchLabels, fnum);
            }
        }
    }
    //ToDo: does checkOwnerReferences need to deal with multiple containers
    oRef = checkOwnerReferences(y_name, y_ns, fnum);
    // OwnerRef structure
    if (typeof vpk.yaml.metadata.ownerReferences !== 'undefined') {
        let pKind;
        let pName;
        let key;
        if (typeof vpk.yaml.metadata.uid !== 'undefined') {
            key = vpk.yaml.metadata.uid;
        }
        else {
            logMessage(`FIO444 - No UID for kind:${y_kind}  namespace:${y_ns}  name:${y_name}`);
            key = fnum;
        }
        for (let i = 0; i < vpk.yaml.metadata.ownerReferences.length; i++) {
            // Use temp vars in case the ownerReference is missing
            // the parent name or kind
            if (typeof vpk.yaml.metadata.ownerReferences[i].kind !== 'undefined') {
                pKind = vpk.yaml.metadata.ownerReferences[i].kind;
            }
            else {
                pKind = 'unknown';
            }
            if (typeof vpk.yaml.metadata.ownerReferences[i].name !== 'undefined') {
                pName = vpk.yaml.metadata.ownerReferences[i].name;
            }
            else {
                pName = 'unknown';
            }
            vpk.oRefLinks.push({
                child: key,
                childFnum: fnum,
                childKind: y_kind,
                childName: y_name,
                ns: y_ns,
                parent: vpk.yaml.metadata.ownerReferences[i].uid,
                parentFnum: '', // Updated in the afterParse.js
                parentKind: pKind,
                parentName: pName,
            });
        }
    }
    buildIndexes(fnum, y_kind, y_ns, y_name);
    // increment counter
    vpk.yCnt++;
    //
    if (typeof y_ns === 'undefined' || y_ns === null || y_ns === '') {
        countResources(y_kind, 'cluster-level');
    }
    else {
        countResources(y_kind, y_ns);
    }
    // check if Services should be run through generic
    genericParse(y_ns, y_kind, y_name, fnum);
    // Check defined resources types in populate and build data
    populate(y_ns, y_kind, y_name, fn, '', y_node, fnum, oRef, cStatus, statusPhase);
}
