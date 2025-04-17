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

//----------------------------------------------------------
// read k8cData and construct data for 3d cluster
//----------------------------------------------------------

function build3DJSON() {
    // initialize common data variables
    meshArray = [];
    foundNSNames = [];
    foundStorageClasses = {};
    cluster = {};
    podArray = []; // Array of displayed pods using fnum
    sliceArray = []; // Array of slice rings
    resourceArray = []; // Array of memory and cpu info
    controlPlaneArray = []; // Array for control plane
    networkLinks = []; // Array of pods that link to existing endpoint/service
    pvcLinks = {};
    pvcBuild = {};
    foundPVC = {};
    foundPVs = {};
    nodeStats = {};
    maxPodCount = 0;
    ingressArray = [];
    foundCSINames = [];
    foundCSINamesFnum = [];
    clusterOtherKeys = [];

    if (typeof k8cData['0000-clusterLevel'] !== 'undefined') {
        if (typeof k8cData['0000-clusterLevel'].Node !== 'undefined') {
            let nData = k8cData['0000-clusterLevel'].Node;
            //add Worker nodes to cluster, then add Master nodes
            cluster.maxNodes = nData.length;
            maxNodeCount = cluster.maxNodes;
            cluster.nodeArc = 360 / cluster.maxNodes;
            cluster.nodes = [];

            console.log(`Cluster node count: ${maxNodeCount}`);

            // Create object with node names and type for use in storage tab
            for (let i = 0; i < nData.length; i++) {
                nodeTypes[nData[i].name] = nData[i].type;
            }

            // Worker nodes
            for (let i = 0; i < nData.length; i++) {
                if (nData[i].type === 'w') {
                    cluster.nodes.push(nData[i]);
                }
            }
            // Master nodes
            for (let i = 0; i < nData.length; i++) {
                if (nData[i].type === 'm') {
                    cluster.nodes.push(nData[i]);
                }
            }
            nData = null;
            populatePods();
        }
        if (typeof k8cData['0000-clusterLevel'].IngressClass !== 'undefined') {
            ingressArray.push(k8cData['0000-clusterLevel'].IngressClass);
        }
        if (typeof k8cData['0000-clusterLevel'].Ingress !== 'undefined') {
            ingressArray.push(k8cData['0000-clusterLevel'].Ingress);
        }

        if (typeof k8cData['0000-clusterLevel'].ComponentStatus !== 'undefined') {
            compStatus = k8cData['0000-clusterLevel'].ComponentStatus;
        }

        if (typeof k8cData['0000-clusterLevel'].CSIDriver !== 'undefined') {
            for (let i = 0; i < k8cData['0000-clusterLevel'].CSIDriver.length; i++) {
                foundCSINames.push(k8cData['0000-clusterLevel'].CSIDriver[i].name);
                let fnum = k8cData['0000-clusterLevel'].CSIDriver[i].name + '::' + k8cData['0000-clusterLevel'].CSIDriver[i].fnum;
                foundCSINamesFnum.push(fnum);
            }
        }

        if (volumeAttachments !== 'undefined') {
            let vaKeys = Object.keys(volumeAttachments);
            for (let i = 0; i < vaKeys.length; i++) {
                let info = volumeAttachments[vaKeys[i]];
                if (typeof volAttach[info[0].pvName] === 'undefined') {
                    volAttach[info[0].pvName] = [];
                }

                volAttach[info[0].pvName].push({
                    name: info[0].name,
                    fnum: info[0].fnum,
                    pvFnum: info[0].pvFnum,
                });
            }
        }
        // console.log(JSON.stringify(volAttach, null, 4));
    }

    // populate drop down filter with located NS values in this cluster
    populate3DSelectNS();

    // populate storage class array
    if (typeof k8cData['0000-@storageClass@'] !== 'undefined') {
        let scKeys = Object.keys(k8cData['0000-@storageClass@']);
        for (let k = 0; k < scKeys.length; k++) {
            saveStorageClass(
                k8cData['0000-@storageClass@'][scKeys[k]].name,
                k8cData['0000-@storageClass@'][scKeys[k]].fnum,
                k8cData['0000-@storageClass@'][scKeys[k]].provisioner,
            );
        }
    }
}

