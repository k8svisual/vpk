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

//----------------------------------------------------------
// build data for cluster tab
//----------------------------------------------------------

let canvas = document.getElementById("renderCanvas");
var engine = null;
var camera = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
};
// let foundServices = {};
// let foundNSNames = [];
// let foundStorageClasses = {};
// let foundPVC = {};
// let foundPVs = {};
// let cluster = {};
// let meshArray = [];             // Array of all meshes
// let podArray = [];              // Array of displayed pods using fnum
// let sliceArray = [];            // Array of slice rings 
// let resourceArray = [];         // Array of memory and cpu info 
// let controlPArray = [];
// let mstCount = 0;
// let nodeSpace = {};

// let networkLinks = {};
// let pvLinks = [];              // Array of PVs that are biult
// let pvcLinks = {};
// let pvcBuild = {};
// let pvToVolAttLinks = {};

// let bn = [
//     1024, //Ki
//     1048576, //Mi
//     1073741824, //Gi
//     1099511627776, //Ti
//     1125899906842620, //Pi
//     1152921504606850000, //Ei
//     1180591620717410000000, //Zi
//     1208925819614630000000000 //Yi
// ];

// let bt = [
//     1000,
//     1000000,
//     1000000000,
//     1000000000000,
//     1000000000000000,
//     1000000000000000000,
//     1000000000000000000000,
//     1000000000000000000000000
// ];

function print3Dscene() {
    if (engine !== null) {
        //BABYLON.Tools.CreateScreenshot(engine, camera, 800)
        //BABYLON.Tools.CreateScreenshot(engine, camera, { width: 1024, height: 300 },
        BABYLON.Tools.CreateScreenshot(engine, camera, { width: 1250, height: 700 },
            function (data) {
                $("#clusterScreenShot").html("<img src='" + data + "'/>");
                printDiv('clusterPicture')

            });
    } else {
        console.log('No 3D image to print');
    }
}

function set3dBackColor(r, g, b, title) {
    // reset stars and clouds
    sceneStars = false;
    sceneClouds = false;
    // set if stars or clouds
    if (title === 'Stars') {
        sceneStars = true;
        sceneClouds = false;
        stickColorDark = false;
        $("#colorTitle").html('Image:&nbsp;' + title);
        return;
    }

    if (title === 'Clouds') {
        sceneClouds = true;
        sceneStars = false;
        stickColorDark = true;
        $("#colorTitle").html('Image:&nbsp;' + title);
        return;
    }

    // Solid color not image
    sceneColorR = r / 255;
    sceneColorG = g / 255;
    sceneColorB = b / 255;
    $("#colorTitle").html('Color:&nbsp;' + title);
    if (title === 'Straw' || title === 'Grey' || title === 'Lavender' || title === 'Olive' || title === 'Teal' || title === 'White') {
        stickColorDark = true;
    } else {
        stickColorDark = false;
    }
}


// function populate3DSelectNSXXX() {
//     if (foundNSNamesBuilt === true) {
//         return
//     }
//     // namespace drop downs
//     let data = bldOptions(foundNSNames, 'N', 'select2');

//     $("#cluster-ns-filter").empty();
//     $("#cluster-ns-filter").select2({
//         data: data,
//         dropdownCssClass: "vpkfont-md",
//         containerCssClass: "vpkfont-md"
//     });
//     foundNSNamesBuilt = true;
// }


// function build3DJSONXXX() {
//     meshArray = [];
//     foundNSNames = [];
//     foundStorageClasses = {};
//     cluster = {};
//     podArray = [];              // Array of displayed pods using fnum
//     sliceArray = [];            // Array of slice rings 
//     resourceArray = [];         // Array of memory and cpu info 
//     controlPArray = [];         // Array for control plane
//     networkLinks = [];          // Array of pods that link to existing endpoint/service
//     pvcLinks = {};
//     pvcBuild = {};
//     foundPVC = {};
//     foundPVs = {};

//     if (typeof k8cData['0000-clusterLevel'] !== 'undefined') {
//         if (typeof k8cData['0000-clusterLevel'].Node !== 'undefined') {
//             let nData = k8cData['0000-clusterLevel'].Node;
//             //add Worker nodes to cluster, then add Master nodes
//             cluster.maxNodes = nData.length;
//             cluster.nodes = [];
//             // Worker nodes
//             for (let i = 0; i < nData.length; i++) {
//                 if (nData[i].type === 'w') {
//                     cluster.nodes.push(nData[i])
//                 }
//             }
//             // Master nodes
//             for (let i = 0; i < nData.length; i++) {
//                 if (nData[i].type === 'm') {
//                     cluster.nodes.push(nData[i])
//                 }
//             }
//             nData = null;
//             populatePods();
//         }
//     }

//     // populate drop down filter with located NS values in this cluster
//     populate3DSelectNS();

//     // populate storage class array
//     if (typeof k8cData['0000-@storageClass@'] !== 'undefined') {
//         let scKeys = Object.keys(k8cData['0000-@storageClass@']);
//         for (let k = 0; k < scKeys.length; k++) {
//             saveStorageClass(k8cData['0000-@storageClass@'][scKeys[k]].name,
//                 k8cData['0000-@storageClass@'][scKeys[k]].fnum)
//         }
//     }

// }


// function saveStorageClass(name, fnum) {
//     if (typeof name === 'undefined' || name === null) {
//         return;
//     }
//     if (typeof foundStorageClasses[name] === 'undefined') {
//         foundStorageClasses[name] = { 'name': name, 'fnum': fnum, 'pv': [] }
//     }
// }


// function savePVC(name, ns, pvcFnum, podFnum) {
//     if (typeof name === 'undefined' || name === null) {
//         return;
//     }

//     let key = name + '::' + ns;
//     if (typeof foundPVC[key] === 'undefined') {
//         foundPVC[key] = { 'name': name, 'ns': ns, 'fnum': pvcFnum, 'cnt': 1, 'podFnum': podFnum }
//         //console.log('Added PCV: ' + key)
//     } else {
//         let cnt = foundPVC[key].cnt
//         cnt++;
//         foundPVC[key].cnt = cnt;
//     }


//     if (typeof pvcBuild[key] === 'undefined') {
//         //PVC info does not exists
//         pvcBuild[key] = { 'fnum': pvcFnum, 'podFnum': podFnum }
//     } else {
//         //builtBy = pvcBuild[key].podFnum;
//         pvcLinks[podFnum] = { 'podFnum': pvcBuild[key].podFnum }
//     }


// }


// populate pod with information
// function populatePods() {
//     let keys = Object.keys(k8cData);
//     let spcTmp;
//     for (let i = 0; i < keys.length; i++) {
//         if (typeof k8cData[keys[i]].kind !== 'undefined') {
//             // In k8cData the kind = 'Pod' 
//             if (k8cData[keys[i]].kind === 'Pod') {
//                 // save unique array list of namespaces 
//                 if (!foundNSNames.includes(k8cData[keys[i]].namespace)) {
//                     foundNSNames.push(k8cData[keys[i]].namespace)
//                 }
//                 let pod = {};
//                 let nodeName = k8cData[keys[i]].node;
//                 pod.name = k8cData[keys[i]].name;
//                 pod.ns = k8cData[keys[i]].namespace;
//                 pod.fnum = k8cData[keys[i]].fnum;

//                 pod.phase = k8cData[keys[i]].phase;
//                 if (pod.phase === 'Running') {
//                     pod.status = 1;
//                 } else if (pod.phase === 'Failed') {
//                     pod.status = 2;
//                 } else if (pod.phase === 'Succeeded') {
//                     pod.status = 4;
//                 } else {
//                     pod.status = 3;
//                 }

//                 if (k8cData[keys[i]].daemonSetPod === true) {
//                     pod.status = 0;
//                 }

//                 if (typeof k8cData[keys[i]].status.conditions !== 'undefined') {
//                     pod.conditions = k8cData[keys[i]].status.conditions;
//                 } else {
//                     pod.conditions = [];
//                 }
//                 if (typeof k8cData[keys[i]].PersistentVolumeClaim !== 'undefined') {
//                     //Save the PVC name and NS
//                     savePVC(k8cData[keys[i]].PersistentVolumeClaim[0].pvcName,
//                         k8cData[keys[i]].namespace,
//                         k8cData[keys[i]].PersistentVolumeClaim[0].pvcFnum,
//                         pod.fnum)

//                     if (typeof k8cData[keys[i]].PersistentVolumeClaim[0] !== 'undefined') {
//                         pod.pvc = [{
//                             'name': k8cData[keys[i]].PersistentVolumeClaim[0].pvcName,
//                             'fnum': k8cData[keys[i]].PersistentVolumeClaim[0].pvcFnum,
//                             'pvName': k8cData[keys[i]].PersistentVolumeClaim[0].pvName,
//                             'pvFnum': k8cData[keys[i]].PersistentVolumeClaim[0].pvFnum,
//                             'pvcSpace': k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace,
//                             'scName': k8cData[keys[i]].PersistentVolumeClaim[0].storageClassName,
//                             'scFnum': k8cData[keys[i]].PersistentVolumeClaim[0].storageClassFnum,
//                             'ns': k8cData[keys[i]].namespace
//                         }]

