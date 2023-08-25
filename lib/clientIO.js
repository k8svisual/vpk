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
Dump memory http server routes 
*/
'use strict';

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import search from '../lib/search.js';
import hier from '../lib/hierarchy.js';
import schematic from '../lib/svgSchematic.js';
import storage from '../lib/storage.js';
import snapshot from '../lib/snapshot.js';
import owner from '../lib/ownerRef.js';
import kube from '../lib/kube.js';
import sec from '../lib/security.js';
// import compare from '../lib/compare.js';
import uiSchematic from '../lib/uiSchematic.js';

import YAML from 'js-yaml';
import fs from 'fs-extra';

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
            var doc = YAML.safeDump(fileData);
            //var doc2 = JSON.stringify(doc[0], null, 4)
            fileData = doc
            // fileData = YAML.safeDump(fileData);
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

export default {

    //------------------------------------------------------------------------------
    // define websocket io handlers
    //------------------------------------------------------------------------------

    init: function (io, softwareVersion) {

        io.on('connection', client => {

            client.on('clusterDir', (data) => {
                utl.logMsg('vpkCIO676 - Request: clusterDir');
                var which = '0';
                if (typeof data.which !== 'undefined') {
                    which = data.which;
                }
                var dirs = utl.getClusterDir();
                utl.logMsg('vpkCIO621 - Emit: clusterDirResult');
                client.emit('clusterDirResult', { 'dirs': dirs, 'which': which });
            });

            // client.on('compareSnapshots', (data) => {
            //     utl.logMsg('vpkCIO676 - Compare snapshots request');
            //     utl.logMsg('vpkCIO041 - Snap1: ' + data.snap1);
            //     utl.logMsg('vpkCIO042 - Snap2: ' + data.snap2);
            //     var result = compare.snapshots(data);
            //     utl.logMsg('vpkCIO043 - Returning compare results');
            //     client.emit('compareSnapshotsResults', { 'result': result });

            // });

            client.on('connectK8', (data) => {
                utl.logMsg('vpkCIO699 - Request: connectK8');
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

                ca = 'PASS';
                if (ca === 'PASS') {
                    msg = 'Authentication completed successfully';
                    client.emit('getKStatus', msg);
                    // Using kubectl or other CLI get list of api resources in the cluster
                    kga = kube.getAPIs(data);
                    if (kga === 'FAIL') {
                        msg = 'Failed to retrieve api resource data, check log messages';
                        utl.logMsg('vpkCIO697 - ' + msg);
                        client.emit('getKStatus', msg);
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
                utl.logMsg('vpkCIO159 - Request: getConfig');
                utl.logMsg('vpkCIO159 - Emit: getConfigResult');
                client.emit('getConfigResult', { 'config': vpk.configFile.defaults });
            });

            // client.on('getCompareFile', (data) => {
            //     utl.logMsg('vpkCIO003 - Get file using: ' + data.fn);
            //     let fn = data.fn
            //     let tmp;
            //     if (fn.endsWith('.yaml')) {
            //         tmp = fn.split('config')
            //         tmp = tmp[1].split('.')
            //         fn = tmp[0] + '.0'
            //     }
            //     let content = getFileContents(fn, 'y');
            //     let which = data.which;
            //     let result = { 'content': content, 'which': which };
            //     client.emit('getCompareFileResults', result);
            // });

            client.on('getDecode', parm => {
                utl.logMsg('vpkCIO005 - Request: getDecode');
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
                    utl.logMsg('vpkCIO005 - Emit: getDecodeResult');
                    client.emit('getDecodeResult', result);
                } catch (err) {
                    utl.logMsg('vpkCIO174 - Error processing decode, message: ' + err);
                }
            });

            client.on('getDef', (data) => {
                utl.logMsg('vpkCIO003 - Request: getDef using: ' + data);
                var result = getFileContents(data, 'n');
                utl.logMsg('vpkCIO003 - Emit: objectDef');
                client.emit('objectDef', result);
            });

            client.on('getDirStats', () => {
                utl.logMsg('vpkCIO006 - Request: getDirStats');
                utl.logMsg('vpkCIO007 - Emit: dirStatsResult');
                var result = { 'kind': vpk.fileCnt, 'ns': vpk.namespaceCnt }
                client.emit('dirStatsResult', result);
            });

            client.on('getDocumentation', data => {
                utl.logMsg('vpkCIO359 - Request: getDocumentation for: ' + data.doc);
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
                utl.logMsg('vpkCIO359 - Emit: getDocumentationResult');
                client.emit('getDocumentationResult', result);
            });

            client.on('getOwnerRefLinks', () => {
                utl.logMsg('vpkCIO359 - Request: getOwnerRefLinks');
                let links = owner.getLinks();
                utl.logMsg('vpkCIO359 - Emit: getOwnerRefLinksResult');
                client.emit('getOwnerRefLinksResult', { 'links': links });
            });

            client.on('getFileByCid', (data) => {
                utl.logMsg('vpkCIO093 - Request: getFileByCid');
                let key = utl.cidNameLookup(data)
                utl.logMsg('vpkCIO093 - Emit: getFileByCidResults');
                if (key !== 'nf') {
                    client.emit('getFileByCidResults', key);
                } else {
                    client.emit('getFileByCidResults', 'missing');
                }
            });

            client.on('getHierarchy', (data) => {
                utl.logMsg('vpkCIO077 - Request: getHierarchy');
                var result = hier.filterHierarchy(data);
                utl.logMsg('vpkCIO177 - Emit: hierarchyResult');
                client.emit('hierarchyResult', result);
            });

            // client.on('getSecurityHier', (data) => {
            //     let what = data.type;
            //     if (what === 's') {
            //         utl.logMsg('vpkCIO008 - Request: getSecurityHier');
            //         client.emit('getSecurityHierResult', vpk.secSubjectsHierarchy);
            //     } else if (what === 'r') {
            //         utl.logMsg('vpkCIO008 - Emit: getSecurityHier');
            //         client.emit('getSecurityHierResult', vpk.secResourcesHierarchy);
            //     }
            // });

            client.on('getSecurityRules', (data) => {
                utl.logMsg('vpkCIO491 - Request: getSecurityRules');
                let result = sec.getSecurityRules(data);
                utl.logMsg('vpkCIO491 - Emit: getSecurityRulesResult');
                client.emit('getSecurityRulesResult', result);
            });

            client.on('getSecurityViewData', (ns) => {
                utl.logMsg('vpkCIO491 - Request: getSecurityViewData');
                let result = sec.getSecurityViewData(ns);
                utl.logMsg('vpkCIO491 - Emit: getSecurityViewDataResult ');
                client.emit('getSecurityViewDataResult', { 'data': result, 'ns': ns });
            });

            client.on('getSelectLists', () => {
                utl.logMsg('vpkCIO008 - Request: getSelectLists');
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
                    //'xRefs': vpk.configFile.xrefNames,
                    'explains': explains
                };
                utl.logMsg('vpkCIO008 - Emit: selectListsResult');
                client.emit('selectListsResult', result);
            });

            client.on('getStorage', () => {
                utl.logMsg('vpkCIO359 - Request: getStorage');
                storage.buildStorage();
                utl.logMsg('vpkCIO359 - Emit: getStorageResult');
                client.emit('getStorageResult', { 'info': vpk.storageInfo });
            });

            client.on('getUsage', () => {
                utl.logMsg('vpkCIO477 - Request: getUsage');
                var result = '{"empty": true}';
                var dumpFile = process.cwd() + '/usage/usageInfo.json';
                var getRpt = true;
                var readRpt = true;

                try {
                    fs.unlinkSync(dumpFile)
                    utl.logMsg('vpkCIO477 - Old usage file removed');
                } catch (e0) {
                    if (!e0.msssage === 'dumpfile is not defined') {
                        utl.logMsg('vpkCIO477 - Emit: usageResult');
                        client.emit('usageResult', result);
                        getRpt = false;
                    } else {
                        utl.logMsg('vpkCIO477 - Usage file did not exist');
                    }
                }

                if (getRpt === true) {
                    if (readRpt === true) {
                        try {
                            process.report.writeReport(dumpFile);
                        } catch (err) {
                            utl.logMsg('vpkCIO477 - Error obtaining node.js process report, message: ' + err);
                            utl.logMsg('vpkCIO477 - Stack: ' + err.stack);
                            result = '{"empty": true, "message": "Unable to obtain usage information"}';
                        }
                    }

                    setTimeout(() => {
                        try {
                            result = fs.readFileSync(dumpFile, "utf8");
                        } catch (e) {
                            utl.logMsg('vpkCIO477 - Unabale to read usage file, message: ' + e);
                            result = '{"empty": true, "message": "Unable to read usage file" }';
                        }

                        result = JSON.parse(result)
                        result.LICENSE = vpk.LICENSE;
                        utl.logMsg('vpkCIO477 - Emit: usageResult');
                        client.emit('usageResult', result);
                    }, 400);
                }
            });

            client.on('getVersion', () => {
                utl.logMsg('vpkCIO094 - Request: getVersion');
                var result = { 'version': softwareVersion, 'runMode': vpk.runMode };
                utl.logMsg('vpkCIO094 - Emit: versionResult');
                client.emit('versionResult', result);
            });

            client.on('reload', (data) => {
                utl.logMsg('vpkCIO009 - Request: reload');
                utl.logMsg('vpkCIO009 - Snapshot directory to get: ' + data);
                vpk.clusterDirectory = data;
                snapshot.reload(data, client);
                uiSchematic.create();
                storage.buildStorage();

                let explains = ''
                if (vpk.explains !== '') {
                    explains = vpk.explains;
                }
                let result = {
                    'kinds': vpk.kinds,
                    'namespaces': vpk.definedNamespaces,
                    'baseDir': vpk.startDir,
                    'validDir': vpk.validDir,
                    // 'xRefs': vpk.configFile.xrefNames,
                    'explains': explains,
                    'baseDir': vpk.startDir,
                    'validDir': vpk.validDir,
                    'pods': vpk.pods,
                    'keys': vpk.schematicKeys,
                    'info': vpk.svgInfo,
                    'evts': vpk.workloadEventsInfo,
                    'nsRI': vpk.nsResourceInfo,
                    'oRef': vpk.oRefLinks,
                    'stor': vpk.storageInfo
                };
                utl.logMsg('vpkCIO009 - Emit: selectListsResult');
                client.emit('selectListsResult', result);

                result = {
                    'baseDir': vpk.startDir,
                    'validDir': vpk.validDir
                };
                utl.logMsg('vpkCIO009 - Emit: resetResults');
                client.emit('resetResults', result);
            });

            client.on('runCommand', (data) => {
                utl.logMsg('vpkCIO026 - Request: runCommand');
                var result = kube.runCommand(data)
                utl.logMsg('vpkCIO026 - Emit: commandResult');
                client.emit('commandResult', result);
            });

            client.on('saveConfig', (data) => {
                utl.logMsg('vpkCIO149 - Request: saveConfig');
                let result = utl.saveConfigFile(data);
                utl.logMsg('vpkCIO149 - Emit: saveConfigResult');
                client.emit('saveConfigResult', { 'result': result });
            });

            // NOTE: This same logic is also included in /lib/afterParse
            // to send the data to the browser.  Might be able to remove this

            client.on('getServerData', () => {
                utl.logMsg('vpkCIO095 - Request: getServerData ');
                schematic.parse();
                uiSchematic.create();
                storage.buildStorage();

                utl.logMsg('vpkCIO095 - Emit: getServerDataResult');
                client.emit('getServerDataResult', {
                    'pods': vpk.pods,
                    'keys': vpk.schematicKeys,
                    'info': vpk.svgInfo,
                    'evts': vpk.workloadEventsInfo,
                    'nsRI': vpk.nsResourceInfo,
                    'oRef': vpk.oRefLinks,
                    'stor': vpk.storageInfo
                });
            });

            client.on('schematicGetSvg', (data) => {
                utl.logMsg('vpkCIO097 - Request: schematicGetSVG');
                let rtn = uiSchematic.getSvg(data);
                utl.logMsg('vpkCIO097 - Emit: schematicGetSvgResult');
                client.emit('schematicGetSvgResult', { 'data': rtn });
            });

            client.on('search', (data) => {
                utl.logMsg('vpkCIO037 - Request: search');
                var msg = 'Search for ' + data.kindFilter + ' in ' + data.namespaceFilter;
                if (data.searchValue > '') {
                    msg = msg + ' with name of kind containing: ' + data.searchValue
                }
                if (data.labelFilter > '::') {
                    msg = msg + ' and labels: ' + data.labelFilter
                }
                utl.logMsg('vpkCIO037 - ' + msg);
                var result = search.process(data);
                utl.logMsg('vpkCIO037 - Emit: searchResult');
                client.emit('searchResult', result);
            });

            client.on('security', () => {
                utl.logMsg('vpkCIO096 - Request: security');
                schematic.parse();  //no data will be passed
                utl.logMsg('vpkCIO096 - Emit: securityResult');
                client.emit('securityResult', { 'data': vpk.pods });
            });

            client.on('securityUsage', () => {
                utl.logMsg('vpkCIO091 - Request: securityUsage request ');
                schematic.parse(); //no
                utl.logMsg('vpkCIO091 - Emit: securityUsageResult');
                client.emit('securityUsageResult', { 'data': vpk.pods });
            });

            client.on('shutdownVpK', () => {
                utl.logMsg('vpkCIO092 - Request: shutdownVpK');
                process.exit(0);
            });

        });
    }
};
