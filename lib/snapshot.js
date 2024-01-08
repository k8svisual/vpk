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
Process snapshot directory 
*/
'use strict';

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import vpkReset from '../lib/vpkReset.js';
import fileio from '../lib/fileio.js';
import owner from '../lib/ownerRef.js';
import kube from '../lib/kube.js';

import fs from 'fs-extra';
import path from 'path';

const dashline = '----------------------------------------------------------------------';
let statMessages = [];

var saveStatMsg = function (msg, cnt) {
    if (msg === 'dl') {
        utl.logMsg(dashline);
    } else {
        if (cnt === 0) {
            return;
        }
        //           1234567890123456789012345678901234567890123456789012345678901234567890
        msg = msg + '                                                            ';
        msg = msg.substring(0, 60)

        utl.logMsg(msg + cnt);
        statMessages.push(msg + '::' + cnt);
    }
}


//------------------------------------------------------------------------------
// Process the snapshot directory
//------------------------------------------------------------------------------
var stats = function () {
    statMessages = [];
    let info;

    if (vpk.fCnt > 0) {
        //saveStatMsg('dl', ' ');
        saveStatMsg('Dirs read', vpk.dCnt);
        saveStatMsg('Files read', vpk.fCnt);
        saveStatMsg('Valid yaml', vpk.yCnt);
        saveStatMsg('Skipped', vpk.xCnt);
        //saveStatMsg('dl', ' ');
    }

    if (vpk.fCnt > 0) {
        saveStatMsg('vpkSNP202 - Binding subjects not defined', vpk.subjectMissingCnt);
        //saveStatMsg('dl', ' ');
    }

    // owner.chkUidChain();

    if (typeof vpk.childUids !== 'undefined') {
        info = []
        saveStatMsg('vpkSNP201 - OwnerRef Single-level', vpk.cLvl)
        saveStatMsg('vpkSNP201 - OwnerRef Double-level', vpk.pLvl)
        saveStatMsg('vpkSNP201 - OwnerRef Triple-level', vpk.gpLvl)
        saveStatMsg('vpkSNP201 - OwnerRef Quad-level', vpk.ggpLvl)
        saveStatMsg('vpkSNP201 - OwnerRef Penta-level', vpk.gggpLvl)
        //saveStatMsg('dl', ' ');

        info.push(`Single-level: ${vpk.cLvl}`)
        info.push(`Double-level: ${vpk.pLvl}`)
        info.push(`Triple-level: ${vpk.gpLvl}`)
        info.push(`Quad-level: ${vpk.ggpLvl}`)
        info.push(`Penta-level: ${vpk.gggpLvl}`)
        vpk.stats['ownerRef'] = info;
    }

    if (typeof vpk.spaceReqSC !== 'undefined') {
        let keys = Object.keys(vpk.spaceReqSC);
        let size;
        info = [];
        for (let i = 0; i < keys.length; i++) {
            size = utl.formatBytes(vpk.spaceReqSC[keys[i]].space);
            saveStatMsg('vpkSNP202 - StorageClass: ' + keys[i], size)
            info.push({ 'storageClass': keys[i], 'size': size })
        }
        //saveStatMsg('dl', ' ');
        vpk.stats['storageClass'] = info;
    }

    utl.processExplains();
    utl.processVersion();

}

//------------------------------------------------------------------------------
// reload snapshot directory 
//------------------------------------------------------------------------------
var processDir = function (dir, client) {
    if (fs.existsSync(dir)) {
        utl.logMsg('vpkSNP311 - Using snapshot: ' + vpk.startDir);
        vpk.resetReq = true;
        utl.resetVpkObject();
        let holdVer = vpk.version;
        vpkReset.resetAll();
        vpk.version = holdVer;
        vpk.dirFS.push(dir);
        vpk.startDir = dir;
        vpk.validDir = true;
        checkForOldData(dir)
        fileio.checkDir(client);
        vpk.dirname = dir;
        stats();
    } else {
        vpk.startDir = dir;
        vpk.validDir = false;
    }
}

var checkForOldData = function (directoryPath) {
    let startTime;
    let endTime;
    let timeElapsed;
    try {
        vpk.k8sResc = {};
        const jsonFile = path.join(directoryPath, 'vpk.snapshot.json');
        if (fs.existsSync(jsonFile)) {
            startTime = new Date();
            utl.logMsg('vpkSNP901 - Located snapshot json file');
            let snapshotContents = fs.readFileSync(jsonFile, 'utf-8');
            vpk.k8sResc = JSON.parse(snapshotContents);
            snapshotContents = null;
            endTime = new Date();
            timeElapsed = endTime - startTime;
            utl.logMsg('vpkSNP603 - Time to load snapshot into memory: ' + timeElapsed + ' milliseconds');

            return
        }

        utl.logMsg('vpkSNP901 - Processing for old snapshot yaml files');
        fs.readdirSync(directoryPath).forEach(file => {
            if (file.startsWith('config') && file.endsWith('.yaml')) {
                const configFile = path.join(directoryPath, file);
                const integerPart = parseInt(file.substring(6, file.length - 5)); // Extract the integer from the filename
                const fileContents = fs.readFileSync(configFile, 'utf-8');
                try {
                    const parsedContents = JSON.parse(fileContents);
                    vpk.k8sResc[integerPart] = parsedContents;
                } catch (error) {
                    utl.logMsg('vpkSNP902 - Error parsing JSON from file' + configFile + ': ' + error.message);
                }
            }
        });

        const snapshotFilePath = path.join(directoryPath, 'vpk.snapshot.json');
        const jsonString = JSON.stringify(vpk.k8sResc, null, 0); // Adding 2 spaces for indentation

        fs.writeFileSync(snapshotFilePath, jsonString, 'utf-8');
        utl.logMsg('vpkSNP902 - Snapshot saved to ' + snapshotFilePath);

        removeOldFiles(directoryPath)

        return
    } catch (err) {
        utl.logMsg('vpkSNP001 - Error - Reading directory, message: = ' + err);
        // clear the file array since there is an error and not able to process
        vpk.baseFS = [];
    }
}