//                         if (k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace > 0) {
//                             if (typeof nodeSpace[nodeName] !== 'undefined') {
//                                 spcTmp = nodeSpace[nodeName];
//                                 // console.log('Node: ' + nodeName)
//                                 // console.log('Value old: ' + spcTmp);
//                                 nodeSpace[nodeName] = spcTmp + k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace;
//                                 // console.log('Added: ' + k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace)
//                                 // console.log('Value new: ' + nodeSpace[nodeName]);
//                             } else {
//                                 nodeSpace[nodeName] = k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace;
//                                 // console.log('Inserted node: ' + nodeName + ' - ' + k8cData[keys[i]].PersistentVolumeClaim[0].pvcSpace)
//                             }
//                         }

//                     } else {
//                         pod.pvc = [];
//                     }
//                 } else {
//                     pod.pvc = false;
//                 }

//                 if (typeof k8cData[keys[i]].Services !== 'undefined') {
//                     pod.serviceFound = true;
//                     pod.services = [];
//                     let chkStr = ':';
//                     for (let s = 0; s < k8cData[keys[i]].Services.length; s++) {
//                         if (chkStr.indexOf(':' + k8cData[keys[i]].Services[s].fnum + ':') === -1) {
//                             let sData = k8cData[keys[i]].Services[s];
//                             pod.services.push(k8cData[keys[i]].Services[s])
//                             chkStr = chkStr + k8cData[keys[i]].Services[s].fnum + ':';
//                         }
//                     }
//                 } else {
//                     pod.serviceFound = false;
//                     pod.services = [];
//                 }

//                 // Pod memory and cpu limits
//                 if (typeof k8cData[keys[i]].resourceLimit !== 'undefined') {
//                     let cpuLimit = 0;
//                     let memoryLimit = 0;
//                     let tVal = 0;

//                     for (let r = 0; r < k8cData[keys[i]].resourceLimit.length; r++) {
//                         if (typeof k8cData[keys[i]].resourceLimit[r].cpu !== 'undefined') {
//                             tVal = k8cData[keys[i]].resourceLimit[r].cpu
//                             if (tVal !== '0') {
//                                 //console.log('CPU: ' + tVal)
//                                 tVal = parseCPU(tVal);
//                                 //console.log('CPULimit: ' + tVal)
//                                 if (typeof tVal === 'string') {
//                                     cpuLimit = cpuLimit + parseFloat(tVal);
//                                 } else {
//                                     cpuLimit = cpuLimit + tVal;
//                                 }
//                             }
//                         }

//                         if (typeof k8cData[keys[i]].resourceLimit[r].memory !== 'undefined') {
//                             tVal = k8cData[keys[i]].resourceLimit[r].memory
//                             if (tVal !== '0') {
//                                 //console.log('Memory: ' + tVal)
//                                 tVal = parseMemory(tVal);
//                                 //console.log('Memory New: ' + tVal)
//                                 //memory = memory + tVal
//                                 if (typeof tVal === 'string') {
//                                     memoryLimit = memoryLimit + parseFloat(tVal);
//                                 } else {
//                                     memoryLimit = memoryLimit + tVal;
//                                 }
//                             }
//                         }
//                     }

//                     pod.cpuLimit = cpuLimit;
//                     pod.memoryLimit = memoryLimit;
//                 } else {
//                     pod.cpuLimit = 0;
//                     pod.memoryLimit = 0;
//                 }

//                 // Pod memory and cpu limits
//                 if (typeof k8cData[keys[i]].resourceRequest !== 'undefined') {
//                     let cpu = 0;
//                     let memory = 0;
//                     let tVal = 0;

//                     for (let r = 0; r < k8cData[keys[i]].resourceRequest.length; r++) {
//                         if (typeof k8cData[keys[i]].resourceRequest[r].cpu !== 'undefined') {
//                             tVal = k8cData[keys[i]].resourceRequest[r].cpu
//                             if (tVal !== '0') {
//                                 //console.log('CPU: ' + tVal)
//                                 tVal = parseCPU(tVal);
//                                 //console.log('CPURequest: ' + tVal)
//                                 if (typeof tVal === 'string') {
//                                     cpu = cpu + parseFloat(tVal);
//                                 } else {
//                                     cpu = cpu + tVal;
//                                 }
//                             }
//                         }

//                         if (typeof k8cData[keys[i]].resourceRequest[r].memory !== 'undefined') {
//                             tVal = k8cData[keys[i]].resourceRequest[r].memory
//                             if (tVal !== '0') {
//                                 //console.log('Memory: ' + tVal)
//                                 tVal = parseMemory(tVal);
//                                 //console.log('Memory New: ' + tVal)
//                                 //memory = memory + tVal
//                                 if (typeof tVal === 'string') {
//                                     memory = memory + parseFloat(tVal);
//                                 } else {
//                                     memory = memory + tVal;
//                                 }
//                             }
//                         }
//                     }
//                     pod.cpuRequest = cpu;
//                     pod.memoryRequest = memory;
//                 } else {
//                     pod.cpuRequest = 0;
//                     pod.memoryRequest = 0;
//                 }

//                 addPodToNode(pod, nodeName);
//             }
//         }
//     }
// }


// function parseLetter(s) {
//     let f = "";
//     //set factor
//     if (s = "K") {
//         f = 0;
//     } else if (s = "M") {
//         f = 1;
//     } else if (s = "G") {
//         f = 2;
//     } else if (s = "T") {
//         f = 3;
//     } else if (s = "P") {
//         f = 4;
//     } else if (s = "E") {
//         f = 5;
//     } else if (s = "Z") {
//         f = 6;
//     } else if (s = "Y") {
//         f = 7;
//     }
//     return f;
// }


// function parseCPU(v) {
//     let num = 0;
//     let s = "";
//     let f = 0;

//     if (typeof v === 'string') {
//         if (v.endsWith("i")) {
//             s = v.substring(v.length - 2);
//             s = s.substring(0, s.length - 1);
//             f = parseLetter(s);
//             num = v.substring(0, v.length - 2);
//             //num = num * bt[f];
//         } else {
//             s = v.substring(v.length - 1, v.length);

//             if (s === 'm' || s === 'M') {
//                 num = v.substring(0, v.length - 1);
//                 //num = v * 1000
//             } else if (s === 'G') {
//                 num = v.substring(0, v.length - 1);
//                 num = v * 1000
//             } else {
//                 if (v.length === 1) {
//                     num = s;
//                     num = s * 1000;
//                 } else {
//                     num = v.substring(0, v.length - 1)
//                     if (typeof num !== 'number') {
//                         console.log('Dont know how to handle cpu: ' + v + ' num: ' + num);
//                     }
//                 }

//                 //f = parseLetter(s);
//                 //num = v.substring(0, v.length - 1);
//                 //num = num * bt[f];
//             }
//         }
//     } else {
//         num = v * 1000;
//     }

//     return num
//     //return parseFloat(num).toFixed(3);
// }


// function parseMemory(v) {
//     // Check if zero 
//     if (v === 0) {
//         return 0;
//     }

//     let num = 0;
//     let f = 0;
//     let s = "";

//     if (typeof v === 'string') {
//         if (v.endsWith("i")) {
//             s = v.substring(v.length - 2);
//             s = s.substring(0, s.length - 1);
//             f = parseLetter(s);
//             num = v.substring(0, v.length - 2);
//             num = num * bn[f];
//         } else {
//             s = v.substring(v.length, v.length);
//             f = parseLetter(s);
//             num = v.substring(0, v.length - 1);
//             num = num * bt[f];
//         }
//     } else {
//         num = v;
//     }
//     return num
// }


// function formatBytes(bytes, decimals = 2) {
//     if (bytes === 0) {
//         return '0 Bytes';
//     }

//     const k = 1024;
//     const dm = decimals < 0 ? 0 : decimals;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));

//     return sizes[i] + ' ' + parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
// }


// function addPodToNode(pod, nodeName) {
//     for (let n = 0; n < cluster.nodes.length; n++) {
//         if (cluster.nodes[n].name === nodeName) {
//             if (typeof cluster.nodes[n].pods === 'undefined') {
//                 cluster.nodes[n].pods = [];
//             }
//             cluster.nodes[n].pods.push(pod)
//             break;
//         }
//     }
// }

//used to diagnois filter settings
function meshCnt() {
    let yesCnt = 0;
    let noCnt = 0;
    let types = ['Node', 'Pod', 'PV', 'PVC', 'Endpoint', 'Service', 'StorageClass', 'PVLine', 'EndpointLine', 'ServiceLine', 'StorageClassLine']
    let i;
    let t;
    let type;
    for (t = 0; t < types.length; t++) {
        type = types[t];
        for (i = 0; i < meshArray.length; i++) {
            if (meshArray[i].type === type) {
                if (meshArray[i].obj.isEnabled()) {
                    yesCnt++;
                } else {
                    noCnt++;
                }
            }
        }
        console.log(type + '  Yes: ' + yesCnt + '  No: ' + noCnt)
        yesCnt = 0;
        noCnt = 0;
    }

}


function showRing() {
    let id = document.getElementById("sliceKey").innerHTML
    for (let i = 0; i < sliceArray.length; i++) {
        if (sliceArray[i].id === id) {
            sliceArray[i].obj.setEnabled(true);
        } else {
            sliceArray[i].obj.setEnabled(false);
        }
    }
}


function hideRing() {
    for (let i = 0; i < sliceArray.length; i++) {
        sliceArray[i].obj.setEnabled(false);
    }
}


