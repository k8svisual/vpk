// src/parsers/workload/handlePodWorkload.ts

import { parseWorkloadContainers } from './parseWorkloadContainers.js';
import { getVolumes } from './getVolumes.js';
import { containerLink } from '../../utils/containerlink.js';
import { volumeParse } from '../volume/parseVolume.js';
import { volumeClaimTemplateParse } from '../volumeClaimTemplate/parseVolumeClaimTemplate.js';

import vpk from '../../lib/vpk.js';

/**
 * Handles parsing for Pod workloads.
 * @param ns Namespace
 * @param kind Workload type
 * @param name Workload name
 * @param yaml Parsed YAML content
 * @param fnum File number identifier
 */
export function handlePodWorkload(ns: string, kind: string, name: string, yaml: any, fnum: any, allVolumes: any): void {
    if (typeof yaml.spec.nodeName !== 'undefined') {
        vpk.pods[fnum].node = yaml.spec.nodeName;
    }
    if (typeof yaml.spec.containers !== 'undefined') {
        parseWorkloadContainers(ns, kind, name, yaml.spec.containers, 'C', fnum, allVolumes);
    }
    if (typeof yaml.spec.volumes !== 'undefined') {
        volumeParse(ns, kind, name, yaml.spec.volumes, fnum);
        getVolumes(yaml.spec.volumes, kind, ns, name, fnum, yaml.spec.nodeName, allVolumes);
    }
    if (typeof yaml.spec.volumeClaimTemplates !== 'undefined') {
        volumeClaimTemplateParse(ns, 'VolumeClaimTemplates', name, yaml.spec.volumeClaimTemplates, kind, fnum);
    }
    if (typeof yaml.spec.serviceAccount !== 'undefined') {
        containerLink(fnum, 'ServiceAccount', yaml.spec.serviceAccount, '', '');
    }
    if (typeof yaml.spec.imagePullSecrets !== 'undefined') {
        yaml.spec.imagePullSecrets.forEach((secret: any) => {
            containerLink(fnum, 'Secret', secret.name, 'ImagePull', '');
        });
    }
}
