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

/*------------------------------------------------------------------------------
Compare snapshots
*/

const utl = require('../lib/utl');
const vpk = require('../lib/vpk');
const fs = require('fs');
const YAML = require('js-yaml');

let resources;

//------------------------------------------------------------------------------
var compare = function (data) {
    resources = {};
    try {
        utl.logMsg('vpkCMP001 - Comparing snapshots');
        if (typeof data.snap1 !== 'undefined') {
            readSnapDir(data.snap1, '1');
        }
        if (typeof data.snap2 !== 'undefined') {
            readSnapDir(data.snap2, '2');
        }

        return { 'resources': resources }
    } catch (err) {
        utl.logMsg('vpkCMP003 - Error comparing snapshots, message: ' + err);
        utl.logMsg('vpkCMP004 - Stack: ' + err.stack);
    }
};

//------------------------------------------------------------------------------
// read directory and populate file array 
//------------------------------------------------------------------------------
var readSnapDir = function (snap, which) {
    try {
        utl.logMsg('vpkCMP012 - Checking Snap: ' + which + ' for files, directroy: ' + snap);

        let files = fs.readdirSync(snap);
        utl.logMsg('vpkCMP014 - Files located: ' + files.length);
        let data;
        let key;
        let file;
        let spec;
        let skipCnt = 0;
        for (let i = 0; i < files.length; i++) {
            file = files[i];
            data = readFile(file, snap);
            if (data !== 'skip') {
                key = data.key;
                if (typeof resources[key] === 'undefined') {
                    if (which === '1') {        // snap1
                        resources[key] = {
                            'name': data.name,
                            'kind': data.kind,
                            'ns': data.ns,
                            'fn1': data.fn,
                            'time1': data.timestamp,
                            'spec1': JSON.stringify(data.spec),
                            'fn2': 'ndf',
                            'timeOK': false,
                            'specOK': false,
                            'nameOK': false,
                            'api': data.api
                        }
                    } else {
                        resources[key] = {
                            'name': data.name,
                            'kind': data.kind,
                            'ns': data.ns,
                            'fn1': 'ndf',
                            'time1': '',
                            'stat1': '',
                            'fn2': data.fn,
                            'timeOK': false,
                            'specOK': false,
                            'nameOK': false,
                            'api': data.api
                        }
                    }
                } else {
                    if (which === '1') {
                        // duplicate entry skip
                        //utl.logMsg('vpkCMP027 - Duplicate snap file key: ' + key + 'file: ' + file + ' for snap1');
                    } else {
                        // "metadta.name" matches 
                        resources[key].fn2 = data.fn;
                        resources[key].nameOK = true;
                        // Comparing "metadata.creationTimestamp:""
                        if (resources[key].time1 === data.timestamp) {
                            resources[key].timeOK = true;
                        }
                        resources[key].time1 = '';
                        // Comparing "spec:"
                        spec = JSON.stringify(data.spec);
                        if (resources[key].spec1 === spec) {
                            resources[key].specOK = true;
                        }
                        resources[key].spec1 = '';
                    }
                }
            } else {
                skipCnt++;
            }
        }
        utl.logMsg('vpkCMP016 - Read phase for Snap: ' + which + ' completed');
        if (skipCnt > 0) {
            utl.logMsg('vpkCMP018 - Skipped ' + skipCnt + ' files');

        }
        return;
    } catch (err) {
        utl.logMsg('vpkCMP020 - Error - Comparing snap: ' + snap + 'file: ' + file + '  message: = ' + err);
        utl.logMsg('vpkCMP021 - Stack: ' + err.stack);
        // clear the file array since there is an error and not able to process
        return [];
    }
};


//------------------------------------------------------------------------------
// using yamljs read and parse the file
//------------------------------------------------------------------------------
var readFile = function (fn, snap) {
    if (fn.endsWith('explains.json')) {
        // the Expains.json file gets skipped
        return 'skip';
    }
    let contents;
    let item = '';
    let fn2;

    try {
        if (vpk.platform.indexOf('wind') > -1) {
            fn2 = snap + '\\' + fn;
        } else {
            fn2 = snap + '/' + fn;
        }

        contents = YAML.safeLoadAll(fs.readFileSync(fn2));      //js-yaml 
        // determine if this is yaml has what is needed			
        if (typeof contents[0] !== 'undefined') {
            if (contents[0] !== null) {
                item = readYaml(contents[0]);
                if (item !== 'skip') {
                    item.fn = fn;
                }
                return item;
            }
        }
    } catch (err) {
        utl.logMsg('vpkCMP031 - Skipped file, unable to parse as YAML, file name: ' + fn);
        return 'skip';
    }
};

//------------------------------------------------------------------------------
// read the yaml and build resource info
//------------------------------------------------------------------------------
var readYaml = function (yaml) {
    let ns = '@clusterLevel';
    let name = 'missing';
    let kind = 'missing';
    let api = 'missing';
    let timestamp = '';
    let spec = '';
    let key = '';
    try {
        if (typeof yaml.metadata.namespace !== 'undefined') {
            ns = yaml.metadata.namespace;
        } else {
            ns = '@clusterLevel';
        }
        if (ns === '') {
            ns = '@clusterLevel';
        }
        apiVersion:
        if (typeof yaml.kind !== 'undefined') {
            kind = yaml.kind;
        }

        if (typeof yaml.apiVersion !== 'undefined') {
            api = yaml.apiVersion;
        }
        if (typeof yaml.metadata.name !== 'undefined') {
            name = yaml.metadata.name;
        }
        if (typeof yaml.metadata.creationTimestamp !== 'undefined') {
            timestamp = yaml.metadata.creationTimestamp;
        }
        if (typeof yaml.spec !== 'undefined') {
            spec = yaml.spec;
        }
        key = ns + ':@:' + name + ':@:' + kind;
        return { 'key': key, 'name': name, 'ns': ns, 'kind': kind, 'timestamp': timestamp, 'spec': spec, 'api': api };
    } catch (err) {
        utl.logMsg('vpkCMP041 - Skipped, unable to build content, message: ' + err);
        return 'skip';
    }
};


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    snapshots: function (data) {
        return compare(data);
    }
};
