/**
 * Parses the container array within a workload.
 * @param ns Namespace
 * @param kind Type of the workload
 * @param name Name of the workload
 * @param obj Container specifications
 * @param ctype Container type ('C' for container, 'I' for init container)
 * @param fnum File number identifier
 */

import { logMessage } from '../../utils/logging.js';
import { getMounts } from './getMounts.js';
import { saveImageInfo } from './saveImageInfo.js';
import { saveResources } from './saveResources.js';
import { savePorts } from './savePorts.js';
import { saveEnv } from './saveEnvironments.js';
import { containerImages } from './containerImages.js';

export function parseWorkloadContainers(ns: string, kind: string, name: string, obj: any, ctype: string, fnum: any, allVolumes: any): void {
    let c_name: string = '';
    let c_image: string = '';

    // loop through the defined containers
    try {
        for (let e = 0; e < obj.length; e++) {
            c_name = '';
            c_image = '';

            if (typeof obj[e] !== 'undefined') {
                // parse container definition
                c_name = obj[e].name;
                c_image = obj[e].image;

                // if not a container image, skip data
                if (typeof c_image !== 'string') {
                    continue;
                }

                // Save name and image info
                saveImageInfo(c_name, c_image, ctype, fnum);
                containerImages(c_image, c_name, fnum, ns, kind, name, ctype);
                // Save memory and CPU resource request and limits
                saveResources(obj, e, fnum, kind, name, ns);
                // build entries if ports exist
                savePorts(obj, e, fnum);
                // build entries if configMapKeyRef or secretKeyRef exist
                saveEnv(obj, e, fnum, name, ns, kind);
                // check for volumeMounts
                getMounts(obj, e, fnum, allVolumes);
            }
        }
    } catch (err) {
        logMessage('CON001 - Error processing file fnum: ' + fnum + ' container entry: ' + c_name + ' message: ' + err);
        logMessage('CON001 - Stack: ' + err.stack);
    }
}
