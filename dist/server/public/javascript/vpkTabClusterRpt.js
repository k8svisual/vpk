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
// Screen handling code for the report section of the Cluster tab
//----------------------------------------------------------

let summaryCRIData = [];

function openClusterRptView() {
    $('#cluster').hide();
    // $('#clusterHdr').hide();
    $('#cluster_filter').hide();
    $('#slideIn_box').hide();
    timeLapseClose();
    $('#cluster3DView').hide();
    $('#clusterReportView').show();
}


function createClusterSummary() {
    if (typeof vpkstats === 'undefined' || vpkstats === '') {
        let noData = '<div class="vpkfont-md vpkblue>No data located</div>'
        $('#summaryReadyz').html(noData);
        $('#summaryDumpC').html(noData);
        $('#summaryNodes').html(noData);
        $('#summaryHogs').html(noData);
        return;
    }

    summaryCRIData = [];
    clusterVersion(vpkstats.stats.k8sVersion)
    clusterNodes(vpkstats.nodes);
    clusterReadyz(vpkstats.stats);
    clusterInfoDump(vpkstats.stats);
    clusterTop10(vpkstats.hogs);
    clusterNetwork(vpkstats.stats);
    clusterCSI(vpkstats.csiDriver);
    clusterCRI();
    clusterPodStats(vpkstats.stats.pods)
}

function clusterPodStats(data) {
    //-------------------------------------------------------------------------
    // Review pod counts
    //-------------------------------------------------------------------------
    let line = '';

    try {
        if (typeof data !== 'undefined') {
            keys = Object.keys(data);
        } else {
            keys = [];
        }
        if (keys.length > 0) {
            line = '<div class="pl-2 mb-1">'
                + '<div class="report-600-wide" data-toggle="collapse" data-target="#podsSummaryALL">'
                + '<span class="px-1 py-1">Pod status counts</span></div>'
                + '<div id="podsSummaryALL" class="collapse in">'
                + '<div class="mt-1 vpkfont-md vpkblue">'
                + '<div class="mb-1 mt-1">'

            for (let i = 0; i < keys.length; i++) {
                line = line
                    + '  <div class="ml-3"><span class="pr-2">' + keys[i] + ':</span>' + data[keys[i]].cnt + '</div>'
            }
            line = line
                + '<div>'
                + '</div>'
        } else {
            $('#summaryPods').html('');
        }
        if (keys.length === 0) {
            $('#summaryPods').html('');
        } else {
            $('#summaryPods').html(line);
        }
    } catch (e) {
        console.log(`error processing clusterPodStats: ${e}`)
        $('#summaryPods').html('');
    }
}


function clusterVersion(data) {
    //-------------------------------------------------------------------------
    // Review versions of cluster software
    //-------------------------------------------------------------------------
    let line = '';
    let ver = '';

    try {
        if (typeof data !== 'undefined') {
            keys = Object.keys(data);
        } else {
            keys = [];
        }
        if (keys.length > 0) {
            line = '<div class="pl-2 mb-1">'
                + '<div class="report-600-wide" data-toggle="collapse" data-target="#versionSummaryALL">'
                + '<span class="px-1 py-1">Cluster version information</span></div>'
                + '<div id="versionSummaryALL" class="collapse in">'
                + '<div class="mt-1 vpkfont-md vpkblue">'
                + '<div class="mb-1 mt-1">'

            for (let i = 0; i < keys.length; i++) {
                if (typeof data[keys[i]].gitVersion !== 'undefined') {
                    ver = data[keys[i]].gitVersion;
                } else {
                    ver = data[keys[i]];
                }
                line = line
                    + '  <div class="ml-3"><span class="pr-2">' + keys[i] + ':</span>' + ver + '</div>'
            }
            line = line
                + '<div>'
                + '</div>'
        } else {
            $('#summaryVersion').hide();
            $('#summaryVersionInfo').html('');
        }
        if (keys.length === 0) {
            $('#summaryVersion').hide();
            $('#summaryVersionInfo').html('');
        } else {
            $('#summaryVersionInfo').html(line);
            $('#summaryVersion').show();
        }
    } catch (e) {
        console.log(`error processing clusterVersion: ${e}`)
        console.log(`stack: ${e.stack}`)
        $('#summaryVersion').hide();
        $('#summaryVersionInfo').html('');
    }
}


