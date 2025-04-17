//-----------------------------------------------------------------------------
// Build the hierarchy of Subject binding to Role
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { sortJSONByKeys } from '../utils/sortjsonbykeys.js';

export function createSubjectHierarchy() {
    let baseKeys: any[] = Object.keys(vpk.secSubjects); // Subject: User, Group, etc.
    let nameKeys: any[];
    let fnumKeys: any[];

    let baseKey: string;
    let nameKey: string;
    let fnumKey: string;

    let nameChildren: any;
    let fnumChildren: any;
    let tmp: any;

    let sbj: any = { name: 'Subjects', children: [] };
    // [User: base ] [Name: item] [Fnum]
    try {
        for (let b = 0; b < baseKeys.length; b++) {
            baseKey = baseKeys[b];
            tmp = sortJSONByKeys(vpk.secSubjects[baseKey]);
            vpk.secSubjects[baseKey] = tmp;
            nameKeys = Object.keys(vpk.secSubjects[baseKey]); // Subject names
            nameChildren = [];
            for (let n = 0; n < nameKeys.length; n++) {
                nameKey = nameKeys[n];
                //sort data
                // tmp = sortJSONByKeys(vpk.secSubjects[baseKey][nameKey]);
                // vpk.secSubjects[baseKey][nameKey] = tmp;
                fnumKeys = Object.keys(vpk.secSubjects[baseKey][nameKey]); // Fnum data
                fnumChildren = [];
                for (let f = 0; f < fnumKeys.length; f++) {
                    fnumKey = fnumKeys[f];
                    tmp = vpk.secSubjects[baseKey][nameKey][fnumKey].bindRoleKind + ' - ' + vpk.secSubjects[baseKey][nameKey][fnumKey].bindRoleName;
                    if (vpk.secSubjects[baseKey][nameKey][fnumKey].bindRoleKind === 'Role') {
                        tmp = tmp + ' Namespace: ' + vpk.secSubjects[baseKey][nameKey][fnumKey].namespace;
                    }
                    fnumChildren.push({ name: tmp, value: fnumKey });
                }
                nameChildren.push({ name: nameKey, children: fnumChildren });
            }
            sbj.children.push({ name: baseKey, children: nameChildren });
        }
        return sbj;
    } catch (err) {
        logMessage('SEC001 - Error processing heiarchy: ' + err);
        logMessage('SEC002 - Stack: ' + err.stack);
    }
}
