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
// Screen handling code OwnerRef tab
//----------------------------------------------------------


let scArray = {};
let storCnt = 0;
let storCollapseID = [];
let storBreakID = 0;
let storageInfo = {};


//----------------------------------------------------------
// build svg data for ownerRef links
//----------------------------------------------------------
function initStorageVars() {
    storCnt = 0;
    storCollapseID = [];
    storBreakID = 0;
    storageInfo = {};
    scArray = {};

    if (typeof k8cData['0000-clusterLevel'] !== 'undefined') {
        if (typeof k8cData['0000-clusterLevel'].Node !== 'undefined') {
            for (let i = 0; i < k8cData['0000-clusterLevel'].Node.length; i++) {
                nodeTypes[k8cData['0000-clusterLevel'].Node[i].name] = k8cData['0000-clusterLevel'].Node[i].type
            }
        }
    }
}

function buildStorage() {
    initStorageVars();

    //Build the SVG for storage requests
    let html = buildStorageSVG();
    //If no images were built display message to inform user
    if (storCnt === 0) {
        html = '<div class="vpkfont vpkcolor"><br><p>No storage information located for the selected snapshot</p></div>'
    }

    //Update the browser DOM
    $("#storageDetail").html(html);
    $("#storageDetail").show();

    // Build the section for Volume Type counts
    $('#countVolType').html(sectionType());
    $('#countVolNode').html('');
    $('#countVolNS').html('');
    $('#countVolFnum').html('');
    // Build the section for Node counts
    $('#countNodeType').html(sectionNode())
    $('#countNodeNode').html('');
    $('#countNodeNS').html('');
    $('#countNodeFnum').html('');
    // Build the section for Namespace counts
    $('#countNSType').html(sectionNamespace())
    $('#countNSNode').html('');
    $('#countNSNS').html('');
    $('#countNSFnum').html('');

}


//============================
function sectionType() {
    let tmp = '<div>'
        + countsForVolume()
        + '</div>'
    return tmp;
}

function sectionNode() {
    let tmp = '<div>'
        + countsForNode()
        + '</div>'
    return tmp;
}

function sectionNamespace() {
    let tmp = '<div>'
        + countsForNS()
        + '</div>'
    return tmp;
}


//============================
function countsForVolume() {
    let allKeys;
    let keys;
    let value;
    let counts = '<div id="volumeCount" class="volCounts">'
        + '<div class="mt-3 vpkfont">Counts by Volume Type -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Type</th><th width=5%;>Count</th><th>Volume Type name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsType);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        if (allKeys[i].indexOf('::') < 0) {
            keys.push(allKeys[i]);
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        value = value.split('=')
        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForVolumeType(\'' + value[1] + '\')">'
            + '<img src="images/3d/3d-volume.png" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForVolumeType(\'' + value[1] + '\')">'
            + volumeCountsType[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForVolumeType(\'' + value[1] + '\')">'
            + value[1] + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'
    return counts;
}

function countsForVolumeType(type) {
    let allKeys;
    let keys;
    let value;
    let img;

    let counts = '<div id="volumeTypeNodeCount" class="volCounts">'
        + '<div class="mt-3 vpkfont">Node counts for -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Type:</div>'
        + '    <div class="col-10"><b>' + type + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Node</th><th width=5%;>Count</th><th>Node name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsType);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 2) {
            if (value[0].indexOf(type) > -1) {
                keys.push(allKeys[i]);
            }
        }
    }
    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        // value = value.split('=')
        value = value.split('::')
        if (typeof nodeTypes[value[1]] !== 'undefined') {
            if (nodeTypes[value[1]] === 'w') {
                img = "images/3d/3d-wrkNode.png";
            } else {
                img = "images/3d/3d-mstNode.png";
            }
        }
        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForVolumeTypeNS(\'' + type + '\',\'' + value[1] + '\')">'
            + '    <img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForVolumeTypeNS(\'' + type + '\',\'' + value[1] + '\')">'
            + volumeCountsType[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForVolumeTypeNS(\'' + type + '\',\'' + value[1] + '\')">' + value[1] + '</td>'
            + '</tr>'
    }
    counts = counts + '</table></div>'

    $('#countVolNode').html(counts);
    $('#countVolNS').html('');
    $('#countVolFnum').html('');
}

function countsForVolumeTypeNS(type, node) {
    let allKeys;
    let keys;
    let value;

    let counts = '<div id="volumeTypeNodeCountNS" class="volCounts">'
        + '<div class="mt-3 vpkfont">Namespace counts for -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Node:</div>'
        + '    <div class="col-10"><b>' + node + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Type:</div>'
        + '    <div class="col-10"><b>' + type + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Namespace</th><th width=5%;>Count</th><th>Namespace name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsType);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 3) {
            if (value[0].indexOf(type) > -1) {
                if (value[1] === node) {
                    keys.push(allKeys[i]);
                }
            }
        }
    }
    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        // value = value.split('=')
        value = value.split('::')

        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForVolumeTypeNSFnum(\'' + type + '\',\'' + node + '\',\'' + value[2] + '\')">'
            + '    <img src="images/k8/ns.svg" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;"  onclick="countsForVolumeTypeNSFnum(\'' + type + '\',\'' + node + '\',\'' + value[2] + '\')">' + volumeCountsType[keys[i]]
            + '</td>'
            + '<td style="padding-left: 10px;"  onclick="countsForVolumeTypeNSFnum(\'' + type + '\',\'' + node + '\',\'' + value[2] + '\')">' + value[2] + '</td>'
            + '</tr>'
    }
    counts = counts + '</table></div>'

    $('#countVolNS').html(counts);
    $('#countVolFnum').html('');
}

