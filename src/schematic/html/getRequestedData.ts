import vpk from '../../lib/vpk.js';

export function getRequestedData(ns: string) {
    if (ns === ':all-namespaces:') {
        return vpk.schematicSVGs;
    }
    let keys = ns.split(':');
    let rtn = {};
    for (let i: number = 0; i < keys.length; i++) {
        if (keys[i] === '') {
            continue;
        }
        rtn[keys[i]] = vpk.schematicSVGs[keys[i]];
    }
    return rtn;
}
