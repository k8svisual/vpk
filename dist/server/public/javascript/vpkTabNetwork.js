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
// Event messages handler
//----------------------------------------------------------

let networkInfo;
let networkPodDetail = {};
let networkSelectedData = [];        // populated with the data for the selected filter type
let networkFilterType;
let networkFilterLevel;
let networkViewSelected = 'Node';    // What is the current view
let networkFilterNodeData = [];
let networkFilterServiceData = [];

let networkFilterNodeType;
let networkFilterNodeLevel;

let networkFilterServiceType;
let networkFilterServiceLevel;

let networkDropDownsBuilt = false;

const netNoDataMsg = '<div><span class="vpkfont vpkblue">No Snapshot data loaded</span></></div>';


function openNetworkTab() {

    // Build and show the proper drop down filter network
    // Depending on what view is shown, Node or Service, populate with the appropriate data

    if (networkDropDownsBuilt === false) {
        let options;
        // populate Node options
        options = '<option></option>'
            + '<option value="Node name">Node name</option>'
            + '<option value="Node ip">Node ip</option>';
        $("#network-type-node-filter").html(options);

        // populate Service options
        options = '<option></option>'
            + '<option value="Service name">Service name</option>'
            + '<option value="Service ip">Service ip</option>'
            + '<option value="Pod name">Pod name</option>'
            + '<option value="Pod ip">Pod ip</option>'
            + '<option value="Namespace">Namespace</option>';
        $("#network-type-service-filter").html(options);
        networkDropDownsBuilt = true;
    }

    $("#networkFilterModal").modal('hide')

    if (networkViewSelected === 'Node') {
        $('#net-service-data').hide();
        $('#net-node-data').show();
        $('#networkNodeDetail').show();
        showNetworkNodeView();
    } else {
        $('#net-node-data').hide();
        $('#net-service-data').show();
        $('#networkServiceDetail').show();
        showNetworkServiceView();
    }
}

function openNetworkFilter() {
    //console.log('openNetworkFilter()')
    //console.log(`networkViewSelected: ${networkViewSelected}`);

    if (networkViewSelected === 'Node') {
        $('#net-service-data').hide();
        $('#net-node-data').show();
    } else {
        $('#net-node-data').hide();
        $('#net-service-data').show();
    }

    $("#networkFilterModal").modal('show')
}

function getNetworkFilterTypeLevel(selected) {
    // Invoked from vpkMain.js on event $('#network-type-filter').on('select2:select', function (e)
    //console.log('getNetwokFilterTypeLevel()');
    let what = selected.split(' ');
    networkFilterType = what[0];
    networkFilterLevel = what[1];

    if (networkViewSelected === 'Node') {
        networkFilterNodeType = what[0];
        networkFilterNodeLevel = what[1];
    } else {
        networkFilterServiceType = what[0];
        networkFilterServiceLevel = what[1];
    }

    populateNetworkSecondDropDown();
}

function applyNetworkFilter() {
    //console.log('applyNetworkFilter()');
    if (networkViewSelected === 'Node') {
        let options = $('#network-data-node-filter').select2('data');
        networkFilterNodeData = [];
        for (let i = 0; i < options.length; i++) {
            networkFilterNodeData.push(options[i].text.trim());
        };
        showNetworkNodeView();
        $("#networkFilterModal").modal('hide')
    } else {
        let options = $('#network-data-service-filter').select2('data');
        networkFilterServiceData = [];
        for (let i = 0; i < options.length; i++) {
            networkFilterServiceData.push(options[i].text.trim());
        };
        showNetworkServiceView();
        $("#networkFilterModal").modal('hide')
    }
}

