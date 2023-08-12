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
// build svg data for ownerRef links
//----------------------------------------------------------
function initStorageVars() {
    oldBreak = '@';
    storCnt = 0;
    storCollapseID = [];
    storBreakID = 0;
    storageInfo = {};
}

function buildStorage() {
    initStorageVars();

    //Build the SVG for storage requests
    let html = buildStorageSVG();
    //If no images were built display message to inform user
    if (storCnt === 0) {
        html = '<div class="vpkfont vpkcolor"><br><p>No storage requests located for the selected snapshot</p></div>'
    }
    //Update the browser DOM
    $("#storageDetail").html(html);
    $("#storageDetail").show();
}

function buildStorageSVG() {
    let scKeys = Object.keys(storageData.StorageClass)
    let scHL = scKeys.length;
    let lastSC = false;
    let space = 0;
    let fmtSpc = '';
    let first = true;

    let rtn = '<div class="mt-0 ml-5 vpkfont-sm vpkcolor"><span pl-5>Click horizontal bars to view StorageClase details</span>'
        + '<span class="pl-3">'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #F8BBD0; color: black;">KiloByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #B39DDB; color: white;">MegaByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #90CAF9; color: black;">GigaByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #4CAF50; color: white;">TeraByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #C0CA33; color: black;">PetaByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #FFA000; color: black;">ExaByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #D84315; color: white;">ZettaByte</span>'
        + '<span class="pl-3 pr-3 pb-1 pt-1 mr-2" style="background-color: #4E342E; color: white;">YottaByte</span>'


        + '</div>'
        + '<svg width="1200" height="10">'
        + '<line  x1="30"  x2="190"  y1="10" y2="10" stroke="black" stroke-width="0.5" stroke-linecap="round"/>'
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

    let name;
    let fnum;
    let spcLength = 09;
    let cSec = '';
    let tmp;
    let fillColor;
    let textColor;
    let spcAbv;
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
        rtn = rtn + '<svg id="sc' + storCnt + '" width="1200" height="50">'
            + '<image x="10" y="5"  width="40" height="40" href="images/k8/sc.svg" onmousemove="showStorageTooltip(evt,\''
            + buildStorageInfo(name, 'SC')
            + '\');" onmouseout="hideVpkTooltip()"  onclick="getDefFnum(\'' + fnum + '\')"/>'

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

            + '<line x1="30" x2="1200" y1="50" y2="50" stroke="gray" stroke-width="0.5" stroke-linecap="round"/>'

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
                + '<image x="70" y="5"  width="35" height="35" href="images/k8/pv.svg" onmousemove="showStorageTooltip(evt,\''
                + buildStorageInfo(name, 'PV')
                + '\')" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + fnum + '\')"/>'
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
                        rtn = rtn + '<image x="100" y="40"  width="35" height="35" href="images/k8/pvc.svg" '
                            + ' onmousemove="showStorageTooltip(evt,\''
                            + buildStorageInfo(pvcName, 'PVC')
                            + '\')" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + pvcKeys[v] + '\')"/>'
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


//----------------------------------------------------------
console.log('loaded vpkStorage.js');
