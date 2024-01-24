/*
Copyright (c) 2018-2023 Dave Weilert

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

/*----------------------------------------------------------
Common utility functions
*/

'use strict';

import vpk from '../lib/vpk.js';

// local routine to output message to console.
const logIt = function (msg) {
    console.log(`${new Date().toLocaleString()} :: ${msg}`);
};


//------------------------------------------------------------------------------
// exported common routines
//------------------------------------------------------------------------------
export default {

    calcSize: function (val) {
        try {
            if (typeof val === 'undefined') {
                logIt(`vpkUTL278 - Unable to converting ${val} to number`);
                return 0
            }
            let nV = val.toUpperCase();
            let pow = 0;
            let base = 1024;
            let num = 0;

            if (nV.endsWith('KI')) {
                pow = 1;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('K')) {
                pow = 1;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('MI')) {
                pow = 2;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('M')) {
                pow = 2;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('GI')) {
                pow = 3;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('G')) {
                pow = 3;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('TI')) {
                pow = 4;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('T')) {
                pow = 4;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('PI')) {
                pow = 5;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('P')) {
                pow = 5;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('EI')) {
                pow = 6;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('E')) {
                pow = 6;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('ZI')) {
                pow = 7;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('Z')) {
                pow = 7;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            } else if (nV.endsWith('YI')) {
                pow = 8;
                num = nV.substring(0, nV.length - 2);
            } else if (nV.endsWith('Y')) {
                pow = 8;
                base = 1000;
                num = nV.substring(0, nV.length - 1);
            }
            let rtn = num * Math.pow(base, pow);
            return rtn
        } catch (err) {
            logIt(`vpkUTL277 - Error converting ${val} to number: ' ${err}`);
        }
    },


    //------------------------------------------------------------------------------
    // check if namespace is in array 
    //------------------------------------------------------------------------------
    checkDefinedNamespace: function (ns) {
        // if this namespace does not exist add it
        if (typeof vpk.definedNamespaces[ns] === 'undefined') {
            vpk.definedNamespaces[ns] = ns;
        }
    },


    //------------------------------------------------------------------------------
    // check if kind/type is in array 
    //------------------------------------------------------------------------------
    checkKind: function (kind, qual) {
        // if this type of kind does not exist create one
        if (typeof qual !== 'undefined' && qual !== null) {
            kind = kind + ' (' + qual + ')';
        }
        if (typeof vpk.kinds[kind] === 'undefined') {
            vpk.kinds[kind] = kind;
        }
    },


    //------------------------------------------------------------------------------
    // check if label is in array 
    //------------------------------------------------------------------------------
    checkLabel: function (label, value, fnum) {
        value = value.trim();
        label = label.trim()
        try {
            if (typeof vpk.labelKeys[label + ': ' + value] === 'undefined') {
                vpk.labelKeys[label + ': ' + value] = [];
                vpk.labelKeys[label + ': ' + value].push(fnum);
            } else {
                var key = label + ': ' + value;
                var tmp = vpk.labelKeys[key];
                var add = true;
                for (let i = 0; i < tmp.length; i++) {
                    if (tmp[i] === fnum) {
                        add = false;
                    }
                }
                if (add === true) {
                    tmp.push(fnum)
                    vpk.labelKeys[label + ': ' + value] = tmp
                }
            }
        } catch (err) {
            logIt(`vpkUTL279 - Error checking labels , message: ' ${err}`);
        }
    },


    //------------------------------------------------------------------------------
    // check types
    //------------------------------------------------------------------------------
    checkType: function (kind, key) {
        if (typeof vpk[kind] === 'undefined') {
            vpk[kind] = [];
            if (vpk.kindList.includes[kind]) {
                // var nop = ""
            } else {
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
    },


    chgP2: function (data) {
        let cp = data.lastIndexOf('@');
        if (cp > -1) {
            return `${data.substring(0, cp)}/${data.substring(cp + 1)}`;
        } else {
            return data;
        }
    },


    //------------------------------------------------------------------------------
    // locate file name based on CID
    //------------------------------------------------------------------------------
    cidNameLookup: function (data) {
        let parts;
        if (typeof data === 'undefined') {
            return 'nf';
        }
        if (typeof data[1] !== 'undefined') {
            parts = data[1].split('::')
        } else {
            parts = data.split('::');
        }
        let ns = '';
        let kind = '';
        let name = '';
        let key = '';
        if (parts.length > 3) {
            ns = parts[2];
            if (typeof parts[3] !== 'undefined') {
                kind = parts[3];
            }
            if (typeof parts[4] !== 'undefined') {
                name = parts[4];
            }
        } else if (parts.length === 3) {
            ns = 'cluster-level';
            kind = 'Namespace';
            name = parts[2]
        } else {
            return 'nf';
        }

        //check for file    
        if (typeof vpk[kind] !== 'undefined') {
            key = ns + '.' + kind + '.' + name;
            if (typeof vpk[kind][key] !== 'undefined') {
                if (typeof vpk[kind][key][0] !== 'undefined') {
                    if (typeof vpk[kind][key][0].fnum !== 'undefined') {
                        return vpk[kind][key][0].fnum;
                    }
                }
            }
        }
        return 'nf';
    },


    //------------------------------------------------------------------------------
    // vpk.container related routine to add information to the container
    //------------------------------------------------------------------------------
    containerLink: function (fnum, type, name, whereUsed, spec) {

        if (typeof vpk.pods[fnum][type] === 'undefined') {
            vpk.pods[fnum][type] = [];
        }

        if (type === 'Secret' || type === 'ConfigMap') {
            if (typeof whereUsed === 'undefined') {
                whereUsed = 'Not provided'
            }
            // check if reference is already added
            let tmp = vpk.pods[fnum][type];
            for (let i = 0; i < tmp.length; i++) {
                if (tmp[i].name === name) {
                    if (tmp[i].use === whereUsed) {
                        return
                    }
                }
            }
            vpk.pods[fnum][type].push({ 'name': name, 'use': whereUsed })

        } else {
            if (typeof spec !== 'undefined') {
                vpk.pods[fnum][type].push({ 'name': name, 'info': spec });
            } else {
                vpk.pods[fnum][type].push({ 'name': name });
            }
        }
    },


    //------------------------------------------------------------------------------
    // count of the resource files by kind, namespace, and name
    //------------------------------------------------------------------------------
    count: function (kind, ns, fnum) {
        let total = '_total';
        if (typeof vpk.fileCnt[total] === 'undefined') {
            vpk.fileCnt[total] = { '_cnt': 1 }
        } else {
            vpk.fileCnt[total]._cnt = vpk.fileCnt[total]._cnt + 1;
        }

        if (typeof vpk.fileCnt[kind] === 'undefined') {
            vpk.fileCnt[kind] = { '_cnt': 1 }
        } else {
            vpk.fileCnt[kind]._cnt = vpk.fileCnt[kind]._cnt + 1;
        }

        if (typeof vpk.fileCnt[kind][ns] === 'undefined') {
            vpk.fileCnt[kind][ns] = 1
        } else {
            vpk.fileCnt[kind][ns] = vpk.fileCnt[kind][ns] + 1;
        }

        // count of kinds by namespace
        if (typeof vpk.namespaceCnt[ns] === 'undefined') {
            vpk.namespaceCnt[ns] = { '_cnt': 1 }
        } else {
            vpk.namespaceCnt[ns]._cnt = vpk.namespaceCnt[ns]._cnt + 1;
        }

        if (typeof vpk.namespaceCnt[ns][kind] === 'undefined') {
            vpk.namespaceCnt[ns][kind] = 1;
        } else {
            vpk.namespaceCnt[ns][kind] = vpk.namespaceCnt[ns][kind] + 1;
        }
    },


    //------------------------------------------------------------------------------
    // format byte amount appending alpha category
    //------------------------------------------------------------------------------
    formatBytes: function (bytes, decimals = 2) {
        if (bytes === 0) {
            return '0 Bytes';
        }
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return sizes[i] + ' ' + parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    },


    //------------------------------------------------------------------------------
    // output message to console appending date and time 
    //------------------------------------------------------------------------------
    logMsg: function (msg, component) {
        // second parameter of component is no longer used 
        // var output = new Date().toLocaleString() + ' :: ' + component + ' :: ' + msg;
        var output = new Date().toLocaleString() + ' :: ' + msg;
        //vpk.vpkLogMsg.push(output);
        console.log(output);
    },


    //------------------------------------------------------------------------------
    // remove a directory 
    //------------------------------------------------------------------------------
    redactSecret: function (data) {
        let keys;
        if (typeof data.data !== 'undefined') {
            keys = Object.keys(data.data);
            for (let i = 0; i < keys.length; i++) {
                data.data[keys[i]] = vpk.redactMsg;
            }
        }
        return data;
    },


    //-------------------------------------------------------------------------------
    // reset the vpk object
    //------------------------------------------------------------------------------
    resetVpkObject: function () {
        // clean up any old kinds in vpk object
        // var totId = vpk.kindList.split('::');
        var totId = vpk.kindList;
        var cCnt = 0;
        if (totId.length > 0) {
            for (var c = 0; c < totId.length; c++) {
                var kind = totId[c];
                kind = kind.trim();
                if (kind.length > 0) {
                    if (typeof vpk[kind] !== 'undefined') {

                        var keys = Object.keys(vpk[kind]);
                        for (var i = 0; i < keys.length; i++) {
                            var key = keys[i]
                            var hl = vpk[kind][key].length;
                            for (var d = 0; d < hl; d++) {
                                vpk[kind][key].pop();
                                if (vpk[kind][key].length === hl) {
                                }
                            }
                            delete vpk[kind][key]
                        }
                        delete vpk[kind];
                        cCnt++;
                        delete vpk.kinds[kind];
                        var chkCntId = kind + 'Cnt'
                        if (typeof vpk[chkCntId] !== 'undefined') {
                            delete vpk[chkCntId];
                        }
                    }
                }
            }
            logIt(`vpkUTL694 - Reset ${cCnt} vpk. objects`);
        }
        vpk.kindList = [];
    },


    //------------------------------------------------------------------------------
    // show object properties
    //------------------------------------------------------------------------------
    showProps: function (obj, objName) {
        var result = ``;
        for (var i in obj) {
            // obj.hasOwnProperty() is used to filter out properties from the object's prototype chain
            if (obj.hasOwnProperty(i)) {
                result += `${objName}.${i} = ${obj[i]}\n`;
            }
        }
        return result;
    },


    //------------------------------------------------------------------------------
    // sort object by keys 
    //------------------------------------------------------------------------------
    sortJSONByKeys: function (data) {
        let newJson = {};
        let keys;
        let key;
        let k;
        try {
            keys = Object.keys(data);
            keys.sort();
            for (k = 0; k < keys.length; k++) {
                key = keys[k];
                newJson[key] = data[key];
            }
        } catch (err) {
            logIt(`vpkUTL086 - Error sorting, message: ${err}`);
            logIt(`vpkUTL086 - Error stack: ${err.stack}`);
        }
        return newJson;
    },

    getPTime: function () {
        let now = new Date();
        return now.getTime(now);
    },

    showTimeDiff: function (start, stop, what) {
        try {
            let diff = stop - start;
            // logIt(`vpkUTL288 - Time duration (milli-seconds): ${diff} for ${what}`);
            if (typeof vpk.stats.durations === 'undefined') {
                vpk.stats.durations = [];
            }
            vpk.stats.durations.push({ 'what': what, 'time': diff })
        } catch (err) {
            logIt(`vpkUTL289 - Error calculating time milliseconds duration, message: ${err}`);
            logIt(`vpkUTL289 - Error stack: ${err.stack}`);
            return 0;
        }
    },


    //------------------------------------------------------------------------------
    // Routine to calculate the total seconds of duration from first date time to 
    // end date time. As currently written the routine only handles maximum of
    // two consecutive days.
    //------------------------------------------------------------------------------
    timeDiff: function (startTime, endTime) {
        try {
            if (startTime === '' || endTime === '') {
                return 0;
            }
            if (startTime === endTime) {
                return 0;
            }
            let start = new Date(startTime);
            let end = new Date(endTime);
            var seconds = (end.getTime() - start.getTime()) / 1000;
            return parseInt(seconds);
        } catch (err) {
            logIt(`vpkUTL089 - Error calculating time duration, message: ${err}`);
            logIt(`vpkUTL089 - Error stack: ${err.stack}`);
            return 0;
        }
    },


    //------------------------------------------------------------------------------
    // space calculation for capacity
    //------------------------------------------------------------------------------
    spaceCalc: function (size) {
        let value = 0;
        let factor = '';
        let power = 0;
        let tmp;
        try {

            if (size.endsWith('i')) {
                value = size.substring(0, size.length - 2);
                tmp = size.length - 2;
                factor = size.substring(tmp);
            } else if (size.endsWith('m')) {
                value = size.substring(0, size.length - 1);
                factor = 'm';
            } else {
                value = size.substring(0, size.length - 1);
                tmp = size.length - 1;
                factor = size.substring(tmp);
            }

            value = parseInt(value, 10);
            if (factor === 'E') {
                power = Math.pow(1000, 6);
            } else if (factor === 'P') {
                power = Math.pow(1000, 5);
            } else if (factor === 'T') {
                power = Math.pow(1000, 4);
            } else if (factor === 'G') {
                power = Math.pow(1000, 3);
            } else if (factor === 'M') {
                power = Math.pow(1000, 2);
            } else if (factor === 'K') {
                power = 1000;
            } else if (factor === 'Ei') {
                power = Math.pow(1024, 6);
            } else if (factor === 'Pi') {
                power = Math.pow(1024, 5);
            } else if (factor === 'Ti') {
                power = Math.pow(1024, 4);
            } else if (factor === 'Gi') {
                power = Math.pow(1024, 3);
            } else if (factor === 'Mi') {
                power = Math.pow(1024, 2);
            } else if (factor === 'Ki') {
                power = 1024;
            } else {
                power = 0;
            }

            value = value * power;

        } catch (err) {
            logIt(`vpkUT584 - Error calculating space, message: ${err}`);
            value = 0;
        }

        return value;
    }

    //end of export    
};
