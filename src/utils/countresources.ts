//------------------------------------------------------------------------------
// count of the resource files by kind, namespace, and name
//------------------------------------------------------------------------------
import vpk from '../lib/vpk.js';

export function countResources(kind: string, ns: string) {
    let total: string = '_total';
    if (typeof vpk.fileCnt[total] === 'undefined') {
        vpk.fileCnt[total] = { _cnt: 1 };
    } else {
        vpk.fileCnt[total]._cnt = vpk.fileCnt[total]._cnt + 1;
    }

    if (typeof vpk.fileCnt[kind] === 'undefined') {
        vpk.fileCnt[kind] = { _cnt: 1 };
    } else {
        vpk.fileCnt[kind]._cnt++;
    }

    if (typeof vpk.fileCnt[kind][ns] === 'undefined') {
        vpk.fileCnt[kind][ns] = 1;
    } else {
        vpk.fileCnt[kind][ns]++;
    }

    // count of kinds by namespace
    if (typeof vpk.namespaceCnt[ns] === 'undefined') {
        vpk.namespaceCnt[ns] = { _cnt: 1 };
    } else {
        vpk.namespaceCnt[ns]._cnt++;
    }

    if (typeof vpk.namespaceCnt[ns][kind] === 'undefined') {
        vpk.namespaceCnt[ns][kind] = 1;
    } else {
        vpk.namespaceCnt[ns][kind]++;
    }
}
