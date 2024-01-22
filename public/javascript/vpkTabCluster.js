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
// Screen handling code for loading or creating Snapshot
//----------------------------------------------------------

//----------------------------------------------------------
// build UI for the get Cluster
function buildClusterUI(s) {
    $("#clusterInfo").show();
    $("#clusterStatus").empty();
    $("#clusterStatus").html('');
}

// Function to close the filter slide-in on right side of screen
function close3dPropSlideIn() {
    slideIn.classList.remove("active");
}

// Function to close the CLUSTER tab filter slide-in on left side of screen
function closeClusterFilter() {
    $("#cluster_filter_box").removeClass("active")
}

function viewClusterLegend() {
    $("#clusterLegendModal").modal('show');
}

// Switch to the Cluster tab and refresh the 3D view
function showClusterTab() {
    if (baseDir === '-none-') {
        return;
    }
    $('.nav-tabs a[href="#cluster"]').tab('show');
    buildCluster3D();
}

function showRegistry(registry, view, returnTo) {
    loadRepositoryData(registry, view, returnTo)
}

function openCluster3DView() {
    timeLapseClose();
    $('#clusterReportView').hide();
    $('#cluster3DView').show();
    $('#cluster').show();
    $('#cluster_filter').show();
    $('#slideIn_box').hide();
}
//----------------------------------------------------------
console.log('loaded vpkTabCluster.js');