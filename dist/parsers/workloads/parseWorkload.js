// src/parsers/workload/parseWorkload.ts
import { handlePodWorkload } from './handlePodWorkload.js';
import { handleJobWorkload } from './handleJobWorkload.js';
import { handleOtherWorkloads } from './handleOtherWorkloads.js';
let allVolumes = {};
let nodeName;
/**
 * Parses the workload based on its kind.
 * @param ns Namespace
 * @param kind Workload type
 * @param name Workload name
 * @param yaml Parsed YAML content
 * @param fnum File number identifier
 * @param node Node name
 */
export function workloadParse(ns, kind, name, yaml, fnum, node) {
    allVolumes = {};
    nodeName = node;
    if (typeof yaml.spec !== 'undefined') {
        // Handle Pod workload kind
        if (kind === 'Pod') {
            handlePodWorkload(ns, kind, name, yaml, fnum, allVolumes);
            return;
        }
        // Handle CronJob or Job workload kind
        if (kind === 'CronJob' || kind === 'Job') {
            handleJobWorkload(ns, kind, name, yaml, fnum, allVolumes, nodeName);
            return;
        }
        // Handle other workload kinds
        handleOtherWorkloads(ns, kind, name, yaml, fnum, allVolumes, nodeName);
    }
}
