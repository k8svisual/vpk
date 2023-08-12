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

/*----------------------------------------------------------
Process snapshot directory 
*/
'use strict';

let vpk = require('./vpk');
const utl = require('./utl');
const fs = require('fs');
const vpkReset = require('./vpkReset');
const fileio = require('./fileio');
const owner = require('../lib/ownerRef');
const kube = require('../lib/kube');
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

    if (vpk.fCnt > 0) {
        saveStatMsg('dl', ' ');
        saveStatMsg('Dirs read', vpk.dCnt);
        saveStatMsg('Files read', vpk.fCnt);
        saveStatMsg('Valid yaml', vpk.yCnt);
        saveStatMsg('Skipped', vpk.xCnt);
        saveStatMsg('dl', ' ');
    }

    if (vpk.fCnt > 0) {
        if (typeof vpk.configFile.xrefNames !== 'undefined') {
            var keys = Object.keys(vpk.configFile.xrefNames);
            let key;
            for (let i = 0; i < keys.length; i++) {
                key = 'xRef' + keys[i]
                if (typeof vpk[key] !== 'undefined') {
                    saveStatMsg('Located xref items for: ' + keys[i], ' ');
                } else {
                    saveStatMsg('Did not locate xref items for: ' + keys[i], ' ');
                }
            }
            saveStatMsg('dl', ' ');
        }
        saveStatMsg('Binding subjects not defined', vpk.subjectMissingCnt);
        saveStatMsg('dl', ' ');
    }

    owner.chkUidChain();

    if (typeof vpk.childUids !== 'undefined') {
        saveStatMsg('OwnerRef Single-level', vpk.cLvl)
        saveStatMsg('OwnerRef Double-level', vpk.pLvl)
        saveStatMsg('OwnerRef Triple-level', vpk.gpLvl)
        saveStatMsg('OwnerRef Quad-level', vpk.ggpLvl)
        saveStatMsg('OwnerRef Penta-level', vpk.gggpLvl)
        saveStatMsg('dl', ' ');
    }

    if (typeof vpk.spaceReqSC !== 'undefined') {
        let keys = Object.keys(vpk.spaceReqSC);
        let size;
        for (let i = 0; i < keys.length; i++) {
            size = utl.formatBytes(vpk.spaceReqSC[keys[i]].space);
            saveStatMsg('StorageClass: ' + keys[i], size)
        }
        saveStatMsg('dl', ' ');
    }

    utl.processExplains();
    // delete the arrays no longer needed
}

//------------------------------------------------------------------------------
// reload snapshot directory 
//------------------------------------------------------------------------------
var processDir = function (dir, client) {
    if (fs.existsSync(dir)) {
        utl.logMsg('vpkUTL311 - Using snapshot: ' + vpk.startDir);
        vpk.resetReq = true;
        utl.resetVpkObject();
        vpkReset.resetAll();
        vpk.dirFS.push(dir);
        vpk.startDir = dir;
        vpk.validDir = true;
        fileio.checkDir(client);
        stats();
    } else {
        vpk.startDir = dir;
        vpk.validDir = false;
    }
}

// save extracted resource JSON to file for snapshot
// Note: The file contents are JSON but the file
// is named with .yaml
var write2 = function (yf, dynDir, client) {
    utl.logMsg('vpkSNP606 - Write files invoked');
    var rdata = {};
    rdata.status = 'PASS';
    rdata.message = 'OK';

    try {
        utl.remdir(dynDir);
        var mkresult = utl.makedir(dynDir);
        if (mkresult === 'PASS') {
            var fnum = 1000;
            var fn;
            var oldKind = '@startUp';
            var input;
            var cnt = 0;
            for (var i = 0; i < yf.items.length; i++) {
                input = yf.items[i];
                if (typeof input.kind !== 'undefined') {
                    if (oldKind !== input.kind) {
                        utl.logMsg('vpkSNP617 - Kind: ' + oldKind + ' fnum: ' + fnum)
                        oldKind = input.kind;
                    }
                }
                input = JSON.stringify(input, null, 4);
                fnum++;
                fn = dynDir + '/' + 'config' + fnum + '.yaml';
                fs.writeFileSync(fn, input);
                cnt++
                utl.saveFileName(fn, fnum)
            }
            utl.logMsg('vpkSNP603 - Created ' + cnt + ' yaml files');

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
        rdata = write2(vpk.rtn, dynDir, client);
    }
}


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    // process: function () {
    //     processDir();
    // },

    reload: function (dir, client) {
        processDir(dir, client);
    },

    // Get the K8 resource type and emit message after processing
    getK: async function (data, kga, client, dynDir) {
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
            msg = 'Processed count ' + curK + ' of ' + hl + ' - Resource kind: <span class="vpkcolor">' + kind + '</span>';
            rtn = { 'msg': msg, 'current': curK, 'max': hl }
            client.emit('getKStatus', rtn);
        }
        //logout of current K8s environment
        //kube.logout(data);
        returnData(client, dynDir);
    }

};