function populate3DSelectNS() {
    if (foundNSNamesBuilt === true) {
        return;
    }
    // namespace drop downs
    let data = bldOptions(foundNSNames, 'S', 'no');
    $('#cluster-ns-filter').empty();
    $('#cluster-ns-filter').html(data);
    foundNSNamesBuilt = true;
}

function saveStorageClass(name, fnum, prov) {
    if (typeof name === 'undefined' || name === null) {
        return;
    }
    if (typeof foundStorageClasses[name] === 'undefined') {
        foundStorageClasses[name] = { name: name, fnum: fnum, pv: [], prov: prov };
    }
}

function savePVC(name, ns, pvcFnum, podFnum) {
    if (typeof name === 'undefined' || name === null) {
        return;
    }

    let key = name + '::' + ns;
    if (typeof foundPVC[key] === 'undefined') {
        foundPVC[key] = { name: name, ns: ns, fnum: pvcFnum, cnt: 1, podFnum: podFnum };
    } else {
        let cnt = foundPVC[key].cnt;
        cnt++;
        foundPVC[key].cnt = cnt;
    }

    if (typeof pvcBuild[key] === 'undefined') {
        //PVC info does not exists
        pvcBuild[key] = { fnum: pvcFnum, podFnum: podFnum };
    } else {
        //builtBy = pvcBuild[key].podFnum;
        pvcLinks[podFnum] = { podFnum: pvcBuild[key].podFnum };
    }
}

