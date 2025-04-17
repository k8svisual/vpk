//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';

export function namespaceLevel(data, type, fnum) {
    let ns;
    let name;
    if (typeof data.namespace === 'undefined') {
        ns = 'Unknown';
    } else {
        ns = data.namespace;
    }

    let cName = '0000-' + ns;

    if (typeof data.value !== 'undefined') {
        name = data.value;
    }
    if (typeof data.name !== 'undefined') {
        name = data.name;
    }
    if (typeof vpk.pods[cName] === 'undefined') {
        vpk.pods[cName] = {};
    }
    if (typeof vpk.pods[cName][type] === 'undefined') {
        vpk.pods[cName][type] = [];
    }

    for (let i = 0; i < vpk.pods[cName][type].length; i++) {
        if (vpk.pods[cName][type][i].fnum === fnum) {
            return;
        }
    }

    vpk.pods[cName][type].push({
        name: name,
        fnum: fnum,
        namespace: ns,
        kind: data.kind,
        api: data.apiVersion,
    });
}
