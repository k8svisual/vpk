//-----------------------------------------------------------------------------
// check if kind/type is in array
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
export function checkKind(kind) {
    // if this type of kind does not exist create one
    if (typeof vpk.kinds[kind] === 'undefined') {
        vpk.kinds[kind] = kind;
    }
}
