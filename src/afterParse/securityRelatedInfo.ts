//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

import { sortJSONByKeys } from '../utils/sortjsonbykeys.js';
import { logMessage } from '../utils/logging.js';
import { buildResourceHierarchy } from '../security/buildResourceHierarchy.js';
import { buildSubjectHierarchy } from '../security/buildsubjectHierarchy.js';

export function sercurityRelatedInfo() {
    let tmp: any;
    try {
        logMessage('AFT100 - Sorting Role ApiGroups');
        tmp = sortJSONByKeys(vpk.secApiGroups);
        vpk.secApiGroups = tmp;
        logMessage('AFT101 - Sorting Role Resources');
        tmp = sortJSONByKeys(vpk.secResources);
        vpk.secResources = tmp;
        vpk.secSubjectsHierarchy = buildSubjectHierarchy();
        vpk.secResourcesHierarchy = buildResourceHierarchy();
    } catch (err) {
        logMessage('AFT001 - Error processing securityRelated, message: ' + err);
        logMessage('AFT001 - Stack: ' + err.stack);
    }
}