function countsForVolumeTypeNSFnum(type, node, ns) {
    let allKeys;
    let keys;
    let value;
    let podName;
    let podStatus;
    let img;
    let counts = '<div id="volumeTypeNodeCountNSFnum" class="volCounts">'
        + '<div class="mt-3 vpkfont">Pod counts for -<span class="pl-2">(Click table row to view resource)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Namespace:</div>'
        + '    <div class="col-10"><b>' + ns + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Node:</div>'
        + '    <div class="col-10"><b>' + node + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Type:</div>'
        + '    <div class="col-10"><b>' + type + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Pod</th><th width=5%;>Count</th><th>Pod name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsType);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 4) {
            if (value[0].indexOf(type) > -1) {
                if (value[1] === node) {
                    if (value[2] === ns) {
                        keys.push(allKeys[i]);
                    }
                }
            }
        }
    }
    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        // value = value.split('=')
        value = value.split('::')

        podName = k8cData[value[3]].name
        podStatus = podStatusLookup[value[3]];

        if (typeof podStatus === 'undefined') {
            img = 'images/3d/3d-podMagenta.png';                     // Unknown
        } else {
            if (podStatus === 1 || podStatus === '1') {
                img = 'images/3d/3d-podGreen.png';                   // Running
            } else if (podStatus === 2 || podStatus === '2') {
                img = 'images/3d/3d-podRed.png';                     // Failing
            } else if (podStatus === 3 || podStatus === '3') {
                img = 'images/3d/3d-podYellow.png';                  // Warn
            } else if (podStatus === 4 || podStatus === '4') {
                img = 'images/3d/3d-podBlue.png';                    // Completed
            } else if (podStatus === 0 || podStatus === '0') {
                img = 'images/3d/3d-podGrey.png';                    // Deamon
            } else {
                img = 'images/3d/3d-podMagenta.png';                 // Unknown
            }
        }

        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="getDefFnum(\'' + value[3] + '\')">'
            + '    <img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="getDefFnum(\'' + value[3] + '\')">' + volumeCountsType[keys[i]]
            + '</td>'
            + '<td style="padding-left: 10px;" onclick="getDefFnum(\'' + value[3] + '\')">' + podName + '</td>'
            + '</tr>'
    }
    counts = counts + '</table></div>'
    $('#countVolFnum').html(counts);
}


