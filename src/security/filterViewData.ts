//------------------------------------------------------------------------------
// Build the hierarchy of Subject binding to Role
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function filterViewData(ns: string) {
    let i: number;
    let records: any;
    let roleData: any;
    let other: any;
    let arr: any[] = [];
    let kept: any[] = [];

    try {
        let key: any;
        records = vpk.viewSecBinding.filter((rec: any) => rec.ns === ns);

        if (records.length > 0) {
            if (typeof records[0] !== 'undefined') {
                // filter for the correct namespace
                for (let s = 0; s < records.length; s++) {
                    key = records[s].name + '.' + records[s].kind + '.' + records[s].ns + '.' + records[s].subjectName + '.' + records[s].fnum;
                    if (kept.includes(key)) {
                        //console.log(' - Skip: ' + key);
                    } else {
                        kept.push(key);
                        // add item to save array
                        arr.push(records[s]);
                        // check for other items for this subject
                        //console.log(' a1.) Create other from bindings by filter for subjectName: ' + records[s].subjectName);
                        other = vpk.viewSecBinding.filter((rec) => rec.subjectName === records[s].subjectName);

                        // check for other items for this kind
                        other = other.filter((rec) => rec.subjectKind === records[s].subjectKind);

                        if (typeof other[0] !== 'undefined') {
                            //console.log(' c1.) Loop and save new keys');
                            for (let x = 0; x < other.length; x++) {
                                key = other[x].name + '.' + other[x].kind + '.' + other[x].ns + '.' + other[x].fnum;
                                if (kept.includes(key)) {
                                    //console.log(' - Skip: ' + key);
                                } else {
                                    arr.push(other[x]);
                                }
                            }
                        }
                    }
                }
            }

            // remove any duplicate items or wrong ns in array
            if (arr.length > 0) {
                let newArr: any = [];
                let checkForDups = {};
                let dKey: any;
                for (let d = 0; d < arr.length; d++) {
                    // Ensure all missing if subjectName is equal missing
                    if (arr[d].subjectName === 'Missing') {
                        arr[d].subjectKind = 'Missing';
                        arr[d].subjectNS = 'Missing';
                    }
                    dKey = `
                    ${arr[d].name}
                    ${arr[d].kind}
                    ${arr[d].ns}
                    ${arr[d].roleName}
                    ${arr[d].roleKind}
                    ${arr[d].subjectName}
                    ${arr[d].subjectKind}
                    ${arr[d].subjectNS}`;

                    if (typeof checkForDups[dKey] === 'undefined') {
                        checkForDups[dKey] = 'y';
                        if (arr[d].ns === ns || arr[d].subjectNS === ns) {
                            newArr.push(arr[d]);
                        }
                    }
                }
                arr = newArr;
                newArr = null;
            }

            // Adding role fnum to defined arr
            for (i = 0; i < arr.length; i++) {
                roleData = vpk.viewSecRole.filter((rec) => rec.name === arr[i].roleName && rec.kind === arr[i].roleKind);
                if (typeof roleData[0] !== 'undefined') {
                    arr[i].rules = roleData[0].rules;
                    arr[i].roleFnum = roleData[0].fnum;
                } else {
                    arr[i].rules = [{ apiGroup: ['?'], resources: ['?'], verbs: ['?'] }];
                    arr[i].roleFnum = '?';
                }
            }
        }
    } catch (err) {
        logMessage('SEC005 - Error filtering security data' + 'message: ' + err);
        logMessage('SEC006 - Stack: ' + err.stack);
    }
    return arr;
}
