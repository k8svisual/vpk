/*
Copyright (c) 2018-2022 K8Debug

Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
and associated documentation files (the "Software"), to deal in the Software without restriction, 
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*------------------------------------------------------------------------------
Secutiry related functions
*/

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
const { viewSecSubject } = require('../lib/vpk');

//------------------------------------------------------------------------------
// Build the hierarchy of Subject binding to Role
var createSubjectHierarchy = function () {
    let baseKeys = Object.keys(vpk.secSubjects);   // Subject: User, Group, etc.
    let nameKeys;
    let fnumKeys;

    let baseKey;
    let nameKey;
    let fnumKey;

    let nameChildren;
    let fnumChildren;
    let tmp;

    let sbj = { 'name': 'Subjects', 'children': [] };
    // [User: base ] [Name: item] [Fnum]
    try {
        for (let b = 0; b < baseKeys.length; b++) {
            baseKey = baseKeys[b];
            tmp = utl.sortJSONByKeys(vpk.secSubjects[baseKey]);
            vpk.secSubjects[baseKey] = tmp;
            nameKeys = Object.keys(vpk.secSubjects[baseKey]);  // Subject names
            nameChildren = [];
            for (let n = 0; n < nameKeys.length; n++) {
                nameKey = nameKeys[n];
                //sort data
                // tmp = utl.sortJSONByKeys(vpk.secSubjects[baseKey][nameKey]);
                // vpk.secSubjects[baseKey][nameKey] = tmp;
                fnumKeys = Object.keys(vpk.secSubjects[baseKey][nameKey]);  // Fnum data
                fnumChildren = [];
                for (let f = 0; f < fnumKeys.length; f++) {
                    fnumKey = fnumKeys[f];
                    tmp = vpk.secSubjects[baseKey][nameKey][fnumKey].bindRoleKind + ' - ' +
                        vpk.secSubjects[baseKey][nameKey][fnumKey].bindRoleName
                    if (vpk.secSubjects[baseKey][nameKey][fnumKey].bindRoleKind === 'Role') {
                        tmp = tmp + ' Namespace: ' + vpk.secSubjects[baseKey][nameKey][fnumKey].namespace
                    }
                    fnumChildren.push({ 'name': tmp, 'value': fnumKey })
                }
                nameChildren.push({ 'name': nameKey, 'children': fnumChildren });
            }
            sbj.children.push({ 'name': baseKey, 'children': nameChildren });
        }
        return sbj;
    } catch (err) {
        utl.logMsg('vpkSEC001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        utl.logMsg('vpkSEC002 - Stack: ' + err.stack);
    }

};

//------------------------------------------------------------------------------
// Build the hierarchy of Subject binding to Role
var createResourceHierarchy = function () {
    let baseKeys = Object.keys(vpk.secResources);   // Subject: User, Group, etc.
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

    let rsc = { 'name': 'Resources', 'children': [] };
    // [User: base ] [Name: item] [Fnum]
    try {
        for (let b = 0; b < baseKeys.length; b++) {
            baseKey = baseKeys[b];
            tmp = utl.sortJSONByKeys(vpk.secResources[baseKey]);
            vpk.secResources[baseKey] = tmp;
            roleKeys = Object.keys(vpk.secResources[baseKey]);  // Subject names
            roleChildren = [];
            for (let n = 0; n < roleKeys.length; n++) {
                roleKey = roleKeys[n];
                if (roleKey === 'ClusterRole') {  // ClusterRole hasn no namespace
                    fnumKeys = Object.keys(vpk.secResources[baseKey][roleKey]);  // Fnum data
                    fnumChildren = [];
                    if (fnumKeys.length === 0) {
                        break;
                    }
                    for (let f = 0; f < fnumKeys.length; f++) {
                        fnumKey = fnumKeys[f];
                        //tmp = vpk.secResources[baseKey][roleKey][fnumKey];
                        tmp2 = Object.keys(vpk.secResources[baseKey][roleKey][fnumKey]);
                        fnumChildren.push({ 'name': fnumKey, 'value': tmp2[0] })
                    }
                    if (fnumChildren.length > 0) {
                        roleChildren.push({ 'name': roleKey, 'children': fnumChildren });
                    } else {
                        roleChildren.push({ 'name': roleKey, 'children': { 'name': 'none', 'value': '0' } });
                    }
                } else {  // Role has namespace
                    nsKeys = Object.keys(vpk.secResources[baseKey][roleKey]);  // Namespace data
                    nsChildren = []
                    for (let n = 0; n < nsKeys.length; n++) {
                        nsKey = nsKeys[n];

                        fnumKeys = Object.keys(vpk.secResources[baseKey][roleKey][nsKey]);  // Fnum data
                        fnumChildren = [];
                        if (fnumKeys.length === 0) {
                            break;
                        }
                        for (let f = 0; f < fnumKeys.length; f++) {
                            fnumKey = fnumKeys[f];
                            //tmp = vpk.secResources[baseKey][roleKey][nsKey][fnumKey];
                            tmp2 = Object.keys(vpk.secResources[baseKey][roleKey][nsKey][fnumKey]);
                            fnumChildren.push({ 'name': fnumKey, 'value': tmp2[0] })
                        }
                        if (fnumChildren.length > 0) {
                            nsChildren.push({ 'name': nsKey, 'children': fnumChildren });
                        } else {
                            nsChildren.push({ 'name': nsKey, 'children': { 'name': 'none', 'value': '0' } });
                        }
                    }
                    roleChildren.push({ 'name': roleKey, 'children': nsChildren });
                }
            }
            rsc.children.push({ 'name': baseKey, 'children': roleChildren });
        }
        return rsc;
    } catch (err) {
        utl.logMsg('vpkSEC003 - Error building security resource hierarchy ' + ' message: ' + err);
        utl.logMsg('vpkSEC004 - Stack: ' + err.stack);
    }

};

var filterSecurityRules = function (data) {
    let vset = data.vset;
    let rsc = data.rsc;
    let apiG = data.apiG;
    let ns = data.ns
    let first = true;
    let newData;
    let i;
    try {
        if (vset !== null) {
            if (vset.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < vset.length; i++) {
                    newData = newData.filter(rec => rec.vset.indexOf(vset[i]) > -1)
                }
            }
        }
        if (rsc !== null) {
            if (rsc.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < rsc.length; i++) {
                    newData = newData.filter(rec => rec.rsc.indexOf(rsc[i]) > -1)
                }
            }
        }
        if (apiG !== null) {
            if (apiG.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < apiG.length; i++) {
                    newData = newData.filter(rec => rec.apiG.indexOf(apiG[i]) > -1)
                }
            }
        }
        if (ns !== null) {
            if (ns.length > 0) {
                if (first) {
                    newData = vpk.secArray;
                    first = false;
                }
                for (i = 0; i < ns.length; i++) {
                    newData = newData.filter(rec => rec.ns.indexOf(ns[i]) > -1)
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkSEC005 - Error filtering security data' + 'message: ' + err);
        utl.logMsg('vpkSEC006 - Stack: ' + err.stack);
    }

    return newData;
};


let filterViewData = function (ns) {
    let i;
    let records;
    let roleData;
    let other;
    let arr = [];
    let = kept = [];
    let = key;

    try {
        //console.log('-----------------------------------');
        //console.log('1.) Filter viewSecBinding[]ns by requested namespace: ' + ns);
        records = vpk.viewSecBinding.filter(rec => rec.ns === ns);

        //console.log(' records size: ' + records.length);
        if (records.length > 0) {
            if (typeof records[0] !== 'undefined') {
                // filter for the correct namespace
                //console.log('-----------------------------------');
                //console.log('3.) Filter records[]ns by requested namespace: ' + ns);
                for (let s = 0; s < records.length; s++) {
                    key = records[s].name + '.' + records[s].kind + '.' + records[s].ns + '.' + records[s].subjectName + '.' + records[s].fnum;
                    //console.log('4.) Loop to find associated bindings for subject: ' + records[s].name);
                    if (kept.includes(key)) {
                        //console.log(' - Skip: ' + key);
                    } else {
                        //console.log(' + Keep: ' + key);
                        kept.push(key);
                        // add item to save array
                        arr.push(records[s]);
                        // check for other items for this subject
                        //console.log(' a1.) Create other from bindings by filter for subjectName: ' + records[s].subjectName);
                        other = vpk.viewSecBinding.filter(rec => rec.subjectName === records[s].subjectName);
                        //console.log(' a2.) other size: ' + other.length);

                        // check for other items for this kind
                        //console.log(' b1.) Filter other by subjectKind: ' + records[s].subjectKind);
                        other = other.filter(rec => rec.subjectKind === records[s].subjectKind);
                        //console.log(' b2.) other size: ' + other.length);

                        if (typeof other[0] !== 'undefined') {
                            //console.log(' c1.) Loop and save new keys');
                            for (let x = 0; x < other.length; x++) {
                                key = other[x].name + '.' + other[x].kind + '.' + other[x].ns + '.' + other[x].fnum;
                                if (kept.includes(key)) {
                                    //console.log(' - Skip: ' + key);
                                } else {
                                    arr.push(other[x]);
                                    //console.log(' + Keep: ' + key);
                                }
                            }
                        }
                        //console.log('------ Total saved keys: ' + kept.length)
                    }
                }
            }

            // remove any duplicate items or wrong ns in array
            if (arr.length > 0) {
                let newArr = [];
                let checkForDups = {};
                let dKey;
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
                    ${arr[d].subjectNS}`

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
            //console.log('-----------------------------------');
            //console.log('2.) Adding roleFnum to arr');
            for (i = 0; i < arr.length; i++) {
                //console.log('  Filter viewSecRole by subject[]roleName & subject[]roleKind: ' + arr[i].roleName + ' - ' + arr[i].roleKind);
                roleData = vpk.viewSecRole.filter(rec => rec.name === arr[i].roleName && rec.kind === arr[i].roleKind);
                //console.log('  Filtered count in roleData: ' + roleData.length);
                if (typeof roleData[0] !== 'undefined') {
                    arr[i].rules = roleData[0].rules;
                    arr[i].roleFnum = roleData[0].fnum;
                } else {
                    arr[i].rules = [{ 'apiGroup': ['?'], 'resources': ['?'], 'verbs': ['?'], }];
                    arr[i].roleFnum = '?';
                }
            }
        }

    } catch (err) {
        utl.logMsg('vpkSEC005 - Error filtering security data' + 'message: ' + err);
        utl.logMsg('vpkSEC006 - Stack: ' + err.stack);
    }
    return arr;
}


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    buildSubjectHierarchy: function () {
        return createSubjectHierarchy();
    },

    buildResourceHierarchy: function () {
        return createResourceHierarchy();
    },

    buildRBACHierarchy: function () {
        return createRBACHierarchy();
    },

    getSecurityRules: function (parms) {
        return filterSecurityRules(parms);
    },

    getSecurityViewData: function (ns) {
        return filterViewData(ns);
    },

};