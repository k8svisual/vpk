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

    clusterNodes(vpkstats.nodes)
    clusterReadyz(vpkstats.stats)
    clusterInfoDump(vpkstats.stats)
    clusterTop10(vpkstats.hogs)
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

            + '<div class="mt-1 vpkfont-md vpkblue">'
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

            + '<div class="mt-1 vpkfont-md vpkblue">'
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
    let line1 = '';
    let img = '';
    let keys = Object.keys(nodes);
    let type = '';

    line1 = '<div class="pl-2 mb-1">'
        + '<div class="report-600-wide" data-toggle="collapse" data-target="#nodeSummaryALL">'
        + '<span class="px-1 py-1">Node information</span></div>'
        + '<div id="nodeSummaryALL" class="collapse in">'

        + '<span class="vpkfont-sm">Click icon or text to toggle node detail view</span>'

    for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== null && keys[i].length !== 0) {
            if (nodes[i] === null) {
                continue;
            }
        }
        // set type of Node
        if (nodes[i][0].type === 'w') {
            img = "images/3d/3d-wrkNode.png";
            type = 'Worker'
        } else {
            img = "images/3d/3d-mstNode.png";
            type = 'Master'
        }

        line1 = line1
            + '<div class="panel-group">'
            + '  <div class="panel panel-default">'
            + '    <div class="panel-heading">'
            + '      <img width="20" height="20" src="' + img + '"   data-toggle="collapse" href="#nodeSummary_' + i + '"/>'
            + '      <span class="panel-title vpkfont-md">'
            + '        <span data-toggle="collapse" href="#nodeSummary_' + i + '">' + nodes[i][0].name + '</span>'
            + '      </span>'
            + '    </div>'

        line1 = line1
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

    line1 = line1 + '</div>'
    $('#summaryNodes').html(line1);
}

function clusterTop10(hogs) {
    //-------------------------------------------------------------------------
    // Top consumers of CPU, Memory, and Disk
    //-------------------------------------------------------------------------
    line2 = '';
    line2 = '<div class="pl-2 mb-1">'
        + '<div class="report-600-wide" data-toggle="collapse" data-target="#hogsSummaryALL">'
        + '<span class="px-1 py-1">Top 10 Requests & Limits</span></button></div>'
        + '<div id="hogsSummaryALL" class="collapse in">'

    line2 = line2 + '<div class="mt-1 mb-2 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.cpuR, 'cpuR')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.cpuL, 'cpuL')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.memR, 'memR')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2 vpkfont-md vpkblue">t<div>'
    line2 = line2 + createTop10Table(hogs.memL, 'memL')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2 vpkfont-md vpkblue"><div>'
    line2 = line2 + createTop10Table(hogs.diskR, 'diskR')
    line2 = line2 + '</div></div>'

    line2 = line2 + '<div class="mb-2 vpkfont-md vpkblue"><div>'
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