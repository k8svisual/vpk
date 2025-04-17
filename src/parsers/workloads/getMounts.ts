import vpk from '../../lib/vpk.js';
import { containerLink } from '../../utils/containerlink.js';

export function getMounts(obj: any, e: number, fnum: any, allVolumes: any) {
    if (typeof obj[e].volumeMounts === 'undefined') {
        return;
    }
    for (let v = 0; v < obj[e].volumeMounts.length; v++) {
        let mountPath = '';
        let mountName = '';
        // get the name that will map to the volume with the same name
        if (typeof obj[e].volumeMounts[v].name !== 'undefined') {
            mountName = obj[e].volumeMounts[v].name;
        }
        if (typeof obj[e].volumeMounts[v].mountPath !== 'undefined') {
            mountPath = obj[e].volumeMounts[v].mountPath;
        }
        if (typeof allVolumes[mountName] !== 'undefined') {
            vpk.pods[fnum].mountLinks.push({
                volumeMountName: mountName,
                volumeMountPath: mountPath,
                volumes: allVolumes[mountName],
            });
        }
        containerLink(fnum, 'VolumeMounts', mountName, '', '');
    }
}
