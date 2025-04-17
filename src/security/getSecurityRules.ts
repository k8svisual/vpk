//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------

import { filterSecurityRules } from './filterSecurityRules.js';

export function getSecurityRules(parms) {
    return filterSecurityRules(parms);
}