function clusterCRI() {
    //-------------------------------------------------------------------------
    // Review if any results from network searches exist
    //-------------------------------------------------------------------------
    let line = '';
    let keys = [];
    let data;
    let found = {};
    try {
        if (summaryCRIData.length > 0) {
            for (let i = 0; i < summaryCRIData.length; i++) {
                if (summaryCRIData[i].startsWith('cri-o')) {
                    if (typeof found['cri-o'] === 'undefined') {
                        found['cri-o'] = 1;
                    } else {
                        found['cri-o'] + found['cri-o'] + 1;
                    }
                } else if (summaryCRIData[i].startsWith('docker')) {
                    if (typeof found['docker'] === 'undefined') {
                        found['docker'] = 1;
                    } else {
                        found['docker'] + found['docker'] + 1;
                    }
                } else if (summaryCRIData[i].startsWith('contain')) {
                    if (typeof found['contain'] === 'undefined') {
                        found['containerd'] = 1;
                    } else {
                        found['containerd'] + found['containerd'] + 1;
                    }
                } else if (summaryCRIData[i].startsWith('frakti')) {
                    if (typeof found['frakti'] === 'undefined') {
                        found['frakti'] = 1;
                    } else {
                        found['frakti'] + found['frakti'] + 1;
                    }
                } else {
                    if (typeof found['unknown'] === 'undefined') {
                        found['unknown'] = 1;
                    } else {
                        found['unknown'] + found['unknown'] + 1;
                    }
                }
            }
        }
        // Get keys of located CRIs
        keys = Object.keys(found);
        if (keys.length > 0) {
            line = '<div class="pl-2 mb-1">'
                + '<div class="report-600-wide" data-toggle="collapse" data-target="#criSummaryALL">'
                + '<span class="px-1 py-1">CRI summary</span></div>'
                + '<div id="criSummaryALL" class="collapse in">'
                + '<div class="mt-1 vpkfont-md vpkblue">'
                + '<div class="mb-1 mt-1">'


            for (let f = 0; f < keys.length; f++) {
                line = line
                    + '  <div class="ml-3">' + keys[f] + '</div>'
            }
            line = line
                + '<div>'
                + '</div>'
        } else {
            $('#summaryCRI').hide();
            $('#summaryCRIInfo').html('');
        }
        if (keys.length === 0) {
            $('#summaryCRI').hide();
            $('#summaryCRIInfo').html('');
        } else {
            $('#summaryCRIInfo').html(line);
            $('#summaryCRI').show();
        }
    } catch (e) {
        console.log(`error processing clusterCRI: ${e}`)
        $('#summaryCRI').hide();
        $('#summaryCRIInfo').html('');
    }
}


function clusterCSI(csi) {
    //-------------------------------------------------------------------------
    // Review if any results from network searches exist
    //-------------------------------------------------------------------------
    let line = '';
    let keys = [];
    try {
        if (typeof csi !== 'undefined') {
            line = '<div class="pl-2 mb-1">'
                + '<div class="report-600-wide" data-toggle="collapse" data-target="#csiSummaryALL">'
                + '<span class="px-1 py-1">CSI drivers</span></div>'
                + '<div id="csiSummaryALL" class="collapse in">'
                + '<div class="mt-1 vpkfont-md vpkblue">'
                + '<div class="mb-1 mt-1 ml-3">'
                + '<table>'
            keys = Object.keys(csi);
            for (let i = 0; i < keys.length; i++) {
                line = line
                    + '  <tr class="summary_tab_border vkpfont-md">'
                    + '    <td class="text-left pr-2 pl-2" onclick="getDefFnum(\'' + csi[keys[i]][0].fnum + '\')">' + csi[keys[i]][0].name + '</td>'
                    + '  </tr>'

            }
            line = line
                + '</table>'
                + '<div>'
                + '</div>'
        } else {
            $('#summaryCSI').hide();
            $('#summaryCSIInfo').html('');
        }
        if (keys.length === 0) {
            $('#summaryCSI').hide();
            $('#summaryCSIInfo').html('');
        } else {
            $('#summaryCSIInfo').html(line);
            $('#summaryCSI').show();
        }
    } catch (e) {
        console.log(`error processing clusterCSI: ${e}`)
        $('#summaryCNI').hide();
        $('#summaryCSIInfo').html('');
    }
}

