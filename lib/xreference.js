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

'use strict';

/*------------------------------------------------------------------------------
Build xrefs
*/

let vpk = require('./vpk');
let utl = require('./utl');
let xrs;                // xref Rules from config file
let elem = '';
let kind;
let fnum;
let xKind;
let findValue = '';

//------------------------------------------------------------------------------
const process = function () {
    try {
        if (typeof vpk.yaml !== 'undefined') {
            if (typeof vpk.yaml.kind !== 'undefined') {
                kind = vpk.yaml.kind;
                if (typeof xrs[kind] !== 'undefined') {
                    checkRules();
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF003 - Error - Invalid yaml did not find needed attributes, message: ' + err);
        utl.logMsg('vpkXRF004 - Stack: ' + err.stack);
    }
};

const checkRules = function () {
    let pXrs = '';
    let pXr = '';
    let item;
    let data;
    let fp;
    let fnKey;
    elem = '';
    try {
        pXrs = xrs[kind];
        for (let r = 0; r < pXrs.length; r++) {
            pXr = pXrs[r];
            xKind = 'xRef' + pXr.xrk;

            //-- Start: Github Issue: #6    
            // keep track of each kind of xref declared so the list can 
            // be used to delete them when parsing a snapshot
            if (vpk.xrefDefined.indexOf('#$@' + xKind) === -1) {
                vpk.xrefDefined = '#$@' + xKind + vpk.xrefDefined;
            }
            //-- End: Github Issue: #6    

            if (typeof vpk[xKind] === 'undefined') {
                vpk[xKind] = [];
            }
            if (pXr.xon === false) {
                //utl.logMsg('vpkXRF057 - Skipping rule, not enabled. Kind: ' + kind + ' Path rule: '  + pXr.xrw);
                continue;
            }
            item = pXr.xrw;
            // check if there is a value to match
            if (item.endsWith('}}')) {
                // save the search value
                fp = item.indexOf('{{');
                findValue = item.substring(fp + 2, item.length - 2);
                // now strip the {{ value }}
                item = item.substring(0, fp);
            } else {
                findValue = '';
            }


            if (item.indexOf('[*]') > -1) {
                elem = item.split('[*]')
                segH0();
            } else {
                data = getSegData(vpk.yaml, item)
                if (data !== '') {
                    if (findValue !== '') {
                        if (data !== findValue) {
                            return '';
                        }
                    }
                    if (typeof vpk[xKind][data] === 'undefined') {
                        vpk[xKind][data] = {};
                    }
                    fnKey = fnum + ':' + kind;
                    if (typeof vpk[xKind][data][fnKey] === 'undefined') {
                        vpk[xKind][data][fnKey] = 1;
                    }
                    vpk[xKind][data][fnKey] = vpk[xKind][data][fnKey] + 1;
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF013 - Error - Check rules, message: ' + err);
        utl.logMsg('vpkXRF014 - Stack: ' + err.stack);
    }
};

const segH0 = function () {
    try {
        let data = getSegData(vpk.yaml, elem[0]);
        if (data !== '') {
            for (let i = 0; i < data.length; i++) {
                // hard coded 1 to force checking at elem[1]
                if (typeof elem[1] !== 'undefined') {
                    segH1(data[i]);
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF023 - Level 0 error, message: ' + err);
        utl.logMsg('vpkXRF024 - Stack: ' + err.stack);
    }
};

const segH1 = function (content) {
    let data;
    let newEle;
    let fnKey;
    try {
        newEle = elem[1];
        if (newEle.startsWith('.')) {
            newEle = newEle.substring(1);
        }
        data = getSegData(content, newEle);
        if (elem.length === 2) {
            if (data !== '') {
                if (findValue !== '') {
                    if (data !== findValue) {
                        return '';
                    }
                }

                if (typeof vpk[xKind][data] === 'undefined') {
                    vpk[xKind][data] = {};
                }
                fnKey = fnum + ':' + kind;
                if (typeof vpk[xKind][data][fnKey] === 'undefined') {
                    vpk[xKind][data][fnKey] = 1;
                }
                vpk[xKind][data][fnKey] = vpk[xKind][data][fnKey] + 1;
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                // hard coded 2 to force checking at elem[2]
                if (typeof elem[2] !== 'undefined') {
                    segH2(data[i]);
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF033 - Level 1 error, message: ' + err);
        utl.logMsg('vpkXRF034 - Stack: ' + err.stack);
    }
};

const segH2 = function (content) {
    let data;
    let newEle;
    let fnKey;
    try {
        newEle = elem[2];
        if (newEle.startsWith('.')) {
            newEle = newEle.substring(1);
        }
        data = getSegData(content, newEle);
        if (elem.length === 3) {
            if (data !== '') {
                if (findValue !== '') {
                    if (data !== findValue) {
                        return '';
                    }
                }
                if (typeof vpk[xKind][data] === 'undefined') {
                    vpk[xKind][data] = {};
                }
                fnKey = fnum + ':' + kind;
                if (typeof vpk[xKind][data][fnKey] === 'undefined') {
                    vpk[xKind][data][fnKey] = 1;
                }
                vpk[xKind][data][fnKey] = vpk[xKind][data][fnKey] + 1;
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                // hard coded 3 to force checking at elem[3]
                if (typeof elem[3] !== 'undefined') {
                    segH3(data[i]);
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF043 - Level 2 error, message: ' + err);
        utl.logMsg('vpkXRF044 - Stack: ' + err.stack);
    }
};

const segH3 = function (content) {
    let data;
    let newEle;
    let fnKey;
    try {
        newEle = elem[3];
        if (newEle.startsWith('.')) {
            newEle = newEle.substring(1);
        }
        data = getSegData(content, newEle);
        if (elem.length === 3) {
            if (data !== '') {
                if (findValue !== '') {
                    if (data !== findValue) {
                        return '';
                    }
                }
                if (typeof vpk[xKind][data] === 'undefined') {
                    vpk[xKind][data] = {};
                }
                fnKey = fnum + ':' + kind;
                if (typeof vpk[xKind][data][fnKey] === 'undefined') {
                    vpk[xKind][data][fnKey] = 1;
                }
                vpk[xKind][data][fnKey] = vpk[xKind][data][fnKey] + 1;
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                // hard coded 4 to force checking at elem[4]
                if (typeof elem[4] !== 'undefined') {
                    segH4(data[i]);
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF053 - Level 3 error, message: ' + err);
        utl.logMsg('vpkXRF054 - Stack: ' + err.stack);
    }
};


const segH4 = function (content) {
    let data;
    let newEle;
    let fnKey;
    try {
        newEle = elem[4];
        if (newEle.startsWith('.')) {
            newEle = newEle.substring(1);
        }
        data = getSegData(content, newEle);
        if (elem.length === 3) {
            if (data !== '') {
                if (findValue !== '') {
                    if (data !== findValue) {
                        return '';
                    }
                }
                if (typeof vpk[xKind][data] === 'undefined') {
                    vpk[xKind][data] = {};
                }
                fnKey = fnum + ':' + kind;
                if (typeof vpk[xKind][data][fnKey] === 'undefined') {
                    vpk[xKind][data][fnKey] = 1;
                }
                vpk[xKind][data][fnKey] = vpk[xKind][data][fnKey] + 1;
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                // hard coded 2 to force checking at elem[1]
                if (typeof elem[5] !== 'undefined') {
                    utl.logMsg('vpkXRF998 - Unable to handle six arrays of data');
                    return '';
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkXRF053 - Level 4 error, message: ' + err);
        utl.logMsg('vpkXRF054 - Stack: ' + err.stack);
    }
};


// the data pig that actually gets the data attribute
const getSegData = function (data, xpath) {
    let keys;
    let hl;
    try {
        keys = xpath.split('.');
        hl = keys.length;
        if (hl === 0) {
            return '';
        }
        if (hl === 9) {
            utl.logMsg('vpkXRF999 - Unable to parse data at 9 levels deep');
            return '';
        }
    } catch (e) {
        utl.logMsg('vpkXRF997 - Unable to parse: ' + xpath + ' - message: ' + e);
        return '';
    }


    try {
        if (typeof data[keys[0]] !== 'undefined') {
            if (hl === 1) {
                return data[keys[0]];
            } else {
                if (typeof data[keys[0]][keys[1]] !== 'undefined') {
                    if (hl === 2) {
                        return data[keys[0]][keys[1]]
                    } else {
                        if (typeof data[keys[0]][keys[1]][keys[2]] !== 'undefined') {
                            if (hl === 3) {
                                return data[keys[0]][keys[1]][keys[2]]
                            } else {
                                if (typeof data[keys[0]][keys[1]][keys[2]][keys[3]] !== 'undefined') {
                                    if (hl === 4) {
                                        return data[keys[0]][keys[1]][keys[2]][keys[3]]
                                    } else {
                                        if (typeof data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]] !== 'undefined') {
                                            if (hl === 5) {
                                                return data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]]
                                            } else {
                                                if (typeof data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]][keys[5]] !== 'undefined') {
                                                    if (hl === 6) {
                                                        return data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]][keys[5]]
                                                    } else {
                                                        if (typeof data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]][keys[5]][keys[6]] !== 'undefined') {
                                                            if (hl === 7) {
                                                                return data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]][keys[5]][keys[6]]
                                                            } else {
                                                                if (typeof data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]][keys[5]][keys[6]][keys[7]] !== 'undefined') {
                                                                    if (hl === 8) {
                                                                        return data[keys[0]][keys[1]][keys[2]][keys[3]][keys[4]][keys[5]][keys[6]][keys[7]]
                                                                    } else {
                                                                        console.log('got to level 9')
                                                                        return '';
                                                                    }
                                                                } else {
                                                                    return '';
                                                                }
                                                            }
                                                        } else {
                                                            return '';
                                                        }
                                                    }
                                                } else {
                                                    return '';
                                                }
                                            }
                                        } else {
                                            return '';
                                        }
                                    }
                                } else {
                                    return '';
                                }
                            }
                        } else {
                            return '';
                        }
                    }
                } else {
                    return '';
                }
            }
        } else {
            return '';
        }
    } catch (err) {
        utl.logMsg('vpkXRF950 - Get data error, message: ' + err);
        utl.logMsg('vpkXRF949 - Stack: ' + err.stack);
    }
};

// build the hierarcy return tree
const getXrefNames = function (kind, filter) {
    let key = 'xRef' + kind;
    let rtn = { 'name': kind, 'children': [] };
    let xKeys;
    let fKeys;
    let refV;
    let fArray = []
    //vpk[xKind][data][fnum] = vpk[xKind][data][fnum] + 1;

    try {
        if (typeof vpk[key] === 'undefined') {
            return rtn;
        }
        xKeys = Object.keys(vpk[key]);
        for (let x = 0; x < xKeys.length; x++) {
            refV = vpk[key][xKeys[x]];
            //rtn.children.push({'name': xKeys[x], 'children': [] })
            fKeys = Object.keys(refV);
            fArray = [];
            for (let f = 0; f < fKeys.length; f++) {
                fArray.push({ 'name': fKeys[f], 'value': '1' })
            }
            rtn.children.push({ 'name': xKeys[x], 'children': fArray })
        }
        xKeys = '';
        fKeys = '';
        refV = '';
        return rtn;
    } catch (e) {
        utl.logMsg('vpkXRF917 - Error unable to build xref return for kind: ' + kind + ' - message: ' + e);
        utl.logMsg('vpkXRF918 - Stack: ' + e.stack);
        return rtn;
    }
};


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

    checkXrefs: function (fileNum) {
        try {
            fnum = fileNum;
            // get xRef rules
            if (typeof vpk.configFile.xrefRules !== 'undefined') {
                xrs = vpk.configFile.xrefRules;
            }
            if (typeof xrs !== 'undefined') {
                process();
            } else {
                return;
            }

        } catch (err) {
            utl.logMsg('vpkXRF001 - Error building xref: ' + err);
            utl.logMsg('vpkXRF002 - Stack: ' + err.stack);
        }
        return;
    },

    getXrefs: function (data) {
        let rtn = '';
        let xkind = data.xref;
        let filter = '';
        if (typeof data.filter !== 'undefined') {
            filter = data.filter
        }
        try {
            // check if there is a defined kind 
            if (typeof vpk.configFile.xrefNames[xkind] === 'undefined') {
                rtn = { 'name': xkind, 'value': 0 }
            }
            rtn = getXrefNames(xkind, filter);

        } catch (err) {
            utl.logMsg('vpkXRF101 - Error getting xref data: ' + err);
            utl.logMsg('vpkXRF102 - Stack: ' + err.stack);
        }
        //console.log(JSON.stringify(rtn, null, 2))
        return rtn;
    },

    getXrefRules: function (data) {
        let rtn = '';
        try {
            rtn = {
                'picked': data,
                'names': vpk.configFile.xrefNames,
                'rules': vpk.configFile.xrefRules
            }
        } catch (err) {
            utl.logMsg('vpkXRF201 - Error getting xref rules: ' + err);
            utl.logMsg('vpkXRF202 - Stack: ' + err.stack);
        }
        return rtn;
    }
};