// populate pod with information
function populatePods() {
    podCount = 0;
    let keys = Object.keys(k8cData);
    let spcTmp;
    for (let i = 0; i < keys.length; i++) {
        if (typeof k8cData[keys[i]].kind !== 'undefined') {
            // In k8cData the kind = 'Pod'
            if (k8cData[keys[i]].kind === 'Pod') {
                // save unique array list of namespaces
                if (!foundNSNames.includes(k8cData[keys[i]].namespace)) {
                    foundNSNames.push(k8cData[keys[i]].namespace);
                }
                let pod = {};
                let nodeName = k8cData[keys[i]].node;
                pod.name = k8cData[keys[i]].name;
                pod.ns = k8cData[keys[i]].namespace;
                pod.fnum = k8cData[keys[i]].fnum;

                pod.phase = k8cData[keys[i]].phase;
                if (pod.phase === 'Running') {
                    pod.status = 1;
                } else if (pod.phase === 'Failed') {
                    pod.status = 2;
                } else if (pod.phase === 'Succeeded') {
                    pod.status = 4;
                } else {
                    pod.status = 3;
                }

                if (k8cData[keys[i]].daemonSetPod === true) {
                    pod.status = 0;
                }

                if (typeof k8cData[keys[i]].status.conditions !== 'undefined') {
                    pod.conditions = k8cData[keys[i]].status.conditions;
                } else {
                    pod.conditions = [];
                }
                if (typeof k8cData[keys[i]].PersistentVolumeClaim !== 'undefined') {
                    //Save the PVC name and NS
                    savePVC(
                        k8cData[keys[i]].PersistentVolumeClaim[0].pvcName,
                        k8cData[keys[i]].namespace,
                        k8cData[keys[i]].PersistentVolumeClaim[0].pvcFnum,
                        pod.fnum,
                    );

                    if (typeof k8cData[keys[i]].PersistentVolumeClaim[0] !== 'undefined') {
                        pod.pvc = [
                            {
                                name: k8cData[keys[i]].PersistentVolumeClaim[0].pvcName,
                                fnum: k8cData[keys[i]].PersistentVolumeClaim[0].pvcFnum,
                                pvName: k8cData[keys[i]].PersistentVolumeClaim[0].pvName,
                                pvFnum: k8cData[keys[i]].PersistentVolumeClaim[0].pvFnum,
                                pvcSpace: k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace,
                                scName: k8cData[keys[i]].PersistentVolumeClaim[0].storageClassName,
                                scFnum: k8cData[keys[i]].PersistentVolumeClaim[0].storageClassFnum,
                                ns: k8cData[keys[i]].namespace,
                            },
                        ];

                        if (k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace > 0) {
                            if (typeof nodeSpace[nodeName] !== 'undefined') {
                                spcTmp = nodeSpace[nodeName];
                                nodeSpace[nodeName] = spcTmp + k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace;
                            } else {
                                nodeSpace[nodeName] = k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace;
                            }
                        }
                    } else {
                        pod.pvc = [];
                    }
                } else {
                    pod.pvc = false;
                }

                // Pod network services info
                if (typeof k8cData[keys[i]].Services !== 'undefined') {
                    pod.serviceFound = true;
                    pod.services = [];
                    let chkStr = ':';
                    for (let s = 0; s < k8cData[keys[i]].Services.length; s++) {
                        if (chkStr.indexOf(':' + k8cData[keys[i]].Services[s].fnum + ':') === -1) {
                            let sData = k8cData[keys[i]].Services[s];
                            pod.services.push(k8cData[keys[i]].Services[s]);
                            chkStr = chkStr + k8cData[keys[i]].Services[s].fnum + ':';
                        }
                    }
                } else {
                    pod.serviceFound = false;
                    pod.services = [];
                }

                // Pod memory and cpu LIMITs
                if (typeof k8cData[keys[i]].resourceLimit !== 'undefined') {
                    let cpuLimit = 0;
                    let memoryLimit = 0;
                    let tVal = 0;

                    for (let r = 0; r < k8cData[keys[i]].resourceLimit.length; r++) {
                        if (typeof k8cData[keys[i]].resourceLimit[r].cpu !== 'undefined') {
                            tVal = k8cData[keys[i]].resourceLimit[r].cpu;
                            if (tVal !== '0') {
                                tVal = parseCPU(tVal);
                                if (typeof tVal === 'string') {
                                    cpuLimit = cpuLimit + parseFloat(tVal);
                                } else {
                                    cpuLimit = cpuLimit + tVal;
                                }
                            }
                        }

                        if (typeof k8cData[keys[i]].resourceLimit[r].memory !== 'undefined') {
                            tVal = k8cData[keys[i]].resourceLimit[r].memory;
                            if (tVal !== '0') {
                                tVal = parseMemory(tVal);
                                if (typeof tVal === 'string') {
                                    memoryLimit = memoryLimit + parseFloat(tVal);
                                } else {
                                    memoryLimit = memoryLimit + tVal;
                                }
                            }
                        }
                    }

                    pod.cpuLimit = cpuLimit;
                    pod.memoryLimit = memoryLimit;
                } else {
                    pod.cpuLimit = 0;
                    pod.memoryLimit = 0;
                }

                // Pod memory and cpu REQUESTs
                if (typeof k8cData[keys[i]].resourceRequest !== 'undefined') {
                    let cpu = 0;
                    let memory = 0;
                    let tVal = 0;

                    for (let r = 0; r < k8cData[keys[i]].resourceRequest.length; r++) {
                        if (typeof k8cData[keys[i]].resourceRequest[r].cpu !== 'undefined') {
                            tVal = k8cData[keys[i]].resourceRequest[r].cpu;
                            if (tVal !== '0') {
                                tVal = parseCPU(tVal);
                                if (typeof tVal === 'string') {
                                    cpu = cpu + parseFloat(tVal);
                                } else {
                                    cpu = cpu + tVal;
                                }
                            }
                        }

                        if (typeof k8cData[keys[i]].resourceRequest[r].memory !== 'undefined') {
                            tVal = k8cData[keys[i]].resourceRequest[r].memory;
                            if (tVal !== '0') {
                                tVal = parseMemory(tVal);
                                if (typeof tVal === 'string') {
                                    memory = memory + parseFloat(tVal);
                                } else {
                                    memory = memory + tVal;
                                }
                            }
                        }
                    }
                    pod.cpuRequest = cpu;
                    pod.memoryRequest = memory;
                } else {
                    pod.cpuRequest = 0;
                    pod.memoryRequest = 0;
                }

                addPodToNode(pod, nodeName);
            }
        }
    }

    let nkeys = Object.keys(nodeStats);
    for (nk = 0; nk < nkeys.length; nk++) {
        if (nodeStats[nkeys[nk]].podCount > maxPodCount) {
            maxPodCount = nodeStats[nkeys[nk]].podCount;
        }
    }
}