var removeOldFiles = function (directoryPath) {
    try {
        let cnt = 0
        utl.logMsg('vpkSNP911 - Deleting old snapshot yaml files');
        fs.readdirSync(directoryPath).forEach(file => {
            if (file.startsWith('config') && file.endsWith('.yaml')) {
                const filePath = path.join(directoryPath, file);
                try {
                    fs.unlinkSync(filePath);
                    cnt++
                } catch (error) {
                    utl.logMsg('vpkSNP912 - Error deleting JSON from file' + filePath + ': ' + error.message);
                }
            }
        });
        utl.logMsg('vpkSNP914 - Removed ' + cnt + ' old .yaml files');
    } catch (err) {
        utl.logMsg('vpkSNP913 - Remove old files error, message: = ' + err);
        return
    }
}

// save extracted resource JSON to file for snapshot
// Note: The file contents are JSON but the file
// is named with .yaml
var saveK8sData = function (dynDir, client) {
    utl.logMsg('vpkSNP606 - Write files invoked');
    var rdata = {};
    rdata.status = 'PASS';
    rdata.message = 'OK';
    let startTime;
    let endTime;
    let timeElapsed;


    try {
        utl.remdir(dynDir);
        var mkresult = utl.makedir(dynDir);
        if (mkresult === 'PASS') {
            vpk.k8sResc = {};
            var fnum = 1000;
            var fn;
            var oldKind = '@startUp';
            var input;
            var cnt = 0;
            var i;
            for (i = 0; i < vpk.rtn.items.length; i++) {
                input = vpk.rtn.items[i];
                if (typeof input.kind !== 'undefined') {
                    if (oldKind !== input.kind) {
                        utl.logMsg('vpkSNP609 - Kind: ' + oldKind + ' fnum: ' + fnum)
                        oldKind = input.kind;
                    }
                }
                // Increment fnum and add K8s recource to object
                fnum++;
                vpk.k8sResc[fnum] = input
            }
            i++;
            utl.logMsg('vpkSNP607 - Created memory map for ' + i + ' K8s resources');


            // Save K8s resource data to snapshot directory
            startTime = new Date();
            fn = dynDir + '/' + 'vpk.snapshot.json';
            fs.writeFileSync(fn, JSON.stringify(vpk.k8sResc));
            endTime = new Date();
            timeElapsed = endTime - startTime;
            utl.logMsg('vpkSNP608 - Time to load snapshot file to memory: ' + timeElapsed + ' milliseconds');


            // read and load newly created files for snapshot
            processDir(dynDir, client);

        } else {
            utl.logMsg('vpkSNP605 - Unable to create directory: ' + dynDir);
            rdata.status = 'FAIL';
            rdata.message = 'vpkSNP605 - Unable to create directory: ' + dynDir;
        }
    } catch (err) {
        utl.logMsg('vpkSNP606 - Error creating directory: ' + dynDir + ' message: ' + err);
        rdata.status = 'FAIL';
        rdata.message = 'vpkSNP606 - Error creating directory: ' + dynDir + ' message: ' + err;
        return rdata;
    }
    delete vpk.rtn
    return rdata;
}

var returnData = function (client, dynDir) {
    var rdata = {};
    if (vpk.rtn === 'FAIL') {
        rdata.status = 'FAIL';
        rdata.message = 'Failed to retrieve data, check log messages';
    } else {
        rdata = saveK8sData(dynDir, client);
    }
}



//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    reload: function (dir, client) {
        let startT = utl.getPTime();
        utl.logMsg('vpkSNP001 - snapshot reload invoked');
        processDir(dir, client);
        let stopT = utl.getPTime();
        utl.showTimeDiff(startT, stopT, 'snapshot.reload()')
    },

    // Get the K8s resource type and emit message after processing
    getK: async function (data, kga, client, dynDir) {

        let startT = utl.getPTime();
        utl.logMsg('vpkSNP001 - snapshot getK invoked');

        var kind;
        var tmp;
        var msg;
        var hl;
        hl = kga.length;
        var curK = 0;
        var rtn = '';

        // initialize global storage to be empty
        vpk.rtn = { 'items': [] };
        kga.sort();
        for (var k = 0; k < kga.length; k++) {
            await kube.getKubeInfo(data, kga[k], client)
            tmp = kga[k];
            kind = tmp.substring(0, tmp.length - 2);
            curK++;
            msg = 'Processed count ' + curK + ' of ' + hl + ' - Resource kind: <span class="vpkblue">' + kind + '</span>';
            rtn = { 'msg': msg, 'current': curK, 'max': hl }
            client.emit('getKStatus', rtn);
        }

        msg = '<span class="vpkblue">Processing completed</span>';
        rtn = { 'msg': msg }
        client.emit('getsDone', rtn)

        returnData(client, dynDir);

        let stopT = utl.getPTime();
        utl.showTimeDiff(startT, stopT, 'snapshot.getK()')
    }

};