function clearNetworkFilters() {
    //console.log('applyNetworkFilter()');
    if (networkViewSelected === 'Node') {
        networkFilterNodeData = [];
        showNetworkNodeView();
        $("#networkFilterModal").modal('hide')
        setSelectValue('network-type-node-filter', '')
        setSelectValue('network-data-node-filter', '')
    } else {
        networkFilterServiceData = [];
        showNetworkServiceView();
        $("#networkFilterModal").modal('hide')
        setSelectValue('network-type-service-filter', '')
        setSelectValue('network-data-service-filter', '')
    }
}

function populateNetworkSecondDropDown() {
    //console.log('populateNetworkSecondDropDown()')
    // Populates the second dropdown with selected filter type
    let options = [];
    let data;
    let keys;
    // Node related filter
    if (networkFilterType === 'Node' && networkFilterLevel === 'name') {
        data = [];
        data = Object.keys(networkNodes);
    } else if (networkFilterType === 'Node' && networkFilterLevel === 'ip') {
        keys = Object.keys(networkNodes);
        data = {};
        for (let i = 0; i < keys.length; i++) {
            for (let p = 0; p < networkNodes[keys[i]].addresses.length; p++) {
                if (networkNodes[keys[i]].addresses[p].type === 'InternalIP') {
                    let tmp = networkNodes[keys[i]].addresses[p].address;
                    if (typeof data[networkNodes[keys[i]].addresses[p].address] === 'undefined') {
                        data[networkNodes[keys[i]].addresses[p].address] = 1;
                    }
                }
            }
        }
        // Service related filter
    } else if (networkFilterType === 'Service' && networkFilterLevel === 'name') {
        keys = Object.keys(networkServicesToPods);
        data = [];
        for (let i = 0; i < keys.length; i++) {
            data.push(networkServicesToPods[keys[i]].name)
        }
    } else if (networkFilterType === 'Service' && networkFilterLevel === 'ip') {
        keys = Object.keys(networkServicesToPods);
        data = {};
        for (let i = 0; i < keys.length; i++) {
            if (typeof data[networkServicesToPods[keys[i]].ip] === 'undefined') {
                data[networkServicesToPods[keys[i]].ip] = 1;
            }
        }
        // Pod related filter
    } else if (networkFilterType === 'Pod' && networkFilterLevel === 'name') {
        keys = Object.keys(networkServicesToPods);
        data = [];
        for (let i = 0; i < keys.length; i++) {
            for (let p = 0; p < networkServicesToPods[keys[i]].pods.length; p++) {
                data.push(networkServicesToPods[keys[i]].pods[p].name)
            }
        }
    } else if (networkFilterType === 'Pod' && networkFilterLevel === 'ip') {
        keys = Object.keys(networkServicesToPods);
        data = {};
        for (let i = 0; i < keys.length; i++) {
            for (let p = 0; p < networkServicesToPods[keys[i]].pods.length; p++) {
                if (typeof networkServicesToPods[keys[i]].pods[p].ips !== 'undefined') {
                    for (let k = 0; k < networkServicesToPods[keys[i]].pods[p].ips.length; k++) {
                        if (typeof data[networkServicesToPods[keys[i]].pods[p].ips[k].ip] === 'undefined') {
                            data[networkServicesToPods[keys[i]].pods[p].ips[k].ip] = 1;
                        }
                    }
                }
            }
        }
        // Namespace related filter
    } else if (networkFilterType === 'Namespace') {
        keys = Object.keys(networkServicesToPods);
        data = {};
        for (let i = 0; i < keys.length; i++) {
            for (let p = 0; p < networkServicesToPods[keys[i]].pods.length; p++) {
                if (typeof data[networkServicesToPods[keys[i]].pods[p].ns] === 'undefined') {
                    data[networkServicesToPods[keys[i]].pods[p].ns] = 1;
                }
            }
        }
    }
    // Build the <options>
    if (typeof data !== 'undefined') {
        if (Array.isArray(data)) {
            data.sort();
            for (let i = 0; i < data.length; i++) {
                options.push('<option value="' + data[i] + '">' + data[i] + '</option>')
            }
        } else {
            let tmp = Object.keys(data)
            tmp.sort();
            for (let i = 0; i < tmp.length; i++) {
                options.push('<option value="' + tmp[i] + '">' + tmp[i] + '</option>')
            }
        }
    }

    // Based on what is shown populate the appropriate drop down
    if (networkViewSelected === 'Node') {
        // Add data to the drop-down filter
        $("#network-data-node-filter").empty();
        $("#network-data-node-filter").html(options);
    } else {
        // Add data to the drop-down filter
        $("#network-data-service-filter").empty();
        $("#network-data-service-filter").html(options);
    }
}

