//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import { namespaceLevel } from './namespaceLevel.js';
import { clusterLevel } from './clusterLevel.js';

export function checkUsage(data: any, fnum: any) {
    if (data.kind === 'RoleBinding' || data.kind === 'Role') {
        return;
    }

    if (typeof data.namespace === 'undefined') {
        data.namespace = 'cluster-level';
    }

    if (data.namespace === '' || data.namespace === 'cluster-level') {
        clusterLevel(data, data.kind, fnum);
    } else {
        namespaceLevel(data, data.kind, fnum);
    }
}
