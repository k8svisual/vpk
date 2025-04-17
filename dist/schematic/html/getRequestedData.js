import vpk from '../../lib/vpk.js';
export function getRequestedData(ns) {
    if (ns === ':all-namespaces:') {
        return vpk.schematicSVGs;
    }
    let keys = ns.split(':');
    let rtn = {};
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] === '') {
            continue;
        }
        rtn[keys[i]] = vpk.schematicSVGs[keys[i]];
    }
    return rtn;
}