function getNetworkNodeData() {
    //console.log('getNetworkNodeData()')
    let newData = null;
    let keys;
    if (networkFilterNodeData.length > 0) {
        // Node related data population
        if (networkFilterNodeType === 'Node' && networkFilterNodeLevel === 'name') {
            keys = Object.keys(networkNodes);
            newData = {};
            for (let i = 0; i < keys.length; i++) {
                if (networkFilterNodeData.includes(keys[i])) {
                    newData[keys[i]] = networkNodes[keys[i]]
                }
            }
        } else if (networkFilterNodeType === 'Node' && networkFilterNodeLevel === 'ip') {
            keys = Object.keys(networkNodes);
            newData = {};
            for (let i = 0; i < keys.length; i++) {
                for (let p = 0; p < networkNodes[keys[i]].addresses.length; p++) {
                    if (networkNodes[keys[i]].addresses[p].type === 'InternalIP') {
                        if (networkFilterNodeData.includes(networkNodes[keys[i]].addresses[p].address)) {
                            newData[keys[i]] = networkNodes[keys[i]]
                        }
                    }
                }
            }
        }
    } else {
        newData = new Object(networkNodes);
    }
    return newData;
}

function showNetworkNodeView() {
    //console.log('showNetworkNodeView()')
    networkViewSelected = 'Node'
    $('#networkServiceDetail').hide();
    $('#networkNodeDetail').show();
    let maxWidth = 1200;
    let maxHeight = 0;
    let line = '';
    let html = '';
    let hdr = '';
    let node = '';
    let netCnt = 0;
    let nodeIP;
    let currentLine = 55;
    let maxIPCnt = 0;
    let data = getNetworkNodeData();
    let netKeys;
    let img;
    let type;
    networkPodDetail = {};
    if (typeof data !== 'undefined') {
        netKeys = Object.keys(data);
    }

    for (let i = 0; i < netKeys.length; i++) {
        line = '';
        hdr = '';
        node = '';
        for (let ip = 0; ip < data[netKeys[i]].addresses.length; ip++) {
            if (data[netKeys[i]].addresses[ip].type === 'InternalIP') {
                nodeIP = data[netKeys[i]].addresses[ip].address;
                break;
            }
        }
        currentLine = 55;
        let newI = netUniqueIPs(data[netKeys[i]].pods);
        networkPodDetail[netKeys[i]] = newI;
        let newKeys = Object.keys(newI);
        let baseIPS = getBaseIPS(newKeys);
        newKeys = Object.keys(baseIPS);
        maxIPCnt = newKeys.length;
        maxHeight = (maxIPCnt * 35) + 70;
        let tH = maxHeight - 55
        let allH = maxHeight + 25;

        if (data[netKeys[i]].type === 'm') {
            img = "images/3d/3d-mstNode.png";
            type = 'Master';
        } else {
            img = "images/3d/3d-wrkNode.png";
            type = 'Worker';
        }

        node = '<div><svg xmlns="http://www.w3.org/2000/svg" width="' + maxWidth + '" height="' + allH + '">'
            + '<rect x="5" y="6" width="400" rx="10px"'
            + ' height="' + maxHeight + '" fill="#ffff00" '
            + ' style="fill:rgb(255,255,0); stroke-width:2; stroke:rgb(0,0,200)"'
            + ' onclick="getNodeInfo(\'' + netKeys[i] + '::' + nodeIP + '::' + type + '\')"'
            + ' />'
            + '<image x="10" y="10"  width="30" height="30" href="' + img + '"'
            + ' onmousemove="showTooltipMessage(evt,\'Click to view Node information\',0)" '
            + ' onmouseout="hideVpkTooltip()" '
            + ' onclick="getNodeInfo(\'' + netKeys[i] + '::' + nodeIP + '::' + type + '\')"/>'
            + '<text text-anchor="start" x="170" y="25" fill="#666" class="fa-1x" '
            + ' onclick="getNodeInfo(\'' + netKeys[i] + '::' + nodeIP + '::' + type + '\')">'
            + nodeIP + '</text>';
        hdr = '<rect x="40" y="35" width="325" rx="10px"'
            + ' height="' + tH + '" fill="#bbbbbb" '
            + ' style="fill:rgb(255,255,255); stroke-width:2; stroke:rgb(200,0,0)"'
            + ' />'

        for (let addr = 0; addr < newKeys.length; addr++) {
            if (addr === 0) {
                line = line + '<text text-anchor="start" x="45" y="' + currentLine + '" fill="#666" class="fa-1x">Pod IP ranges:</text>'
                    + '<text text-anchor="start" x="155" y="' + currentLine + '" fill="#666" class="fa-sm">(click ranges to view details)</text>';
                currentLine = currentLine + 25;
            }
            line = line + '<text text-anchor="start" x="170" y="' + currentLine + '" fill="#666" class="fa-1x"'
                + ' onmousemove="showTooltipMessage(evt,\'Click to view ' + newKeys[addr] + '.xxx range information\',0)" '
                + ' onmouseout="hideVpkTooltip()" '
                + ' onclick="getPodRangeInfo(\'' + netKeys[i] + '::' + nodeIP + '::' + newKeys[addr] + '\')">'
                + newKeys[addr] + '.xxx'
                + '</text>';
            currentLine = currentLine + 25;
            netCnt++;
        }
        // Update the tab with the new html
        html = html + node + hdr + line + '</svg></div>';
    }
    $('#networkNodeDetail').html(html);
    $('#networkNodeDetail').show();
}