function parseLetter(s) {
    let f = '';
    //set factor
    if ((s = 'K')) {
        f = 0;
    } else if ((s = 'M')) {
        f = 1;
    } else if ((s = 'G')) {
        f = 2;
    } else if ((s = 'T')) {
        f = 3;
    } else if ((s = 'P')) {
        f = 4;
    } else if ((s = 'E')) {
        f = 5;
    } else if ((s = 'Z')) {
        f = 6;
    } else if ((s = 'Y')) {
        f = 7;
    }
    return f;
}

function parseCPU(v) {
    let num = 0;
    let s = '';
    let f = 0;

    if (typeof v === 'string') {
        if (v.endsWith('i')) {
            s = v.substring(v.length - 2);
            s = s.substring(0, s.length - 1);
            f = parseLetter(s);
            num = v.substring(0, v.length - 2);
            //num = num * bt[f];
        } else {
            s = v.substring(v.length - 1, v.length);

            if (s === 'm' || s === 'M') {
                num = v.substring(0, v.length - 1);
            } else if (s === 'G') {
                num = v.substring(0, v.length - 1);
                num = v * 1000;
            } else {
                if (v.length === 1) {
                    num = s;
                    num = s * 1000;
                } else {
                    num = v.substring(0, v.length - 1);
                    if (typeof num !== 'number') {
                        console.log(`parseCPU() doesn't know how to handle cpu: ${v} and num: ${num}`);
                    }
                }
            }
        }
    } else {
        num = v * 1000;
    }
    return num;
}

function parseMemory(v) {
    // Check if zero
    if (v === 0) {
        return 0;
    }

    let num = 0;
    let f = 0;
    let s = '';

    if (typeof v === 'string') {
        if (v.endsWith('i')) {
            s = v.substring(v.length - 2);
            s = s.substring(0, s.length - 1);
            f = parseLetter(s);
            num = v.substring(0, v.length - 2);
            num = num * bn[f];
        } else {
            s = v.substring(v.length, v.length);
            f = parseLetter(s);
            num = v.substring(0, v.length - 1);
            num = num * bt[f];
        }
    } else {
        num = v;
    }
    return num;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) {
        return '0 Bytes';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return sizes[i] + ' ' + parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
}

function addPodToNode(pod, nodeName) {
    if (typeof nodeStats[nodeName] === 'undefined') {
        nodeStats[nodeName] = { podCount: 0 };
    }

    for (let n = 0; n < cluster.nodes.length; n++) {
        if (cluster.nodes[n].name === nodeName) {
            if (typeof cluster.nodes[n].pods === 'undefined') {
                cluster.nodes[n].pods = [];
            }
            cluster.nodes[n].pods.push(pod);
            nodeStats[nodeName].podCount = nodeStats[nodeName].podCount + 1;
            break;
        }
    }
}

function parseOther() {
    if (typeof nodeStats[nodeName] === 'undefined') {
        nodeStats[nodeName] = { podCount: 0 };
    }

    for (let n = 0; n < cluster.nodes.length; n++) {
        if (cluster.nodes[n].name === nodeName) {
            if (typeof cluster.nodes[n].pods === 'undefined') {
                cluster.nodes[n].pods = [];
            }
            cluster.nodes[n].pods.push(pod);
            nodeStats[nodeName].podCount = nodeStats[nodeName].podCount + 1;
            break;
        }
    }
}

//----------------------------------------------------------
console.log('loaded vpk3dData.js');
