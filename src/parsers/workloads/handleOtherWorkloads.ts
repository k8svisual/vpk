// src/parsers/workload/handlePodWorkload.ts

import { parseWorkloadContainers } from './parseWorkloadContainers.js';
import { getVolumes } from './getVolumes.js';
import { containerLink } from '../../utils/containerlink.js';
import { volumeParse } from '../volume/parseVolume.js';
import { volumeClaimTemplateParse } from '../volumeClaimTemplate/parseVolumeClaimTemplate.js';

import vpk from '../../lib/vpk.js';

/**
 * Handles parsing for workloads.
 * @param ns Namespace
 * @param kind Workload type
 * @param name Workload name
 * @param yaml Parsed YAML content
 * @param fnum File number identifier
 */
export function handleOtherWorkloads(ns: string, kind: string, name: string, yaml: any, fnum: any, allVolumes: any, nodeName: string) {
    if (yaml.spec?.template?.spec) {
        const spec = yaml.spec.template.spec;
        if (spec.nodeName !== 'undefined') {
            vpk.pods[fnum].node = spec.nodeName;
        }
        if (spec.volumes) {
            volumeParse(ns, kind, name, spec.volumes, fnum);
            getVolumes(spec.volumes, kind, ns, name, fnum, nodeName, allVolumes);
        }
        if (yaml.spec.volumeClaimTemplates) {
            volumeClaimTemplateParse(ns, 'VolumeClaimTemplates', name, yaml.spec.volumeClaimTemplates, kind, fnum);
        }
        if (spec.serviceAccount) {
            containerLink(fnum, 'ServiceAccount', spec.serviceAccount, '', '');
        }
        if (spec.imagePullSecrets) {
            spec.imagePullSecrets.forEach((secret: any) => {
                containerLink(fnum, 'Secret', secret.name, 'ImagePull', '');
            });
        }
        if (spec.containers) {
            parseWorkloadContainers(ns, kind, name, spec.containers, 'C', fnum, allVolumes);
        }
        if (spec.initContainers) {
            parseWorkloadContainers(ns, kind, name, spec.initContainers, 'I', fnum, allVolumes);
        }
    }
}
