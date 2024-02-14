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
Processes and functions for communicting with kubernetes via CLI
*/

'use strict';

import vpk from '../lib/vpk.js';
import vpkSpan from '../lib/vpkSpan.js';
import utl from '../lib/utl.js';

import Q from 'q';
import { execSync } from 'child_process';

var glbGet = '';
var getKindList = '';
var glbSSH = '';

// issue command to get the ready status of resources in the cluster
var kubeReadyZ = function (kinfo) {
    let cTxt = ' get --raw="/readyz?verbose"';
    try {
        var out = "";
        var cmd = ""
        var getParts = glbGet.split(' ');
        if (getParts.length > 1) {
            cmd = getParts[0] + cTxt;
        } else {
            cmd = glbGet + cTxt;
        }

        utl.logMsg('vpkKUB022 - ' + cmd);
        // // Added to support using SSH to call container Host to run command
        if (typeof kinfo.host_ip !== 'undefined') {
            glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `
        } else {
            glbSSH = '';
        }

        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'"
            utl.logMsg('vpkKUB023 - Command modified to use SSH to call Host machine');
        }

        out = execSync(cmd).toString();
        if (out !== "") {
            let tmp = out.split('\n')
            vpkSpan.readyz = tmp;
        } else {
            vpkSpan.readyz = [];
        }

    } catch (err) {
        utl.logMsg('vpkKUB024 - Error getting ReadyZ information.  message: ' + err);
        vpkSpan.readyz = [];
    }
}

// issue command dump the cluster info for the cluster
var kubeStatus = function (kinfo) {
    try {
        var out = "";
        var cmd = ""
        var getParts = glbGet.split(' ');
        if (getParts.length > 1) {
            cmd = getParts[0] + ' cluster-info dump ';
        } else {
            cmd = glbGet + ' cluster-info dump ';
        }

        utl.logMsg('vpkKUB042 - ' + cmd);
        // // Added to support using SSH to call container Host to run command
        if (typeof kinfo.host_ip !== 'undefined') {
            glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `
        } else {
            glbSSH = '';
        }

        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'"
            utl.logMsg('vpkKUB042 - Command modified to use SSH to call Host machine');
        }

        out = execSync(cmd).toString();
        if (out !== "") {
            let tmp = parseStatus(out);
            return parseStatus(out)
        } else {
            return { 'components': [] };
        }

    } catch (err) {
        utl.logMsg('vpkKUB053 - Error getting Components information.  message: ' + err);
        return { "components": [], "error": err };
    }
}

// parse the cluster dump data and save the required data
var parseStatus = function (result) {
    try {
        let data = result.split('\n')
        let compStatus = { 'components': [] };
        let i;
        let line;
        // This will locate the log files for the containers in the dump output
        for (i = 0; i < data.length; i++) {
            if (data[i].startsWith("==== START")) {
                line = data[i].split('container ');
                if (typeof line[1] !== 'undefined') {
                    compStatus.components.push(line[1])
                    utl.logMsg('vpkKUB030 - Located component: ' + line[1]);
                }
            }
        }
        utl.logMsg('vpkKUB031 - ' + i + ' entries located for K8s cluster status')
        data = null;
        vpk.kubeSystemComponents = compStatus;

    } catch (e) {
        utl.logMsg('vpkKUB032 - Error parsing status information,  message: ' + e);
        vpk.kubeSystemComponents = { 'components': [] };
    }
    return;
}

// issue command to get the cluster version
var kubeversion = function (kinfo) {
    try {
        var cmd = ""
        var getParts = glbGet.split(' ');
        if (getParts.length > 1) {
            cmd = getParts[0] + ' version -o json'
        } else {
            cmd = glbGet + ' version -o json';
        }

        utl.logMsg('vpkKUB052 - ' + cmd);
        // // Added to support using SSH to call container Host to run command
        if (typeof kinfo.host_ip !== 'undefined') {
            glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `
        } else {
            glbSSH = '';
        }

        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'"
            utl.logMsg('vpkKUB054 - Command modified to use SSH to call Host machine');
        }

        var out = execSync(cmd).toString();
        out = JSON.parse(out);
        return out;
    } catch (err) {
        utl.logMsg('vpkKUB053 - Error getting version information.  message: ' + err);
        return { "items": [], "error": err };
    }
};

// issue command to get the list of all resources types in the cluster
var kubeapis = function (kinfo) {
    try {
        var cmd = ""
        cmd = glbGet + ' api-resources -o wide';
        utl.logMsg('vpkKUB072 - ' + cmd);

        // // Added to support using SSH to call container Host to run command
        if (typeof kinfo.host_ip !== 'undefined') {
            glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `
        } else {
            glbSSH = '';
        }

        if (glbSSH !== '') {
            utl.logMsg('vpkKUB054 - Command modified to use SSH to call Host machine');
            cmd = glbSSH + "'" + cmd + "'"
        }

        var out = execSync(cmd).toString();
        // var hl = out.length;
        return out;
    } catch (err) {
        utl.logMsg('vpkKUB071 - Error getting api-resource information.  message: ' + err);
        return { "items": [], "error": err };
    }
};