function getNetworkServiceData() {
    //console.log('getNetworkServiceData()')
    let newData = null;
    let keys;
    if (networkFilterServiceData.length > 0) {
        // Node related data population
        if (networkFilterServiceType === 'Service' && networkFilterServiceLevel === 'name') {
            keys = Object.keys(networkServicesToPods);
            newData = {};
            for (let i = 0; i < keys.length; i++) {
                if (networkFilterServiceData.includes(networkServicesToPods[keys[i]].name)) {
                    newData[keys[i]] = networkServicesToPods[keys[i]];
                }
            }
        } else if (networkFilterServiceType === 'Service' && networkFilterServiceLevel === 'ip') {
            keys = Object.keys(networkServicesToPods);
            newData = {};
            for (let i = 0; i < keys.length; i++) {
                if (networkFilterServiceData.includes(networkServicesToPods[keys[i]].ip)) {
                    newData[keys[i]] = networkServicesToPods[keys[i]];
                }
            }
        } else if (networkFilterServiceType === 'Pod' && networkFilterServiceLevel === 'name') {
            keys = Object.keys(networkServicesToPods);
            newData = {};
            for (let i = 0; i < keys.length; i++) {

                for (let p = 0; p < networkServicesToPods[keys[i]].pods.length; p++) {
                    if (networkFilterServiceData.includes(networkServicesToPods[keys[i]].pods[p].name)) {
                        newData[keys[i]] = networkServicesToPods[keys[i]];
                    }
                }
            }
        } else if (networkFilterServiceType === 'Pod' && networkFilterServiceLevel === 'ip') {
            keys = Object.keys(networkServicesToPods);
            newData = {};
            for (let i = 0; i < keys.length; i++) {
                for (let p = 0; p < networkServicesToPods[keys[i]].pods.length; p++) {
                    for (let k = 0; k < networkServicesToPods[keys[i]].pods[p].ips.length; k++) {
                        if (networkFilterServiceData.includes(networkServicesToPods[keys[i]].pods[p].ips[k].ip)) {
                            newData[keys[i]] = networkServicesToPods[keys[i]];
                        }
                    }
                }
            }
        } else if (networkFilterServiceType === 'Namespace') {
            keys = Object.keys(networkServicesToPods);
            newData = {};
            for (let i = 0; i < keys.length; i++) {
                for (let p = 0; p < networkServicesToPods[keys[i]].pods.length; p++) {
                    if (networkFilterServiceData.includes(networkServicesToPods[keys[i]].pods[p].ns)) {
                        newData[keys[i]] = networkServicesToPods[keys[i]];
                    }
                }
            }
        }
    } else {
        newData = new Object(networkServicesToPods);
    }
    return newData;
}