function clusterNetwork(stats) {
    //-------------------------------------------------------------------------
    // Review if any results from network searches exist
    //-------------------------------------------------------------------------
    let line = '';
    let keys = [];
    let data;
    try {
        if (typeof stats.networkSearchResults !== 'undefined') {
            line = '<div class="pl-2 mb-1">'
                + '<div class="report-600-wide" data-toggle="collapse" data-target="#cniSummaryALL">'
                + '<span class="px-1 py-1">CNI search results</span></div>'
                + '<div id="cniSummaryALL" class="collapse in">'
                + '<div class="mt-1 vpkfont-md vpkblue">'

            keys = Object.keys(stats.networkSearchResults);
            for (let i = 0; i < keys.length; i++) {
                line = line
                    + '<div class="mb-2 mt-2 ml-3 vpkfont-md vpkblue">' + keys[i] + '</div>'
                    + '<div class="mb-1 ml-3">'

                // Loop through the results
                data = stats.networkSearchResults[keys[i]]
                if (data.length > 0) {

                    for (let f = 0; f < data.length; f++) {
                        line = line
                            + '<div class="mb-1 mt-1">'
                            + '<table>'
                            + '  <tr class="summary_tab_border vkpfont-md">'
                            + '    <td class="text-right pr-2 pl-2" onclick="getDefFnum(\'' + data[f].fnum + '\')">Kind:</td>'
                            + '    <td class="text-left pr-2 pl-2" onclick="getDefFnum(\'' + data[f].fnum + '\')">' + data[f].kind + '</td>'
                            + '  </tr>'
                            + '  <tr class="summary_tab_border vkpfont-md">'
                            + '    <td class="text-right pr-2 pl-2" onclick="getDefFnum(\'' + data[f].fnum + '\')">Namespace:</td>'
                            + '    <td class="text-left pr-2 pl-2" onclick="getDefFnum(\'' + data[f].fnum + '\')">' + data[f].namespace + '</td>'
                            + '  </tr>'
                            + '  <tr class="summary_tab_border vkpfont-md">'
                            + '    <td class="text-right pr-2 pl-2" onclick="getDefFnum(\'' + data[f].fnum + '\')">Name:</td>'
                            + '    <td class="text-left pr-2 pl-2" onclick="getDefFnum(\'' + data[f].fnum + '\')">' + data[f].name + '</td>'
                            + '  </tr>'
                            + '</table>'
                            + '<div>'
                    }
                    line = line + '</div>'
                }
            }
        } else {
            $('#summaryCNI').hide();
            $('#summaryCNIInfo').html('');
        }

        if (keys.length === 0) {
            $('#summaryCNI').hide();
            $('#summaryCNIInfo').html('');
        } else {
            $('#summaryCNIInfo').html(line);
            $('#summaryCNI').show();
        }

    } catch (e) {
        console.log(`error processing clusterCSI: ${e}`)
        $('#summaryCNI').hide();
        $('#summaryCNIInfo').html('');
    }
}

function clusterReadyz(stats) {
    //-------------------------------------------------------------------------
    // Output from kubectl get --raw="/readyz?verbose"
    //-------------------------------------------------------------------------
    let line = '';
    try {
        line = '<div class="pl-2 mb-1">'
            + '<div class="report-600-wide" data-toggle="collapse" data-target="#readyZSummaryALL">'
            + '<span class="px-1 py-1">Ready status of components</span></div>'
            + '<div id="readyZSummaryALL" class="collapse in">'

            + '<div class="mt-1 ml-3 vpkfont-md vpkblue">'
            + '<table><tr>'
            + '<th class="text-center summary_tab" style="width: 600px;">Ready status</th><tr>';

        if (typeof stats.k8sReadyz !== 'undefined') {
            for (let i = 0; i < stats.k8sReadyz.length; i++) {
                line = line
                    + '<tr class="summary_tab_border vkpfont-md">'
                    + '  <td class="text-left pr-2 pl-2">' + stats.k8sReadyz[i] + '</td>'
                    + '</tr>';
            }
        } else {
            line = line
                + '<tr class="summary_tab_border vkpfont-md">'
                + '  <td class="text-left pr-2 pl-2">No data located</td>'
                + '</tr>';
        }

        line = line + '</table></div>'

    } catch (e) {
        console.log(`error processing clusterReadyZ: ${e}`)
        line = line + '</table></div>'
    }
    $('#summaryReadyz').html(line);
}

