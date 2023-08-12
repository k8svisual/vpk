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
Processes and functions for communicting with kubernetes via CLI
*/

'use strict';

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
var Q = require('q');
var glbGet = '';
var getKindList = '';

//----------------------------------------------------------
var authenticate = function (cmd) {
    utl.logMsg('vpkKUB062 - Authenticate invoked using: ' + cmd);
    var execSync = require('child_process').execSync;
    try {
        var out;
        if (cmd.indexOf('noauth') > -1) {
            out = 'OK NoAuth Required';
            utl.logMsg('vpkKUB063 - Login skipped, no auth required');
        } else {
            out = execSync(cmd).toString();
            var hl = out.length;
            utl.logMsg('vpkKUB060 - Login bytes of data: ' + hl);
        }
        return out;
    } catch (err) {
        utl.logMsg('vpkKUB061 - Error authenticating, message: ' + err);
        return '';
    }
};



// issue command to get the api-resources to determine what is in the cluster
var kubeapis = function () {
    // utl.logMsg('vpkKUB064 - ClusterVersion invoked');
    // kubeVersionInfo();
    var execSync = require('child_process').execSync;
    try {
        var cmd = glbGet + ' api-resources -o wide';
        utl.logMsg('vpkKUB072 - ' + cmd);
        var out = execSync(cmd).toString();
        // var hl = out.length;
        return out;
    } catch (err) {
        utl.logMsg('vpkKUB071 - Error getting api-resource information.  message: ' + err);
        return { "items": [], "error": err };
    }
};


var kubeget = function (ns, kind) {
    var deferred = Q.defer();
    var execSync = require('child_process').execSync;
    var out;
    var cmd;
    var explain;
    var expOut;
    try {
        // Reformat command sequence for Kubernetes 1.11, namespace and -o option had
        // to be placed after the get <kind>
        cmd = '';

        if (ns === 'all-namespaces') {
            cmd = glbGet + ' get ' + kind + ' --all-namespaces -o json';
        } else if (ns === '') {
            cmd = glbGet + ' get ' + kind + ' -o json';
        } else {
            cmd = glbGet + ' get ' + kind + ' -n ' + ns + ' -o json';
        }
        explain = glbGet + ' explain ' + kind;

        out = execSync(cmd, { maxBuffer: 50 * 1024 * 1024 }).toString();
        // var hl = out.length;
        // //return out;

        expOut = execSync(explain).toString();
        expOut = expOut.split('FIELDS:')
        expOut = expOut[0];

        vpk.explains[kind] = expOut;

        deferred.resolve(out);
    } catch (err) {
        utl.logMsg('vpkKUB081 - Error getting information for kind: ' + kind + ',  Message: ' + err);
        utl.logMsg('vpkKUB082 - Command : ' + cmd + ' output: \n');
        if (typeof out !== 'undefined') {
            console.log(out);
        } else {
            console.log('No output from command execution');
        }

        //return '{"items":[]}';
        deferred.resolve('{"items":[]}');
    }

    return deferred.promise;
};


var getProvider = function (kinfo) {
    var hl = vpk.configFile.providers.length;
    for (var k = 0; k < hl; k++) {
        if (vpk.configFile.providers[k].name === kinfo.ctype) {
            return vpk.configFile.providers[k];
        }
    }
    return null;
};


var buildAuthCmd = function (provider, kinfo) {
    //utl.logMsg('vpkKUB900 - Build auth command invoked' );      
    var rtn = '';
    var base = '';
    var parms = '';
    var pl;
    var tmp;
    var pv;
    var hp;
    if (typeof provider.authCmd.command !== 'undefined') {
        // determine if authorization is needed
        if (base.length === 0) {
            return 'NOAUTH'
        }
        base = provider.authCmd.command + ' ';
        base = base + ' ';
    }


    if (typeof provider.authCmd.parms !== 'undefined') {
        tmp = provider.authCmd.parms;
        pl = tmp.length;
        if (pl > 0) {
            for (var p = 0; p < pl; p++) {

                // check sal (skip at login)
                if (typeof tmp[p].sal !== 'undefined') {
                    if (tmp[p].sal === true) {
                        continue;
                    }
                }

                // get the parm and value
                pv = '';
                hp = tmp[p].value.indexOf('{{');
                if (hp > -1) {
                    pv = getKV(tmp[p].value, kinfo);
                } else {
                    pv = tmp[p].value;
                }
                pv = pv.trim();

                // set the namespace value for ICP
                //if (provider.name === 'icp' || provider.name === 'chicago') {
                if (tmp[p].key.startsWith('-n')) {
                    if (pv === 'all-namespaces') {
                        pv = 'default';
                    }
                }
                //} 

                // check swe (skip when empty)
                if (tmp[p].swe === true) {
                    if (pv.length === 0) {
                        continue;
                    }
                }

                // check if parm and value need spaces between each other
                if (tmp[p].key.endsWith('=')) {
                    if (pv.length > 0) {
                        parms = parms + tmp[p].key + pv + ' ';
                    }
                } else {
                    parms = parms + tmp[p].key + ' ' + pv + ' ';
                }
            }
            rtn = base + parms;
        }
    }
    return rtn;
};