function showNetworkServiceView() {
    //console.log('showNetworkServiceView()');
    networkViewSelected = 'Service';
    $('#networkNodeDetail').hide();
    $('#networkServiceDetail').show();
    let maxWidth = 1200;
    let line = '';
    let sLine = '';
    let nLine = '';
    let pLine = '';
    let html = '';
    let svcY;
    let currentLine = 80;
    let data = getNetworkServiceData();
    let netKeys = Object.keys(data);
    let imgGreen = "images/3d/3d-podGreen.png";
    let imgGrey = "images/3d/3d-podGrey.png";
    let pData;
    let lineLinks = [];
    let maxLine = 0;
    let p;
    let i;
    let x;
    let sIP;
    let oldNode;
    let nodeTop = 55;
    let nodeBottom = 0;
    let tmp;

    // Outter for loop is the Service, inner for loop is the Pods in each Node
    for (i = 0; i < netKeys.length; i++) {
        line = '';
        pLine = '';
        sLine = '';
        nLine = '';
        hdr = '';
        svcs = '';
        currentLine = 80;
        lineLinks = [];
        tmp = [];
        pData = data[netKeys[i]].pods

        for (let c = 0; c < pData.length; c++) {
            if (pData[c].status === 'Running') {
                tmp.push(pData[c])
            }
        }

        if (tmp.length === 0) {
            continue;
        } else {
            pData = tmp;
        }
        // Sort data if more than one entry
        if (pData.length > 1) {
            pData.sort(sortNodeIPs);
        }

        oldNode = pData[0].node;
        nodeTop = 55;
        nodeBottom = 0;
        // Pods processing
        nLine = '';
        for (p = 0; p < pData.length; p++) {
            // Service info uses "sLine"
            if (p === 0) {
                sLine = sLine + '<text text-anchor="start" x="20" y="25" fill="#666" class="fa-1x" '
                    + ' onmousemove="showTooltipMessage(evt,\'Click to view Service information\',1)" '
                    + ' onmouseout="hideVpkTooltip()" '
                    + ' onclick="getDefFnum(\'' + pData[p].fnum + '\')">'
                    + 'Service: ' + data[netKeys[i]].name
                    + '</text>'

                if (data[netKeys[i]].ip !== 'None') {
                    sIP = data[netKeys[i]].ip;
                } else {
                    sIP = 'No clusterIP located'
                }

                sLine = sLine + '<text text-anchor="start" x="20" y="50" fill="#666" class="fa-1x" '
                    + ' onmousemove="showTooltipMessage(evt,\'Click to view Service information\',1)" '
                    + ' onmouseout="hideVpkTooltip()" '
                    + ' onclick="getDefFnum(\'' + pData[p].fnum + '\')">'
                    + sIP
                    + '</text>'
                lineLinks.push(currentLine)
                currentLine = currentLine + 25;
            }
            // If DaemonSetPod
            if (pData[p].dsp === true) {
                img = imgGrey;
            } else {
                img = imgGreen;
            }

            if (pData[p].node !== oldNode) {
                nLine = nLine + buildNodeRect(nodeTop, ((nodeBottom * 25) + 40), oldNode, pData[p - 1].nodeFnum, pData[p - 1].type, pData[p - 1].nodeIP)
                nodeTop = currentLine;
                nodeBottom = 0;
                oldNode = pData[p].node;
                currentLine = currentLine + 25;
                lineLinks.push(currentLine);
                currentLine = currentLine + 25;
                // Append the node rectangle to the svg along with existing and reset
                line = line + nLine;
                nLine = '';
            }

            nodeBottom = nodeBottom + 1;

            pLine = pLine + '<image x="240" y="' + (currentLine - 17) + '" height="25" href="' + img + '"'
                + ' onmousemove="showTooltipMessage(evt,\'Click to view Pod information\',1)" '
                + ' onmouseout="hideVpkTooltip()" '
                + ' onclick="getDefFnum(\'' + pData[p].fnum + '\')"/>'

            for (x = 0; x < pData[p].ips.length; x++) {
                //lineLinks.push(currentLine)
                pLine = pLine + '<text text-anchor="start" x="280" y="' + currentLine + '" fill="#666" class="fa-1x" '
                    + ' onmousemove="showTooltipMessage(evt,\'Click to view Pod information\',1)" '
                    + ' onmouseout="hideVpkTooltip()" '
                    + ' onclick="getDefFnum(\'' + pData[p].fnum + '\')">'
                    + pData[p].ips[x].ip + ' - ' + pData[p].name
                    + '</text>'
                currentLine = currentLine + 25;
                if (maxLine < currentLine) {
                    maxLine = currentLine;
                }
            }

            // Add node rectangle for single Pod
            if (pData.length === 1) {
                nLine = nLine + buildNodeRect(nodeTop, 70, oldNode, pData[0].nodeFnum, pData[0].type, pData[0].nodeIP)
                currentLine = currentLine + 25;
            }
            // Add node rectangle for last Pod when multiple exist
            if (pData.length > 1) {
                // Is this the last entry in pData
                if ((p + 1) === pData.length) {
                    nLine = nLine + buildNodeRect(nodeTop, ((nodeBottom * 25) + 40), oldNode, pData[p].nodeFnum, pData[p].type, pData[p].nodeIP)
                    currentLine = currentLine + 25;
                }
            }
        }
        // Center the Y axis for the line start point
        if (pData.length === 1) {
            svcY = 80;
            sLine = sLine + '<image x="20" y="' + (svcY) + '" height="25" href="images/3d/3d-svc.png"'
                + ' onmousemove="showTooltipMessage(evt,\'Click to view Service information\',1)" '
                + ' onmouseout="hideVpkTooltip()" '
                + ' onclick="getDefFnum(\'' + netKeys[i] + '\')"/>'
            sLine = sLine + '<line x1="50" y1="' + (svcY + 12) + '" x2="200" y2="' + (svcY + 12) + '" stroke-width="1" stroke="black"/>'

        } else {
            svcY = parseInt((currentLine / 2))
            sLine = sLine + '<image x="20" y="' + (svcY - 12) + '" height="25" href="images/3d/3d-svc.png"'
                + ' onmousemove="showTooltipMessage(evt,\'Click to view Service information\',1)" '
                + ' onmouseout="hideVpkTooltip()" '
                + ' onclick="getDefFnum(\'' + netKeys[i] + '\')"/>'

            for (let c = 0; c < lineLinks.length; c++) {
                sLine = sLine + '<line x1="50" y1="' + (svcY) + '" x2="200" y2="' + (lineLinks[c] - 3) + '" stroke-width="1" stroke="black"/>'
            }
        }

        hdr = '<div><svg xmlns="http://www.w3.org/2000/svg" width="' + maxWidth + '" height="' + (maxLine + 50) + '">'
            + '<rect x="5" y="6" width="970" rx="10px"'
            + ' height="' + (maxLine + 25) + '" fill="#eeeeee" '
            + ' style="fill:rgb(230,230,230); stroke-width:2; stroke:rgb(80,80,80)"'
            + ' />'

        // Update the tab with the new html
        html = html + hdr + line + nLine + sLine + pLine + '</svg></div>';
        maxLine = 0;
    }
    $('#networkServiceDetail').html(html);
    $('#networkNodeDetail').hide();
    $('#networkServiceDetail').show();
}


