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
import vpkSpan from '../lib/vpkSpan.js';
import fs from 'fs-extra';
import fsPath from 'path';

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
    // format byte amount appending alpha category
    //------------------------------------------------------------------------------
    formatDir: function (dir) {
        let os = process.platform;
        let nd = '';
        let c = '';
        if (os.startsWith('win')) {
            for (let i = 0; i < dir.length; i++) {
                c = dir.substring(i, i);
                if (c === '/') {
                    nd = nd + '\\';
                } else {
                    nd = nd + c;
                }
            }
        } else {
            for (let i = 0; i < dir.length; i++) {
                c = dir.substring(i, i + 1);
                if (c === '\\') {
                    nd = nd + '/';
                } else {
                    nd = nd + c;
                }
            }
        }
        return nd;
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
            // cwd = cwd + '/cluster'

            var os = process.platform;
            if (os.startsWith('win')) {
                cwd = cwd + '\\cluster\\';
            } else {
                cwd = cwd + '/cluster/';
            }

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
    // read and load the version file
    //------------------------------------------------------------------------------
    processComponents: function () {
        if (vpk.kubeSystemComponents === '') {
            return;
        }
        let fn = fsPath.join(vpk.dirname, 'components.json');
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
                if (typeof content.components !== 'undefined') {
                    vpk.kubeSystemComponents = content.components;
                } else {
                    vpk.kubeSystemComponents = [];
                }
                vpk.stats['k8sComponents'] = content;
                logIt(`vpkUTL493 - Components information loaded`);
                return;
            }
        } catch (err) {
            logIt(`vpkUTL494 - Failed to read : ${fn} message: ${err}`);
            return;
        }

        if (typeof vpk.kubeSystemComponents !== 'undefined') {
            try {
                let content = {};
                if (typeof vpk.kubeSystemComponents !== 'undefined') {
                    content.components = vpk.kubeSystemComponents.components;
                } else {
                    content.components = [];
                }
                let doc = JSON.stringify(content)
                fs.writeFileSync(fn, doc);
                logIt(`vpkUTL393 - Created components file ${fn}`);
            } catch (e) {
                logIt(`vpkUTL395 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt(`vpkUTL396 - No vpk.kubeSystemComponents available to save`);
            return;
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
                logIt(`vpkUTL373 - Explains information loaded`);
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
    processReadyz: function () {
        if (vpkSpan.readyz === '') {
            return;
        }
        if (vpk.dirname === '') {
            return;
        }

        let fn = fsPath.join(vpk.dirname, 'readyz.json');
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
                if (typeof content !== 'undefined') {
                    vpkSpan.readyz = content;
                } else {
                    vpkSpan.readyz = [];
                }
                vpk.stats['k8sReadyz'] = content;
                logIt(`vpkUTL493 - Readyz information loaded`);
                return;
            }
        } catch (err) {
            logIt(`vpkUTL494 - Failed to read : ${fn} message: ${err}`);
            return;
        }

        if (typeof vpkSpan.readyz !== 'undefined') {
            try {
                let content = {};
                if (vpkSpan.readyz.length > 0) {
                    content = vpkSpan.readyz;
                } else {
                    content = [];
                }

                let doc = JSON.stringify(content)
                fs.writeFileSync(fn, doc);
                logIt(`vpkUTL393 - Created readyz file ${fn}`);
            } catch (e) {
                logIt(`vpkUTL395 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt(`vpkUTL396 - No vpk.readyz available to save`);
            return;
        }
    },

    //------------------------------------------------------------------------------
    // read and load the version file
    //------------------------------------------------------------------------------
    processVersion: function () {
        // if (vpk.version === '') {
        //     return;
        // }
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
                vpk.stats['k8sVersion'] = content;
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
                // Populate global vpk object with vpkconfig.json provided parms
                try {
                    vpk.configFile = JSON.parse(contents);
                    // Validate 'defaults' parameter
                    if (typeof vpk.configFile.defaults === 'undefined') {
                        vpk.configFile.defaults = {};
                        vpk.configFile.defaults.managedFields = false;
                        vpk.configFile.defaults.statusSection = false;
                        vpk.configFile.defaults.redactSecrets = false;
                        vpk.configFile.defaults.reloadAction = false;
                        vpk.configFile.defaults.lightTheme = true;
                        vpk.configFile.defaults.clusterBackground = 'grey';
                    }
                    if (typeof vpk.configFile.snapshotDir === 'undefined') {
                        vpk.configFile.snapshotDir = "";
                    }
                    // Save validated parameters to new global variable
                    vpk.defaultSettings = vpk.configFile.defaults;
                    let useDir = "";
                    let dirFromStartup;
                    let dirFromConfig;

                    // Check if the "-s" startup parameter snapshot directory exists
                    // 'none' indicates the parameter was not provided 
                    if (vpk.snapshotDir !== 'none') {
                        dirFromStartup = fs.existsSync(vpk.snapshotDir);
                        if (dirFromStartup === false) {
                            logIt(`vpkUTL383 - Startup parameter "-s" for snapshot directory does not exist: ${vpk.snapshotDir}`)
                        }
                    } else {
                        dirFromStartup = false;
                    }

                    // Check if the vpkconfig.json parameter was provided and check if snapshot directory exists
                    if (vpk.configFile.snapshotDir !== "") {
                        dirFromConfig = fs.existsSync(vpk.configFile.snapshotDir);
                        if (dirFromConfig === false) {
                            logIt(`vpkUTL385 - vpkconfig.json provided parameter for snapshot directory does not exist: ${vpk.configFile.snapshotDir}`)
                        }
                    } else {
                        dirFromConfig = false;
                    }

                    // Set what directory will be used
                    // check one
                    if (dirFromStartup === true) {
                        // Use this value as the snapshot directory
                        useDir = vpk.snapshotDir;
                        logIt(`vpkUTL387 - Snapshot directory from startup parameter will be used: ${vpk.snapshotDir}`)
                    }
                    // Check two
                    if (useDir === "" && dirFromConfig === true) {
                        // Use this value as the snapshot directory
                        useDir = vpk.configFile.snapshotDir;
                        logIt(`vpkUTL389 - Snapshot directory from vpkconfig.json parameter will be used: ${vpk.configFile.snapshotDir}`)
                    }
                    // Use default
                    if (useDir === "") {
                        let os = process.platform;
                        if (os.startsWith('win')) {
                            useDir = `${process.cwd()}\\cluster`;
                        } else {
                            useDir = `${process.cwd()}/cluster`;
                        }

                        //useDir = `${process.cwd()}/cluster`;
                        logIt(`vpkUTL384 - Default snapshot directory will be used: ${useDir}`)
                    }

                    vpk.snapshotDir = useDir;
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
                vpk.configFile.defaults.redactSecrets = false;
                vpk.configFile.defaults.reloadAction = false;
                vpk.configFile.defaults.lightTheme = true;
                vpk.configFile.defaults.clusterBackground = 'grey';
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
                vpk.configFile.defaults.redactSecrets = false;
                vpk.configFile.defaults.reloadAction = false;
                vpk.configFile.defaults.lightTheme = true;
                vpk.configFile.defaults.clusterBackground = 'grey';
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
            return 'Open source software, MIT license';
        }
    },


    //------------------------------------------------------------------------------
    // save a k8 resource file, files end with yaml but are json content
    //------------------------------------------------------------------------------
    readResourceFile: function (fn, comp) {
        let key;
        try {
            if (fn.indexOf('.')) {
                key = fn.split('.');
                key = parseInt(key[0]);
            } else {
                key = fn;
            }
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
            logIt(`vpkUTL324 - Failed to read : ${fn} message: ${err}`);
            return '';
        }
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
            logIt(`vpkUTL155 - Unable to create snapshot directory: ${dir} error message: ${err}`);
            logIt(`vpkUTL155 - ${err.stack}`);
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
                if (typeof data.redactSecrets !== 'undefined') {
                    vpk.configFile.defaults.redactSecrets = data.redactSecrets;
                }
                if (typeof data.reloadAction !== 'undefined') {
                    vpk.configFile.defaults.reloadAction = data.reloadAction;
                }
                if (typeof data.lightTheme !== 'undefined') {
                    vpk.configFile.defaults.lightTheme = data.lightTheme;
                }
                if (typeof data.clusterBackground !== 'undefined') {
                    vpk.configFile.defaults.clusterBackground = data.clusterBackground;
                }
            }

            if (typeof vpk.clusterFilters.clusterFilterNodes !== 'undefined') {
                vpk.configFile.clusterFilters = vpk.clusterFilters;
            }

            let doc = {
                'defaults': vpk.configFile.defaults,
                'snapshotDir': vpk.configFile.snapshotDir,
                'clusterFilters': vpk.configFile.clusterFilters
            };

            // Convert to string before writing to file
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




        try {
            let sTmp = startTime.split('T');
            let eTmp = endTime.split('T');

            let sDay = sTmp[0].split('-');
            let sTime = sTmp[1].split(':');

            let eDay = eTmp[0].split('-');
            let eTime = eTmp[1].split(':');

            let sYYYY = sDay[0];
            let sMM = sDay[1];
            let sDD = sDay[2];
            let sHr = sTime[0];
            let sMin = sTime[1];
            let sSec = sTime[2].substring(0, 2);

            let eYYYY = eDay[0];
            let eMM = eDay[1];
            let eDD = eDay[2];
            let eHr = eTime[0];
            let eMin = eTime[1];
            let eSec = eTime[2].substring(0, 2);

            let totalSeconds = 0;
            let seconds = 0;

            let start_date;
            let end_date;

            if (sTmp[0] !== eTmp[0]) {
                // First day
                start_date = new Date(sYYYY, sMM, sDD, sHr, sMin, sSec)
                end_date = new Date(sYYYY, sMM, sDD, 23, 59, 59)
                seconds = (end_date - start_date) / 1000;
                timeDiffotalSeconds = seconds;
                // Second day
                start_date = new Date(eYYYY, eMM, eDD, 0, 0, 1)
                end_date = new Date(eYYYY, eMM, eDD, eHr, eMin, eSec)
                totalSeconds = (end_date - start_date) / 1000;
                seconds = (end_date - start_date) / 1000;
                totalSeconds = evtTotalSeconds + seconds;
            } else {
                start_date = new Date(sYYYY, sMM, sDD, sHr, sMin, sSec)
                end_date = new Date(eYYYY, eMM, eDD, eHr, eMin, eSec)
                seconds = (end_date - start_date) / 1000;
                totalSeconds = seconds;
            }
            return totalSeconds;
        } catch (err) {
            logIt(`vpkUTL089 - Error calculating time duration, message: ${err}`);
            logIt(`vpkUTL089 - Error stack: ${err.stack}`);
            return 1;
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
