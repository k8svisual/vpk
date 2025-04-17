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
// filter the 3d cluster view
//----------------------------------------------------------

//used to diagnois filter settings
function meshCnt(type) {
    let yesCnt = 0;
    let noCnt = 0;
    for (let i = 0; i < meshArray.length; i++) {
        if (meshArray[i].type === type) {
            if (meshArray[i].obj.isEnabled()) {
                yesCnt++;
            } else {
                noCnt++;
            }
        }
    }
    console.log(`Type: ${type} - Yes: ${yesCnt} - No: ${noCnt}`);
}

function clearAll3dItems() {
    for (i = 0; i < meshArray.length; i++) {
        meshArray[i].obj.setEnabled(false);
    }
    for (i = 0; i < sliceArray.length; i++) {
        sliceArray[i].obj.setEnabled(false);
    }
    for (i = 0; i < controlPlaneArray.length; i++) {
        controlPlaneArray[i].obj.setEnabled(false);
    }
    for (i = 0; i < resourceArray.length; i++) {
        resourceArray[i].obj.setEnabled(false);
    }
}

function showRing() {
    $('#slideIn').addClass('active');
    let id = document.getElementById('sliceKey').innerHTML;
    console.log(typeof id);
    console.log(id);
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
        $('#yamlModal').modal('show');
        return;
    }
    selectedDef = data;
    editObj();
}