function getFnumInfo(data) {
    if (data === 'missing') {
        $("#yamlModal").modal('show');
        return;
    }
    selectedDef = data;
    editObj();
}


function filter3DView() {
    // get namespace filters if defined
    let namespaces = '';
    let options = $('#cluster-ns-filter').select2('data');
    let tmp;
    let i;

    // Pod display options
    let podDaemonSet = $('#clusterFilterDSPods').prop('checked');
    let podRunning = $('#clusterFilterRunning').prop('checked');
    let podFailed = $('#clusterFilterFailed').prop('checked');
    let podWarning = $('#clusterFilterWarning').prop('checked');
    let podSuccessful = $('#clusterFilterSuccessful').prop('checked');

    let parentPods = [];
    let printStatFlag = false;

    if (printStatFlag) {
        console.log('At Start ===================')
        meshCnt();
    }

    // Determine if Nodes are shown or hidden
    if ($('#clusterFilterNodes').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            if (meshArray[i].type === 'Node') {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            if (meshArray[i].type === 'Node') {
                meshArray[i].obj.setEnabled(false);
            }
        }
    }

    if (printStatFlag) {
        console.log('After FilterNodes ===================')
        meshCnt();
    }

    // Determine if Storage items are shown or hidden
    if ($('#clusterFilterStorage').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine' || tmp === 'PVCLine' || tmp === 'StorageClass' || tmp === 'StorageClassLine') {
                //console.log('Show: ' + tmp)
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine' || tmp === 'PVCLine' || tmp === 'StorageClass' || tmp === 'StorageClassLine') {
                //console.log('NoShow: ' + tmp)
                meshArray[i].obj.setEnabled(false);
            }
        }
    }

    if (printStatFlag) {
        console.log('After FilterStorage ===================')
        meshCnt();
    }

    // Determine if Network items are shown or hidden
    if ($('#clusterFilterNetwork').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'Endpoint' || tmp === 'EndpointLine' || tmp === 'Service' || tmp === 'ServiceLine') {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'Endpoint' || tmp === 'EndpointLine' || tmp === 'Service' || tmp === 'ServiceLine') {
                meshArray[i].obj.setEnabled(false);
            }
        }
    }

    if (printStatFlag) {
        console.log('After FilterNetwork ===================')
        meshCnt();
    }

    // NAMESPACEs ----------------------------------------
    // Using namespace determine if pod is shown or hidden
    for (i = 0; i < options.length; i++) {
        tmp = options[i].text;
        tmp = tmp.trim();
        if (tmp.length === 0) {
            namespaces = namespaces + ':all-namespaces:';
        } else {
            namespaces = namespaces + ':' + tmp + ':';
        }
    }

    if (namespaces === ':all-namespaces:' || namespaces === '') {
        // All namespaces are shown
        for (i = 0; i < meshArray.length; i++) {
            tmp = tmp = meshArray[i].type;
            if (tmp === 'Pod') {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            // If ClusterLevel show the item. 
            // if (meshArray[i].ns === 'ClusterLevel') {
            //     meshArray[i].obj.setEnabled(true);
            //     continue;
            // }
            // Search Pods by namespace and decide if shown or hidden
            tmp = ':' + meshArray[i].ns + ':';
            if (meshArray[i].type === 'Pod') {
                if (namespaces.indexOf(tmp) > -1) {
                    meshArray[i].obj.setEnabled(true);
                } else {
                    meshArray[i].obj.setEnabled(false);
                }
            }
        }
    }

    if (printStatFlag) {
        console.log('After namespaces ===================')
        meshCnt();
    }


    // POD status selections ----------------------------------
    // Set the display for pods based on pod display selections
    for (i = 0; i < meshArray.length; i++) {
        if (meshArray[i].type === 'Pod') {
            // Check if able to display
            if (meshArray[i].obj.isEnabled()) {
                // DaemonSet
                if (meshArray[i].status === 0) {
                    if (!podDaemonSet) {
                        meshArray[i].obj.setEnabled(false);
                        continue
                    }
                }
                // Running
                if (meshArray[i].status === 1) {
                    if (!podRunning) {
                        meshArray[i].obj.setEnabled(false);
                        continue
                    }
                }
                // Failed
                if (meshArray[i].status === 2) {
                    if (!podFailed) {
                        meshArray[i].obj.setEnabled(false);
                        continue
                    }
                }
                // Warning
                if (meshArray[i].status === 3) {
                    if (!podWarning) {
                        meshArray[i].obj.setEnabled(false);
                        continue
                    }
                }
                // Successful
                if (meshArray[i].status === 4) {
                    if (!podSuccessful) {
                        meshArray[i].obj.setEnabled(false);
                        continue
                    }
                }
            }
        }
    }

    if (printStatFlag) {
        console.log('After pod types ===================')
        meshCnt();
    }

    // POD array ------------------------------
    // Build array of all pods that are visible
    podArray = [];
    for (i = 0; i < meshArray.length; i++) {
        if (meshArray[i].type === 'Pod') {
            if (meshArray[i].obj.isEnabled()) {
                podArray.push(meshArray[i].pod)
            };
        };
    }

    // Hide Network related itmes that have no associated pod shown
    for (i = 0; i < meshArray.length; i++) {
        tmp = meshArray[i].type
        if (tmp === 'Endpoint' || tmp === 'EndpointLine' || tmp === 'Service' || tmp === 'ServiceLine') {
            if (podArray.includes(meshArray[i].pod)) {
                //nothing to do
            } else {
                meshArray[i].obj.setEnabled(false);
            };
        }
        // Build array of items to check for missing endpoint and services
        if (tmp === 'EndpointLine' && meshArray[i].obj.isEnabled()) {
            if (typeof networkLinks[meshArray[i].pod] !== 'undefined') {
                parentPods.push(networkLinks[meshArray[i].pod]);
            }
        }
    }

    if (printStatFlag) {
        console.log('After endpoints  ===================')
        meshCnt();
    }

    // Determine if any Pods have missing Network endpoints and services
    if (parentPods.length > 0) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type
            if (tmp === 'Endpoint' || tmp === 'Service' || tmp === 'ServiceLine') {
                if (parentPods.includes(meshArray[i].pod)) {
                    meshArray[i].obj.setEnabled(true);
                }
            }
        }
    }

    if (printStatFlag) {
        console.log('After endpoints w/ links  ===================')
        meshCnt();
    }


    if ($('#clusterFilterStorage').prop('checked')) {
        // Hide StorageClassLine that have no associated pod shown
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine' || tmp === 'PVCLine' || tmp === 'StorageClassLine') {
                if (podArray.includes(meshArray[i].pod)) {
                    //console.log('Show: ' + tmp);
                } else {
                    meshArray[i].obj.setEnabled(false);
                };
            }
        }

        if (printStatFlag) {
            console.log('After PV,PVC,etc  ===================')
            meshCnt();
        }

        // POD array ------------------------------
        // Refresh array of all pods that are visible
        podArray = [];
        for (i = 0; i < meshArray.length; i++) {
            if (meshArray[i].type === 'Pod') {
                if (meshArray[i].obj.isEnabled()) {
                    podArray.push(meshArray[i].pod)
                };
            };
        }


        // Storage related ------------------------------
        // Refresh array of all pods that are visible
        let t1;
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type
            if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine' || tmp === 'PVCLine') {
                t1 = meshArray[i].pod;
                if (podArray.includes(t1)) {
                    //determine if this pod is linked to another PVC
                    if (typeof pvcLinks[t1] !== 'undefined') {
                        parentPods.push(pvcLinks[t1].podFnum);
                    }
                }
            }
        }

        // Determine if any Pod has missing PVC link
        if (parentPods.length > 0) {
            for (i = 0; i < meshArray.length; i++) {
                tmp = meshArray[i].type
                if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine') {
                    if (parentPods.includes(meshArray[i].pod)) {
                        meshArray[i].obj.setEnabled(true);
                    }
                }
            }
        }

        if (printStatFlag) {
            console.log('After PV,PVC,etc w/ links ===================')
            meshCnt();
        }
    }
    // Check Node Memory
    if ($('#clusterFilterNodeMemory').prop('checked')) {
        // Hide / Show memory for associated node
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'NodeMemory') {
                resourceArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'NodeMemory') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check Node CPU
    if ($('#clusterFilterNodeCPU').prop('checked')) {
        // Hide / Show CPU for associated node
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'NodeCPU') {
                resourceArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'NodeCPU') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check Node Storage
    if ($('#clusterFilterNodeStorage').prop('checked')) {
        // Hide / Show CPU for associated node
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'NodeStorage') {
                resourceArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'NodeStorage') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }
    // Check Memory limits
    if ($('#clusterFilterMemoryLimit').prop('checked')) {
        // Hide / Show memory associated pod shown
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'MemoryLimit') {
                if (podArray.includes(resourceArray[i].pod)) {
                    resourceArray[i].obj.setEnabled(true);
                } else {
                    resourceArray[i].obj.setEnabled(false);
                };
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'MemoryLimit') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check Memory requested
    if ($('#clusterFilterMemoryRequest').prop('checked')) {
        // Hide / Show memory associated pod shown
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'MemoryRequest') {
                if (podArray.includes(resourceArray[i].pod)) {
                    resourceArray[i].obj.setEnabled(true);
                } else {
                    resourceArray[i].obj.setEnabled(false);
                };
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'MemoryRequest') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check CPU limits
    if ($('#clusterFilterCPULimit').prop('checked')) {
        // Hide / Show memory associated pod shown
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'CPULimit') {
                if (podArray.includes(resourceArray[i].pod)) {
                    resourceArray[i].obj.setEnabled(true);
                } else {
                    resourceArray[i].obj.setEnabled(false);
                };
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'CPULimit') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check CPU requested
    if ($('#clusterFilterCPURequest').prop('checked')) {
        // Hide / Show memory associated pod shown
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'CPURequest') {
                if (podArray.includes(resourceArray[i].pod)) {
                    resourceArray[i].obj.setEnabled(true);
                } else {
                    resourceArray[i].obj.setEnabled(false);
                };
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'CPURequest') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check CPU requested
    if ($('#clusterFilterControlP').prop('checked')) {
        // Show control plane items
        for (i = 0; i < controlPArray.length; i++) {
            controlPArray[i].obj.setEnabled(true);
        }
    } else {
        // hide control plane items
        for (i = 0; i < controlPArray.length; i++) {
            controlPArray[i].obj.setEnabled(false);
        }
    }


    //console.log('At end===========================')
    //meshCnt();

}