//================ Routines used to display the Node and Service views =====================

function sortNodeIPs(a, b) {
    if (a.nodeIP < b.nodeIP) {
        return -1;
    }
    if (a.nodeIP > b.nodeIP) {
        return 1;
    }
    return 0;
}

function sortPodIPs(a, b) {
    if (a.ip < b.ip) {
        return -1;
    }
    if (a.ip > b.ip) {
        return 1;
    }
    return 0;
}

function buildNodeRect(nodeTop, nodeBottom, oldNode, fnum, type, address) {
    let nLine = '';
    let img;
    if (type === 'm') {
        img = "images/3d/3d-mstNode.png";
    } else {
        img = "images/3d/3d-wrkNode.png";
    }

    nLine = nLine + '<rect x="200" y="' + nodeTop + '" width="750" rx="10px"'
        + ' height="' + (nodeBottom + 10) + '" fill="yellow" '
        + ' stroke-width="2px" stroke="rgb(0,0,200)"'
        + ' />';

    nLine = nLine + '<image x="205" y="' + (nodeTop + 5) + '" height="25" href="' + img + '" '
        + ' onmousemove="showTooltipMessage(evt,\'Click to view Node information\',1)" '
        + ' onmouseout="hideVpkTooltip()" '
        + ' onclick="getDefFnum(\'' + fnum + '\')"/>';


    nLine = nLine + '<text text-anchor="start" x="240" y="' + (nodeTop + 20) + '" fill="#666" class="fa-1x" '
        + ' onmousemove="showTooltipMessage(evt,\'Click to view Node information\',1)" '
        + ' onmouseout="hideVpkTooltip()" '
        + ' onclick="getDefFnum(\'' + fnum + '\')">'
        + address + ' - ' + oldNode
        + '</text>';

    // Pod rectangle
    nLine = nLine + '<rect x="230" y="' + (nodeTop + 30) + '" width="700" rx="10px"'
        + ' height="' + (nodeBottom - 35) + '" fill="white" '
        + ' stroke-width="2px" stroke="rgb(200,0,0)"'
        + ' />';

    return nLine;
}