function filter3DView() {
    // Close the TimeLapse if it is open
    const clusterSlideUpContainer = document.getElementById('clusterSlideUpContainer');
    clusterSlideUpContainer.classList.remove('clusterShow');
    timeLapseFilterClose();

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

    // Determine if Storage items are shown or hidden
    if ($('#clusterFilterStorage').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (
                tmp === 'PV' ||
                tmp === 'PVC' ||
                tmp === 'PVLine' ||
                tmp === 'PVCLine' ||
                tmp === 'StorageClass' ||
                tmp === 'StorageClassLine' ||
                tmp === 'VALine' ||
                tmp === 'VA'
            ) {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (
                tmp === 'PV' ||
                tmp === 'PVC' ||
                tmp === 'PVLine' ||
                tmp === 'PVCLine' ||
                tmp === 'StorageClass' ||
                tmp === 'StorageClassLine' ||
                tmp === 'VALine' ||
                tmp === 'VA'
            ) {
                meshArray[i].obj.setEnabled(false);
            }
        }
    }

    // Determine if Network items are shown or hidden
    if ($('#clusterFilterNetwork').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'Endpoints' || tmp === 'EndpointLine' || tmp === 'Service' || tmp === 'ServiceLine') {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'Endpoints' || tmp === 'EndpointLine' || tmp === 'Service' || tmp === 'ServiceLine') {
                meshArray[i].obj.setEnabled(false);
            }
        }
    }

    // Determine if CSI items are shown or hidden
    if ($('#clusterFilterCSI').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (
                tmp === 'csiStorageLine' ||
                tmp === 'csiStorageWall' ||
                tmp === 'CSILine' ||
                tmp === 'CSINode' ||
                tmp === 'CSIWall' ||
                tmp === 'CSIDriver'
            ) {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (
                tmp === 'csiStorageLine' ||
                tmp === 'csiStorageWall' ||
                tmp === 'CSILine' ||
                tmp === 'CSINode' ||
                tmp === 'CSIWall' ||
                tmp === 'CSIDriver'
            ) {
                meshArray[i].obj.setEnabled(false);
            }
        }
    }

    // Determine if Ingress slice shown or hidden
    if ($('#clusterFilterIngress').prop('checked')) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'ingress') {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'ingress') {
                meshArray[i].obj.setEnabled(false);
            }
        }
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
            tmp = meshArray[i].type;
            if (tmp === 'Pod') {
                meshArray[i].obj.setEnabled(true);
            }
        }
    } else {
        for (i = 0; i < meshArray.length; i++) {
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
                        continue;
                    }
                }
                // Running
                if (meshArray[i].status === 1) {
                    if (!podRunning) {
                        meshArray[i].obj.setEnabled(false);
                        continue;
                    }
                }
                // Failed
                if (meshArray[i].status === 2) {
                    if (!podFailed) {
                        meshArray[i].obj.setEnabled(false);
                        continue;
                    }
                }
                // Warning
                if (meshArray[i].status === 3) {
                    if (!podWarning) {
                        meshArray[i].obj.setEnabled(false);
                        continue;
                    }
                }
                // Successful
                if (meshArray[i].status === 4) {
                    if (!podSuccessful) {
                        meshArray[i].obj.setEnabled(false);
                        continue;
                    }
                }
            }
        }
    }

    // POD array ------------------------------
    // Build array of all pods that are visible
    podArray = [];
    for (i = 0; i < meshArray.length; i++) {
        if (meshArray[i].type === 'Pod') {
            if (meshArray[i].obj.isEnabled()) {
                podArray.push(meshArray[i].fnum);
            }
        }
    }

    // Hide Network related itmes that have no associated pod shown
    for (i = 0; i < meshArray.length; i++) {
        tmp = meshArray[i].type;
        if (tmp === 'Endpoints' || tmp === 'EndpointLine' || tmp === 'Service' || tmp === 'ServiceLine') {
            if (podArray.includes(meshArray[i].fnum)) {
                //nothing to do
            } else {
                meshArray[i].obj.setEnabled(false);
            }
        }
        // Build array of items to check for missing endpoint and services
        if (tmp === 'EndpointLine' && meshArray[i].obj.isEnabled()) {
            if (typeof networkLinks[meshArray[i].fnum] !== 'undefined') {
                parentPods.push(networkLinks[meshArray[i].fnum]);
            }
        }
    }

    // Determine if any Pods have missing Network endpoints and services
    if (parentPods.length > 0) {
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'Endpoints' || tmp === 'Service' || tmp === 'ServiceLine') {
                if (parentPods.includes(meshArray[i].fnum)) {
                    meshArray[i].obj.setEnabled(true);
                }
            }
        }
    }

    if ($('#clusterFilterStorage').prop('checked')) {
        // Hide StorageClassLine that have no associated pod shown
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine' || tmp === 'PVCLine' || tmp === 'StorageClassLine' || tmp === 'VALine') {
                if (podArray.includes(meshArray[i].fnum)) {
                } else {
                    meshArray[i].obj.setEnabled(false);
                }
            }
        }

        // POD array ------------------------------
        // Refresh array of all pods that are visible
        podArray = [];
        for (i = 0; i < meshArray.length; i++) {
            if (meshArray[i].type === 'Pod') {
                if (meshArray[i].obj.isEnabled()) {
                    podArray.push(meshArray[i].fnum);
                }
            }
        }

        // Storage related ------------------------------
        // Refresh array of all pods that are visible
        let t1;
        for (i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine' || tmp === 'PVCLine') {
                t1 = meshArray[i].fnum;
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
                tmp = meshArray[i].type;
                if (tmp === 'PV' || tmp === 'PVC' || tmp === 'PVLine') {
                    if (parentPods.includes(meshArray[i].fnum)) {
                        meshArray[i].obj.setEnabled(true);
                    }
                }
            }
        }

        // Determine if Pods have any missing VolumeAttachments
        // Get all PV's that are visiable and use that list to determine if the
        // VA, volumeAtachment, should be visiable
        let pvShown = [];
        for (let i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'PV') {
                if (meshArray[i].obj.isEnabled()) {
                    pvShown.push(meshArray[i].fnum);
                }
            }
        }

        // Add logic to check if the associated VA needs to be shown
        for (let i = 0; i < meshArray.length; i++) {
            tmp = meshArray[i].type;
            if (tmp === 'VA') {
                if (pvShown.includes(meshArray[i].fnum)) {
                    meshArray[i].obj.setEnabled(true);
                } else {
                    meshArray[i].obj.setEnabled(false);
                }
            }
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
                }
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
                }
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
                }
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
                }
            }
        }
    } else {
        for (i = 0; i < resourceArray.length; i++) {
            if (resourceArray[i].type === 'CPURequest') {
                resourceArray[i].obj.setEnabled(false);
            }
        }
    }

    // Check Control Plane requested
    if ($('#clusterFilterControlP').prop('checked')) {
        // Show control plane items
        for (i = 0; i < controlPlaneArray.length; i++) {
            if (
                controlPlaneArray[i].id === 'ControlPlane' ||
                controlPlaneArray[i].id === 'ControlPlaneComponent' ||
                controlPlaneArray[i].id === 'Kubelet' ||
                controlPlaneArray[i].id === 'KubeCTL' ||
                controlPlaneArray[i].id === 'Kubelet-Link' ||
                controlPlaneArray[i].id === 'Kube-Proxy' ||
                controlPlaneArray[i].id === 'Registry'
            ) {
                controlPlaneArray[i].obj.setEnabled(true);
            }
        }
    } else {
        // hide control plane items
        for (i = 0; i < controlPlaneArray.length; i++) {
            if (
                controlPlaneArray[i].id === 'ControlPlane' ||
                controlPlaneArray[i].id === 'ControlPlaneComponent' ||
                controlPlaneArray[i].id === 'Kubelet' ||
                controlPlaneArray[i].id === 'KubeCTL' ||
                controlPlaneArray[i].id === 'Kubelet-Link' ||
                controlPlaneArray[i].id === 'Kube-Proxy' ||
                controlPlaneArray[i].id === 'Registry'
            ) {
                controlPlaneArray[i].obj.setEnabled(false);
            }
        }
    }

    if ($('#clusterFilterWorkload').prop('checked')) {
        changePlane('Workload', 'Show');
    } else {
        changePlane('Workload', 'Hide');
    }

    if ($('#clusterFilterService').prop('checked')) {
        changePlane('Service', 'Show');
    } else {
        changePlane('Service', 'Hide');
    }

    if ($('#clusterFilterConfigStorage').prop('checked')) {
        changePlane('ConfigStorage', 'Show');
    } else {
        changePlane('ConfigStorage', 'Hide');
    }

    if ($('#clusterFilterAuthentication').prop('checked')) {
        changePlane('Authentication', 'Show');
    } else {
        changePlane('Authentication', 'Hide');
    }

    if ($('#clusterFilterAuthorization').prop('checked')) {
        changePlane('Authorization', 'Show');
    } else {
        changePlane('Authorization', 'Hide');
    }

    if ($('#clusterFilterPolicy').prop('checked')) {
        changePlane('Policy', 'Show');
    } else {
        changePlane('Policy', 'Hide');
    }

    if ($('#clusterFilterExtend').prop('checked')) {
        changePlane('Extend', 'Show');
    } else {
        changePlane('Extend', 'Hide');
    }

    if ($('#clusterFilterCluster').prop('checked')) {
        changePlane('Cluster', 'Show');
    } else {
        changePlane('Cluster', 'Hide');
    }

    if ($('#clusterFilterOther').prop('checked')) {
        changePlane('Other', 'Show');
    } else {
        changePlane('Other', 'Hide');
    }

    if ($('#clusterFilterThirdParty').prop('checked')) {
        changePlane('ThirdParty', 'Show');
    } else {
        changePlane('ThirdParty', 'Hide');
    }
}

