//------------------------------------------------------------------------------
// Build the hierarchy of Subject binding to Role
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { sortJSONByKeys } from '../utils/sortjsonbykeys.js';
export function createResourceHierarchy() {
    let baseKeys = Object.keys(vpk.secResources); // Subject: User, Group, etc.
    let roleKeys;
    let fnumKeys;
    let nsKeys;
    let baseKey;
    let roleKey;
    let fnumKey;
    let nsKey;
    let roleChildren;
    let fnumChildren;
    let nsChildren;
    let tmp;
    let tmp2;
    let rsc = { name: 'Resources', children: [] };
    // [User: base ] [Name: item] [Fnum]
    try {
        for (let b = 0; b < baseKeys.length; b++) {
            baseKey = baseKeys[b];
            tmp = sortJSONByKeys(vpk.secResources[baseKey]);
            vpk.secResources[baseKey] = tmp;
            roleKeys = Object.keys(vpk.secResources[baseKey]); // Subject names
            roleChildren = [];
            for (let n = 0; n < roleKeys.length; n++) {
                roleKey = roleKeys[n];
                if (roleKey === 'ClusterRole') {
                    // ClusterRole hasn no namespace
                    fnumKeys = Object.keys(vpk.secResources[baseKey][roleKey]); // Fnum data
                    fnumChildren = [];
                    if (fnumKeys.length === 0) {
                        break;
                    }
                    for (let f = 0; f < fnumKeys.length; f++) {
                        fnumKey = fnumKeys[f];
                        //tmp = vpk.secResources[baseKey][roleKey][fnumKey];
                        tmp2 = Object.keys(vpk.secResources[baseKey][roleKey][fnumKey]);
                        fnumChildren.push({ name: fnumKey, value: tmp2[0] });
                    }
                    if (fnumChildren.length > 0) {
                        roleChildren.push({ name: roleKey, children: fnumChildren });
                    }
                    else {
                        roleChildren.push({ name: roleKey, children: { name: 'none', value: '0' } });
                    }
                }
                else {
                    // Role has namespace
                    nsKeys = Object.keys(vpk.secResources[baseKey][roleKey]); // Namespace data
                    nsChildren = [];
                    for (let n = 0; n < nsKeys.length; n++) {
                        nsKey = nsKeys[n];
                        fnumKeys = Object.keys(vpk.secResources[baseKey][roleKey][nsKey]); // Fnum data
                        fnumChildren = [];
                        if (fnumKeys.length === 0) {
                            break;
                        }
                        for (let f = 0; f < fnumKeys.length; f++) {
                            fnumKey = fnumKeys[f];
                            //tmp = vpk.secResources[baseKey][roleKey][nsKey][fnumKey];
                            tmp2 = Object.keys(vpk.secResources[baseKey][roleKey][nsKey][fnumKey]);
                            fnumChildren.push({ name: fnumKey, value: tmp2[0] });
                        }
                        if (fnumChildren.length > 0) {
                            nsChildren.push({ name: nsKey, children: fnumChildren });
                        }
                        else {
                            nsChildren.push({ name: nsKey, children: { name: 'none', value: '0' } });
                        }
                    }
                    roleChildren.push({ name: roleKey, children: nsChildren });
                }
            }
            rsc.children.push({ name: baseKey, children: roleChildren });
        }
        return rsc;
    }
    catch (err) {
        logMessage('SEC003 - Error building security resource hierarchy ' + ' message: ' + err);
        logMessage('SEC004 - Stack: ' + err.stack);
    }
}