function getBaseIPS(data) {
    let ipArray = {};
    let base;
    for (let i = 0; i < data.length; i++) {
        base = data[i].substring(0, data[i].lastIndexOf('.'))
        if (typeof ipArray[base] === 'undefined') {
            ipArray[base] = 1;
        } else {
            ipArray[base] = ipArray[base] + 1;
        }
    }
    return ipArray;
}

function netUniqueIPs(data) {
    let keys = Object.keys(data);
    let newK = [];
    let newD = [];
    let ip;
    // Build set of keys with zero padded IP in last portion
    for (let i = 0; i < keys.length; i++) {
        ip = keys[i].split('.');
        if (ip[3].length === 1) {
            ip[3] = '00' + ip[3]
        } else if (ip[3].length === 2) {
            ip[3] = '0' + ip[3]
        }
        newK.push(ip[0] + '.' + ip[1] + '.' + ip[2] + '.' + ip[3] + '::' + keys[i]);
    }
    newK.sort();

    for (let i = 0; i < newK.length; i++) {
        ip = newK[i].split('::')
        newD[ip[1]] = data[ip[1]];
        //newD.push(data[ip[1]]);
    }
    return newD;
}

function getNodeInfo(node) {
    let parts = node.split('::');
    let nData = '';
    let tRows = '';
    for (let i = 0; i < k8cData['0000-clusterLevel'].Node.length; i++) {
        if (k8cData['0000-clusterLevel'].Node[i].name === parts[0]) {
            nData = k8cData['0000-clusterLevel'].Node[i]
        }
    }
    let html = '<div class="mt-4">'
        + '<table style="border: 1px solid grey; border-collapse: collapse;" width="100%">'
        + '<tr class="text-center" style="background-color: grey; color: white;">'
        + '<th width="250px">Item</th><th>Value</th></tr>';
    tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Name</td><td>' + parts[0] + '</td></tr>'
        + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Type</td><td>' + parts[2] + '</td></tr>'
        + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">IP address</td><td>' + parts[1] + '</td></tr>';

    if (typeof nData.nodeInfo['architecture'] !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Node Architecture</td><td>' + nData.nodeInfo['architecture'] + '</td></tr>'
    }
    if (typeof nData.c_cpu !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">CPUs</td><td>' + nData.c_cpu + '</td></tr>'
    }
    if (typeof nData.c_memory !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Memory</td><td>' + nData.c_memory + '</td></tr>'
    }
    if (typeof nData.nodeInfo['osImage'] !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Operating System</td><td>' + nData.nodeInfo['osImage'] + '</td></tr>'
    }
    if (typeof nData.nodeInfo['kubeletVersion'] !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Kubelet Version</td><td>' + nData.nodeInfo['kubeletVersion'] + '</td></tr>'
    }
    if (typeof nData.nodeInfo['kubeProxyVersion'] !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Kube Proxy Version</td><td>' + nData.nodeInfo['kubeProxyVersion'] + '</td></tr>'
    }
    if (typeof nData.nodeInfo['containerRuntimeVersion'] !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Container Runtime (CRI) Version</td><td>' + nData.nodeInfo['containerRuntimeVersion'] + '</td></tr>'
    }
    html = html + tRows + '</table></div>'
    $('#networkInfoContents').html(html);
    $('#networkInfoModal').modal('show');
}