function changePlane(plane, action) {
    // Show or hide other plane items
    for (i = 0; i < controlPlaneArray.length; i++) {
        if (controlPlaneArray[i].id === plane) {
            if (action === 'Show') {
                controlPlaneArray[i].obj.setEnabled(true);
            } else {
                controlPlaneArray[i].obj.setEnabled(false);
            }
        }
    }
}
function saveClusterFilters() {
    let filter = {};
    if ($('#clusterFilterNodes').prop('checked')) {
        filter.clusterFilterNodes = true;
    } else {
        filter.clusterFilterNodes = false;
    }

    if ($('#clusterFilterCSI').prop('checked')) {
        filter.clusterFilterCSI = true;
    } else {
        filter.clusterFilterCSI = false;
    }

    if ($('#clusterFilterStorage').prop('checked')) {
        filter.clusterFilterStorage = true;
    } else {
        filter.clusterFilterStorage = false;
    }

    if ($('#clusterFilterNetwork').prop('checked')) {
        filter.clusterFilterNetwork = true;
    } else {
        filter.clusterFilterNetwork = false;
    }

    if ($('#clusterFilterIngress').prop('checked')) {
        filter.clusterFilterIngress = true;
    } else {
        filter.clusterFilterIngress = false;
    }

    if ($('#clusterFilterControlP').prop('checked')) {
        filter.clusterFilterControlP = true;
    } else {
        filter.clusterFilterControlP = false;
    }

    if ($('#clusterFilterWorkload').prop('checked')) {
        filter.clusterFilterWorkload = true;
    } else {
        filter.clusterFilterWorkload = false;
    }

    if ($('#clusterFilterService').prop('checked')) {
        filter.clusterFilterService = true;
    } else {
        filter.clusterFilterService = false;
    }

    if ($('#clusterFilterConfigStorage').prop('checked')) {
        filter.clusterFilterConfigStorage = true;
    } else {
        filter.clusterFilterConfigStorage = false;
    }

    if ($('#clusterFilterAuthentication').prop('checked')) {
        filter.clusterFilterAuthentication = true;
    } else {
        filter.clusterFilterAuthentication = false;
    }

    if ($('#clusterFilterAuthorization').prop('checked')) {
        filter.clusterFilterAuthorization = true;
    } else {
        filter.clusterFilterAuthorization = false;
    }

    if ($('#clusterFilterPolicy').prop('checked')) {
        filter.clusterFilterPolicy = true;
    } else {
        filter.clusterFilterPolicy = false;
    }

    if ($('#clusterFilterExtend').prop('checked')) {
        filter.clusterFilterExtend = true;
    } else {
        filter.clusterFilterExtend = false;
    }

    if ($('#clusterFilterCluster').prop('checked')) {
        filter.clusterFilterCluster = true;
    } else {
        filter.clusterFilterCluster = false;
    }

    if ($('#clusterFilterOther').prop('checked')) {
        filter.clusterFilterOther = true;
    } else {
        filter.clusterFilterOther = false;
    }

    if ($('#clusterFilterThirdParty').prop('checked')) {
        filter.clusterFilterThirdParty = true;
    } else {
        filter.clusterFilterThirdParty = false;
    }

    if ($('#clusterFilterRunning').prop('checked')) {
        filter.clusterFilterRunning = true;
    } else {
        filter.clusterFilterRunning = false;
    }

    if ($('#clusterFilterWarning').prop('checked')) {
        filter.clusterFilterWarning = true;
    } else {
        filter.clusterFilterWarning = false;
    }

    if ($('#clusterFilterFailed').prop('checked')) {
        filter.clusterFilterFailed = true;
    } else {
        filter.clusterFilterFailed = false;
    }

    if ($('#clusterFilterSuccessful').prop('checked')) {
        filter.clusterFilterSuccessful = true;
    } else {
        filter.clusterFilterSuccessful = false;
    }

    if ($('#clusterFilterDSPods').prop('checked')) {
        filter.clusterFilterDSPods = true;
    } else {
        filter.clusterFilterDSPods = false;
    }

    if ($('#clusterFilterNodeMemory').prop('checked')) {
        filter.clusterFilterNodeMemory = true;
    } else {
        filter.clusterFilterNodeMemory = false;
    }

    if ($('#clusterFilterNodeCPU').prop('checked')) {
        filter.clusterFilterNodeCPU = true;
    } else {
        filter.clusterFilterNodeCPU = false;
    }

    if ($('#clusterFilterNodeStorage').prop('checked')) {
        filter.clusterFilterNodeStorage = true;
    } else {
        filter.clusterFilterNodeStorage = false;
    }

    if ($('#clusterFilterMemoryLimit').prop('checked')) {
        filter.clusterFilterMemoryLimit = true;
    } else {
        filter.clusterFilterMemoryLimit = false;
    }

    if ($('#clusterFilterMemoryRequest').prop('checked')) {
        filter.clusterFilterMemoryRequest = true;
    } else {
        filter.clusterFilterMemoryRequest = false;
    }

    if ($('#clusterFilterCPULimit').prop('checked')) {
        filter.clusterFilterCPULimit = true;
    } else {
        filter.clusterFilterCPULimit = false;
    }

    if ($('#clusterFilterCPURequest').prop('checked')) {
        filter.clusterFilterCPURequest = true;
    } else {
        filter.clusterFilterCPURequest = false;
    }

    if ($('#clusterFilterSound').prop('checked')) {
        filter.clusterFilterSound = true;
    } else {
        filter.clusterFilterSound = false;
    }

    socket.emit('saveClusterFilters', filter);
}

