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
/*------------------------------------------------------------------------------
Parse Node
*/
'use strict';
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
import { formatBytes } from '../../utils/formatbytes.js';
var stripKi = function (amt) {
    let newAmt = amt.substring(0, amt.length - 2);
    newAmt = parseInt(newAmt);
    newAmt = newAmt * 1024;
    newAmt = formatBytes(newAmt);
    return newAmt.substring(3);
};
//------------------------------------------------------------------------------
export function nodeParse(ns, kind, name, obj, fnum) {
    let type = '';
    let capac = {};
    let alloc = {};
    let conditions = [];
    let provider = 'unknown';
    let addresses = [];
    let nodeInfo = 'unknown';
    let rootIP;
    const masterKey = 'node-role.kubernetes.io/master';
    const controlPlane = 'node-role.kubernetes.io/control-plane';
    // console.log(JSON.stringify(obj, null, 2))
    try {
        if (typeof vpk.nodesFnum[fnum] === 'undefined') {
            vpk.nodesFnum[fnum] = [];
        }
        // build node type, default is worker
        type = 'w'; // worker node
        if (typeof obj.metadata.labels[masterKey] !== 'undefined') {
            type = 'm'; // master node
        }
        if (typeof obj.metadata.labels[controlPlane] !== 'undefined') {
            type = 'm'; // master node
        }
        // populate node allocatable and capacity
        if (typeof obj.status.capacity !== 'undefined') {
            capac = obj.status.capacity;
        }
        if (typeof obj.status.allocatable !== 'undefined') {
            alloc = obj.status.allocatable;
        }
        if (typeof obj.spec.providerID !== 'undefined') {
            provider = obj.spec.providerID;
        }
        // populate conditions info
        if (typeof obj.status.conditions !== 'undefined') {
            conditions = obj.status.conditions;
        }
        if (typeof obj.status.addresses !== 'undefined') {
            addresses = obj.status.addresses;
        }
        if (typeof obj.status.nodeInfo !== 'undefined') {
            nodeInfo = obj.status.nodeInfo;
        }
        rootIP = 'Unknown';
        for (let i = 0; i < addresses.length; i++) {
            if (typeof addresses[i] !== 'undefined') {
                if (addresses[i].type === 'InternalIP') {
                    rootIP = addresses[i].address;
                }
            }
        }
        // Save info for each Node
        if (typeof vpk.nodeType[name] === 'undefined') {
            vpk.nodeType[name] = {
                type: type,
                fnum: fnum,
                address: rootIP,
            };
        }
        vpk.nodesFnum[fnum].push({
            name: name,
            fnum: fnum,
            type: type,
            api: obj.apiVersion,
            a_cpu: alloc.cpu,
            a_memory: alloc.memory,
            a_memory_gb: stripKi(alloc.memory),
            a_pods: alloc.pods,
            c_cpu: capac.cpu,
            c_memory: capac.memory,
            c_memory_gb: stripKi(capac.memory),
            c_pods: capac.pods,
            conditions: conditions,
            csiNodes: [],
            provider: provider,
            nodeInfo: nodeInfo,
            addresses: addresses,
            rootIP: rootIP,
        });
        // populate conditions info
        if (typeof obj.status.addresses !== 'undefined') {
            let netKey = kind + ':cluster-level:' + name;
            let netInfo = {};
            netInfo.addresses = obj.status.addresses;
            netInfo.fnum = fnum;
            netInfo.name = name;
            if (typeof vpk.netInfo[netKey] === 'undefined') {
                vpk.netInfo[netKey] = netInfo;
            }
        }
        if (typeof vpk.networkNodes[name] === 'undefined') {
            vpk.networkNodes[name] = {
                addresses: addresses,
                pods: {},
                services: [],
                type: type,
            };
        }
    }
    catch (err) {
        logMessage('NOD001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('NOD001 - Stack: ' + err.stack);
    }
}
