/*
Copyright (c) 2018-2023 k8sVisual

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

import fs from 'fs-extra';
//import YAML from 'js-yaml';
import fsPath from 'path';

// local routine to output message to console.
const logIt = function (msg) {
    console.log(`${new Date().toLocaleString()} :: ${msg}`);
};


//------------------------------------------------------------------------------
// exported common routines
//------------------------------------------------------------------------------
export default {


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
            logIt(`vpkUTL099 - Error checking labels , message: ' ${err}`);
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

    // Start: github issue #9 fix
    /**
    * Change all `@` to `/` in the provided string
    * 
    * Example:
    *
    *    utl.chgP2('http://localhost:4200/dumpobj/key@base@one')
    *
    * @param {String} url
    * @public
    */
    chgP2: function (data) {
        let cp = data.lastIndexOf('@');
        if (cp > -1) {
            return `${data.substring(0, cp)}/${data.substring(cp + 1)}`;
        } else {
            return data;
        }
    },
    // End: Git issue #9 fix


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
    // build date and time string 
    //------------------------------------------------------------------------------
    dirDate: function () {
        var dStr = new Date().toISOString();
        var fp;
        fp = dStr.indexOf('T');
        if (fp > -1) {
            dStr = dStr.substring(0, fp) + '-' + dStr.substring(fp + 1);
        }
        fp = dStr.indexOf(':');
        if (fp > -1) {
            dStr = dStr.substring(0, fp) + 'h-' + dStr.substring(fp + 1);
        }
        fp = dStr.indexOf(':');
        if (fp > -1) {
            dStr = dStr.substring(0, fp) + 'm-' + dStr.substring(fp + 1);
        }

        fp = dStr.indexOf('.');
        if (fp > -1) {
            dStr = dStr.substring(0, fp) + 's';
        }
        return dStr;
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
    // read cluster directory
    //------------------------------------------------------------------------------
    getClusterDir: function () {
        var cwd;
        if (vpk.snapshotDir !== "") {
            cwd = vpk.snapshotDir;
        } else {
            cwd = process.cwd();
            cwd = cwd + '/cluster'
        }
        var dirs = [];
        var content;
        var item;
        //var path
        try {
            content = fs.readdirSync(cwd);
            for (var i = 0; i < content.length; i++) {
                // build file name to process
                item = fsPath.join(cwd, content[i]);
                // is this item a directory
                if (fs.statSync(item).isDirectory()) {
                    dirs.push(item)
                }
            }
        } catch (err) {
            logIt(`vpkUTL056 - Error reading cluster directory, message: ${err}`);
        }
        return dirs;
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
    // create a directory 
    //------------------------------------------------------------------------------
    makedir: function (dir) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
                logIt(`vpkUTL158 - Created directory: ${dir}`);
            }
            return 'PASS';
        } catch (e) {
            logIt(`vpkUTL160 - Failed to create directory: ${dir} error message: ${e}`);
            return 'FAIL';
        }
    },


    //------------------------------------------------------------------------------
    // read and load the explains file
    //------------------------------------------------------------------------------
    processExplains: function () {
        if (vpk.dirname === '') {
            return;
        }
        let fn = fsPath.join(vpk.dirname, 'explains.json');
        let found = false;
        try {
            if (fs.existsSync(fn)) {
                found = true;
            }
            if (found) {
                //
                let content = fs.readFileSync(fn);
                content = content.toString();
                content = JSON.parse(content);
                vpk.explains = content;
                logIt(`vpkUTL373 - Explains loaded`);
                return;
            }
        } catch (err) {
            logIt(`vpkUTL374 - Failed to read : ${fn} message: ${err}`);
            return;
        }

        if (typeof vpk.explains !== 'undefined') {
            try {
                let keys = Object.keys(vpk.explains);
                let doc = '';
                if (keys.length > 0) {
                    doc = JSON.stringify(vpk.explains)
                    fs.writeFileSync(fn, doc);
                    logIt(`vpkUTL373 - Created explains file ${fn}`);
                }
            } catch (e) {
                logIt(`vpkUTL375 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt(`vpkUTL376 - No vpk.explains available to save`);
            return;
        }
    },


    //------------------------------------------------------------------------------
    // read and load the version file
    //------------------------------------------------------------------------------
    processVersion: function () {
        if (vpk.version === '') {
            return;
        }
        let fn = fsPath.join(vpk.dirname, 'version.json');
        let found = false;
        try {
            if (fs.existsSync(fn)) {
                found = true;
            }
            if (found) {
                //
                let content = fs.readFileSync(fn);
                content = content.toString();
                content = JSON.parse(content);
                vpk.version = content;
                logIt(`vpkUTL473 - Version information loaded`);
                return;
            }
        } catch (err) {
            logIt(`vpkUTL474 - Failed to read : ${fn} message: ${err}`);
            return;
        }

        if (typeof vpk.version !== 'undefined') {
            try {
                let doc = JSON.stringify(vpk.version)
                fs.writeFileSync(fn, doc);
                logIt(`vpkUTL373 - Created version file ${fn}`);
            } catch (e) {
                logIt(`vpkUTL375 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt(`vpkUTL376 - No vpk.explains available to save`);
            return;
        }
    },


    //------------------------------------------------------------------------------
    // read configuration file
    //------------------------------------------------------------------------------
    readConfig: function () {
        var status = 'OK';
        let fn = fsPath.join(process.cwd(), 'vpkconfig.json');
        logIt(`vpkUTL380 - Using configuration file: ${fn}`);

        try {
            var contents = fs.readFileSync(fn, "utf8");
            if (contents !== '') {
                // populate vpk object with config parms
                try {
                    vpk.configFile = JSON.parse(contents);
                    if (typeof vpk.configFile.defaults === 'undefined') {
                        vpk.configFile.defaults = {};
                        vpk.configFile.defaults.managedFields = false;
                        vpk.configFile.defaults.statusSection = false;
                    }

                    //check for custom snapshot directory
                    if (typeof vpk.configFile.snapshotDir === 'undefined') {
                        vpk.configFile.snapshotDir = "";
                    }

                    vpk.defaultSettings = vpk.configFile.defaults;

                    // Determine if startup parameter was provided, if found
                    // do not use snapshotDir from config file.
                    if (vpk.snapshotDir === 'none') {
                        vpk.snapshotDir = vpk.configFile.snapshotDir
                        if (typeof vpk.configFile.snapshotDir !== 'undefined') {
                            if (vpk.configFile.snapshotDir !== '') {
                                if (!fs.existsSync(vpk.configFile.snapshotDir)) {
                                    logIt(`vpkUTL381 - VPK snapshot directory does not exist: ${vpk.configFile.snapshotDir}`)
                                } else {
                                    logIt(`vpkUTL382 - vpkconfig.json parameter is being used for snapshot directory: ${vpk.configFile.snapshotDir}`);
                                }
                            } else {
                                logIt(`vpkUTL383 - VPK snapshot directory will use ${process.cwd()}/cluster`)
                            }
                        }
                    } else {
                        logIt(`vpkUTL384 - VPK snapshot directory startup parameter is being used: ${vpk.snapshotDir}`)
                    }
                    status = 'OK';
                } catch (e) {
                    logIt(`vpkUTL385 - VPK config file: ${fn} has invalid format, message: ${e}`);
                    logIt(`vpkUTL385 - Stack: ${e.stack}`);
                    status = 'FAIL';
                }
            } else {
                vpk.configFile = {};
                vpk.configFile.defaults = {};
                vpk.configFile.defaults.managedFields = false;
                vpk.configFile.defaults.statusSection = false;
                vpk.configFile.snapshotDir = "";
                logIt(`vpkUTL386 - VpK config is empty. Add parameters to file: vpkconfig.json`)
                this.saveConfigFile();
                status = 'OK';
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                vpk.configFile = {};
                vpk.configFile.defaults = {};
                vpk.configFile.defaults.managedFields = false;
                vpk.configFile.defaults.statusSection = false;
                vpk.configFile.snapshotDir = "";
                logIt(`vpkUTL387 - VPK config file: ${fn} does not exist, creating file`);
                this.saveConfigFile();
                status = 'OK';
            } else if (err.code === 'EACCES') {
                logIt(`vpkUTL388 - VPK config file: ${fn} has Permission error(s)`);
                status = 'FAIL';
            } else {
                logIt(`vpkUTL389 - VPK config file: ${fn} has Unknown Error(s)`);
                status = 'FAIL';
            }
        }
        return status;
    },


    //------------------------------------------------------------------------------
    // read the license file and put content in memory var
    //------------------------------------------------------------------------------
    readLicenseFile: function () {
        let base = process.cwd();
        let fn = base + '/LICENSE';
        let found = false;
        try {
            if (fs.existsSync(fn)) {
                found = true;
            }
            if (found) {
                let content = fs.readFileSync(fn);
                content = content.toString();
                vpk.LICENSE = content;
                return;
            } else {
                vpk.LICENSE = 'Open source software, MIT license';
            }
        } catch (err) {
            logIt(`vpkUTL834 - Failed to read LICENSE file, message: ${err}`);
            return;
        }
    },


    //------------------------------------------------------------------------------
    // save a k8 resource file, files end with yaml but are json content
    //------------------------------------------------------------------------------
    readResourceFile: function (fn, comp) {
        try {
            let key;
            key = fn.split('.');
            key = parseInt(key[0]);
            let content = vpk.k8sResc[key]

            // check if managedFields should be removed
            if (typeof vpk.defaultSettings.managedFields !== 'undefined') {
                if (vpk.defaultSettings.managedFields === false) {
                    if (typeof content.metadata.managedFields !== 'undefined') {
                        delete content.metadata.managedFields;
                    }
                }
            }
            // check if status section should be removed
            if (typeof vpk.defaultSettings.statusSection !== 'undefined') {
                if (vpk.defaultSettings.statusSection === false) {
                    if (typeof content.status !== 'undefined') {
                        delete content.status;
                    }
                }
            }
            return content;
        } catch (err) {
            logIt(`vpkUT324 - Failed to read : ${fn} message: ${err}`);
            return '';
        }
    },


    //------------------------------------------------------------------------------
    // remove a directory 
    //------------------------------------------------------------------------------
    remdir: function (dir) {
        try {
            // remove the directory if it already exists;
            if (fs.existsSync(dir)) {
                fs.unlinkSync(dir);
            }
            // create the directory
            fs.mkdirSync(dir);
            logIt(`vpkUTL164 - Creating directory: ${dir}`);
        } catch (err) {
            logIt(`vpkUTL155 - Unable to delete resource: ${dir} error message: ${err}`);
        }
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
    // save the user config file contents
    //------------------------------------------------------------------------------
    saveConfigFile: function (data) {
        let fn = fsPath.join(process.cwd(), 'vpkconfig.json')

        try {
            if (typeof data !== 'undefined') {
                if (typeof data.managedFields !== 'undefined') {
                    vpk.configFile.defaults.managedFields = data.managedFields;
                }
                if (typeof data.statusSection !== 'undefined') {
                    vpk.configFile.defaults.statusSection = data.statusSection;
                }

            }
            var doc = {
                'defaults': vpk.configFile.defaults,
                'snapshotDir': vpk.configFile.snapshotDir,
            };
            doc = JSON.stringify(doc, null, 4);
            fs.writeFileSync(fn, doc);
            return { "status": "PASS", "message": "Successfully saved " };
        } catch (e) {
            logIt(`vpkUT484 - Error saving user configuration file, message: ${e}`);
            return { "status": "FAIL", "message": "Failed saving: " + fn + " message: " + e };
        }
    },


    //------------------------------------------------------------------------------
    // save the yaml file name
    //------------------------------------------------------------------------------
    saveFileName: function (fn, fnum) {
        // save file name info
        if (typeof vpk.fileNames[fnum] === 'undefined') {
            vpk.fileNames[fnum] = fn;
        }
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
            logIt(`vpkUTL086 - Error sorting, message: ${err.stack}`);
        }
        return newJson;
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