function setClusterFilters() {
    if (clusterFilters.clusterFilterNodes === true) {
        $('#clusterFilterNodes').prop('checked', true);
    } else {
        $('#clusterFilterNodes').prop('checked', false);
    }

    if (clusterFilters.clusterFilterCSI === true) {
        $('#clusterFilterCSI').prop('checked', true);
    } else {
        $('#clusterFilterCSI').prop('checked', false);
    }

    if (clusterFilters.clusterFilterStorage === true) {
        $('#clusterFilterStorage').prop('checked', true);
    } else {
        $('#clusterFilterStorage').prop('checked', false);
    }

    if (clusterFilters.clusterFilterNetwork === true) {
        $('#clusterFilterNetwork').prop('checked', true);
    } else {
        $('#clusterFilterNetwork').prop('checked', false);
    }

    if (clusterFilters.clusterFilterIngress === true) {
        $('#clusterFilterIngress').prop('checked', true);
    } else {
        $('#clusterFilterIngress').prop('checked', false);
    }

    if (clusterFilters.clusterFilterControlP === true) {
        $('#clusterFilterControlP').prop('checked', true);
    } else {
        $('#clusterFilterControlP').prop('checked', false);
    }

    if (clusterFilters.clusterFilterWorkload === true) {
        $('#clusterFilterWorkload').prop('checked', true);
    } else {
        $('#clusterFilterWorkload').prop('checked', false);
    }

    if (clusterFilters.clusterFilterService === true) {
        $('#clusterFilterService').prop('checked', true);
    } else {
        $('#clusterFilterService').prop('checked', false);
    }

    if (clusterFilters.clusterFilterConfigStorage === true) {
        $('#clusterFilterConfigStorage').prop('checked', true);
    } else {
        $('#clusterFilterConfigStorage').prop('checked', false);
    }

    if (clusterFilters.clusterFilterAuthentication === true) {
        $('#clusterFilterAuthentication').prop('checked', true);
    } else {
        $('#clusterFilterAuthentication').prop('checked', false);
    }

    if (clusterFilters.clusterFilterAuthorization === true) {
        $('#clusterFilterAuthorization').prop('checked', true);
    } else {
        $('#clusterFilterAuthorization').prop('checked', false);
    }

    if (clusterFilters.clusterFilterPolicy === true) {
        $('#clusterFilterPolicy').prop('checked', true);
    } else {
        $('#clusterFilterPolicy').prop('checked', false);
    }

    if (clusterFilters.clusterFilterExtend === true) {
        $('#clusterFilterExtend').prop('checked', true);
    } else {
        $('#clusterFilterExtend').prop('checked', false);
    }

    if (clusterFilters.clusterFilterCluster === true) {
        $('#clusterFilterCluster').prop('checked', true);
    } else {
        $('#clusterFilterCluster').prop('checked', false);
    }

    if (clusterFilters.clusterFilterOther === true) {
        $('#clusterFilterOther').prop('checked', true);
    } else {
        $('#clusterFilterOther').prop('checked', false);
    }

    if (clusterFilters.clusterFilterThirdParty === true) {
        $('#clusterFilterThirdParty').prop('checked', true);
    } else {
        $('#clusterFilterThirdParty').prop('checked', false);
    }

    if (clusterFilters.clusterFilterRunning === true) {
        $('#clusterFilterRunning').prop('checked', true);
    } else {
        $('#clusterFilterRunning').prop('checked', false);
    }

    if (clusterFilters.clusterFilterWarning === true) {
        $('#clusterFilterWarning').prop('checked', true);
    } else {
        $('#clusterFilterWarning').prop('checked', false);
    }

    if (clusterFilters.clusterFilterFailed === true) {
        $('#clusterFilterFailed').prop('checked', true);
    } else {
        $('#clusterFilterFailed').prop('checked', true);
    }

    if (clusterFilters.clusterFilterSuccessful === true) {
        $('#clusterFilterSuccessful').prop('checked', true);
    } else {
        $('#clusterFilterSuccessful').prop('checked', false);
    }

    if (clusterFilters.clusterFilterDSPods === true) {
        $('#clusterFilterDSPods').prop('checked', true);
    } else {
        $('#clusterFilterDSPods').prop('checked', false);
    }

    if (clusterFilters.clusterFilterNodeMemory === true) {
        $('#clusterFilterNodeMemory').prop('checked', true);
    } else {
        $('#clusterFilterNodeMemory').prop('checked', false);
    }

    if (clusterFilters.clusterFilterNodeCPU === true) {
        $('#clusterFilterNodeCPU').prop('checked', true);
    } else {
        $('#clusterFilterNodeCPU').prop('checked', false);
    }

    if (clusterFilters.clusterFilterNodeStorage === true) {
        $('#clusterFilterNodeStorage').prop('checked', true);
    } else {
        $('#clusterFilterNodeStorage').prop('checked', false);
    }

    if (clusterFilters.clusterFilterMemoryLimit === true) {
        $('#clusterFilterMemoryLimit').prop('checked', true);
    } else {
        $('#clusterFilterMemoryLimit').prop('checked', false);
    }

    if (clusterFilters.clusterFilterMemoryRequest === true) {
        $('#clusterFilterMemoryRequest').prop('checked', true);
    } else {
        $('#clusterFilterMemoryRequest').prop('checked', false);
    }

    if (clusterFilters.clusterFilterCPULimit === true) {
        $('#clusterFilterCPULimit').prop('checked', true);
    } else {
        $('#clusterFilterCPULimit').prop('checked', false);
    }

    if (clusterFilters.clusterFilterCPURequest === true) {
        $('#clusterFilterCPURequest').prop('checked', true);
    } else {
        $('#clusterFilterCPURequest').prop('checked', false);
    }

    if (clusterFilters.clusterFilterSound === true) {
        $('#clusterFilterSound').prop('checked', true);
    } else {
        $('#clusterFilterSound').prop('checked', false);
    }
}

//----------------------------------------------------------
console.log('loaded vpk3dFilter.js');
