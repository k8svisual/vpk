import { workloadParse } from './parseWorkload.js';
import { logMessage } from '../../utils/logging.js';
import vpk from '../../lib/vpk.js';

/**
 * Main function to parse workloads.
 * @param ns Namespace of the workload
 * @param kind Type of the workload
 * @param name Name of the workload
 * @param yaml Parsed YAML content
 * @param fnum File number identifier
 * @param nodeName Name of the node
 */

export function workloadParser(
    ns: string,
    kind: string,
    name: string,
    yaml: any,
    fnum: any,
    nodeName: string,
    fn: any,
    oRef: any,
    cStatus: any,
    statusPhase: any,
): void {
    if (typeof fnum === 'undefined' || fnum === '' || fnum === 0 || fnum === ':') {
        logMessage('CON999 - Error processing, invalid fnum: fnum for file');
        return;
    }
    // Create the vpk.pods[fnum] entry and populate with initial data
    if (typeof vpk.pods[fnum] === 'undefined') {
        vpk.pods[fnum] = {
            src: fn,
            part: '0',
            fnum: fnum,
            uid: yaml.metadata.uid,
            api: yaml.apiVersion,
            kind: kind,
            name: name,
            namespace: ns,
            containerNames: [],
            typeCcnt: 0,
            typeIcnt: 0,
            node: '',
            oRef: oRef,
            status: cStatus,
            phase: statusPhase,
            resourceLimit: [],
            resourceRequest: [],
            ports: [],
            cmapRefs: [],
            secRefs: [],
            mountLinks: [],
        };
    }
    workloadParse(ns, kind, name, yaml, fnum, nodeName);
}