var buildGetCmd = function (provider) {
    //utl.logMsg('vpkKUB940 - Build get command invoked' );   

    var rtn = '';

    if (typeof provider.getCmd.command !== 'undefined') {
        rtn = provider.getCmd.command;
    } else {
        // if nothing defined provide kubectl
        rtn = "kubectl"
    }

    rtn = rtn.trim();

    // Strip 'get' if found at the end

    if (rtn.endsWith('get')) {
        rtn = rtn.substring(0, rtn.length - 3)
    }

    //utl.logMsg('vpkKUB942 - Cluster command: ' + rtn);
    return rtn;
};


var getKV = function (parm, kinfo) {
    var rtn = '';
    var pre = [];
    var dat = [];
    var items;
    var parts = parm.split('}}');
    if (parts.length > 0) {
        for (var p = 0; p < parts.length; p++) {
            if (parts[p].trim().length > 0) {
                items = parts[p].split('{{');
                if (items.length > 0) {
                    pre[p] = items[0];
                    dat[p] = getParm(items[1], kinfo);
                } else {
                    pre[p] = '';
                    dat[p] = getParm(items[0], kinfo);
                }
            }
        }
    }
    for (var r = 0; r < pre.length; r++) {
        rtn = rtn + pre[r] + dat[r];
    }

    return rtn;
};


var getParm = function (parm, kinfo) {
    if (typeof kinfo[parm] !== 'undefined') {
        return kinfo[parm]
    } else {
        utl.logMsg('vpkKUB201 - Did not locate parameter: ' + parm);
        return ' ';
    }
};

var checkTest = function () {
    return 'PASS';
};

var checkPass = function (value, auth) {
    if (auth.indexOf(value) > -1) {
        return 'PASS';
    } else {
        return 'FAIL';
    }
};

var checkFail = function (value, auth) {
    if (auth.indexOf(value) > -1) {
        return 'FAIL';
    } else {
        return 'PASS';
    }
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

var endsession = function (cmd) {
    var execSync = require('child_process').execSync;
    try {
        var out;
        if (cmd.indexOf('noauth') > -1) {
            out = 'OK NoAuth Required';
            utl.logMsg('vpkKUB063 - Logout skipped, no auth required');
        } else {
            out = execSync(cmd).toString();
            var hl = out.length;
            utl.logMsg('vpkKUB060 - Logout bytes of data: ' + hl);
        }
        return out;
    } catch (err) {
        console.log('vpkKUB408 - Error during logout, message: ' + err);
        return '';
    }
};

//------------------------------------------------------------------------------
var buildStopCmd = function (provider) {
    if (typeof provider.stopCmd !== 'undefined') {
        if (typeof provider.stopCmd.command !== 'undefined') {
            return provider.stopCmd.command;
        }
    }
    return 'noauth';
};

// issue command from UI
var runCommand = function (cmd) {
    var execSync = require('child_process').execSync;
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
module.exports = {

    getAuth: function (kinfo) {
        utl.logMsg('vpkKUB005 - GetAuth invoked');
        var provider = getProvider(kinfo);
        var rtn = 'PASS';
        // gblGet = '';
        if (typeof provider !== 'undefined' && provider !== null) {
            var cmd = buildAuthCmd(provider, kinfo);
            var get = buildGetCmd(provider, kinfo);
            // setting a global value that will be reused for the get or base command 
            glbGet = get;
            if (cmd === 'NOAUTH' || cmd === 'noauth') {
                // no authorization required defined in the vpk.providers
            } else {
                var auth = authenticate(cmd);
                // check if custom test is used to validate
                if (typeof provider.authCmd.test !== 'undefined' && provider.authCmd.test.length > 0) {
                    rtn = checkTest(provider, auth);
                    return rtn;
                }
                // check pass
                if (typeof provider.authCmd.pass !== 'undefined' && provider.authCmd.pass.length > 0) {
                    rtn = checkPass(provider.authCmd.pass, auth);
                    return rtn;
                }
                // check fail
                if (typeof provider.authCmd.fail !== 'undefined' && provider.authCmd.fail.length > 0) {
                    rtn = checkFail(provider.authCmd.fail, auth);
                    return rtn;
                }
            }
        }
        return rtn;
    },


    //------------------------------------------------------------------------------
    // run command on server
    //------------------------------------------------------------------------------
    runCommand: function (cmd) {
        utl.logMsg('vpkKUB103 - Run command invoked');
        return runCommand(cmd);
    },


    //------------------------------------------------------------------------------
    // log out of cluster
    //------------------------------------------------------------------------------
    logout: function (kinfo) {
        utl.logMsg('vpkKUB035 - Logout invoked');
        var provider = getProvider(kinfo);
        var rtn = 'PASS';
        if (typeof provider !== 'undefined' && provider !== null) {
            var cmd = buildStopCmd(provider, kinfo);
            if (cmd === 'NOAUTH' || cmd === 'noauth') {
                // no logout required
            } else {
                return endsession(cmd);
            }
        } else {
            return rtn;
        }
    },


    getAPIs: function (kinfo) {
        getKindList = '::';
        var provider = getProvider(kinfo);

        if (typeof provider !== 'undefined' && provider !== null) {
            var apidata = kubeapis();

            if (typeof apidata.error !== 'undefined') {
                utl.logMsg('vpkKUB017 - Error processing, message: ' + apidata.error);
                return 'FAIL';
            }

            // build kga (Kubernetes Get Array) from the results of the api-resources command
            var kga = parseAPIs(apidata);
            return kga;
        }
    },

    // get data for request 
    // kga (Kubernetes Get Array) 
    getKubeInfo: function (kinfo, kga, client) {
        var deferred = Q.defer();

        try {
            if (typeof kinfo.namespace === 'undefined') {
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