function getPodRangeInfo(keys) {
    let parts = keys.split('::')
    let data = networkPodDetail[parts[0]];
    let dkeys = Object.keys(data);
    let pData;
    let iData;
    let html = '<div class="mt-1"><span class="py-2">Click IP or Pod name to view pod information</span>'
        + '<table style="border: 1px solid grey; border-collapse: collapse;" width="100%">'
        + '<tr class="text-center" style="background-color: grey; color: white;">'
        + '<th width="250px">IP</th><th>Pod Name</th></tr>';
    let line = '';
    for (let i = 0; i < dkeys.length; i++) {
        if (dkeys[i].startsWith(parts[2])) {
            pData = data[dkeys[i]];
            for (let p = 0; p < pData.length; p++) {
                if (typeof k8cData[pData[p].fnum] !== 'undefined') {
                    iData = k8cData[pData[p].fnum];
                    if (iData.status.phase === 'Running') {
                        for (let x = 0; x < iData.status.podIPs.length; x++) {
                            line = line + '<tr><td class="text-center"  onclick="getDefFnum(\'' + iData.fnum + '\')">' + iData.status.podIPs[x].ip + '</td>'
                                + '<td onclick="getDefFnum(\'' + iData.fnum + '\')">' + iData.name + '</td></tr>'
                        }
                    }
                }
            }
        }
    }
    html = html + line + '</table></div>'
    $('#networkInfoContents').html(html);
    $('#networkInfoModal').modal('show');
}


//----------------------------------------------------------
console.log('loaded vpkTabEvtMsgs.js');