function clusterInfoDump(stats) {
    //-------------------------------------------------------------------------
    // Output from kubectl cluster-info dump
    //-------------------------------------------------------------------------
    let line = '';
    try {
        line = '<div class="pl-2 mb-1">'
            + '<div class="report-600-wide" data-toggle="collapse" data-target="#dumpCSummaryALL">'
            + '<span class="px-1 py-1">Output from cluster-info dump</span></div>'
            + '<div id="dumpCSummaryALL" class="collapse in">'

            + '<div class="mt-1 ml-3 vpkfont-md vpkblue">'
            + '<table><tr>'
            + '<th class="text-center summary_tab" style="width: 600px;">Cluster-info dump</th><tr>';

        if (typeof stats.k8sComponents !== 'undefined') {
            for (let i = 0; i < stats.k8sComponents.components.length; i++) {
                info = stats.k8sComponents.components[i].substring(0, stats.k8sComponents.components[i].length - 5)
                line = line
                    + '<tr class="summary_tab_border vkpfont-md">'
                    + '  <td class="text-left pr-2 pl-2">' + info + '</td>'
                    + '</tr>';
            }
        } else {
            line = line
                + '<tr class="summary_tab_border vkpfont-md">'
                + '  <td class="text-left pr-2 pl-2">No data located</td>'
                + '</tr>';
        }
    } catch (e) {
        console.log(`error processing clusterInfoDump: ${e}`)
        line = line + '</table></div>'
    }

    line = line + '</table></div>'
    $('#summaryDumpC').html(line);
}

function clusterNodes(nodes) {
    //-------------------------------------------------------------------------
    // Cluster node details
    //-------------------------------------------------------------------------
    let line = '';
    let nodeLine = '';
    let img = '';
    let keys = Object.keys(nodes);
    let newKeys = [];
    let newNodes = [];
    let type = '';

    line = '<div class="pl-2 mb-1">'
        + '<div class="report-600-wide" data-toggle="collapse" data-target="#nodeSummaryALL">'
        + '<span class="px-1 py-1">Node information</span></div>'
        + '<div id="nodeSummaryALL" class="collapse in">'

    // Locate null and blank nodes and skip them
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== null && keys[i].length !== 0) {
            if (nodes[i] === null) {
                continue;
            } else {
                newKeys.push(keys[i])
                newNodes.push(nodes[keys[i]]);
            }
        }
    }

    keys = new Object(newKeys);
    nodes = new Object(newNodes);

    if (keys.length > 0) {
        line = line + '<span class="vpkfont-sm">Click icon for resource information or click text to toggle node summayr view</span>'
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] !== null && keys[i].length !== 0) {
                if (nodes[i] === null) {
                    continue;
                }
            }

            // Save CRI data for later use in clusterCRI function
            summaryCRIData.push(nodes[i][0].nodeInfo.containerRuntimeVersion);

            // set type of Node
            if (nodes[i][0].type === 'w') {
                img = "images/3d/3d-wrkNode.png";
                type = 'Worker'
            } else {
                img = "images/3d/3d-mstNode.png";
                type = 'Master'
            }

            line = line
                + '<div class="panel-group ml-3">'
                + '  <div class="panel panel-default">'
                + '    <div class="panel-heading">'
                + '      <img width="20" height="20" src="' + img + '"  onclick="getDefFnum(\'' + nodes[i][0].fnum + '\')"/>'
                + '      <span class="panel-title vpkfont-md">'
                + '        <span data-toggle="collapse" href="#nodeSummary_' + i + '">' + nodes[i][0].name + '</span>'
                + '      </span>'
                + '    </div>'

                + '    <div id="nodeSummary_' + i + '" class="panel-collapse collapse mb-3">'
                + '      <div class="panel-body">'
                + '      <table>'
                + '        <tr class="summary_tab_border">'
                + '          <td class="text-right pl-2">Type:</td><td class="pl-3" style="width: 150px; border-right: 1pt solid #555555;">' + type + '</td>'
                + '          <td class="text-right pl-2" style="width: 85px;">KubeProxy:</td><td class="pl-3 pr-3">' + nodes[i][0].nodeInfo.kubeProxyVersion + '</td>'
                + '        </tr>'

                + '        <tr class="summary_tab_border">'
                + '          <td class="text-right pl-2">Arch:</td><td class="pl-3"  style="width: 200px; border-right: 1pt solid #555555;">' + nodes[i][0].nodeInfo.architecture + '</td>'
                + '          <td class="text-right pl-2">Kubelet:</td><td class="pl-3 pr-3">' + nodes[i][0].nodeInfo.kubeletVersion + '</td>'
                + '        </tr>'

                + '        <tr class="summary_tab_border">'
                + '          <td class="text-right pl-2">CPU:</td><td class="pl-3"  style="width: 200px; border-right: 1pt solid #555555;">' + nodes[i][0].c_cpu + '</td>'
                + '          <td class="text-right pl-2">CRI:</td><td class="pl-3 pr-3">' + nodes[i][0].nodeInfo.containerRuntimeVersion + '</td>'
                + '        </tr>'

                + '        <tr class="summary_tab_border">'
                + '          <td class="text-right pl-2">Memory:</td><td class="pl-3"  style="width: 200px; border-right: 1pt solid #555555;">' + nodes[i][0].c_memory_gb + ' GB</td>'
                + '          <td class="text-right pl-2">MachineID:</td><td class="pl-3 pr-3">' + nodes[i][0].nodeInfo.machineID + '</td>'
                + '        </tr>'

                + '        <tr class="summary_tab_border">'
                + '          <td class="text-right pl-2">Op/Sys:</td><td class="pl-3"  style="width: 200px; border-right: 1pt solid #555555;">' + nodes[i][0].nodeInfo.operatingSystem + '</td>'
                + '          <td class="text-right pl-2">OS Image:</td><td class="pl-3 pr-3">' + nodes[i][0].nodeInfo.osImage + '</td>'
                + '        </tr>'

                + '        <tr class="summary_tab_border">'
                + '          <td class="text-right pl-2">IP:</td><td class="pl-3"  style="width: 200px; border-right: 1pt solid #555555;">' + nodes[i][0].rootIP + '</td>'
                + '          <td class="text-right pl-2">OS Kernel:</td><td class="pl-3 pr-3">' + nodes[i][0].nodeInfo.kernelVersion + '</td>'
                + '        </tr>'
                + '      </table>'

                + '      </div>'
                + '    </div>'
                + '  </div>'
                + '</div>'
        }

    } else {
        line = line
            + '<div class="mt-1 mb-1">No node data located</div>'
            + '</div>'
    }

    line = line + nodeLine + '</div>'
    $('#summaryNodes').html(line);
}

