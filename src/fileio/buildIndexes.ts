//------------------------------------------------------------------------------
// create index entries in the global vpk
//------------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

export function buildIndexes(fnum, kind, ns, name) {
    //console.log(typeof (fnum))

    vpk.idxFnum[fnum] = { ns: ns, kind: kind, name: name };

    if (typeof vpk.idxKind[kind] === 'undefined') {
        vpk.idxKind[kind] = [];
    }
    vpk.idxKind[kind].push(fnum);

    if (typeof vpk.idxNS[ns] === 'undefined') {
        vpk.idxNS[ns] = [];
    }
    vpk.idxNS[ns].push(fnum);

    if (typeof vpk.idxName[name] === 'undefined') {
        vpk.idxName[name] = [];
    }
    vpk.idxName[name].push(fnum);

    if (typeof vpk.idxFullName[ns + '.' + kind + '.' + name] === 'undefined') {
        vpk.idxFullName[ns + '.' + kind + '.' + name] = [];
    }
    vpk.idxFullName[ns + '.' + kind + '.' + name].push(fnum);
}
