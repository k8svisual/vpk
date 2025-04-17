//------------------------------------------------------------------------------
// using yamljs read and parse the file
//------------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

import { logMessage } from '../utils/logging.js';
import { validYAML } from './validYAML.js';
import { checkNetInfo } from './checkNetIno.js';

export function processYAML(fn: any, fnum: any, oRef: any, cStatus: any, statusPhase: string) {
    let valid: boolean = true; // indicate if yaml is valid, true = yes, false = no
    let y_ns: string = '';
    let y_kind: string = '';
    let y_name: string = '';
    let y_node: string = '';

    fnum = fn;

    try {
        // determine if this is a valid kubernetes yaml file
        if (typeof vpk.yaml !== 'undefined') {
            if (typeof vpk.yaml.apiVersion !== 'undefined') {
                // Handle one off processing for specific KINDS
                if (typeof vpk.yaml.kind !== 'undefined') {
                    y_kind = vpk.yaml.kind;
                    // Save namespace fnum if this is a new namespace name
                    if (y_kind === 'Namespace') {
                        if (typeof vpk.namespaceFnum[vpk.yaml.metadata.name] === 'undefined') {
                            vpk.namespaceFnum[vpk.yaml.metadata.name] = fnum;
                        }
                    }
                    checkNetInfo(y_kind, fnum);
                } else {
                    valid = false;
                }
            } else {
                valid = false;
            }
        }

        // check if metadata tag is found and get the name
        if (valid) {
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.name !== 'undefined') {
                    y_name = vpk.yaml.metadata.name;
                } else {
                    valid = false;
                    logMessage(`FIO036 - Missing metadata.name for kind: ${y_kind} fnum: ${fnum}`);
                }
            }

            // set namespace variable y_ns
            if (typeof vpk.yaml.metadata.namespace !== 'undefined') {
                y_ns = vpk.yaml.metadata.namespace;
            } else {
                // no namespace defined, will treat as cluster level resource
                y_ns = 'cluster-level';
            }

            // add api type if it does not exist
            if (typeof vpk.apitypes[vpk.yaml.apiVersion + ':' + vpk.yaml.kind] === 'undefined') {
                vpk.apitypes[vpk.yaml.apiVersion + ':' + vpk.yaml.kind] = {
                    group: vpk.yaml.apiVersion,
                    kind: vpk.yaml.kind,
                    namespaced: y_ns,
                };
            }

            // Process the YAML
            validYAML(y_ns, y_kind, y_name, y_node, fn, fnum, oRef, cStatus, statusPhase);
        } else {
            // File skipped not valid for processing increment x counter, x = not Kube YAML
            vpk.xCnt++;
        }
    } catch (err) {
        logMessage(`FIO005 - Error processing error file fnum: ${fnum}  message: ${err.message}`);
        logMessage(`FIO005 - stack: ${err.stack}`);
        vpk.xCnt++;
    }
    if (vpk.xCnt > 0) {
        logMessage(`FIO009 - Number of invalid resources: ${vpk.xCnt}`);
    }
}
