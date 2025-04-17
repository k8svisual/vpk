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
import YAML from 'js-yaml';
import fs from 'node:fs';
import fsPath from 'path';
import vpk from '../lib/vpk.js';
import { schematicHtml, getSchematic } from '../schematic/html/schematicHtml.js';
import { logMessage } from '../utils/logging.js';
import { resetVpkObject } from '../utils/resetvpkobject.js';
import { cidNameLookup } from '../utils/cidnamelookup.js';
import { dirDate } from '../filehandler/dirdate.js';
import { readResourceFile } from '../filehandler/readresource.js';
import { getClusterDir } from '../filehandler/getclusterdir.js';
import { saveConfigFile } from '../filehandler/saveconfigfile.js';
import { runCommand } from '../kube/runCommand.js';
import { getAPIs } from '../kube/getAPIs.js';
import { driver } from '../kube/driver.js';
import { reloadSnapshot } from '../snapshot/reloadSnapshot.js';
import { getOwnerRefLinks } from '../ownerRefs/getOwnerRefLinks.js';
import { processSearch } from '../search/processSearch.js';
import { getSecurityViewData } from '../security/getSecurityViewData.js';
import { schematicParse } from '../schematic/data/schematicParse.js';
import { buildStorage } from '../lib/buildStorage.js';
//----------------------------------------------------------
function getFileContents(data, comp) {
    if (comp === null || comp === '') {
        comp = 'n';
    }
    let result;
    let fileData;
    try {
        if (data.endsWith('/ndf')) {
            fileData = '';
        }
        else {
            fileData = readResourceFile(data);
            let doc = YAML.dump(fileData);
            fileData = doc;
        }
        result = {
            filePart: '0',
            lines: fileData,
            defkey: data,
        };
        return result;
    }
    catch (err) {
        logMessage('CIO057 - Error processing getFileContents, message: ' + err);
        logMessage(err.stack);
    }
}
export default {
    //------------------------------------------------------------------------------
    // define websocket io handlers
    //------------------------------------------------------------------------------
    init: function (io, softwareVersion) {
        io.on('connection', (client) => {
            client.on('clusterDir', (data) => {
                logMessage('CIO676 - Request: clusterDir');
                let which = '0';
                if (typeof data.which !== 'undefined') {
                    which = data.which;
                }
                let dirs = getClusterDir();
                logMessage('CIO621 - Emit: clusterDirResult');
                client.emit('clusterDirResult', { dirs: dirs, which: which });
            });
            client.on('connectK8', (data) => {
                logMessage('CIO699 - Request: connectK8');
                let dynDir = process.cwd();
                let tmpDir = '';
                let dTmp;
                let fsps;
                let kga; // Kubernetes Get Array
                let msg;
                let slp;
                if (vpk.snapshotDir !== '') {
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
                }
                else {
                    tmpDir = 'kube';
                }
                tmpDir = tmpDir + '-' + dirDate();
                slp = tmpDir.lastIndexOf('/');
                if (slp > -1) {
                    slp++;
                    tmpDir = tmpDir.substring(slp);
                }
                let os = process.platform;
                // Check if snapshot directory was provided
                if (vpk.snapshotDir === '') {
                    if (os.startsWith('win')) {
                        dynDir = dynDir + '\\cluster\\' + tmpDir;
                    }
                    else {
                        dynDir = dynDir + '/cluster/' + tmpDir;
                    }
                }
                else {
                    // No Snapshot directory provided
                    dynDir = fsPath.join(dynDir, tmpDir);
                }
                vpk.clusterDirectory = dynDir;
                msg = 'Authentication completed successfully';
                client.emit('getKStatus', msg);
                // Using kubectl or other CLI get list of api resources in the cluster
                kga = getAPIs(data);
                if (kga === 'FAIL') {
                    msg = 'Failed to retrieve api resource data, check log messages';
                    logMessage('CIO697 - ' + msg);
                    client.emit('getKStatus', msg);
                }
                else {
                    // reset and clear the old kinds and counts in the vpk object
                    resetVpkObject();
                    // getSnapshot(data, kga, client, dynDir);
                    driver(data, kga, client, dynDir);
                }
            });
            client.on('getConfig', () => {
                logMessage('CIO159 - Request: getConfig');
                logMessage('CIO159 - Emit: getConfigResult');
                client.emit('getConfigResult', { config: vpk.configFile.defaults });
            });
            client.on('getDecode', (parm) => {
                logMessage('CIO005 - Request: getDecode');
                // save the key for use when results are returned
                let fn = parm.file;
                let secret = parm.secret;
                let data;
                let tmp;
                let vArray = {};
                let text = '';
                let buff;
                // decode base64 data in secret
                try {
                    tmp = readResourceFile(fn);
                    if (typeof tmp.data !== 'undefined') {
                        data = tmp.data;
                        if (typeof data === 'object') {
                            let keys = Object.keys(data);
                            let key;
                            for (let d = 0; d < keys.length; d++) {
                                key = keys[d];
                                buff = Buffer.from(data[key], 'base64');
                                text = buff.toString('ascii');
                                if (text.startsWith('{')) {
                                    text = JSON.parse(text);
                                    vArray[key] = {
                                        value: text,
                                        type: 'JSON',
                                    };
                                }
                                else {
                                    vArray[key] = {
                                        value: text,
                                        type: 'TEXT',
                                    };
                                }
                            }
                        }
                    }
                    else {
                        vArray = {
                            value: 'Unable to process request to decode value',
                            type: 'TEXT',
                        };
                    }
                    let result = {
                        result: vArray,
                        secret: secret,
                    };
                    logMessage('CIO005 - Emit: getDecodeResult');
                    client.emit('getDecodeResult', result);
                }
                catch (err) {
                    logMessage('CIO174 - Error processing decode, message: ' + err);
                }
            });
            client.on('getDef', (data) => {
                logMessage('CIO003 - Request: getDef using: ' + data);
                let result = getFileContents(data, 'n');
                logMessage('CIO003 - Emit: objectDef');
                client.emit('objectDef', result);
            });
            client.on('getDirStats', () => {
                logMessage('CIO006 - Request: getDirStats');
                logMessage('CIO007 - Emit: dirStatsResult');
                let result = { kind: vpk.fileCnt, ns: vpk.namespaceCnt };
                client.emit('dirStatsResult', result);
            });
            client.on('getDocumentation', (data) => {
                logMessage('CIO359 - Request: getDocumentation for: ' + data.doc);
                let result = { content: 'No documentation located' };
                if (typeof data.doc !== 'undefined') {
                    if (typeof vpk.documentation[data.doc] !== 'undefined') {
                        logMessage('CIO353 - Emit: getDocumentationResult');
                        result = vpk.documentation[data.doc];
                    }
                    else {
                        logMessage('CIO377 - Failed to locate documentation: ' + data.doc);
                        let tmpKey = data.doc + '/';
                        if (typeof vpk.documentation[tmpKey] !== 'undefined') {
                            result = vpk.documentation[tmpKey];
                        }
                        else {
                            logMessage('CIO377 - Failed to locate documentation: ' + tmpKey);
                        }
                    }
                }
                logMessage('CIO359 - Emit: getDocumentationResult');
                client.emit('getDocumentationResult', result);
            });
            client.on('getOwnerRefLinks', () => {
                logMessage('CIO359 - Request: getOwnerRefLinks');
                let links = getOwnerRefLinks();
                logMessage('CIO359 - Emit: getOwnerRefLinksResult');
                client.emit('getOwnerRefLinksResult', { links: links });
            });
            client.on('getFileByCid', (data) => {
                logMessage('CIO093 - Request: getFileByCid');
                let key = cidNameLookup(data);
                logMessage('CIO093 - Emit: getFileByCidResults');
                if (key !== 'nf') {
                    client.emit('getFileByCidResults', key);
                }
                else {
                    client.emit('getFileByCidResults', 'missing');
                }
            });
            client.on('getSecurityViewData', (ns) => {
                logMessage('CIO491 - Request: getSecurityViewData');
                let result = getSecurityViewData(ns);
                logMessage('CIO491 - Emit: getSecurityViewDataResult ');
                client.emit('getSecurityViewDataResult', { data: result, ns: ns });
            });
            client.on('getUsage', () => {
                logMessage('CIO477 - Request: getUsage');
                let result = '{"empty": true}';
                let dumpFile = process.cwd() + '/usage/usageInfo.json';
                let getRpt = true;
                let readRpt = true;
                try {
                    if (fs.existsSync(dumpFile)) {
                        fs.unlinkSync(dumpFile);
                        logMessage('CIO477 - Old usage file removed');
                    }
                }
                catch (e0) {
                    if (e0.msssage !== 'dumpfile is not defined') {
                        logMessage('CIO477 - Emit: usageResult');
                        client.emit('usageResult', result);
                        getRpt = false;
                    }
                    else {
                        logMessage('CIO477 - Usage file did not exist');
                    }
                }
                if (getRpt === true) {
                    if (readRpt === true) {
                        try {
                            process.report.writeReport(dumpFile);
                        }
                        catch (err) {
                            logMessage('CIO477 - Error obtaining node.js process report, message: ' + err);
                            logMessage('CIO477 - Stack: ' + err.stack);
                            result = '{"empty": true, "message": "Unable to obtain usage information"}';
                        }
                    }
                    setTimeout(() => {
                        try {
                            result = fs.readFileSync(dumpFile, 'utf8');
                        }
                        catch (e) {
                            logMessage('CIO477 - Unabale to read usage file, message: ' + e);
                            result = '{"empty": true, "message": "Unable to read usage file" }';
                        }
                        result = JSON.parse(result);
                        result.LICENSE = vpk.LICENSE;
                        logMessage('CIO477 - Emit: usageResult');
                        client.emit('usageResult', result);
                    }, 400);
                }
            });
            client.on('getVersion', () => {
                logMessage('CIO094 - Request: getVersion');
                let result = {
                    version: softwareVersion,
                    runMode: vpk.runMode,
                    editTheme: vpk.configFile.defaults.lightTheme,
                    clusterBackground: vpk.configFile.defaults.clusterBackground,
                };
                logMessage('CIO094 - Emit: versionResult');
                client.emit('versionResult', result);
            });
            client.on('reload', (data) => {
                logMessage('CIO009 - Request: reload');
                logMessage('CIO009 - Snapshot directory to get: ' + data);
                if (data === vpk.oldDirectory) {
                    if (vpk.configFile.defaults.reloadAction === false) {
                        logMessage('CIO009 - No emit, no re-parse performed');
                    }
                    else {
                        logMessage('CIO009 - Parsing data for new directory');
                        vpk.oldDirectory = data;
                        vpk.clusterDirectory = data;
                        reloadSnapshot(data, client);
                        // snapshot.reload(data, client);
                    }
                }
                else {
                    logMessage('CIO009 - Parsing data for new directory');
                    vpk.oldDirectory = data;
                    vpk.clusterDirectory = data;
                    reloadSnapshot(data, client);
                    //snapshot.reload(data, client);
                }
                logMessage('CIO009 - Emit: reloadResults');
                let result = {
                    validDir: vpk.validDir,
                };
                client.emit('reloadResults', result);
            });
            client.on('runCommand', (data) => {
                logMessage('CIO026 - Request: runCommand');
                let result = runCommand(data);
                logMessage('CIO026 - Emit: commandResult');
                client.emit('commandResult', result);
            });
            client.on('saveConfig', (data) => {
                logMessage('CIO149 - Request: saveConfig');
                let result = saveConfigFile(data);
                logMessage('CIO149 - Emit: saveConfigResult');
                client.emit('saveConfigResult', { result: result });
            });
            client.on('getServerData', () => {
                logMessage('CIO095 - Request: getServerData ');
                schematicParse();
                schematicHtml();
                buildStorage();
                let explains = '';
                if (vpk.explains !== '') {
                    explains = vpk.explains;
                }
                let result = {
                    kinds: vpk.kinds,
                    namespaces: vpk.definedNamespaces,
                    baseDir: vpk.startDir,
                    validDir: vpk.validDir,
                    explains: explains,
                    pods: vpk.pods,
                    keys: vpk.schematicKeys,
                    info: vpk.svgInfo,
                    evts: vpk.workloadEventsInfo,
                    nsRI: vpk.nsResourceInfo,
                    oRef: vpk.oRefLinks,
                    stor: vpk.storageInfo,
                    registry: vpk.imageRepository,
                    registryData: vpk.imageRepositoryData,
                    registryFirst: vpk.imageRepositoryFirst,
                    helm: vpk.helm,
                    filters: vpk.configFile.clusterFilters,
                    configMapsFound: vpk.configMapsFound,
                    secretsFound: vpk.secretsFound,
                    eventStats: {
                        firstTime: vpk.evtFirstTime,
                        lastTime: vpk.evtLastTime,
                        totalDuration: vpk.evtTotalDuration,
                        evtMinutes: vpk.evtMinutes,
                        evtNs: vpk.evtNs,
                        evtNsSum: vpk.evtNsSum,
                    },
                    events: vpk.eventGraphics,
                    volumeCountsType: vpk.volumeCountsType,
                    volumeCountsNode: vpk.volumeCountsNode,
                    volumeCountsNS: vpk.volumeCountsNS,
                    volumeCountsPod: vpk.volumeCountsPod,
                    storageVolumes: vpk.storageVolumes,
                    namespaceFnum: vpk.namespaceFnum,
                    timeline: vpk.timeline,
                    networkNodes: vpk.networkNodes,
                    networkServiceToPods: vpk.networkServicesToPod,
                    stats: vpk.clusterSummary,
                    volumeAttachments: vpk.volumeAttachment,
                };
                logMessage('CIO095 - Emit: getServerDataResult');
                client.emit('getServerDataResult', result);
                //console.log(JSON.stringify(vpk.stats, null, 4))
            });
            client.on('saveClusterFilters', (data) => {
                logMessage('CIO197 - Request: saveClusterFilter');
                vpk.clusterFilters = data;
                saveConfigFile({});
            });
            client.on('getSchematicSvg', (data) => {
                logMessage('CIO097 - Request: schematicGetSVG');
                let rtn = getSchematic(data);
                logMessage('CIO097 - Emit: schematicGetSvgResult');
                client.emit('schematicGetSvgResult', { data: rtn });
            });
            client.on('searchK8Data', (data) => {
                logMessage('CIO037 - Request: search');
                let msg = 'Search for ' + data.kindFilter + ' in ' + data.namespaceFilter;
                if (data.searchValue > '') {
                    msg = msg + ' with name of kind containing: ' + data.searchValue;
                }
                if (data.labelFilter > '::') {
                    msg = msg + ' and labels: ' + data.labelFilter;
                }
                logMessage('CIO037 - ' + msg);
                let result = processSearch(data);
                logMessage('CIO037 - Emit: searchResult');
                client.emit('searchResult', result);
            });
            client.on('shutdownVpK', () => {
                logMessage('CIO092 - Request: shutdownVpK');
                //logMessage('CIO092 - Shutdown VpK completed');
                logMessage('-----------------------------------------');
                logMessage('|                                       |');
                logMessage('| VpK (Visually presented Kubernetes)   |');
                logMessage('|   Stopped via user request            |');
                logMessage('|                                       |');
                logMessage('-----------------------------------------');
                process.exit(0);
            });
        });
    },
};
