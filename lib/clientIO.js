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
Dump memory http server routes 
*/
'use strict';

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
var search = require('../lib/search');
var hier = require('../lib/hierarchy');
var schematic = require('../lib/svgSchematic');
var xref = require('../lib/xreference');
var storage = require('../lib/storage');
var snapshot = require('../lib/snapshot');
var owner = require('../lib/ownerRef');
var kube = require('../lib/kube');
var sec = require('../lib/security');
var compare = require('../lib/compare');

var YAML = require('js-yaml');
var fs = require('fs');

//----------------------------------------------------------

function getFileContents(data, comp) {
    if (comp === null || comp === '') {
        comp = 'n';
    }
    var result;
    var fileData;
    try {
        if (data.endsWith('/ndf')) {
            fileData = ''
        } else {
            fileData = utl.readResourceFile(data, comp);
            fileData = YAML.safeDump(fileData);
        }
        result = {
            'filePart': '0',
            'lines': fileData,
            'defkey': data
        };
        return result;
    } catch (err) {
        utl.logMsg('vpkCIO057 - Error processing getFileContents, message: ' + err);
        utl.logMsg(err.stack);
    }
}


module.exports = {

    //------------------------------------------------------------------------------
    // define websocket io handlers
    //------------------------------------------------------------------------------

    init: function (io, softwareVersion) {

        io.on('connection', client => {

            client.on('clusterDir', (data) => {
                var which = '0';
                if (typeof data.which !== 'undefined') {
                    which = data.which;
                }
                utl.logMsg('vpkCIO676 - Get snapshot directory request');
                var dirs = utl.getClusterDir();
                utl.logMsg('vpkCIO621 - Emit cluster directory');
                client.emit('clusterDirResult', { 'dirs': dirs, 'which': which });

            });

            client.on('compareSnapshots', (data) => {
                utl.logMsg('vpkCIO676 - Compare snapshots request');
                utl.logMsg('vpkCIO041 - Snap1: ' + data.snap1);
                utl.logMsg('vpkCIO042 - Snap2: ' + data.snap2);
                var result = compare.snapshots(data);
                utl.logMsg('vpkCIO043 - Returning compare results');
                client.emit('compareSnapshotsResults', { 'result': result });

            });

            client.on('connectK8', (data) => {
                utl.logMsg('vpkCIO699 - Connect to k8s request');
                var dynDir = process.cwd();
                var tmpDir = '';
                var dTmp;
                var fsps;
                var kga;           // Kubernetes Get Array
                var ca;
                var msg;
                var slp;
                if (vpk.snapshotDir !== "") {
                    dynDir = vpk.snapshotDir;
                }
                // set the new directory name
                if (typeof data.snapshot_prefix !== 'undefined') {
                    dTmp = data.snapshot_prefix;
                    dTmp.trim();
                    // check for spaces and only use what is before the first space
                    fsps = dTmp.indexOf(' ');
                    if (fsps > -1) {
                        dTmp = dTmp.substring(0, fsps);
                    }
                    tmpDir = dTmp;
                } else {
                    tmpDir = 'kube';
                }
                tmpDir = tmpDir + '-' + utl.dirDate();

                kga;       // Kubernetes Get Array
                slp = tmpDir.lastIndexOf('/');

                if (slp > -1) {
                    slp++;
                    tmpDir = tmpDir.substring(slp);
                }

                if (vpk.snapshotDir === "") {
                    dynDir = dynDir + '/cluster/' + tmpDir;
                } else {
                    if (dynDir.endsWith('/')) {
                        dynDir = dynDir + tmpDir;
                    } else {
                        dynDir = dynDir + '/' + tmpDir;
                    }
                }
                vpk.clusterDirectory = dynDir;

                //TODO: check, should this be async
                ca = kube.getAuth(data);
                if (ca === 'PASS') {

                    msg = 'Authentication completed successfully';
                    client.emit('getKStatus', msg);

                    // Using kubectl or other CLI get list of api resources in the cluster
                    kga = kube.getAPIs(data);
                    if (kga === 'FAIL') {
                        msg = 'Failed to retrieve api resource data, check log messages';
                        utl.logMsg('vpkCIO697 - ' + msg);
                        client.emit('getKStatus', msg);
                        // kube.logout(data);
                    } else {
                        // reset and clear the old kinds and counts in the vpk object
                        utl.resetVpkObject();
                        snapshot.getK(data, kga, client, dynDir);
                    }
                } else {
                    msg = 'Failed Authentication';
                    client.emit('getKStatus', msg);
                }
            });

            client.on('getConfig', () => {
                utl.logMsg('vpkCIO159 - Get config data request');
                client.emit('getConfigResult', { 'config': vpk.defaultSettings });
            });

            // client.on('getCmds', () => {
            //     utl.logMsg('vpkCIO019 - Get command history');
            //     var result = {
            //         'logs': vpk.cmdHist
            //     };
            //     utl.logMsg('vpkCIO021 - Emit cmdResult');
            //     client.emit('cmdResult', result);
            // });

            client.on('getCompareFile', data => {
                utl.logMsg('vpkCIO003 - Get file using: ' + data.fn);
                let content = getFileContents(data.fn, 'y');
                let which = data.which;
                let result = { 'content': content, 'which': which };
                client.emit('getCompareFileResults', result);
            });

            client.on('getDecode', parm => {
                // save the key for use when results are returned
                var fn = parm.file;
                var secret = parm.secret;
                var data;
                var tmp;
                var vArray = {};
                var text = '';
                var buff;

                // decode base64 data in secret
                try {
                    tmp = utl.readResourceFile(fn);
                    if (typeof tmp.data !== 'undefined') {
                        data = tmp.data;
                        if (typeof data === 'object') {
                            let keys = Object.keys(data);
                            let key;
                            for (let d = 0; d < keys.length; d++) {
                                key = keys[d];
                                buff = new Buffer.from(data[key], 'base64');
                                text = buff.toString('ascii');
                                if (text.startsWith('{')) {
                                    text = JSON.parse(text)
                                    vArray[key] = {
                                        'value': text,
                                        'type': 'JSON'
                                    }
                                } else {
                                    vArray[key] = {
                                        'value': text,
                                        'type': 'TEXT'
                                    }
                                }
                            }
                        }
                    } else {
                        vArray[key] = {
                            'value': 'Unable to process request to decode value',
                            'type': 'TEXT'
                        }
                    }
                    var result = {
                        'result': vArray,
                        'secret': secret
                    };
                    utl.logMsg('vpkCIO005 - Emit decodeDef');
                    client.emit('getDecodeResult', result);
                } catch (err) {
                    utl.logMsg('vpkCIO174 - Error processing decode, message: ' + err);
                }
            });

            client.on('getDef', data => {
                utl.logMsg('vpkCIO003 - Get file using: ' + data);
                var result = getFileContents(data, 'n');
                client.emit('objectDef', result);
            });

            client.on('getDirStats', () => {
                utl.logMsg('vpkCIO006 - DirStats request');
                utl.logMsg('vpkCIO007 - Emit dirStatsResults');
                var result = { 'kind': vpk.fileCnt, 'ns': vpk.namespaceCnt }
                //client.emit('dirStatsResult', statMessages);
                client.emit('dirStatsResult', result);
            });

            client.on('getDocumentation', data => {
                utl.logMsg('vpkCIO359 - Get documentation request: ' + data.doc);
                let result = { 'content': 'No documentation located' }
                if (typeof data.doc !== 'undefined') {
                    if (typeof vpk.documentation[data.doc] !== 'undefined') {
                        result = vpk.documentation[data.doc];
                    } else {
                        let tmpKey = data.doc + '/';
                        if (typeof vpk.documentation[tmpKey] !== 'undefined') {
                            result = vpk.documentation[tmpKey];
                        }
                    }
                }
                client.emit('getDocumentationResult', result);
            });

            client.on('getOwnerRefLinks', () => {
                utl.logMsg('vpkCIO359 - Get owner ref links request');
                let links = owner.getLinks();
                client.emit('getOwnerRefLinksResult', { 'links': links });
            });

            client.on('getFileByCid', data => {
                utl.logMsg('vpkCIO091 - Get getFileByCid request ');
                let key = utl.cidNameLookup(data)
                if (key !== 'nf') {
                    client.emit('getFileByCidResults', key);
                } else {
                    client.emit('getFileByCidResults', 'missing');
                }
            });

            client.on('getHierarchy', data => {
                utl.logMsg('vpkCIO077 - GetHierarchy request');
                var result = hier.filterHierarchy(data);
                utl.logMsg('vpkCIO178 - Emit hierarchyResults');
                client.emit('hierarchyResult', result);
            });

            client.on('getSecurityHier', data => {
                let what = data.type;
                if (what === 's') {
                    utl.logMsg('vpkCIO008 - Get security subject hierarchy');
                    client.emit('getSecurityHierResult', vpk.secSubjectsHierarchy);
                } else if (what === 'r') {
                    utl.logMsg('vpkCIO008 - Get security resource hierarchy');
                    client.emit('getSecurityHierResult', vpk.secResourcesHierarchy);
                }
            });

            client.on('getSecurityRules', data => {
                utl.logMsg('vpkCIO491 - Get security rules request ');
                let result = sec.getSecurityRules(data);
                client.emit('getSecurityRulesResult', result);
            });

            client.on('getSecurityViewData', ns => {
                utl.logMsg('vpkCIO491 - Get security view data request ');
                let result = sec.getSecurityViewData(ns);
                client.emit('getSecurityViewDataResult', { 'data': result, 'ns': ns });
            });

            client.on('getSelectLists', () => {
                utl.logMsg('vpkCIO008 - Get select lists request');
                var labels = Object.keys(vpk.labelKeys);
                let explains = ''
                if (vpk.explains !== '') {
                    explains = vpk.explains;
                }
                var result = {
                    'kinds': vpk.kinds,
                    'namespaces': vpk.definedNamespaces,
                    'baseDir': vpk.startDir,
                    'validDir': vpk.validDir,
                    'providers': vpk.providers,
                    'labels': labels,
                    'xRefs': vpk.configFile.xrefNames,
                    'explains': explains
                };
                utl.logMsg('vpkCIO047 - Emit selectListsResult');
                client.emit('selectListsResult', result);
            });

            client.on('getStorage', () => {
                utl.logMsg('vpkCIO359 - Get storage request');
                storage.buildStorage();
                client.emit('getStorageResult', { 'info': vpk.storageInfo });
            });

            client.on('getUsage', () => {
                utl.logMsg('vpkCIO477 - GetUsage request');
                var result = '{"empty": true}';
                var dumpFile = process.cwd() + '/usage/usageInfo.json';
                var getRpt = true;
                var readRpt = true;

                try {
                    fs.unlinkSync(dumpFile)
                    utl.logMsg('vpkCIO474 - Old usage file removed');
                } catch (e0) {
                    if (!e0.msssage === 'dumpfile is not defined') {
                        client.emit('usageResult', result);
                        getRpt = false;
                    } else {
                        utl.logMsg('vpkCIO475 - Usage file did not exist');
                    }
                }

                if (getRpt === true) {
                    if (readRpt === true) {
                        try {
                            process.report.writeReport(dumpFile);
                        } catch (err) {
                            utl.logMsg('vpkCIO477 - Error obtaining node.js process report, message: ' + err);
                            utl.logMsg('vpkCIO476 - Stack: ' + err.stack);
                            result = '{"empty": true, "message": "Unable to obtain usage information"}';
                        }
                    }

                    setTimeout(() => {
                        try {
                            result = fs.readFileSync(dumpFile, "utf8");
                        } catch (e) {
                            utl.logMsg('vpkCIO473 - Unabale to read usage file, message: ' + e);
                            result = '{"empty": true, "message": "Unable to read usage file" }';
                        }

                        result = JSON.parse(result)
                        result.LICENSE = vpk.LICENSE;
                        utl.logMsg('vpkCIO478 - Emit usageResults');
                        client.emit('usageResult', result);
                    }, 400);
                }
            });

            client.on('getVersion', () => {
                utl.logMsg('vpkCIO091 - Get software version request ');
                var result = { 'version': softwareVersion, 'runMode': vpk.runMode };
                utl.logMsg('vpkCIO049 - Emit version');
                client.emit('version', result);
            });

            client.on('getXrefRules', () => {
                utl.logMsg('vpkCIO067 - Get xref rules request ');
                let result = '{"empty": true}';
                result = xref.getXrefRules()
                client.emit('getXrefRulesResult', result);
            });

            client.on('reload', data => {
                utl.logMsg('vpkCIO009 - Snapshot directory: ' + data);
                vpk.clusterDirectory = data;
                snapshot.reload(data, client);
                let explains = ''
                if (vpk.explains !== '') {
                    explains = vpk.explains;
                }
                let labels = Object.keys(vpk.labelKeys);
                let result = {
                    'kinds': vpk.kinds,
                    'namespaces': vpk.definedNamespaces,
                    'baseDir': vpk.startDir,
                    'validDir': vpk.validDir,
                    'providers': vpk.providers,
                    'labels': labels,
                    'xRefs': vpk.configFile.xrefNames,
                    'explains': explains
                };
                utl.logMsg('vpkCIO010 - Emit selectListsResult');
                client.emit('selectListsResult', result);

                result = {
                    'baseDir': vpk.startDir,
                    'validDir': vpk.validDir
                };
                utl.logMsg('vpkCIO011 - Emit resetResults');
                client.emit('resetResults', result);
            });

            client.on('runCommand', (data) => {
                utl.logMsg('vpkCIO026 - RunCommand request');
                var result = kube.runCommand(data)
                client.emit('commandResult', result);
            });


            //TODO verify if this is dead code
            client.on('saveFile', data => {
                utl.logMsg('vpkCIO076 - SaveFile request for file: ' + data.filename);
                var status = utl.saveEditFile(data.filename, data.content);
                client.emit('saveFileResults', status);
            });

            client.on('saveConfig', (data) => {
                utl.logMsg('vpkCIO149 - Save config file request');
                let result = utl.saveConfigFile(data);
                client.emit('saveConfigResult', { 'result': result });
            });

            client.on('schematic', data => {
                utl.logMsg('vpkCIO091 - Get schematic request ');
                schematic.parse(data);
                client.emit('schematicResult', { 'data': vpk.pods, 'messages': vpk.svgMsg });
            });

            client.on('search', data => {
                var msg = 'Search for ' + data.kindFilter + ' in ' + data.namespaceFilter;
                if (data.kindnameValue > '') {
                    msg = msg + ' with name of kind containing: ' + data.kindnameValue
                }
                if (data.labelFilter > '::') {
                    msg = msg + ' and labels: ' + data.labelFilter
                }
                utl.logMsg('vpkCIO037 - ' + msg);
                var result = search.process(data);
                utl.logMsg('vpkCIO036 - Emit searchResult');
                client.emit('searchResult', result);
            });

            client.on('security', () => {
                utl.logMsg('vpkCIO091 - Get security request ');
                schematic.parse();  //no data will be passed
                client.emit('securityResult', { 'data': vpk.pods, 'messages': vpk.svgMsg });
            });

            client.on('securityUsage', () => {
                utl.logMsg('vpkCIO091 - Get securityUsage request ');
                schematic.parse(); //no
                client.emit('securityUsageResult', { 'data': vpk.pods, 'messages': vpk.svgMsg });
            });

            client.on('shutdownVpK', () => {
                utl.logMsg('vpkCIO092 - Shutdown VpK request ');
                process.exit(0);
            });

            client.on('xreference', data => {
                utl.logMsg('vpkCIO067 - Get xreference request ');
                let result = '{"empty": true}';
                if (typeof data.xref !== 'undefined') {
                    result = xref.getXrefs(data)
                }
                client.emit('xrefResult', result);
            });

        });
    }
}