// issue command to get the resource kind information
var kubeget = function (ns, kind) {
    var deferred = Q.defer();
    var out;
    var cmd;
    var explain;
    var expOut;
    try {
        // Reformat command sequence for Kubernetes 1.11, namespace and -o option had
        // to be placed after the get <kind>
        cmd = '';
        out = '';

        if (ns === 'all-namespaces') {
            cmd = glbGet + ' get ' + kind + ' --all-namespaces -o json';
        } else if (ns === '') {
            cmd = glbGet + ' get ' + kind + ' -o json';
        } else {
            cmd = glbGet + ' get ' + kind + ' -n ' + ns + ' -o json';
        }

        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'"
        }
        out = execSync(cmd, { maxBuffer: 50 * 1024 * 1024 }).toString();

        try {
            if (glbSSH !== '') {
                explain = glbSSH + " " + glbGet + ' explain ' + kind;
            } else {
                explain = glbGet + ' explain ' + kind;
            }

            expOut = execSync(explain).toString();
            expOut = expOut.split('FIELDS:')
            expOut = expOut[0];

            vpk.explains[kind] = expOut;
        } catch (err) {
            utl.logMsg('vpkKUB083 - Warning, did not find explain information for kind: ' + kind);
        }

        //TODO if HARD redact of Secret is to be supported the logic needs to be added here.

        // if (kind === 'componentstatuses') {
        //     console.log(JSON.stringify(out));
        // }
        deferred.resolve(out);
    } catch (err) {
        utl.logMsg('vpkKUB081 - Error getting information for kind: ' + kind + ',  Message: ' + err);
        utl.logMsg('vpkKUB082 - Command : ' + cmd + ' output: \n');
        if (typeof out !== 'undefined') {
            console.log(out);
        } else {
            console.log('No output from command execution');
        }

        deferred.resolve('{"items":[]}');
    }

    return deferred.promise;
};

var parseAPIs = function (data) {
    var tmp = data.split('\n');
    var hl = tmp.length;
    if (hl < 1) {
        return []
    }

    // Get starting positions of data
    var nPos = tmp[0].indexOf('NAMESPACED');
    var vPos = tmp[0].indexOf('VERBS');
    var ePos = tmp[0].indexOf('SHORT');
    var gPos = tmp[0].indexOf('APIGROUP');
    var kPos = tmp[0].indexOf('KIND');

    ePos = ePos - 1;
    var rtn = [];
    var noGet = [];
    var item;
    var entry;
    var wrk;
    var found = ':';
    var kind;
    var fp;

    for (var i = 1; i < hl; i++) {
        item = tmp[i];
        fp = item.indexOf(' ');
        kind = item.substring(0, fp);
        if (found.indexOf(':' + kind + ':') > -1) {
            // already found this kind
            utl.logMsg('vpkKUB521 - API resource kind: ' + kind + ' already found');
            continue;
        } else {
            found = found + kind + ':';
        }


        if (item.length > vPos) {
            wrk = item.substring(vPos);
            // if verb get is found create entry
            if (wrk.indexOf('get') > -1) {
                // build return array
                entry = item.substring(0, ePos);
                entry = entry.trim() + ':' + item.substring(nPos, nPos + 1);
                rtn.push(entry);

                // build apikeys
                var apiG = item.substring(gPos, nPos - 1);
                apiG = apiG.trim();
                if (apiG.length === 0) {
                    apiG = '-none-'
                }

                var kind2 = item.substring(kPos, vPos - 1);
                kind2 = kind2.trim();
                var nsd = item.substring(nPos, kPos - 1);
                nsd = nsd.trim();
                var key = apiG + ':' + kind2;
                if (typeof vpk.apitypes[key] === 'undefined') {
                    var atype = {};
                    atype.group = apiG;
                    atype.kind = kind2;
                    atype.namespaced = nsd;
                    vpk.apitypes[key] = atype;

                }
            } else {
                entry = item.substring(0, ePos);
                var msg = 'Skipped api-resource: ' + entry.trim() + ' - does not support get verb';
                //utl.logMsg('vpkKUB305 - ' + msg);

                noGet.push({ "msg": msg });
            }
        }
    }
    return rtn;
};


// issue command from UI
var runCommand = function (cmd) {
    var out;
    try {
        utl.logMsg('vpkKUB101 - Command to run: ' + cmd);
        out = execSync(cmd).toString();
        if (out.length > 0) {
            out = out.split('\n');
        } else {
            out = ['OK'];
        }
        return { "output": out, "status": 'pass' };
    } catch (err) {
        utl.logMsg('vpkKUB102 - Error from command, message: ' + err);
        if (typeof err.message !== 'undefined') {
            out = [err.message];
        } else {
            out = ['Command failed to run properly'];
        }
        return { "output": out, "status": 'fail' };
    }
};


