//-----------------------------------------------------------------------------
// check types
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
export function checkType(kind, key) {
    if (typeof vpk[kind] === 'undefined') {
        vpk[kind] = [];
        if (vpk.kindList.includes[kind]) {
            // var nop = ""
        }
        else {
            vpk.kindList.push(kind);
        }
    }
    if (typeof key === 'number') {
        key = key.toString();
    }
    if (key.length > 0) {
        // add key if not defined
        if (typeof vpk[kind][key] === 'undefined') {
            vpk[kind][key] = [];
        }
    }
}
