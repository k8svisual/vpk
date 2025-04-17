import vpk from '../../lib/vpk.js';
import { containerLink } from '../../utils/containerlink.js';
/**
 * Extracts environment variable information from the workload and updates relevant data structures.
 * @param obj Object data
 * @param e Counter position
 * @param fnum File number identifier
 * @param name name
 * @param ns namespace
 * @param kind kind
 */
export function saveEnv(obj, e, fnum, name, ns, kind) {
    if (typeof obj[e].env === 'undefined') {
        return;
    }
    const secRef = [];
    const cmapRef = [];
    for (let c = 0; c < obj[e].env.length; c++) {
        if (typeof obj[e].env[c].valueFrom !== 'undefined') {
            // Create a new vdata object for each loop iteration
            let vdata = {
                namespace: ns,
                kind: kind,
                objName: name,
                type: '',
                vname: '',
                vkey: '',
            };
            if (typeof obj[e].env[c].valueFrom.secretKeyRef !== 'undefined') {
                vdata.type = 'secret';
                vdata.vname = obj[e].env[c].valueFrom.secretKeyRef.name;
                vdata.vkey = obj[e].env[c].valueFrom.secretKeyRef.key;
                secRef.push({ ...vdata }); // Spread to create a new copy
                containerLink(fnum, 'Secret', obj[e].env[c].valueFrom.secretKeyRef.name, 'Env', '');
                vpk.pods[fnum].secRefs.push({ ...vdata });
            }
            if (typeof obj[e].env[c].valueFrom.configMapKeyRef !== 'undefined') {
                vdata.type = 'configMap';
                vdata.vname = obj[e].env[c].valueFrom.configMapKeyRef.name;
                vdata.vkey = obj[e].env[c].valueFrom.configMapKeyRef.key;
                cmapRef.push({ ...vdata }); // Spread to create a new copy
                containerLink(fnum, 'ConfigMap', obj[e].env[c].valueFrom.configMapKeyRef.name, 'Env', '');
                vpk.pods[fnum].cmapRefs.push({ ...vdata });
            }
        }
    }
}