function clusterTop10(hogs) {
    //-------------------------------------------------------------------------
    // Top consumers of CPU, Memory, and Disk
    //-------------------------------------------------------------------------
    line2 = '';
    line2 = '<div class="pl-2 mb-1">'
        + '<div class="report-600-wide" data-toggle="collapse" data-target="#hogsSummaryALL">'
        + '<span class="px-1 py-1">Top 10 Requests & Limits</span></div>'
        + '<div id="hogsSummaryALL" class="collapse in">'

    line2 = line2 + '<div class="mt-1 mb-2 ml-3 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.cpuR, 'cpuR')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2  ml-3 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.cpuL, 'cpuL')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2  ml-3 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.memR, 'memR')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2  ml-3 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.memL, 'memL')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2  ml-3 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.diskR, 'diskR')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2  ml-3 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.diskL, 'diskL')
    line2 = line2 + '</div></div>'

    $('#summaryHogs').html(line2);
}

function createTop10Table(data, type) {
    // build table for Top 10 entries
    let hdr = '';
    let value = '';
    if (type === 'cpuL') {
        hdr = 'CPU Limit'
    } else if (type === 'cpuR') {
        hdr = 'CPU Request'
    } else if (type === 'memL') {
        hdr = 'Memory Limit'
    } else if (type === 'memR') {
        hdr = 'Memory Request'
    } else if (type === 'diskL') {
        hdr = 'Disk Limit'
    } else if (type === 'diskR') {
        hdr = 'Disk Request'
    }

    let detail = '<table><tr>'
        + '<th class="text-center summary_tab" style="width: 75px;">' + hdr + '</th>'
        + '<th class="text-center summary_tab">Namespace</th>'
        + '<th class="text-center summary_tab">Pod Name</th><tr>';

    if (data.length > 0) {
        for (let i = 0; i < data.length; i++) {
            if (type.endsWith('L')) {
                value = data[i].limit
            } else {
                value = data[i].req
            }

            detail = detail
                + '<tr class="summary_tab_border vkpfont-md">'
                + '  <td class="text-center pr-2 pl-2" onclick="getDefFnum(\'' + data[i].podFnum + '\')">' + value + '</td>'
                + '  <td class="pl-2 pr-2"  onclick="getDefFnum(\'' + data[i].podFnum + '\')">' + data[i].ns + '</td>'
                + '  <td class="pl-2 pr-2"  onclick="getDefFnum(\'' + data[i].podFnum + '\')">' + data[i].podName + '</td>'
                + '</tr>';
        }
    } else {
        detail = detail
            + '<tr class="summary_tab_border vkpfont-md">'
            + '  <td class="text-center pr-2 pl-2">No data</td>'
            + '  <td class="text-center pl-2 pr-2" style="width: 200px;">No data</td>'
            + '  <td class="text-center pl-2 pr-2" style="width: 200px;">No data</td>'
            + '</tr>';
    }
    detail = detail + '</table>'
    return detail;
}


//----------------------------------------------------------
console.log('loaded vpkTabClusterRpt.js');