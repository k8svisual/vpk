//-----------------------------------------------------------------------------
// check if namespace is in array
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
export function checkDefinedNamespace(ns) {
    // if this namespace does not exist add it
    if (typeof vpk.definedNamespaces[ns] === 'undefined') {
        vpk.definedNamespaces[ns] = ns;
    }
}
