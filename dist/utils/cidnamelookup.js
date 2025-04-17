//-----------------------------------------------------------------------------
// locate file name based on CID
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
export function cidNameLookup(data) {
    let parts;
    if (typeof data === 'undefined') {
        return 'nf';
    }
    if (typeof data[1] !== 'undefined') {
        parts = data[1].split('::');
    }
    else {
        parts = data.split('::');
    }
    let ns = '';
    let kind = '';
    let name = '';
    let key = '';
    if (parts.length > 3) {
        ns = parts[2];
        if (typeof parts[3] !== 'undefined') {
            kind = parts[3];
        }
        if (typeof parts[4] !== 'undefined') {
            name = parts[4];
        }
    }
    else if (parts.length === 3) {
        ns = 'cluster-level';
        kind = 'Namespace';
        name = parts[2];
    }
    else {
        return 'nf';
    }
    //check for file
    if (typeof vpk[kind] !== 'undefined') {
        key = ns + '.' + kind + '.' + name;
        if (typeof vpk[kind][key] !== 'undefined') {
            if (typeof vpk[kind][key][0] !== 'undefined') {
                if (typeof vpk[kind][key][0].fnum !== 'undefined') {
                    return vpk[kind][key][0].fnum;
                }
            }
        }
    }
    return 'nf';
}
