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
Dump memory http server routes 
*/
'use strict';

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import search from '../lib/search.js';
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

                // ca = 'PASS';
                // if (ca === 'PASS') {
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
                // } else {
                //     msg = 'Failed Authentication';
                //     client.emit('getKStatus', msg);
                // }
            });

            client.on('getConfig', () => {
                utl.logMsg('vpkCIO159 - Request: getConfig');
                utl.logMsg('vpkCIO159 - Emit: getConfigResult');
                client.emit('getConfigResult', { 'config': vpk.configFile.defaults });
            });

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
                        utl.logMsg('vpkCIO35 - Emit: getDocumentationResult');
                        result = vpk.documentation[data.doc];
                    } else {
                        utl.logMsg('vpkCIO37 - Failed to locate documentation: ' + data.doc);
                        let tmpKey = data.doc + '/';
                        if (typeof vpk.documentation[tmpKey] !== 'undefined') {
                            result = vpk.documentation[tmpKey];
                        } else {
                            utl.logMsg('vpkCIO37 - Failed to locate documentation: ' + tmpKey);
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

            client.on('getSecurityViewData', (ns) => {
                utl.logMsg('vpkCIO491 - Request: getSecurityViewData');
                let result = sec.getSecurityViewData(ns);
                utl.logMsg('vpkCIO491 - Emit: getSecurityViewDataResult ');
                client.emit('getSecurityViewDataResult', { 'data': result, 'ns': ns });
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
                var result = {
                    'version': softwareVersion,
                    'runMode': vpk.runMode,
                    'editTheme': vpk.configFile.defaults.lightTheme,
                    'clusterBackground': vpk.configFile.defaults.clusterBackground
                };
                utl.logMsg('vpkCIO094 - Emit: versionResult');
                client.emit('versionResult', result);
            });

            client.on('reload', (data) => {
                utl.logMsg('vpkCIO009 - Request: reload');
                utl.logMsg('vpkCIO009 - Snapshot directory to get: ' + data);
                if (data === vpk.oldDirectory) {
                    if (vpk.configFile.defaults.reloadAction === false) {
                        utl.logMsg('vpkCIO009 - No emit, no re-parse performed');
                    } else {
                        utl.logMsg('vpkCIO009 - Parsing data for new directory');
                        vpk.oldDirectory = data;
                        vpk.clusterDirectory = data;
                        snapshot.reload(data, client);
                    }
                } else {
                    utl.logMsg('vpkCIO009 - Parsing data for new directory');
                    vpk.oldDirectory = data;
                    vpk.clusterDirectory = data;
                    snapshot.reload(data, client);
                }

                utl.logMsg('vpkCIO009 - Emit: reloadResults');
                let result = {
                    'validDir': vpk.validDir
                }
                client.emit('reloadResults', result);
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

            client.on('getServerData', () => {
                utl.logMsg('vpkCIO095 - Request: getServerData ');

                schematic.parse();
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
                    'explains': explains,
                    'pods': vpk.pods,
                    'keys': vpk.schematicKeys,
                    'info': vpk.svgInfo,
                    'evts': vpk.workloadEventsInfo,
                    'nsRI': vpk.nsResourceInfo,
                    'oRef': vpk.oRefLinks,
                    'stor': vpk.storageInfo,
                    'registry': vpk.imageRepository,
                    'registryData': vpk.imageRepositoryData,
                    'registryFirst': vpk.imageRepositoryFirst,
                    'helm': vpk.helm,
                    'filters': vpk.configFile.clusterFilters,
                    'configMapsFound': vpk.configMapsFound,
                    'secretsFound': vpk.secretsFound,
                    'eventStats': {
                        'firstTime': vpk.evtFirstTime,
                        'lastTime': vpk.evtLastTime,
                        'totalDuration': vpk.evtTotalDuration,
                        'evtMinutes': vpk.evtMinutes,
                        'evtNs': vpk.evtNs,
                        'evtNsSum': vpk.evtNsSum
                    },
                    'events': vpk.eventGraphics,
                    'volumeCountsType': vpk.volumeCountsType,
                    'volumeCountsNode': vpk.volumeCountsNode,
                    'volumeCountsNS': vpk.volumeCountsNS,
                    'volumeCountsPod': vpk.volumeCountsPod,
                    'storageVolumes': vpk.storageVolumes,
                    'namespaceFnum': vpk.namespaceFnum,
                    'timeline': vpk.timeline,
                    'networkNodes': vpk.networkNodes,
                    'networkServiceToPods': vpk.networkServicesToPod,
                    'helm': vpk.helm,
                    'stats': vpk.stats
                };

                utl.logMsg('vpkCIO095 - Emit: getServerDataResult');
                client.emit('getServerDataResult', result)
                //console.log(JSON.stringify(vpk.stats, null, 4))

            });

            client.on('saveClusterFilters', (data) => {
                utl.logMsg('vpkCIO197 - Request: saveClusterFilter');
                vpk.clusterFilters = data;
                let rtn = utl.saveConfigFile();

            });

            client.on('getSchematicSvg', (data) => {
                utl.logMsg('vpkCIO097 - Request: schematicGetSVG');
                let rtn = uiSchematic.getSvg(data);
                utl.logMsg('vpkCIO097 - Emit: schematicGetSvgResult');
                client.emit('schematicGetSvgResult', { 'data': rtn });
            });

            client.on('searchK8Data', (data) => {
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

            client.on('shutdownVpK', () => {
                utl.logMsg('vpkCIO092 - Request: shutdownVpK');
                //utl.logMsg('vpkCIO092 - Shutdown VpK completed');
                utl.logMsg('-----------------------------------------');
                utl.logMsg('|                                       |');
                utl.logMsg('| VpK (Visually presented Kubernetes)   |');
                utl.logMsg('|   Stopped via user request            |');
                utl.logMsg('|                                       |');
                utl.logMsg('-----------------------------------------');
                process.exit(0);
            });
        });
    }
};