//------------------------------------------------------------------------------
// common routinesUserIdentityMapping
//------------------------------------------------------------------------------
export default {

    //------------------------------------------------------------------------------
    // run command on server
    //------------------------------------------------------------------------------
    runCommand: function (cmd) {
        utl.logMsg('vpkKUB103 - Run command invoked');
        return runCommand(cmd);
    },

    getAPIs: function (kinfo) {

        glbGet = kinfo.command;

        // Get the cluster softwre version    
        vpk.version = kubeversion(kinfo);

        if (glbGet.indexOf(' ')) {
            let tmp = glbGet.split(' ');
            glbGet = tmp[0]
        }

        kubeReadyZ(kinfo);
        kubeStatus(kinfo);

        getKindList = '::';
        var apidata = kubeapis(kinfo);

        if (typeof apidata.error !== 'undefined') {
            utl.logMsg('vpkKUB017 - Error processing, message: ' + apidata.error);
            return 'FAIL';
        }

        // build kga (Kubernetes Get Array) from the results of the api-resources command
        var kga = parseAPIs(apidata);
        return kga;

    },

    // get data for request 
    // kga (Kubernetes Get Array) 
    getKubeInfo: function (kinfo, kga, client) {
        var deferred = Q.defer();
        glbGet = kinfo.command;
        glbSSH = '';
        if (glbGet.indexOf(' ')) {
            let tmp = glbGet.split(' ');
            glbGet = tmp[0]
        }

        // // Added to support using SSH to call container Host to run command
        if (typeof kinfo.host_ip !== 'undefined') {
            glbSSH = `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} `
            //console.log(glbSSH);
        } else {
            glbSSH = '';
        }


        try {
            if (typeof kinfo.namespace === 'undefined') {
                kinfo.namespace = 'all-namespaces';
            }
            if (kinfo.namespace === '') {
                kinfo.namespace = 'all-namespaces';
            }
            var namespace = kinfo.namespace;
            var yf;
            var item;
            var it;
            if (namespace === null || namespace === '' || namespace.length < 3) {
                utl.logMsg('vpkKUB009 - Invalid or missing namespace value: ' + namespace);
                deferred.resolve('FAIL');
            } else {
                var newKind;
                var newNS;
                var rtn = '';
                // kga[k] has either ending value of :t or :f 
                // indicating if resource is namespaced 
                if (kga.endsWith(':t')) {
                    newNS = namespace;
                } else {
                    newNS = '';
                }
                newKind = kga.substring(0, kga.length - 2);

                if (getKindList.indexOf('::' + newKind + '::') > -1) {
                    utl.logMsg('vpkKUB429 - Duplicate get for kind: ' + newKind)
                    deferred.resolve('SKIP');
                } else {
                    getKindList = getKindList + newKind + '::'
                }

                client.emit('kubeGet', 'processing');

                kubeget(newNS, newKind)
                    .then(function (data) {
                        if (data.length > 0) {
                            if (data.length > 143) {
                                if (data.endsWith('}\n')) {
                                    if (data.startsWith('{')) {
                                        yf = JSON.parse(data);
                                        for (it = 0; it < yf.items.length; it++) {
                                            item = yf.items[it];
                                            vpk.rtn.items.push(item);
                                        }
                                        utl.logMsg('vpkKUB392 - Kind: ' + newKind + ' Pushed: ' + it);
                                        // pad leading zero on it count
                                        if (it < 10) {
                                            it = '0000' + it;
                                        } else if (it < 100) {
                                            it = '000' + it;
                                        } else if (it < 1000) {
                                            it = '00' + it;
                                        } else if (it < 10000) {
                                            it = '0' + it;
                                        }
                                        //utl.logMsg('vpkKUB014 - Count: ' + it + ' - '+ newKind );
                                        client.emit('dynamicResults', ' ');
                                        deferred.resolve(rtn);
                                    } else {
                                        utl.logMsg('vpkKUB171 - Not valid JSON structure');
                                        deferred.resolve(rtn);
                                    }
                                } else {
                                    utl.logMsg('vpkKUB172 - Not JSON: ' + data);
                                    deferred.resolve(rtn);
                                }
                            } else {
                                //utl.logMsg('vpkKUB173 - No data located for kind: ' + newKind );
                                deferred.resolve(rtn);
                            }
                        }
                    })
                    .catch(function (err) {
                        utl.logMsg('vpkKUB351 - Failed to get kube data, message: ' + err);
                    });
                deferred.resolve(rtn);
            }
        } catch (e) {
            deferred.resolve('FAIL');
        }
        return deferred.promise;
    }
    //end of export    
};