//////////////////////////////////////////////////////////////////////////////
// Function to define the cluster usng Babylon
function createScene() {

    // properties and initial values

    let RADIUSINNER = 2;                    // radius for inner/first wall cylinder
    let bandPositions;                      // array of band positions
    let WALL_HEIGHT = 0.1;                  // controls heigth of wall, not bands
    let LINEFACTOR = .55;
    let INNERFACTOR = 0.5;
    let OUTTERFACTOR = 1.0;
    let PI2 = 6.283185307179586;
    let ARC = 0.017453293;
    let NODE_ICON_ADJ = .75;
    let MST_TYPE = 'Master';
    let WRK_TYPE = 'Worker';
    let NODE_NAME = 'Name: ';
    let NODE_TYPE = 'Type:';
    let NODE_HEIGHT = 1.0;
    let POD_HEIGHT = 0.30;
    let POD_SIZE = 0.20;
    let RES_NAME = 'Name:';
    let RES_STATUS = 'Status:';
    let RES_NS = 'NS:';
    let SLICE_HEIGHT = 0.01;
    let SLICE_SIZE = 0.50;
    let SLICE_SIZE_BIG = 1.60;

    let aV = 0;
    let angle = 0;
    let angleArray = [];
    let nodePtr = 0;
    let buildWall = true;
    let pX, sX;
    let pY, sY;
    let pZ, sZ;
    let nodeCnt = cluster.maxNodes;
    let currentNode = 0;
    let maxRings = 0;

    let mstStart = 0;
    let mstStop = 0;
    let mstArc = [];
    let beginArc = 0;
    let endArc = 0;
    let controlPlane;

    // set the maximum to be used to build nodes and walls.  Two times the number of nodes.
    let max = cluster.maxNodes * 2;
    // if no nodes defined set to one empty node
    if (max === 0) {
        max = 2
    }

    // Reset the sl counter
    sl = 0;

    // build array of all angles that will be used to place pods
    let arc = PI2 / 360;
    for (let a = 0; a < 360; a++) {
        angleArray.push(aV)
        aV += arc;
    }

    // Define the Babylon scene engine, camera, lights, etc
    const scene = new BABYLON.Scene(engine);

    // set scene background
    if (sceneStars === true) {
        scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        let skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        let skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("textures/stars", scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;
    } else if (sceneClouds === true) {
        scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        let skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        let skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("textures/clouds", scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;
    } else {
        scene.clearColor = new BABYLON.Color3(sceneColorR, sceneColorG, sceneColorB);
    }

    camera = new BABYLON.ArcRotateCamera("Camera", 3 * Math.PI / 2, 3 * Math.PI / 8, 30, BABYLON.Vector3.Zero());
    // camera.setPosition(new BABYLON.Vector3(0, 0, 100));
    camera.attachControl(canvas, true);


    // camera = new BABYLON.ArcRotateCamera("camera1", 0, 0, 0, new BABYLON.Vector3(0, 0, -0), scene);
    // camera.setPosition(new BABYLON.Vector3(0, -40, -25));
    // camera.attachControl(canvas, true);


    const light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 50, 0));
    const light2 = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(10, -50, 0));

    const clickSound = new BABYLON.Sound("clickSound", "sounds/LowDing.wav", scene);

    // build materials with colors for nodes and pods
    const mstNodeMat = new BABYLON.StandardMaterial("nMstMat", scene);
    //mstNodeMat.diffuseColor = new BABYLON.Color3(0.5, 0.25, 0.25);
    mstNodeMat.diffuseColor = new BABYLON.Color3.FromHexString("#804040");

    const wrkNodeMat = new BABYLON.StandardMaterial("nWrkMat", scene);
    //wrkNodeMat.diffuseColor = new BABYLON.Color3(0.90, 0.80, 0.90);
    wrkNodeMat.diffuseColor = new BABYLON.Color3.FromHexString("#c4bec4");

    const podRed = new BABYLON.StandardMaterial("", scene);
    //podRed.diffuseColor = new BABYLON.Color3(0.75, 0.0, 0.0);
    podRed.diffuseColor = new BABYLON.Color3.FromHexString("#bf0000");

    const podGreen = new BABYLON.StandardMaterial("", scene);
    //podGreen.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.0);
    podGreen.diffuseColor = new BABYLON.Color3.FromHexString("#00ff00");

    const podYellow = new BABYLON.StandardMaterial("", scene);
    //podYellow.diffuseColor = new BABYLON.Color3(1.0, 1.0, 0.0);
    podYellow.diffuseColor = new BABYLON.Color3.FromHexString("#ffff00");

    const podPurple = new BABYLON.StandardMaterial("", scene);
    //podPurple.diffuseColor = new BABYLON.Color3(0.7, 0.0, 0.7);
    podPurple.diffuseColor = new BABYLON.Color3.FromHexString("#00a6ff");

    const podGrey = new BABYLON.StandardMaterial("", scene);
    //podGrey.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    podGrey.diffuseColor = new BABYLON.Color3.FromHexString("#808080")

    const endpointColor = new BABYLON.StandardMaterial("", scene);
    //endpointColor.diffuseColor = new BABYLON.Color3(0.0, 0.0, 0.75);
    endpointColor.diffuseColor = new BABYLON.Color3.FromHexString("#0000ef")

    const serviceColor = new BABYLON.StandardMaterial("", scene);
    //serviceColor.diffuseColor = new BABYLON.Color3(0.5, 0.75, 0.75);
    serviceColor.diffuseColor = new BABYLON.Color3.FromHexString("#80bfbf")

    const pvColor = new BABYLON.StandardMaterial("", scene);
    //pvColor.diffuseColor = new BABYLON.Color3(0.73, 0.53, 0.35);
    pvColor.diffuseColor = new BABYLON.Color3.FromHexString("#ba8759")

    const pvcColor = new BABYLON.StandardMaterial("", scene);
    //pvcColor.diffuseColor = new BABYLON.Color3(0.75, 0.75, 0.10);
    pvcColor.diffuseColor = new BABYLON.Color3.FromHexString("#bfbf1a")

    const storageClassColor = new BABYLON.StandardMaterial("", scene);
    //SCColor.diffuseColor = new BABYLON.Color3(0.98, 0.60, 0.01);
    storageClassColor.diffuseColor = new BABYLON.Color3.FromHexString("#fa9903");

    const csiNodeColor = new BABYLON.StandardMaterial("", scene);
    //SCColor.diffuseColor = new BABYLON.Color3(0.98, 0.60, 0.01);
    csiNodeColor.diffuseColor = new BABYLON.Color3.FromHexString("#ff9903");


    const memoryLimitColor = new BABYLON.StandardMaterial("", scene);
    memoryLimitColor.diffuseColor = new BABYLON.Color3.FromHexString("#f4a8e6");

    const memoryRequestColor = new BABYLON.StandardMaterial("", scene);
    memoryRequestColor.diffuseColor = new BABYLON.Color3.FromHexString("#1e18ef");

    const cpuLimitColor = new BABYLON.StandardMaterial("", scene);
    cpuLimitColor.diffuseColor = new BABYLON.Color3.FromHexString("#ef5818");

    const cpuRequestColor = new BABYLON.StandardMaterial("", scene);
    cpuRequestColor.diffuseColor = new BABYLON.Color3.FromHexString("#66b0aa");

    const nodeCPUColor = new BABYLON.StandardMaterial("", scene);
    nodeCPUColor.diffuseColor = new BABYLON.Color3.FromHexString("#f58b4e");

    const nodeMemoryColor = new BABYLON.StandardMaterial("", scene);
    nodeMemoryColor.diffuseColor = new BABYLON.Color3.FromHexString("#7b737b");

    const nodeStorageColor = new BABYLON.StandardMaterial("", scene);
    nodeStorageColor.diffuseColor = new BABYLON.Color3.FromHexString("#f72141");

    const sliceColor = new BABYLON.StandardMaterial("", scene);
    sliceColor.diffuseColor = new BABYLON.Color3.FromHexString("#ff0000");

    const controlPlaneColor = new BABYLON.StandardMaterial("", scene);
    controlPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString("#725db7");

    let stickColor = new BABYLON.StandardMaterial("", scene);
    if (stickColorDark === false) {
        stickColor.diffuseColor = new BABYLON.Color3.FromHexString("#ffffff");
    } else {
        stickColor.diffuseColor = new BABYLON.Color3.FromHexString("#666666");
    }

    // Build inner band for cluster (small circle in center of cluster)
    const band1 = BABYLON.MeshBuilder.CreateTube("band1", {
        path: [new BABYLON.Vector3(0.0, 0.0, 0.0), new BABYLON.Vector3(0.0, WALL_HEIGHT, 0.0)],
        radius: RADIUSINNER,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    bandPositions = band1.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    band1.setVerticesData(BABYLON.VertexBuffer.ColorKind, setColor(bandPositions, 0.70, 0.70, 0.70));

    //////////////////////////////////////////////////////////////////////////////
    //============================= Common functions =============================
    //////////////////////////////////////////////////////////////////////////////

    //==============================================
    // Routine to build outter band of cluster 
    function buildOutterRing(rad) {
        // Good / Green band
        const band2 = BABYLON.MeshBuilder.CreateTube("band2", {
            path: [new BABYLON.Vector3(0.0, 0.0, 0.0), new BABYLON.Vector3(0.0, WALL_HEIGHT, 0.0)],
            radius: rad,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        bandPositions = band2.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        band2.setVerticesData(BABYLON.VertexBuffer.ColorKind, setColor(bandPositions, 0.70, 0.70, 0.70));
    }


    //==============================================
    //Set colors for band / ring
    function setColor(positions, c1, c2, c3) {
        let colors = [];
        for (var p = 0; p < positions.length / 3; p++) {
            colors.push(c1, c2, c3, 1);
        }
        return colors;
    }


    //==============================================
    //Sort data 
    function dynamicSort(property) {
        var sortOrder = 1;
        if (property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a, b) {
            /* next line works with strings and numbers, 
             * and you may want to customize it to your needs
             */
            var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
            return result * sortOrder;
        }
    }


    //==============================================
    // Sort multiple
    function dynamicSortMultiple() {
        /*
         * save the arguments object as it will be overwritten
         * note that arguments object is an array-like object
         * consisting of the names of the properties to sort by
         */
        var props = arguments;
        return function (obj1, obj2) {
            var i = 0, result = 0, numberOfProperties = props.length;
            /* try getting a different result from 0 (equal)
             * as long as we have extra properties to compare
             */
            while (result === 0 && i < numberOfProperties) {
                result = dynamicSort(props[i])(obj1, obj2);
                i++;
            }
            return result;
        }
    }


    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addMesh(obj, ns, type, fnum, status, link) {
        meshArray.push({ 'ns': ns, 'type': type, 'obj': obj, 'pod': fnum, 'status': status, 'link': link });
    }


    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addSlice(obj, id) {
        sliceArray.push({ 'id': id, 'obj': obj });
    }


    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addControlP(obj, id) {
        controlPArray.push({ 'id': id, 'obj': obj });
    }


    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addResource(obj, ns, type, fnum) {
        resourceArray.push({ 'ns': ns, 'type': type, 'obj': obj, 'pod': fnum });
    }


    //==============================================
    // Build the pods to display in the cluster view for this node
    function buildResources(start, stop, node) {
        let lc = 0;
        let nLen = (lc * LINEFACTOR) + RADIUSINNER + INNERFACTOR;
        let cPtr = start;
        let cCnt = 0;
        let podStatus;
        let podName;
        let podCords;
        let podFnum;
        let svcName;
        let pvcName;
        let pvName;
        let serviceName = '';
        let nCords;
        let podCnt;
        let tmpData;
        let ns;
        let key;
        let endPoint;
        let epName;
        let epType;

        // Set node to proper location in cluster by subtracting one
        node = node - 1;

        // Check for no pods in the node
        if (typeof cluster.nodes[node].pods === 'undefined') {
            console.log(cluster.nodes[node].name + ' has no pods')
            return
        }

        // Get the number of pods in the node
        podCnt = cluster.nodes[node].pods.length;

        // Sort pod data for cluster.nodes[].pods  
        tmpData = cluster.nodes[node].pods;
        tmpData.sort(dynamicSortMultiple("status", "name"));
        cluster.nodes[node].pods = tmpData;
        tmpData = null;

        for (cCnt = 0; cCnt < podCnt; cCnt++) {
            // let cpu;
            // let memory;
            // let i;
            // let tmp;
            let size;

            // check if ring of node is full, if so, add new ring in node
            if (cPtr > stop) {
                // reset pointer 
                cPtr = start
                // increase length counter
                lc++;
                // increase length pointer
                nLen = (lc * LINEFACTOR) + RADIUSINNER + INNERFACTOR;
            }

            ///////////////////////////////////////////////////////////////////
            // Pod related 
            ///////////////////////////////////////////////////////////////////            
            ns = cluster.nodes[node].pods[cCnt].ns;
            podFnum = cluster.nodes[node].pods[cCnt].fnum
            // Get pod status that is used to set pod color
            podStatus = cluster.nodes[node].pods[cCnt].status;

            podName = '<div class="vpkfont vpkcolor ml-4">'
                + '<div id="sliceKey">' + podFnum + '</div>'

                + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                + ' onclick="showSchematic(\'' + ns + '\',\'' + podFnum + '\')"> &nbsp;View pod schematic&nbsp;</button>&nbsp;'

                + '<a href="javascript:getDefFnum(\'' + podFnum + '\')">'
                + '<img src="images/k8/pod.svg" style="width:40px;height:40px;"></a>'
                + '<span class="pl-3"><b>' + RES_STATUS + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].phase + '</span>'
                + '<span class="pl-3"><b>' + RES_NAME + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].name + '</span>'
                + '<span class="pl-3"><b>' + RES_NS + '&nbsp;&nbsp;</b>' + ns + '</span>'
                + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span>'

            // build Pod and save the center cords for use with network and storage    
            //podCords = buildPodObj(angleArray[cPtr], nLen, 'N_' + node + '_P_' + cCnt, podStatus, podName, ns, podFnum, podStatus)
            podCords = buildPodObj(angleArray[cPtr], nLen, podStatus, podName, ns, podFnum, podStatus)

            // Memory Limit and Request resource cylinders
            size = cluster.nodes[node].pods[cCnt].memoryLimit
            if (size > 0) {
                size = (size / 1000) / 1000;
                buildMemCPUResource(podCords.x - 0.03, podCords.y + .25, podCords.z, size, 0.08, 3, memoryLimitColor, ns, 'MemoryLimit', podFnum, podName)
            }

            size = cluster.nodes[node].pods[cCnt].memoryRequest
            if (size > 0) {
                size = (size / 1000) / 1000;
                buildMemCPUResource(podCords.x, podCords.y + .25, podCords.z + 0.03, size, 0.08, 3, memoryRequestColor, ns, 'MemoryRequest', podFnum, podName)
            }

            // CPU Limit and Requests resource cylinders
            size = cluster.nodes[node].pods[cCnt].cpuLimit
            if (size > 0) {
                size = (size / 1000);
                size = size / 2;
                buildMemCPUResource(podCords.x + 0.03, podCords.y + .25, podCords.z, size, 0.08, 3, cpuLimitColor, ns, 'CPULimit', podFnum, podName)
            }
            // CPULimit resource cylinder
            size = cluster.nodes[node].pods[cCnt].cpuRequest
            if (size > 0) {
                size = (size / 1000);
                size = size / 2;
                buildMemCPUResource(podCords.x, podCords.y + .25, podCords.z - 0.03, size, 0.08, 3, cpuRequestColor, ns, 'CPURequest', podFnum, podName)
            }
            ///////////////////////////////////////////////////////////////////
            // Network related - Service and Endpoint
            ///////////////////////////////////////////////////////////////////
            if (cluster.nodes[node].pods[cCnt].services.length > 0) {
                svcName = '<div class="vpkfont vpkcolor ml-4">'
                    + '<div id="sliceKey">' + cluster.nodes[node].pods[cCnt].services[0].fnum + '</div>'

                    + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                    + ' onclick="getDefFnum(\'' + cluster.nodes[node].pods[cCnt].services[0].fnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                    + '<a href="javascript:getDefFnum(\'' + cluster.nodes[node].pods[cCnt].services[0].fnum + '\')">'
                    + '<img src="images/k8/svc.svg" style="width:40px;height:40px;"></a>'
                    + '<span class="pl-3"><b>' + RES_NAME + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].services[0].name + '</span>'
                    + '<span class="pl-3"><b>' + RES_NS + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].services[0].namespace + '</span>'
                    + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>';

                // Create a fully qualified name using service name and namespace    
                serviceName = cluster.nodes[node].pods[cCnt].services[0].name + '::' + cluster.nodes[node].pods[cCnt].services[0].namespace;

                if (typeof foundServices[serviceName] === 'undefined') {
                    // Save where the pod for this service is located and the pod fnum
                    podCords.fnum = podFnum;
                    foundServices[serviceName] = podCords;
                    nCords = 'build';
                } else {
                    // Use the pod location since it already exists
                    nCords = foundServices[serviceName];
                    // Save to array links to other pods for endpoint and service
                    networkLinks[podFnum] = nCords.fnum;
                }

                // Get the endPoint/endPointSlice fnum 
                epFnum = "";
                epType = "";
                epName = "";
                if (cluster.nodes[node].pods[cCnt].services[0].ep !== "") {
                    epFnum = cluster.nodes[node].pods[cCnt].services[0].ep
                    epType = "ep";
                } else {
                    epFnum = cluster.nodes[node].pods[cCnt].services[0].eps
                    epType = "eps"
                }

                if (endPoint !== "") {
                    epName = '<div class="vpkfont vpkcolor ml-4">'
                        + '<div id="sliceKey">' + epFnum + '</div>'

                        + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                        + ' onclick="getDefFnum(\'' + epFnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                        + '<a href="javascript:getDefFnum(\'' + epFnum + '\')">'
                        + '<img src="images/k8/' + epType + '.svg" style="width:40px;height:40px;"></a>'
                        + '<span class="pl-3"><b>' + RES_NAME + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].services[0].name + '</span>'
                        + '<span class="pl-3"><b>' + RES_NS + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].services[0].namespace + '</span>'
                        + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>';
                }

                let svcFnum = cluster.nodes[node].pods[cCnt].services[0].fnum;
                buildServiceObj(podCords, svcName, cluster.nodes[node].pods[cCnt].services[0].namespace, nCords, epName, podFnum, svcFnum, epFnum)
            }

            ///////////////////////////////////////////////////////////////////
            // Storage related - PV and PVC
            ///////////////////////////////////////////////////////////////////
            if (cluster.nodes[node].pods[cCnt].pvc.length > 0) {
                pvcName = '<div class="vpkfont vpkcolor ml-4">'
                    + '<div id="sliceKey">' + cluster.nodes[node].pods[cCnt].pvc[0].fnum + '</div>'

                    + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                    + ' onclick="getDefFnum(\'' + cluster.nodes[node].pods[cCnt].pvc[0].fnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                    + '<a href="javascript:getDefFnum(\'' + cluster.nodes[node].pods[cCnt].pvc[0].fnum + '\')">'
                    + '<img src="images/k8/pvc.svg" style="width:40px;height:40px;"></a>'
                    + '<span class="pl-3"><b>PVC Name: &nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].pvc[0].name + '</span>'
                    + '<span class="pl-3"><b>' + RES_NS + '&nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].ns + '</span>'
                    + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>';

                if (typeof cluster.nodes[node].pods[cCnt].pvc[0].pvName !== 'undefined') {
                    pvName = '<div class="vpkfont vpkcolor ml-4">'
                        + '<div id="sliceKey">' + cluster.nodes[node].pods[cCnt].pvc[0].pvFnum + '</div>'

                        + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                        + ' onclick="getDefFnum(\'' + cluster.nodes[node].pods[cCnt].pvc[0].pvFnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                        + '<a href="javascript:getDefFnum(\'' + cluster.nodes[node].pods[cCnt].pvc[0].pvFnum + '\')">'
                        + '<img src="images/k8/pv.svg" style="width:40px;height:40px;"></a>'
                        + '<span class="pl-3"><b>PV Name: &nbsp;&nbsp;</b>' + cluster.nodes[node].pods[cCnt].pvc[0].pvName + '</span>'
                        + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>';
                } else {
                    pvName = '';
                }

                key = cluster.nodes[node].pods[cCnt].pvc[0].scName
                if (key > "") {
                    let pvcFnum = cluster.nodes[node].pods[cCnt].pvc[0].fnum
                    let pvFnum = cluster.nodes[node].pods[cCnt].pvc[0].pvFnum
                    let foundKey = cluster.nodes[node].pods[cCnt].pvc[0].name + '::' + cluster.nodes[node].pods[cCnt].pvc[0].ns
                    let found;
                    found = buildStorageObj(podCords, pvcName, cluster.nodes[node].pods[cCnt].ns, pvName, podFnum, pvcFnum, pvFnum, foundKey);

                    // save x,y,z for use with storage class if the PV was built
                    if (found) {
                        podCords.ns = ns;
                        podCords.pFnum = podFnum;
                        foundStorageClasses[key].pv.push(podCords);
                    }
                }
            }

            // Control spacing between pods
            if (lc > 1) {
                cPtr = cPtr + 4;
            } else {
                cPtr = cPtr + 5;
            }

        }
        // Update maxRings so outter band/ring is properly placed
        if (maxRings < lc) {
            maxRings = lc;
        }
    }


    //==============================================
    // build a cylinder for the red slice when object is selected    
    function buildSlice(x, y, z, fnum, size) {
        let slice_size = SLICE_SIZE
        if (size === 'b' || size === 'B') {
            slice_size = SLICE_SIZE_BIG
        }
        slice = BABYLON.MeshBuilder.CreateCylinder("slice", { height: SLICE_HEIGHT, diameterTop: slice_size, diameterBottom: slice_size, tessellation: 32 });
        slice.position.y = y;
        slice.position.x = x;
        slice.position.z = z;
        slice.material = sliceColor;
        // register click event for object
        slice.actionManager = new BABYLON.ActionManager(scene);
        slice.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            function () {
                document.getElementById("resourceProps").innerHTML = '';
                hideRing()
            }
        ));
        slice.setEnabled(false);          // always hide the slice when built
        addSlice(slice, fnum);
    }


    //==============================================
    // build a cylinder used for a line to connect objects   
    function buildLine(x, y, z, height, type, ns, fnum) {
        let stick;
        stick = BABYLON.MeshBuilder.CreateCylinder(type, { height: height, diameterTop: .015, diameterBottom: .015, tessellation: 4 });
        stick.position.x = x;
        stick.position.y = y;
        stick.position.z = z;
        stick.material = stickColor;
        addMesh(stick, ns, type, fnum, '')
    }


    //==============================================
    // build a cylinder 
    function buildCylinder(x, y, z, height, diameter, tess, material, ns, type, fnum, inner, status, link) {
        let cyl = BABYLON.MeshBuilder.CreateCylinder("pvc", { height: height, diameterTop: diameter, diameterBottom: diameter, tessellation: tess });
        cyl.position.x = x;
        cyl.position.y = y;
        cyl.position.z = z;
        cyl.material = material;

        // register click event for object
        cyl.actionManager = new BABYLON.ActionManager(scene);
        cyl.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            function () {
                document.getElementById("resourceProps").innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing()
            }
        ));

        if (link === '21337.0' || link === '21336.0' || link === '21340.0') {
            console.log('located fnum: ' + fnum)
        }

        addMesh(cyl, ns, type, fnum, status)
    }


    //==============================================
    // build a cylinder 
    function buildMemCPUCylinder(x, y, z, height, diameter, tess, material, ns, type, fnum, inner) {
        let cyl = BABYLON.MeshBuilder.CreateCylinder("pvc", { height: height, diameterTop: diameter, diameterBottom: diameter, tessellation: tess });
        cyl.position.x = x;
        cyl.position.y = y;
        cyl.position.z = z;
        cyl.material = material;

        // register click event for object
        cyl.actionManager = new BABYLON.ActionManager(scene);
        cyl.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            function () {
                document.getElementById("resourceProps").innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing()
            }
        ));
        cyl.setEnabled(false);
        addResource(cyl, ns, type, fnum)
    }


    //==============================================
    // build a memory or cpu resource 
    function buildMemCPUResource(x, y, z, height, diameter, tess, material, ns, type, fnum, inner) {
        let newHeight = height / 2;
        y = y + newHeight / 2;
        y = y - .1
        buildMemCPUCylinder(x, y, z, newHeight, diameter, tess, material, ns, type, fnum, inner);
    }


    //==============================================
    // build a shpere   
    function buildSphere(x, y, z, diameter, segs, material, ns, type, fnum, inner) {
        // define the sphere
        let sphere = BABYLON.MeshBuilder.CreateSphere("endpoint", { diameter: diameter, segments: segs }, scene);
        sphere.position.x = x;
        sphere.position.y = y;
        sphere.position.z = z;
        sphere.material = material;

        // register click event for object
        sphere.actionManager = new BABYLON.ActionManager(scene);
        sphere.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPickTrigger,
            function () {
                document.getElementById("resourceProps").innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }
        ));
        addMesh(sphere, ns, type, fnum, '')
    }

    //==============================================
    // build line to connect Pod to an existing PVC
    function buildPVCLine(cords, pCords, fnum, ns) {
        let epPath = [
            new BABYLON.Vector3(pCords.x, pCords.y, pCords.z),
            new BABYLON.Vector3(pCords.x, pCords.y - 1.35, pCords.z),
            new BABYLON.Vector3(cords.x, cords.y - 2.5, cords.z)
        ];

        let stick = BABYLON.MeshBuilder.CreateTube("tube", { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = stickColor;

        addMesh(stick, ns, 'PVCLine', fnum, '')
    }

    //==============================================
    // build a cylinder for the PVC and PV
    function buildStorageObj(pCords, pvcName, ns, pvName, pFnum, pvcFnum, pvFnum, foundKey) {
        if (typeof foundPVC[foundKey].cords === 'undefined') {
            // define the PVC
            buildCylinder(pCords.x, pCords.y - 2.5, pCords.z, .4, .25, 16, pvcColor, ns, 'PVC', pFnum, pvcName, '')
            buildSlice(pCords.x, pCords.y - 2.5, pCords.z, pvcFnum, 'n')
            // Connect PVC to Pod
            buildLine(pCords.x, pCords.y - 1.15, pCords.z, 2.25, 'PVCLine', ns, pFnum)

            // define the PV
            buildCylinder(pCords.x, pCords.y - 5, pCords.z, .4, .25, 8, pvColor, ns, 'PV', pFnum, pvName, '')
            buildSlice(pCords.x, pCords.y - 5, pCords.z, pvFnum, 'n')
            // Connect PVC to PV
            buildLine(pCords.x, pCords.y - 3.75, pCords.z, 2.25, 'PVLine', ns, pFnum)
            //Update the object
            foundPVC[foundKey].cords = pCords;
            return true   // Indicate the objects are new
        } else {
            let cords = foundPVC[foundKey].cords;
            buildPVCLine(cords, pCords, pFnum, ns)
            return false;   //Indicate the objects already exist
        }
    }


    //==============================================
    // build a sphere for the endpoint and service
    function buildServiceObj(pCords, sName, ns, nCords, epName, pFnum, svcFnum, epFnum) {
        if (nCords === 'build') {
            // define the Endpoint
            buildSphere(pCords.x, pCords.y + 5, pCords.z, .175, 32, endpointColor, ns, 'Endpoint', pFnum, epName)
            buildSlice(pCords.x, pCords.y + 5, pCords.z, epFnum, 'n')

            // Add connection line between the Pod and the Endpoint
            buildLine(pCords.x, pCords.y + 2.55, pCords.z, 5.0, 'EndpointLine', ns, pFnum)

            // define the Serive
            buildSphere(pCords.x, pCords.y + 7, pCords.z, .175, 32, serviceColor, ns, 'Service', pFnum, sName)
            buildSlice(pCords.x, pCords.y + 7, pCords.z, svcFnum, 'n')

            // Add connection line between the Service and the Endpoint
            buildLine(pCords.x, pCords.y + 6, pCords.z, 2.0, 'ServiceLine', ns, pFnum)

        } else {
            // Endpoint / EndpointSlice already defined, link this pod to existing item.
            // Define a map with three points of the stick (start, middle, end)
            const epPath = [
                new BABYLON.Vector3(pCords.x, pCords.y, pCords.z),
                new BABYLON.Vector3(pCords.x, pCords.y + 2, pCords.z),
                new BABYLON.Vector3(nCords.x, nCords.y + 5, nCords.z)
            ];

            let stick = BABYLON.MeshBuilder.CreateTube("tube", { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
            stick.material = stickColor;

            //pCords.fnum is the pod that this is linking back to
            addMesh(stick, ns, 'EndpointLine', pFnum, '', pCords.fnum)
        }
    }


    //==============================================
    // build a sphere for the pod
    function buildPodObj(iAngle, iLen, color, name, ns, pFnum, pStatus) {
        let wX;
        let wY;
        let wZ;
        let material

        // Calculate where is the point to build the Pod
        wX = iLen * Math.sin(iAngle);
        wY = 0;
        wZ = iLen * Math.cos(iAngle);

        // set pod color
        if (color === 1 || color === '1') {
            material = podGreen;
        } else if (color === 2 || color === '2') {
            material = podRed;
        } else if (color === 3 || color === '3') {
            material = podYellow;
        } else if (color === 4 || color === '4') {
            material = podPurple;
        } else if (color === 0 || color === '0') {
            material = podGrey;
        }

        // define the Pod
        buildCylinder(wX, wY, wZ, POD_HEIGHT, POD_SIZE, 6, material, ns, 'Pod', pFnum, name, pStatus)
        buildSlice(wX, wY, wZ, pFnum, 'n')

        return { 'x': wX, 'y': wY, 'z': wZ };
    }


    //==============================================
    // Build the walls to seperate the Nodes
    function createWall(x, y, z, sX, sY, sZ, h, i) {
        //Material on front and back of custom mesh
        let wallMat = new BABYLON.StandardMaterial("mat" + i, scene);
        wallMat.backFaceCulling = false;
        wallMat.diffuseColor = new BABYLON.Color3(0.725, 0.725, 0.725);
        //Create a custom mesh for the wall
        let customMesh = new BABYLON.Mesh("wall" + i, scene);
        //Set arrays for positions and indices
        let positions = [sX, sY, sZ, x, y, z, x, h, z, sX, h, sZ];
        let indices = [0, 1, 2, 2, 3, 0];
        //Empty array to contain calculated values
        var normals = [];
        var vertexData = new BABYLON.VertexData();
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        //Assign positions, indices and normals to vertexData
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        //Apply vertexData to custom mesh
        vertexData.applyToMesh(customMesh);
        customMesh.material = wallMat;
    }


    //==============================================
    // Build the StoreageClass 
    function buildSCs() {
        angle = 0;
        let scData;
        let scKeys = Object.keys(foundStorageClasses);
        let index;
        let scTxt;
        let scFnum

        max = scKeys.length;

        // loop and build storage classes and connect to PVs
        for (index = 0; index < max; index++) {
            scData = foundStorageClasses[scKeys[index]];
            scFnum = scData.fnum;
            scTxt = '<div class="vpkfont vpkcolor ml-4">'
                + '<div id="sliceKey">' + scFnum + '</div>'

                + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                + ' onclick="getDefFnum(\'' + scFnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                + '<a href="javascript:getDefFnum(\'' + scFnum + '\')">'
                + '<img src="images/k8/sc.svg" style="width:40px;height:40px;"></a>'
                + '<span class="pl-3 pr-3"><b>Storage Class : &nbsp;&nbsp;</b>' + scData.name + '</span>'
                + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>'

            //createSC(scTxt, scFnum, scData)
            let adjustment = 0;
            let path;

            // set x,y,z points for storage class icon
            if (maxRings > 4) {
                adjustment = 3;
            }
            pX = (maxRings - adjustment) * Math.sin(angle);
            pY = 0;
            pZ = (maxRings - adjustment) * Math.cos(angle);

            // define the storage class
            buildCylinder(pX, pY - 7, pZ, 1, 1, 3, storageClassColor, 'ClusterLevel', 'StorageClass', 0, scTxt, '')
            buildSlice(pX, pY - 7, pZ, scFnum, 'b')

            // connection lines to PVCs 
            if (typeof scData.pv[0] !== 'undefined') {
                for (let c = 0; c < scData.pv.length; c++) {
                    path = [
                        new BABYLON.Vector3(pX, pY - 7, pZ),
                        new BABYLON.Vector3(scData.pv[c].x, scData.pv[c].y - 5, scData.pv[c].z)
                    ];

                    let stick = BABYLON.MeshBuilder.CreateTube("tube", { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
                    stick.material = stickColor;

                    addMesh(stick, 'ClusterLevel', 'StorageClassLine', scData.pv[c].pFnum, '')
                }
            }

            // update angle for next storage class to be defined
            angle += PI2 / max;
        }
    }


    function buildControlPlane() {
        //Build Control Plane arc
        mstArc = [];

        let steps = 360 / nodeCnt;
        if (steps === 0) {
            steps = 360;
        }

        if (nodeCnt === 1) {
            // Ensure a full control plane circle is defined
            beginArc = 0;
            endArc = 361;
        } else {
            // Define control plane arc at master nodes
            beginArc = steps * mstStart;
            endArc = steps * (mstStop + 1);
        }

        for (let i = beginArc; i < endArc; i++) {
            pX = (maxRings + 2) * Math.sin(ARC * i);
            pZ = (maxRings + 2) * Math.cos(ARC * i);
            mstArc.push(new BABYLON.Vector3(pX, 0, pZ));
        }

        // build the control plane
        controlPlane = BABYLON.MeshBuilder.CreateTube("", { path: mstArc, radius: 0.1, sideOrientation: BABYLON.Mesh.DOUBLESIDE, cap: BABYLON.Mesh.CAP_ALL }, scene);
        controlPlane.material = controlPlaneColor;

        addControlP(controlPlane, 'ControlPlane');
    }


    function buildNodesAndWall(index) {
        let size;
        if (buildWall === false) {
            // set x,y,z points for node icon
            pX = (maxRings + NODE_ICON_ADJ) * Math.sin(angle);
            pY = 0;
            pZ = (maxRings + NODE_ICON_ADJ) * Math.cos(angle);

            let can = BABYLON.MeshBuilder.CreateCylinder("node" + index, { height: NODE_HEIGHT, tessellation: 4 });
            can.position.y = pY;
            can.position.x = pX;
            can.position.z = pZ;
            let nType = '';
            let storage = '';
            let storageBase = '';
            let cpu = 0;
            let cpuBase = 0;
            let memory = 0;
            let memoryBase = 0;
            let nName = cluster.nodes[nodePtr].name;
            let csiFnum;
            let csiInner;
            let csiX = pX;


            // "m" is a Master node, otherwise treat as worker node
            if (cluster.nodes[nodePtr].type === "m") {
                can.material = mstNodeMat;
                nType = MST_TYPE;
                mstCount++;
            } else {
                can.material = wrkNodeMat;
                nType = WRK_TYPE;
            }


            // CSINode information 
            if (typeof cluster.nodes[nodePtr].csiNodes !== 'undefined') {
                if (typeof cluster.nodes[nodePtr].csiNodes[0] !== 'undefined') {
                    data = cluster.nodes[nodePtr].csiNodes;
                    for (let c = 0; c < cluster.nodes[nodePtr].csiNodes[0].drivers.length; c++) {
                        if (typeof cluster.nodes[nodePtr].csiNodes[0].fnum !== 'undefined') {

                            csiInner = '<div class="vpkfont vpkcolor ml-4">'
                                + '<div id="sliceKey">' + cluster.nodes[nodePtr].csiNodes[0].fnum + '</div>'

                                + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                                + ' onclick="getDefFnum(\'' + cluster.nodes[nodePtr].csiNodes[0].fnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                                + '<a href="javascript:getDefFnum(\'' + cluster.nodes[nodePtr].csiNodes[0].fnum + '\')">'
                                + '<img src="images/k8/csinode.svg" style="width:40px;height:40px;"></a>'
                                + '<span class="pl-3"><b>PV Name: &nbsp;&nbsp;</b>' + cluster.nodes[nodePtr].csiNodes[0].drivers[c].name + '</span>'
                                + '&nbsp;&nbsp&nbsp;&nbsp&nbsp;&nbsp<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>';

                            // define the csiNode
                            buildSphere(csiX, pY - 2, pZ, .175, 32, csiNodeColor, 'ClusterLevel', 'CSINode', csiFnum, csiInner);
                            buildSlice(csiX, pY - 2, pZ, '1000.0', 'n');
                            buildLine(csiX, pY - 2, pZ, 4, 'CSILine', 'ClusterLevel', cluster.nodes[nodePtr].csiNodes[0].fnum);

                            //save the volumeAttachments
                            if (typeof cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt !== 'undefined') {
                                if (cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt.length > 0) {
                                    for (let v = 0; v < cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt.length; v++) {
                                        volKey = cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt[v].pvName;
                                        if (typeof pvToVolAttLinks[volKey] === 'undefined') {
                                            pvToVolAttLinks[volKey] = [];
                                        }
                                        pvToVolAttLinks[volKey].push({
                                            'fnum': cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt[v].fnum,
                                            'x': csiX,
                                            'y': pY - 5,
                                            'z': pZ
                                        })
                                    }
                                }
                            }
                            // increase csi X location for next entry
                            csiX = csiX + .25;
                        }
                    }
                }
            }





            // Node CPU resource cylinder
            if (typeof nodeSpace[nName] !== 'undefined') {
                size = nodeSpace[nName];
                storageBase = size;
                storage = formatBytes(size);
            }

            // Node Memory resource cylinder
            size = cluster.nodes[nodePtr].c_memory;
            size = size.substring(0, size.length - 2);
            if (size > 0) {
                memoryBase = size;
                memory = formatBytes(size * 1024);
            } else {
                memoryBase = 0;
                memory = 'Unknown';
            }

            // Node CPU resource cylinder
            size = cluster.nodes[nodePtr].c_cpu;
            if (size > 0) {
                cpuBase = size;
                cpu = size;
            } else {
                cpu = 'Unknown';
            }

            // Node storage cylinder
            if (typeof nodeSpace[nName] !== 'undefined') {
                size = nodeSpace[nName];
                storage = formatBytes(size);
            } else {
                storage = 'None';
            }

            let nTxt = '<div class="vpkfont vpkcolor ml-4">'
                + '<div id="sliceKey">' + cluster.nodes[nodePtr].fnum + '</div>'

                + '<button type="button" class="btn btn-outline-primary btn-sm vpkButton" '
                + ' onclick="getDefFnum(\'' + cluster.nodes[nodePtr].fnum + '\')"> &nbsp;View resource&nbsp;</button>&nbsp;'

                + '<a href="javascript:getDefFnum(\'' + cluster.nodes[nodePtr].fnum + '\')">'
                + '<img src="images/k8/node.svg" style="width:40px;height:40px;"></a>'
                + '<span class="pl-3 pr-3"><b>Node ' + NODE_TYPE + '&nbsp;&nbsp;</b>' + nType + '</span>'
                + '<span class="pl-3"><b>' + NODE_NAME + '&nbsp;&nbsp;</b>' + nName + '</span>'
                + '&nbsp;<span class="pl-3 vpkfont"><b>CPU:</b>&nbsp;' + cpu + '</span>'
                + '&nbsp;<span class="pl-3 vpkfont"><b>Memory:</b>&nbsp;' + memory + '</span>'
                + '&nbsp;<span class="pl-3 vpkfont"><b>Storage:</b>&nbsp;' + storage + '</span>'
                + '&nbsp;&nbsp;&nbsp;<span class="pl-3 vpkfont-sm">(Press icon to view resource info)</span></div>'

            // register click event for each node;
            can.actionManager = new BABYLON.ActionManager(scene);
            can.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPickTrigger,
                function () {
                    document.getElementById("resourceProps").innerHTML = nTxt;
                    if ($('#clusterFilterSound').prop('checked')) {
                        clickSound.play();
                    }
                    showRing();
                }
            ));

            addMesh(can, 'ClusterLevel', 'Node', 'na', 'na')

            buildSlice(pX, pY, pZ, cluster.nodes[nodePtr].fnum, 'b')

            if (memoryBase > 0) {
                size = memoryBase;
                size = (memoryBase / 10000) / 1000;
                buildMemCPUResource(pX - 0.14, pY + .65, pZ + 0.14, size, 0.25, 3, nodeMemoryColor, 'ClusterLevel', 'NodeMemory', fnum, nTxt)
            }

            if (cpuBase > 0) {
                size = cpu / 2
                buildMemCPUResource(pX + 0.14, pY + .65, pZ - 0.14, size, 0.25, 3, nodeCPUColor, 'ClusterLevel', 'NodeCPU', fnum, nTxt)
            }

            if (storageBase > 0) {
                size = storageBase / 100000;
                size = size / 10000;
                size = size / 50;
                size = size * -1;
                buildMemCPUResource(pX, pY - .45, pZ, size, 0.25, 3, nodeStorageColor, 'ClusterLevel', 'NodeStorage', fnum, nTxt)
            }


            buildWall = true;
            nodePtr++;

        } else {
            // set start points for wall
            sX = RADIUSINNER * Math.sin(angle);
            sY = 0;
            sZ = RADIUSINNER * Math.cos(angle);
            // set end points for wall
            pX = maxRings * Math.sin(angle);
            pY = 0;
            pZ = maxRings * Math.cos(angle);
            // if single node in cluster no wall is built 
            if (max !== 2) {
                createWall(pX, pY, pZ, sX, sY, sZ, WALL_HEIGHT, index)
                buildWall = false;
            } else {
                buildWall = false;
            }
        }
        // update angle for next item to be defined
        angle += PI2 / max;
    }

    //==============================================
    // End of common functions
    //==============================================


    //---------------------------------------------------
    // Build pods for each node
    foundServices = {};
    for (let n = 0; n < cluster.maxNodes; n++) {
        let gblCnt = 360 / nodeCnt;
        let start;
        let stop;
        currentNode++;
        gblCnt = parseInt(gblCnt, 10);
        if (currentNode === 1) {
            stop = gblCnt - 1;
            if (nodeCnt === 48) {
                start = 1;
            } else {
                start = 2;
            }
            buildResources(start, stop, currentNode)
        } else {
            let totV = currentNode * gblCnt;
            start = (totV - gblCnt) + 4;
            stop = totV - 4;
            buildResources(start, stop, currentNode)
        }
        // define the arc start and stop points for the control plane
        if (typeof cluster.nodes[currentNode] !== 'undefined') {
            if (typeof cluster.nodes[currentNode].type !== 'undefined') {
                if (cluster.nodes[currentNode].type === "m") {
                    if (mstStart === 0) {
                        mstStart = currentNode;
                    }
                    mstStop = currentNode;
                }
            }
        }
    }

    //---------------------------------------------------
    // Build outter band/ring and walls for each node
    maxRings = (maxRings * LINEFACTOR) + RADIUSINNER + OUTTERFACTOR;
    buildOutterRing(maxRings);

    //---------------------------------------------------
    // build node walls and node objects
    mstCount = 0;
    for (let index = 0; index < max; index++) {
        buildNodesAndWall(index);
    }

    //---------------------------------------------------
    // build the control plane
    buildControlPlane();

    //---------------------------------------------------
    // build storage classes
    buildSCs();

    // return the newly built scene to the calling function
    //console.log(stringify(scene))
    return scene;
}


function build3DView() {
    window.initFunction = async function () {

        var asyncEngineCreation = async function () {
            try {
                return createDefaultEngine();
            } catch (e) {
                alert("Create 3D engine function failed. Creating the default engine instead")
                console.log("Create 3D engine function failed. Creating the default engine instead");
                return createDefaultEngine();
            }
        }

        window.engine = await asyncEngineCreation();

        if (!engine) {
            throw 'engine should not be null.';
        }

        window.scene = createScene();
        filter3DView();

        // Populate the schematic tab 
        var openSch = async function () {
            try {
                bldSchematic();
                console.log("3D view opens schematics for viewing");
                return
            } catch (e) {
                alert("Failed to open schematics for viewing")
                console.log("Failed to open schematics for viewing");
                return;
            }
        }

        let done = await openSch();
        openAll('collid-');
    };

    initFunction().then(() => {
        sceneToRender = scene
        engine.runRenderLoop(function () {
            if (sceneToRender && sceneToRender.activeCamera) {
                sceneToRender.render();
            }
        });
    });

    // Resize
    window.addEventListener("resize", function () {
        engine.resize();
    });
}


//----------------------------------------------------------
console.log('loaded vpkcluster3D.js');
