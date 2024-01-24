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
Common file handling functions
*/

'use strict';

import vpk from './vpk.js';
import vpkSpan from './vpkSpan.js';
import fs from 'fs-extra';
import fsPath from 'path';

// local routine to output message to console.
const logIt2 = function (msg) {
    console.log(`${new Date().toLocaleString()} :: ${msg}`);
};


//------------------------------------------------------------------------------
// exported common routines
//------------------------------------------------------------------------------
export default {

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
            logIt2(`vpkFHL056 - Error reading cluster directory, message: ${err}`);
        }
        return dirs;
    },


    //------------------------------------------------------------------------------
    // create a directory 
    //------------------------------------------------------------------------------
    makedir: function (dir) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
                logIt2(`vpkFHL158 - Created directory: ${dir}`);
            }
            return 'PASS';
        } catch (e) {
            logIt2(`vpkFHL160 - Failed to create directory: ${dir} error message: ${e}`);
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
                logIt2(`vpkFHL493 - Components information loaded`);
                return;
            }
        } catch (err) {
            logIt2(`vpkFHL494 - Failed to read : ${fn} message: ${err}`);
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
                logIt2(`vpkFHL393 - Created components file ${fn}`);
            } catch (e) {
                logIt2(`vpkFHL395 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt2(`vpkFHL396 - No vpk.kubeSystemComponents available to save`);
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
                logIt2(`vpkFHL373 - Explains information loaded`);
                return;
            }
        } catch (err) {
            logIt2(`vpkFHL374 - Failed to read : ${fn} message: ${err}`);
            return;
        }

        if (typeof vpk.explains !== 'undefined') {
            try {
                let keys = Object.keys(vpk.explains);
                let doc = '';
                if (keys.length > 0) {
                    doc = JSON.stringify(vpk.explains)
                    fs.writeFileSync(fn, doc);
                    logIt2(`vpkFHL373 - Created explains file ${fn}`);
                }
            } catch (e) {
                logIt2(`vpkFHL375 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt2(`vpkFHL376 - No vpk.explains available to save`);
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
                logIt2(`vpkFHL493 - Readyz information loaded`);
                return;
            }
        } catch (err) {
            logIt2(`vpkFHL494 - Failed to read : ${fn} message: ${err}`);
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
                logIt2(`vpkFHL393 - Created readyz file ${fn}`);
            } catch (e) {
                logIt2(`vpkFHL395 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt2(`vpkFHL396 - No vpk.readyz available to save`);
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
                logIt2(`vpkFHL473 - Version information loaded`);
                return;
            }
        } catch (err) {
            logIt2(`vpkFHL474 - Failed to read : ${fn} message: ${err}`);
            return;
        }

        if (typeof vpk.version !== 'undefined') {
            try {
                let doc = JSON.stringify(vpk.version)
                fs.writeFileSync(fn, doc);
                logIt2(`vpkFHL373 - Created version file ${fn}`);
            } catch (e) {
                logIt2(`vpkFHL375 - Error saving file: ${fn} message: ${e}`);
            }
        } else {
            logIt2(`vpkFHL376 - No vpk.explains available to save`);
            return;
        }
    },


    //------------------------------------------------------------------------------
    // read configuration file
    //------------------------------------------------------------------------------
    readConfig: function () {
        var status = 'OK';
        let fn = fsPath.join(process.cwd(), 'vpkconfig.json');
        logIt2(`vpkFHL380 - Using configuration file: ${fn}`);

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
                            logIt2(`vpkFHL383 - Startup parameter "-s" for snapshot directory does not exist: ${vpk.snapshotDir}`)
                        }
                    } else {
                        dirFromStartup = false;
                    }

                    // Check if the vpkconfig.json parameter was provided and check if snapshot directory exists
                    if (vpk.configFile.snapshotDir !== "") {
                        dirFromConfig = fs.existsSync(vpk.configFile.snapshotDir);
                        if (dirFromConfig === false) {
                            logIt2(`vpkFHL385 - vpkconfig.json provided parameter for snapshot directory does not exist: ${vpk.configFile.snapshotDir}`)
                        }
                    } else {
                        dirFromConfig = false;
                    }

                    // Set what directory will be used
                    // check one
                    if (dirFromStartup === true) {
                        // Use this value as the snapshot directory
                        useDir = vpk.snapshotDir;
                        logIt2(`vpkFHL387 - Snapshot directory from startup parameter will be used: ${vpk.snapshotDir}`)
                    }
                    // Check two
                    if (useDir === "" && dirFromConfig === true) {
                        // Use this value as the snapshot directory
                        useDir = vpk.configFile.snapshotDir;
                        logIt2(`vpkFHL389 - Snapshot directory from vpkconfig.json parameter will be used: ${vpk.configFile.snapshotDir}`)
                    }
                    // Use default
                    if (useDir === "") {
                        let os = process.platform;
                        if (os.startsWith('win')) {
                            useDir = `${process.cwd()}\\cluster`;
                        } else {
                            useDir = `${process.cwd()}/cluster`;
                        }
                        logIt2(`vpkFHL384 - Default snapshot directory will be used: ${useDir}`)
                    }

                    if (typeof vpk.configFile.search !== 'undefined') {
                        if (Array.isArray(vpk.configFile.search)) {
                            logIt2(`vpkFHL417 - Located search count: ${vpk.configFile.search.length}`);
                        }
                    }


                    vpk.snapshotDir = useDir;
                    status = 'OK';
                } catch (e) {
                    logIt2(`vpkFHL385 - VPK config file: ${fn} has invalid format, message: ${e}`);
                    logIt2(`vpkFHL385 - Stack: ${e.stack}`);
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
                logIt2(`vpkFHL386 - VpK config is empty. Add parameters to file: vpkconfig.json`)
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
                logIt2(`vpkFHL387 - VPK config file: ${fn} does not exist, creating file`);
                this.saveConfigFile();
                status = 'OK';
            } else if (err.code === 'EACCES') {
                logIt2(`vpkFHL388 - VPK config file: ${fn} has Permission error(s)`);
                status = 'FAIL';
            } else {
                logIt2(`vpkFHL389 - VPK config file: ${fn} has Unknown Error(s)`);
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
            logIt2(`vpkFHL834 - Failed to read LICENSE file, message: ${err}`);
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
            logIt2(`vpkFHL324 - Failed to read : ${fn} message: ${err}`);
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
            logIt2(`vpkFHL164 - Creating directory: ${dir}`);
        } catch (err) {
            logIt2(`vpkFHL155 - Unable to create snapshot directory: ${dir} error message: ${err}`);
            logIt2(`vpkFHL155 - ${err.stack}`);
        }
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
                'clusterFilters': vpk.configFile.clusterFilters,
                'search': vpk.configFile.search
            };

            // Convert to string before writing to file
            doc = JSON.stringify(doc, null, 4);
            fs.writeFileSync(fn, doc);
            return { "status": "PASS", "message": "Successfully saved " };
        } catch (e) {
            logIt2(`vpkUT484 - Error saving user configuration file, message: ${e}`);
            return { "status": "FAIL", "message": "Failed saving: " + fn + " message: " + e };
        }
    },

    //end of export    
};