//============================
function countsForNode() {
    let allKeys;
    let keys;
    let value;
    let img;
    let counts = '<div id="nodeCount" class="nodeCounts">'
        + '<div class="mt-3 vpkfont">Counts by Cluster Node -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont bg-secondary">'
        + '    <th width=10%;>Node</th><th width=5%;>Count</th><th>Node name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNode);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        if (allKeys[i].indexOf('::') < 0) {
            keys.push(allKeys[i]);
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        if (typeof nodeTypes[value] !== 'undefined') {
            if (nodeTypes[value] === 'w') {
                img = "images/3d/3d-wrkNode.png";
            } else {
                img = "images/3d/3d-mstNode.png";
            }
        }

        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNodeType(\'' + value + '\')">'
            + '<img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNodeType(\'' + value + '\')">'
            + volumeCountsNode[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForNodeType(\'' + value + '\')">'
            + value + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'
    return counts;
}

function countsForNodeType(node) {
    let allKeys;
    let keys;
    let value;
    let img;
    let counts = '<div id="nodeCountType" class="nodeCounts">'
        + '<div class="mt-3 vpkfont">Type counts for -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Node:</div>'
        + '    <div class="col-10"><b>' + node + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Type</th><th width=5%;>Count</th><th>Volume Type name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNode);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 2) {
            if (value[0] === node) {
                keys.push(allKeys[i]);
            }
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i].split('::');
        value = value[1].split('=');
        img = "images/3d/3d-volume.png";

        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNodeTypeKey(\'' + node + '\',\'' + value[1] + '\')">'
            + '<img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNodeTypeKey(\'' + node + '\',\'' + value[1] + '\')">'
            + volumeCountsNode[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForNodeTypeKey(\'' + node + '\',\'' + value[1] + '\')">'
            + value[1] + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'

    $('#countNodeNode').html(counts);
    $('#countNodeNS').html('');
    $('#countNodeFnum').html('');
}

function countsForNodeTypeKey(node, key) {
    let fullKey = 'Type=' + key;
    let allKeys;
    let keys;
    let value;
    let img;
    let cnt;
    let counts = '<div id="nodeCountType" class="nodeCounts">'
        + '<div class="mt-3 vpkfont">Namespace counts for -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Node:</div>'
        + '    <div class="col-10"><b>' + node + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Type:</div>'
        + '    <div class="col-10"><b>' + key + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>NS</th><th width=5%;>Count</th><th>Volume Type name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNode);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 3) {
            if (value[0] === node) {
                if (value[1] === fullKey) {
                    keys.push(allKeys[i]);
                }
            }
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i].split('::');
        //value = value[1].split('=');
        img = "images/k8/ns.svg";
        cnt = volumeCountsNode[keys[i]]
        if (cnt === null) {
            console.log(`countsForNodeTypeKey() Value error for Key: ${keys[i]}`);
            console.log(JSON.stringify(volumeCountsNode[keys[i]], null, 4))
            continue;
        }
        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNodeTypeKeyFnum(\'' + node + '\',\'' + key + '\',\'' + value[2] + '\')">'
            + '<img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNodeTypeKeyFnum(\'' + node + '\',\'' + key + '\',\'' + value[2] + '\')">'
            + volumeCountsNode[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForNodeTypeKeyFnum(\'' + node + '\',\'' + key + '\',\'' + value[2] + '\')">'
            + value[2] + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'

    $('#countNodeNS').html(counts);
    $('#countNodeFnum').html('');
}

function countsForNodeTypeKeyFnum(node, key, ns) {
    let fullKey = 'Type=' + key;
    let allKeys;
    let keys;
    let value;
    let img;
    let cnt;
    let podName;
    let podStatus;
    let counts = '<div id="nodeCountType" class="nodeCounts">'
        + '<div class="mt-3 vpkfont">Pod counts for -<span class="pl-2">(Click table row to view resource)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Node:</div>'
        + '    <div class="col-10"><b>' + node + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Type:</div>'
        + '    <div class="col-10"><b>' + key + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Namespace:</div>'
        + '    <div class="col-10"><b>' + ns + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Pod</th><th width=5%;>Count</th><th>Pod name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNode);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 4) {
            if (value[0] === node) {
                if (value[1] === fullKey) {
                    if (value[2] === ns) {
                        keys.push(allKeys[i]);
                    }
                }
            }
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {

        value = keys[i];
        value = value.split('::')
        podName = k8cData[value[3]].name
        podStatus = podStatusLookup[value[3]];

        if (typeof podStatus === 'undefined') {
            img = 'images/3d/3d-podMagenta.png';                     // Unknown
        } else {
            if (podStatus === 1 || podStatus === '1') {
                img = 'images/3d/3d-podGreen.png';                   // Running
            } else if (podStatus === 2 || podStatus === '2') {
                img = 'images/3d/3d-podRed.png';                     // Failing
            } else if (podStatus === 3 || podStatus === '3') {
                img = 'images/3d/3d-podYellow.png';                  // Warn
            } else if (podStatus === 4 || podStatus === '4') {
                img = 'images/3d/3d-podBlue.png';                    // Completed
            } else if (podStatus === 0 || podStatus === '0') {
                img = 'images/3d/3d-podGrey.png';                    // Deamon
            } else {
                img = 'images/3d/3d-podMagenta.png';                 // Unknown
            }
        }


        cnt = volumeCountsNode[keys[i]]
        if (cnt === null) {
            console.log(`countsForNodeTypeKeyFnum() Value erron for Key: ${keys[i]}`);
            console.log(JSON.stringify(volumeCountsNode[keys[i]], null, 4))
            continue;
        }
        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="getDefFnum(\'' + value[3] + '\')">'
            + '<img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="getDefFnum(\'' + value[3] + '\')">'
            + volumeCountsNode[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="getDefFnum(\'' + value[3] + '\')">'
            + podName + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'

    $('#countNodeFnum').html(counts);
}


//============================
function countsForNS() {
    let allKeys;
    let keys;
    let value;
    let counts = '<div id="namespaceCount" class="namespaceCounts">'
        + '<div class="mt-3 vpkfont">Counts by Namespace -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Namespace</th><th width=5%;>Count</th><th>Namespace name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNS);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        if (allKeys[i].indexOf('::') < 0) {
            keys.push(allKeys[i]);
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNSType(\'' + value + '\')">'
            + '<img src="images/k8/ns.svg" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNSType(\'' + value + '\')">'
            + volumeCountsNS[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForNSType(\'' + value + '\')">'
            + value + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'
    return counts;
}

function countsForNSType(ns) {
    let allKeys;
    let keys;
    let value;
    let img;
    let counts = '<div id="nodeCountType" class="namespaceCounts">'
        + '<div class="mt-3 vpkfont">Type counts for -<span class="pl-2">(Click table row to drill down)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Namespace:</div>'
        + '    <div class="col-10"><b>' + ns + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Type</th><th width=5%;>Count</th><th>Volume Type name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNS);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 2) {
            if (value[0] === ns) {
                keys.push(allKeys[i]);
            }
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i].split('::');
        value = value[1].split('=');
        img = "images/3d/3d-volume.png";

        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNSTypeKey(\'' + ns + '\',\'' + value[1] + '\')">'
            + '<img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="countsForNSTypeKey(\'' + ns + '\',\'' + value[1] + '\')">'
            + volumeCountsNS[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="countsForNSTypeKey(\'' + ns + '\',\'' + value[1] + '\')">'
            + value[1] + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'

    $('#countNSNode').html(counts);
    $('#countNSNS').html('');
    $('#countNSFnum').html('');
}

function countsForNSTypeKey(ns, key) {
    let fullKey = 'Type=' + key;
    let allKeys;
    let keys;
    let value;
    let img;
    let counts = '<div id="nodeCountType" class="namespaceCounts">'
        + '<div class="mt-3 vpkfont">Type counts for -<span class="pl-2">(Click table row to view resource)</span></div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Namespace:</div>'
        + '    <div class="col-10"><b>' + ns + '</b></div>'
        + '</div>'
        + '<div class="row vpkfont ml-1">'
        + '    <div class="col-1">Type:</div>'
        + '    <div class="col-10"><b>' + key + '</b></div>'
        + '</div>'

        + '<div>'
        + '<table class="vpkfont mt-1">'
        + '<tr class="vpkfont">'
        + '    <th width=10%;>Pod</th><th width=5%;>Count</th><th>Pod name</th>'
        + '</tr>';

    allKeys = Object.keys(volumeCountsNS);
    keys = [];
    for (let i = 0; i < allKeys.length; i++) {
        value = allKeys[i].split('::')
        if (value.length === 3) {
            if (value[0] === ns) {
                if (value[1] === fullKey) {
                    keys.push(allKeys[i]);
                }
            }
        }
    }

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        value = keys[i];
        value = value.split('::')
        podName = k8cData[value[2]].name
        podStatus = podStatusLookup[value[2]];

        if (typeof podStatus === 'undefined') {
            img = 'images/3d/3d-podMagenta.png';                     // Unknown
        } else {
            if (podStatus === 1 || podStatus === '1') {
                img = 'images/3d/3d-podGreen.png';                   // Running
            } else if (podStatus === 2 || podStatus === '2') {
                img = 'images/3d/3d-podRed.png';                     // Failing
            } else if (podStatus === 3 || podStatus === '3') {
                img = 'images/3d/3d-podYellow.png';                  // Warn
            } else if (podStatus === 4 || podStatus === '4') {
                img = 'images/3d/3d-podBlue.png';                    // Completed
            } else if (podStatus === 0 || podStatus === '0') {
                img = 'images/3d/3d-podGrey.png';                    // Deamon
            } else {
                img = 'images/3d/3d-podMagenta.png';                 // Unknown
            }
        }

        counts = counts + '<tr class="vpkfont">'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="getDefFnum(\'' + value[2] + '\')">'
            + '<img src="' + img + '" height="20" width="20"></td>'
            + '<td style="text-align: center; border: 1px solid #888888;" onclick="getDefFnum(\'' + value[2] + '\')">'
            + volumeCountsNS[keys[i]] + '</td>'
            + '<td style="padding-left: 10px;" onclick="getDefFnum(\'' + value[2] + '\')">'
            + podName + '</td>'
            + '</tr>'
    }
    counts = counts + '</table>'

    $('#countNSFnum').html(counts);
}


//============================
function openNodeStorage(section) {

}

function openNodeStorageCounts(node) {
    // TODO: Should other sections be closed
    $('#storageWrapper').collapse("hide");
    $("#countNode").collapse("show");

    countsForNodeType(node);

    returnWhere = 'Cluster';
    let returnButton = '<div class="vpkfont vpkcolor vpk-rtn-bg mt-1 mb-2 ml-2">'
        + '<button type="button" class="mt-1 mb-1 btn btn-sm btn-secondary vpkButtons ml-2 px-2" '
        + ' onclick="returnToWhereTab(\'' + returnWhere + '\',\'countsReturnSection\')">Return</button>'
        + '<span class="px-2">to ' + returnWhere + ' tab</span>'
        + '</div>'

    $("#countsReturnSection").html(returnButton);
    $("#storageReturnSection").html('');
    $('[href="#storage"]').tab('show');
}


//============================
function buildStorageSVG() {
    let scKeys = Object.keys(storageData.StorageClass)
    let scHL = scKeys.length;
    let lastSC = false;
    let space = 0;
    let fmtSpc = '';
    let first = true;

    let name;
    let fnum;
    let spcLength = 9;
    let cSec = '';
    let tmp;
    let fillColor;
    let textColor;
    let spcAbv;

    // Dashed / tics at top of display area
    let rtn = '<div class="mt-0 ml-5 vpkfont-sm vpkcolor"><span pl-5></span>'
        + '</div>'
        + '<svg width="1200" height="10">'
        // + '<line  x1="30"  x2="190"  y1="10" y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="200"  x2="1200"  y1="10" y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="200"  x2="200"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="250"  x2="250"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="300"  x2="300"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="350"  x2="350"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="400"  x2="400"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="450"  x2="450"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="500"  x2="500"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="550"  x2="550"   y1="6"  y2="10"  stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="600"  x2="600"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="650"  x2="650"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="700"  x2="700"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="750"  x2="750"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="800"  x2="800"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="850"  x2="850"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="900"  x2="900"   y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="950"  x2="950"   y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="1000" x2="1000"  y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="1050" x2="1050"  y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="1100" x2="1100"  y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '<line  x1="1150" x2="1150"  y1="6"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'

        + '<line  x1="1200" x2="1200"  y1="1"  y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
        + '</svg>'


    scKeys.sort();
    for (let s = 0; s < scKeys.length; s++) {
        storCnt++;
        space = 0;
        if (typeof storageData.SpaceReqSC[scKeys[s]] !== 'undefined') {
            fmtSpc = storageData.SpaceReqSC[scKeys[s]].fmtSpc
            space = storageData.SpaceReqSC[scKeys[s]].space
            // TODO: to do calculate max size
            tmp = fmtSpc.substring(2);
            tmp = tmp.trim();
            spcLength = parseInt(tmp, 10);

        } else {
            fmtSpc = 'None used';
            space = 0;
            spcLength = 0;
        }

        if (typeof storageData.StorageClass[scKeys[s]].name === 'undefined') {
            continue;
        } else {
            name = storageData.StorageClass[scKeys[s]].name;
        }

        // set fillColor

        spcAbv = fmtSpc.substring(0, 2);
        switch (spcAbv) {
            case "KB":
                fillColor = "#F8BBD0"
                textColor = "black";
                break;
            case "MB":
                fillColor = "#B39DDB"
                textColor = "white";
                break;
            case "GB":
                fillColor = "#90CAF9"
                textColor = "black";
                break;
            case "TB":
                fillColor = "#4CAF50"
                textColor = "white";
                break;
            case "PB":
                fillColor = "#C0CA33"
                textColor = "black";
                break;
            case "EB":
                fillColor = "#FFA000"
                textColor = "black";
                break;
            case "ZB":
                fillColor = "#D84315"
                textColor = "white";
                break;
            case "YB":
                fillColor = "#4E342E"
                textColor = "white";
                break;
            default:
                fillColor = "#999999"
                textColor = "black";
        }

        if (fmtSpc === "None used") {
            fillColor = "#eeeeee"
            textColor = "#666666";
        }

        fnum = storageData.StorageClass[scKeys[s]].fnum;

        if (typeof scArray[name] === 'undefined') {
            scArray[name] = {};
            scArray[name].id = 'sc' + storCnt;
            scArray[name].fnum = fnum;
        }

        rtn = rtn + '<svg id="sc' + storCnt + '" width="1200" height="50">'
            + '<image x="10" y="5"  width="40" height="40" href="images/3d/3d-sc.png" '
            + ' onclick="getDefFnum(\'' + fnum + '\')"/>'

            + '<text x="60" y="42" fill="black" class="vpkfont" data-toggle="collapse" '
            + ' onclick="toggleStorage(\'sc' + storCnt + 'pv\')">StorageClass: </text>'

            + '<text x="160" y="42" fill="black" class="vpkfont" data-toggle="collapse" '
            + ' onclick="toggleStorage(\'sc' + storCnt + 'pv\')">' + name + '</text>'

            + '<rect x="200" y="5"  width="' + spcLength + '"  height="18" rx="0" stroke-width="0"  stroke="black" fill="' + fillColor + '" '
            + ' onclick="toggleStorage(\'sc' + storCnt + 'pv\')"/>'

            + '<rect x="55" y="5"  width="85"  height="18" rx="1" stroke-width="0.5"  stroke="' + textColor + '" fill="' + fillColor + '" '
            + ' onclick="toggleStorage(\'sc' + storCnt + 'pv\')"/>'

            + '<text x="60" y="19" fill="' + textColor + '" class="vpkfont" '
            + ' onclick="toggleStorage(\'sc' + storCnt + 'pv\')">' + fmtSpc + '</text>'

        //+ '<line x1="30" x2="1200" y1="50" y2="50" stroke="gray" stroke-width="0.5" stroke-linecap="round"/>'

        if (first === false) {
            rtn = rtn + '<line  x1="1"  x2="1200" y1="1" y2="1" stroke="lightgray" stroke-width="0.5" stroke-linecap="round"/>'
        }

        rtn = rtn + '</svg>';

        if ((s + 1) === scHL) {
            lastSC = true;
        } else {
            lastSC = false;
        }
        cSec = buildPVLine(storCnt, scKeys[s], lastSC);
        rtn = rtn + cSec;
    }
    return rtn;
}

function buildPVLine(storCnt, sc, lastSC) {
    let pvKeys = Object.keys(storageData.PVinfo);
    let pvcKeys = Object.keys(storageData.PVCinfo);
    let hdr = '<div id="sc' + storCnt + 'pv" class="collapse">';
    let rtn = '';
    let name;
    let fnum;
    let pvcNS;
    let pvcName;
    let first = true;
    let item = '';
    for (let p = 0; p < pvKeys.length; p++) {
        item = storageData.PVinfo[pvKeys[p]];
        name = storageData.PVinfo[pvKeys[p]][0].name;
        fnum = storageData.PVinfo[pvKeys[p]][0].fnum;
        if (storageData.PVinfo[pvKeys[p]][0].storageClass === sc) {
            // on first PV do not draw continue line from previous PV
            if (first) {
                first = false;
            } else {
                rtn = rtn + '<line  x1="30" x2="30"  y1="25"  y2="100" stroke="black" stroke-width="1" stroke-linecap="round"/></svg>'
            }

            rtn = rtn + '<svg id="pv' + p + '" width="1200" height="100">'
                + '<image x="70" y="5"  width="32" height="32" href="images/3d/3d-pv.png" '
                + ' onclick="getDefFnum(\'' + fnum + '\')"/>'
                + '<text x="145"  y="20" fill="black" class="vpkfont" onclick="getDefFnum(\'' + fnum + '\')">' + storageData.PVinfo[pvKeys[p]][0].fmtSpc + '</text>'
                + '<text x="145"  y="34" fill="black" class="vpkfont-sm">PV name:</text>'
                + '<text x="205"  y="34" fill="black" class="vpkfont">' + name + '</text>'

                + '<line  x1="30" x2="70"  y1="25" y2="25" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="30" x2="30"  y1="0"  y2="25" stroke="black" stroke-width="1" stroke-linecap="round"/>'

            pvcName = storageData.PVinfo[pvKeys[p]][0].cRefName;
            pvcNS = storageData.PVinfo[pvKeys[p]][0].cRefNS;
            for (let v = 0; v < pvcKeys.length; v++) {
                if (storageData.PVCinfo[pvcKeys[v]][0].name === pvcName) {
                    if (storageData.PVCinfo[pvcKeys[v]][0].namespace === pvcNS) {
                        rtn = rtn + '<image x="100" y="40"  width="32" height="32" href="images/3d/3d-pvc.png" '
                            + ' onclick="getDefFnum(\'' + pvcKeys[v] + '\')"/>'
                            + '<text x="145" y="66" fill="black" class="vpkfont">' + storageData.PVCinfo[pvcKeys[v]][0].fmtSpc + '</text>'
                            + '<text x="145" y="80" fill="black" class="vpkfont-sm">PVC name:</text>'
                            + '<text x="205" y="80" fill="black" class="vpkfont">' + pvcName + '</text>'

                            + '<line  x1="100" x2="88" y1="58" y2="58" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                            + '<line  x1="88"  x2="88" y1="40" y2="58" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                            + '<line  x1="35"  x2="1200" y1="99" y2="99" stroke="lightgray" stroke-width="0.5" stroke-linecap="round"/>'
                    }
                }
            }
        }
        // rtn = rtn + '</svg>'
    }
    return rtn = hdr + rtn + '</svg></div>'
}

// Toggle the StorageClass in the UI
function toggleStorage(id) {
    id = '#' + id;
    if ($(id).is('.collapse:not(.show)')) {
        // not open, open it
        $(id).collapse("show");
    } else {
        $(id).collapse("hide");
    }
}

function showSC(name, fnum) {
    // Close all StroageClasses
    returnWhere = 'Cluster';
    let returnButton = '<div class="vpkfont vpkcolor vpk-rtn-bg mt-1 mb-2 ml-2">'
        + '<button type="button" class="mt-1 mb-1 btn btn-sm btn-secondary vpkButtons ml-2 px-2" '
        + ' onclick="returnToWhereTab(\'' + returnWhere + '\',\'storageReturnSection\')">Return</button>'
        + '<span class="px-2">to ' + returnWhere + ' tab</span>'
        + '</div>'

    $("#storageReturnSection").html(returnButton);
    $("#countsReturnSection").html('');

    $("#countNode").collapse("hide");
    $("#countVol").collapse("hide");
    $("#countNamespace").collapse("hide");

    $('#storageWrapper').collapse("show");

    try {
        let tID;
        let keys = Object.keys(scArray);
        for (let i = 0; i < keys.length; i++) {
            tID = scArray[keys[i]].id;
            // Close all open Open the stroage info
            let id = '#' + tID + 'pv';
            if ($(id).is('.collapse:not(.show)')) {
                // not open, open it
            } else {
                $(id).collapse("hide");
            }
        }

        // Open the selected StorageClass and scroll to that SC
        if (typeof scArray[name] !== 'undefined') {
            let tID = scArray[name].id;
            // Open the stroage info
            let id = '#' + tID + 'pv';
            $(id).collapse("show");
            // Switch to the tab
            $('[href="#storage"]').tab('show');
            // Scroll to the info
            document.getElementById(tID).scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        console.log(`View storage from cluster failed, error: ${e.message}`);
        console.log(`Error stack: ${e.stack}`);
    }
}


//----------------------------------------------------------
console.log('loaded vpkTabStorage.js');