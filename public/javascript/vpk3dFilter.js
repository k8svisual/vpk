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
// filter the 3d cluster view
//----------------------------------------------------------

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


//----------------------------------------------------------
console.log('loaded vpk3dFilter.js');
