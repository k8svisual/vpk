/*
Copyright (c) 2018-2023 k8sVisual

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
// build svg for workloads 
//----------------------------------------------------------

"use strict"

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

let iCnt = 1;
let oldNS = '@';
let first = true;
let evtCnt = 0;
let partsCnt = 0;
let rdata = '';
let breakData = '';
let breakID = 0;
let height = 0;
let fnum;
let genS;
let cfgS;
let iamS;
let podS;
let netS;
let pvcS;
let genH;
let cfgH;
let iamH;
let podH;
let netH;
let pvcH;
let allH;
let outterName = '';
let wCnt = 0;
let cLevel = '';
let countContainer = 0;
let countInitContainer = 0;
let countUnkImage = 0;
let collapseIDs = [];
let crdRefCnt = 0;

let k8cData;
let shtml = {};
let dom = {}
let cLeve;
let collapseNamespaces = {};
let workloadEventsInfo = {};			// workload events
let html = "";


function initSchematicVars() {
    iCnt = 1;
    oldNS = '@';
    first = true;
    evtCnt = 0;
    partsCnt = 0;
    rdata = '';
    breakData = '';
    breakID = 0;
    height = 0;
    fnum;
    genS;
    cfgS;
    iamS;
    podS;
    netS;
    pvcS;
    genH;
    cfgH;
    iamH;
    podH;
    netH;
    pvcH;
    allH;
    outterName = '';
    wCnt = 0;
    cLevel = '';
    countContainer = 0;
    countInitContainer = 0;
    countUnkImage = 0;
    collapseIDs = [];
    crdRefCnt = 0;
    shtml = {};
    dom = {};
    cLeve = '';
    collapseNamespaces = {};
    html = "";
    vpk.schematicSVGs = {};
    vpk.schematicKeys = {};
    vpk.nsResourceInfo = {};
    vpk.svgInfo = {};
}

function schematic() {
    //Clear and initialize the variables
    initSchematicVars();
    // Clear the DOM 
    dom.html = '';

    cLeve = '';

    //Build the SVG workload images
    let html = buildCSVG();
    let noPods = buildNoPods();
    if (noPods !== '') {
        // content was returned to output the message
        noPods = '<div id="noPods" class"vpkfont vpkcolor mt-4 mb-4 ml-4">'
            + '<span class="pl-4">Following defined namespaces have no deployed pods</span>'
            + '</div>'
            + noPods;
    }

    //If no images were built display message to inform user
    if (wCnt === 0) {
        html = '<div class="vpkfont vpkcolor"><br><p>No workload schematics generated for the selected datasource</p></div>'
    }

    //Update the fake browser DOM
    dom.html = cLevel + html + noPods;
    utl.logMsg("vpkUIS001 - Schematic process completed")
}


function buildNoPods() {
    let keys = Object.keys(k8cData);
    let key;
    let noPo = '';
    let line;
    let newKey;
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        line = '';
        if (key.startsWith('0000-@')) {
            continue;
        }
        if (key.startsWith('0000-#')) {
            continue;
        }
        if (!key.startsWith('0000-')) {
            continue;
        }
        if (key === '0000-clusterLevel') {
            continue;
        }

        if (typeof k8cData[key] !== 'undefined') {
            if (typeof k8cData[key].Pods === 'undefined') {
                wCnt++  // increment the workload found counter, even though there is no workload Pods
                newKey = key.substring(5);
                // generate the list of resources in the namespace
                nsChange(newKey);

                breakID++;

                // output the bar
                line = '<div class="breakBar">'
                    + '<button type="button" class="btn btn-warning btn-sm vpkButtons" '
                    + 'data-toggle="collapse" data-target="#collid-' + breakID + '">&nbsp;&nbsp;' + newKey + '&nbsp;&nbsp;'
                    + '</button>'
                    + '<hr>'
                    + '</div>'
                    + '<div id="collid-' + breakID + '" class="collapse">'
                    + '<div class="mb-1">'
                    + '<span class="vpkcolor vpkfont-md ml-4 mt-2">Press icon to view resources in namespace</span>'
                    + '</div>'
                    + '<div class="ml-4 mb-1"><img style="vertical-align:middle;" src="images/k8/ns.svg" width="50" height="40" '
                    + ' onclick="getNsTable(\'' + newKey + '\')">'
                    + '</div>'
                    + '</div>'

                noPo = noPo + line;
                collapseIDs.push(breakID);
                collapseNamespaces[newKey] = breakID;
                vpk.schematicSVGs[newKey] = {};
                vpk.schematicKeys[newKey] = {};
                vpk.schematicSVGs[newKey]['NoPod'] = line;
                vpk.schematicKeys[newKey]['NoPod'] = {};
            }
        }
    }
    return noPo;
}


function buildCSVG() {
    let keys = Object.keys(k8cData);
    let newKeys = [];
    let newKey;
    let acb;
    let nsWide;

    try {
        for (let p = 0; p < keys.length; p++) {
            newKey = keys[p];
            if (k8cData[newKey].display === true) {
                newKeys.push({ 'namespace': k8cData[newKey].namespace, 'fnum': newKey });
            } else {
                //newKeys.push({'namespace': k8cData[newKey].namespace, 'fnum': newKey});
            }
        }

        // sort by namespace & kind
        newKeys.sort((a, b) => (a.namespace > b.namespace) ? 1 : (a.namespace === b.namespace) ? ((a.fnum > b.fnum) ? 1 : -1) : -1);

        // clear the old unsorted keys
        keys = [];

        // build new sorted array: keys
        for (let t = 0; t < newKeys.length; t++) {
            newKey = newKeys[t].fnum;
            keys.push(newKey);
        }

        // process data 
        for (let k = 0; k < keys.length; k++) {
            evtCnt++;
            fnum = keys[k];
            if (fnum.startsWith('0000-')) {
                continue;
            } else {
                wCnt++  // increment the workload found counter
            }

            if (k8cData[fnum].namespace !== oldNS) {
                oldNS = k8cData[fnum].namespace;
                vpk.schematicSVGs[k8cData[fnum].namespace] = {};
                vpk.schematicKeys[k8cData[fnum].namespace] = {};

                breakID++;
                if (first) {
                    first = false;
                    rdata = rdata + '<span class="breakBar vpkcolor mt-2 ml-5">'
                        + 'Press the buttons below to view the schematics for the listed namespace'
                        + '<span class="ml-4"><button type="button" class="btn btn-outline-primary btn-sm vpkButtons pr-4 pl-4"'
                        + ' onclick="openAll(\'collid-\')">Open all</button></span>'
                        + '<span class="ml-4"><button type="button" class="btn btn-outline-primary btn-sm vpkButtons pr-4 pl-4"'
                        + ' onclick="closeAll(\'collid-\')">Close all</button></span>'
                        + '<hr class="mt-1"><span>'

                } else {
                    rdata = rdata + '</div>'
                }
                // output the break bar
                breakData =
                    '<div class="breakBar"><button type="button" '
                    + ' class="btn btn-primary btn-sm vpkButtons pl-4 pr-4" data-toggle="collapse" data-target="#collid-'
                    + breakID + '">' + k8cData[fnum].namespace + '</button>'
                    + '<hr></div>'
                    + '<div id="collid-' + breakID + '" class="collapse">';

                // print button
                breakData = breakData + '<div class="header-right">'
                    + '<a href="javascript:printDiv(\'collid-' + breakID + '\')">'
                    + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                    + '</a>'
                    + '</div>';

                //

                collapseIDs.push(breakID);
                collapseNamespaces[oldNS] = breakID;
                nsWide = nsChange(oldNS);
                rdata = rdata + breakData + nsWide;
            }
            // Build the actual svg
            acb = processF(fnum);
            // Save svg in object
            vpk.schematicSVGs[k8cData[fnum].namespace][fnum] = acb;
            vpk.schematicKeys[k8cData[fnum].namespace][fnum] = {
                'daemonSet': k8cData[fnum].daemonSetPod,
                'phase': k8cData[fnum].phase,
                'name': k8cData[fnum].name
            };

            // Old school string 
            rdata = `${rdata}${acb}`;
        }
        rdata = rdata + '</div>'
        return rdata
    } catch (e) {
        utl.logMsg(`vpkUIS002 - Error building SVG: ${e}`)
        utl.logMsg(`vpkUIS002 - Error stack: ${e.stack}`);
    }
}


function nsChange(ns) {
    let nsKey = '0000-' + ns;
    let titleNS = '';
    if (ns === 'clusterLevel') {
        titleNS = 'Cluster <hr>'
        return;
    } else {
        titleNS = 'namespace';
    }
    partsCnt++;
    let divSection = '<div class="events" ><hr><table style="width:100%">';
    let header1 = '<tr class="partsList"><th class="pt-1 pb-1 pr-1 pl-1">';
    let headerImg;
    let header2 = 'API Version</th><th>Kind</th><th>Resource Name</th></tr>';
    let nsHtml = '';
    let keys;
    let key;
    let k;
    let d;
    let hl;
    let item;
    let rtn = '';
    let name;
    let fnum;
    let parts;
    let parm;
    let fname;
    let api;
    let getDef = 'getDef';
    let getDefSec = 'getDefSec';
    let getD;
    let api4Hdr;
    let hdrImage;
    if (typeof k8cData[nsKey] !== 'undefined') {
        nsHtml = divSection;
        keys = Object.keys(k8cData[nsKey]);
        keys.sort();

        for (k = 0; k < keys.length; k++) {
            key = keys[k];
            if (key === 'display' || key === 'CRB' || key === 'Pods') {
                continue;
            }
            parts = k8cData[nsKey][key];
            api4Hdr = parts[0].api

            hdrImage = checkImage(key, api4Hdr);
            headerImg = '<img style="vertical-align:middle;" src="images/' + hdrImage + '" '
                + ' onclick="getExplain(\'' + key + '\')" width="35" height="35">&nbsp;'
            nsHtml = nsHtml + header1 + headerImg + header2;

            let nArray = [];

            hl = parts.length;
            for (d = 0; d < hl; d++) {
                nArray.push(parts[d].name + '#@@#' + parts[d].fnum + '#@@#' + parts[d].api);
            }
            nArray.sort();
            parts = []
            for (d = 0; d < hl; d++) {
                let bits = nArray[d].split('#@@#');
                parts.push({ 'name': bits[0], 'fnum': bits[1], 'api': bits[2] });
            }

            for (d = 0; d < hl; d++) {
                name = parts[d].name;
                api = parts[d].api;
                fnum = parts[d].fnum;
                parm = fnum;
                if (key === 'Secret') {
                    getD = getDefSec;
                } else {
                    getD = getDef;
                }
                item = '<tr>'
                    + '<td width="25%"><span onclick="' + getD + '(\'' + parm + '\')">' + api + '</td>'
                    + '<td width="25%"><span onclick="' + getD + '(\'' + parm + '\')">' + key + '</td>'
                    + '<td width="50%"><span onclick="' + getD + '(\'' + parm + '\')">' + name + '</td>'
                    + '</tr>';
                nsHtml = nsHtml + item
            }
        }
        nsHtml = nsHtml + '</table><hr></div>';
        vpk.nsResourceInfo[ns] = nsHtml;
    }
    return rtn;
}


//Builder for the Workloads
function processF(fnum) {
    genS = 0;
    cfgS = 0;
    iamS = 0;
    podS = 0;
    netS = 0;
    pvcS = 0;

    genH = 0;
    cfgH = 0;
    iamH = 0;
    podH = 0;
    netH = 0;
    pvcH = 0;

    allH = 0;
    height = 0;
    outterName = 'No defined workload name';
    html = '';

    // add the namespace and cluster icons 
    let rtnHeader = svgHeader(k8cData[fnum], fnum)
    if (rtnHeader.bnds.show === true) {
        html = html + '<g id="configH-' + fnum + '" transform="translate(5, -20)">' + rtnHeader.rtn + '</g>';
    }

    // config
    let rtnConfig = svgConfig(k8cData[fnum], fnum);
    if (rtnConfig.bnds.show === true) {
        cfgS = 50;
        html = html + '<g id="config-' + fnum + '" transform="translate(350, ' + (cfgS + 25) + ')">' + rtnConfig.rtn + '</g>';
        cfgH = rtnConfig.bnds.height;
    }

    // check if events shoud be built
    if (typeof k8cData[fnum].Events !== 'undefined') {
        bldEvents(fnum);
        if (cfgH === 0) {
            cfgS = 50;
            cfgH = 100;
        }
    }

    // generators
    let rtnGen = svgGenerators(k8cData[fnum], fnum);
    if (rtnGen.bnds.show === true) {
        if (cfgS > 0) {
            genS = cfgS + cfgH + 50;
        } else {
            genS = 50;
        }

        if (rtnGen.bnds.width > 150) {
            html = html + '<g id="gen-' + fnum + '" transform="translate(50, ' + genS + ')">' + rtnGen.rtn + '</g>'
        } else {

            html = html + '<g id="gen-' + fnum + '" transform="translate(50, ' + genS + ')">' + rtnGen.rtn + '</g>'
        }
        genH = height + rtnGen.bnds.height;
        if (rtnGen.bnds.crev === true) {
            genH = genH + 50;
        }
    }

    // network
    let rtnNet = svgNetwork(k8cData[fnum], fnum);
    if (rtnNet.bnds.show === true) {
        if (cfgH > 0) {
            if (genH > 0) {
                netS = cfgS + cfgH + genH + 100;
            } else {
                netS = cfgS + cfgH + 50;
            }
        } else {
            if (genH > 0) {
                netS = genS + genH + 50;
            } else {
                netS = 50;
            }
        }
        html = html + '<g id="net-' + fnum + '" transform="translate(50, ' + netS + ')">' + rtnNet.rtn + '</g>'
        netH = height + rtnNet.bnds.height;
    }

    // security / IAM
    let rtnIAM = svgIAM(k8cData[fnum], fnum);
    if (rtnIAM.bnds.show === true) {
        if (cfgS > 0) {
            iamS = cfgS + cfgH + 50;;
        } else {
            iamS = 50;
        }
        html = html + '<g id="iam-' + fnum + '" transform="translate(650, ' + iamS + ')">' + rtnIAM.rtn + '</g>'
        iamH = height + rtnIAM.bnds.height;
    }

    // PVC
    let rtnPvc = svgPVC(k8cData[fnum], fnum);
    if (rtnPvc.bnds.show === true) {
        if (cfgH > 0) {
            if (iamH > 0) {
                pvcS = cfgS + cfgH + iamH + 100;
            } else {
                pvcS = cfgS + cfgH + 50;
            }
        } else {
            if (iamH > 0) {
                pvcS = cfgS + cfgH + 50;
            } else {
                pvcS = 50;
            }
        }
        html = html + '<g id="pvc-' + fnum + '" transform="translate(650, ' + pvcS + ')">' + rtnPvc.rtn + '</g>'
        pvcH = height + rtnPvc.bnds.height;
    }


    let lH = 0;
    let rH = 0;

    // pod
    if (genH > 0) {
        if (netH > 0) {
            lH = genH + netH + 50;
        }
    }
    if (iamH > 0) {
        if (pvcH > 0) {
            rH = iamH + pvcH + 50;
        }
    }
    if (rH > lH) {
        height = rH;
    } else {
        height = lH;
    }


    let rtnPod = svgPod(k8cData[fnum], fnum, height);
    if (rtnPod.bnds.show === true) {
        outterName = rtnPod.outterName;
        if (cfgS > 0) {
            podS = cfgS + cfgH + 50;
        } else {
            podS = 50;
        }
        html = html + '<g id="pod-' + fnum + '" transform="translate(350, ' + podS + ')">' + rtnPod.rtn + '</g>';
        podH = rtnPod.bnds.height;
    }

    // calculate outter box size
    let maxL = 0;
    let maxM = 0;
    let maxR = 0;

    // calc left max
    if (cfgH > 0) {
        if (genH > 0) {
            if (netH > 0) {
                height = cfgH + genH + netH + 200;
                maxL = height;
            } else {
                height = cfgH + 100;
                maxL = height;
            }
        } else {
            if (netH > 0) {
                height = cfgH + netH + 150;
                maxL = height;
            } else {
                height = cfgH + 100;
                maxL = height;
            }
        }
    } else {
        if (genH > 0) {
            if (netH > 0) {
                height = genH + netH + 150;
                maxL = height;
            } else {
                height = genH + 100;
                maxL = height;
            }
        } else {
            if (netH > 0) {
                height = netH + 100;
                maxL = height;
            } else {
                height = 0;
                maxL = height;
            }
        }
    }

    // calc middle max
    if (cfgH > 0) {
        if (podH > 0) {
            height = cfgH + podH + 200;
            maxM = height;
        } else {
            height = cfgH + 100;
            maxM = height;
        }
    } else {
        if (podH > 0) {
            height = podH + 150;
            maxM = height;
        } else {
            height = 0;
            maxM = height;
        }
    }

    // calc right max
    if (cfgH > 0) {
        if (iamH > 0) {
            if (pvcH > 0) {
                height = cfgH + iamH + pvcH + 200;
                maxR = height;
            } else {
                height = cfgH + iamH + 150;
                maxR = height;
            }
        } else {
            if (pvcH > 0) {
                height = cfgH + pvcH + 150;
                maxR = height;
            } else {
                height = cfgH + 100;
                maxR = height;
            }
        }
    } else {
        if (iamH > 0) {
            if (pvcH > 0) {
                height = iamH + pvcH + 150;
                maxR = height;
            } else {
                height = iamH + 100;
                maxR = height;
            }
        } else {
            if (pvcH > 0) {
                height = pvcH + 100;
                maxr = height;
            } else {
                height = 0;
                maxR = height;
            }
        }
    }

    height = maxL;
    if (maxM > height) {
        height = maxM;
    }
    if (maxR > height) {
        height = maxR;
    }

    if (rtnPvc.bnds.clusterBar === true || rtnIAM.bnds.clusterBar === true || rtnGen.bnds.clusterBar === true) {
        html = html
            + '<rect  x="875" y="0" width="250" height="'
            + height
            + '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="none"/>';
    }

    if (rtnGen.bnds.clusterBar === true) {
        let xPos = 900;
        if (typeof rtnGen.bnds.crd1 !== 'undefined') {
            crdRefCnt++;
            let what1 = '<image x="' + xPos + '" y="50"  width="50" height="50" href="images/' + rtnGen.bnds.img1 + '" '
                + 'onmousemove="showVpkTooltip(evt, \''
                + buildSvgInfo('CRD for note: ' + rtnGen.bnds.ltr1, crdRefCnt, 'Ref')
                + '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + rtnGen.bnds.crd1 + '\')"/>';
            html = html + what1;

            let note1 = '<circle cx="' + (xPos - 6) + '" cy="97" r="10" stroke="black" stroke-width="1.5" fill="#000" />'
                + '<text x="' + (xPos - 15) + '" y="100" fill="white" font-weight="bold">' + rtnGen.bnds.ltr1 + '</text>'
            html = html + note1;
            xPos = xPos + 100;
        }

        if (typeof rtnGen.bnds.crd2 !== 'undefined') {
            crdRefCnt++;
            let what2 = '<image x="' + xPos + '" y="50"  width="50" height="50" href="images/' + rtnGen.bnds.img2 + '" '
                + 'onmousemove="showVpkTooltip(evt, \''
                + buildSvgInfo('CRD for note: ' + rtnGen.bnds.ltr2, crdRefCnt, 'Ref')
                + '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + rtnGen.bnds.crd2 + '\')"/>'
            html = html + what2;

            let note2 = '<circle cx="' + (xPos - 6) + '" cy="97" r="10" stroke="black" stroke-width="1.5" fill="#000" />'
                + '<text x="' + (xPos - 15) + '" y="100" fill="white" font-weight="bold">' + rtnGen.bnds.ltr2 + '</text>'
            html = html + note2;
            xPos = xPos + 100;
        }
    }


    // build the outter box 
    let outterBox = '<g>'
        + '<rect  x="5" y="0" width="845" height="'
        + height
        + '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="none"/>'
        + '<text x="15" y="67" class="workloadText">Pod: '
        + outterName
        + '</text>'
        + '<text x="15" y="80" class="pickIcon">(Click icons to view additional detail)</text>'

        + '<line  x1="15" x2="55" y1="95" y2="95" stroke="black" stroke-width="1" stroke-linecap="round"/>'
        + '<line  x1="55" x2="50" y1="95" y2="90" stroke="black" stroke-width="1" stroke-linecap="round"/>'
        + '<line  x1="55" x2="50" y1="95" y2="100" stroke="black" stroke-width="1" stroke-linecap="round"/>'
        + '<text  x="65" y="100" >References</text>'

        + '<line  x1="15" x2="55" y1="115" y2="115" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
        + '<line  x1="55" x2="50" y1="115" y2="110" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
        + '<line  x1="55" x2="50" y1="115" y2="120" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
        + '<text  x="65" y="120" >Creates</text>'

        + '</g>'
    html = html + outterBox;

    iCnt++;
    height = height + 50;  // adding visual space between svg
    html = '<svg id="fnum-' + fnum + '" width="1285" height="' + height + '">' + html + '</svg>';
    return html;
}

function bldEvents(fnum) {

    // build the table of Event messages
    if (typeof k8cData[fnum].Events !== 'undefined') {
        let evts = k8cData[fnum].Events;
        let hl = evts.length;
        if (hl > 0) {
            let msg;
            let evtHtml = '<div class="events"><table style="width:100%">'
                + '<tr class="eventsList text-center" ><th>Type</th><th>Reason</th><th>Object</th>'
                + '<th>Message</th><th>Occurences</th></tr>'
            for (let e = 0; e < hl; e++) {
                msg = '<tr class="mb-0 mt-0">'
                    + '<td width="5%"><hr class="mb-0 mt-0"></td>'
                    + '<td width="10%"><hr class="mb-0 mt-0"></td>'
                    + '<td width="20%"><hr class="mb-0 mt-0"></td>'
                    + '<td width="45%"><hr class="mb-0 mt-0"></td>'
                    + '<td width="20%"><hr class="mb-0 mt-0"></td></tr>'
                    + '<tr>'
                    + '<td width="5%"  class="vpkfont-sm"  onclick="getDefFnum(\'' + evts[e].fnum + '\')">' + evts[e].type + '</td>'
                    + '<td width="10%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' + evts[e].fnum + '\')">' + evts[e].reason + '</td>'
                    + '<td width="20%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' + evts[e].fnum + '\')">' + evts[e].kind + '/' + evts[e].name + '</td>'
                    + '<td width="45%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' + evts[e].fnum + '\')">' + evts[e].message + '</td>'
                    + '<td width="20%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' + evts[e].fnum + '\')">'
                    + '<b>Occurence count:</b> ' + evts[e].count + '<br>'
                    + '<b>First:</b> ' + formatDate(evts[e].firstTime) + '<br>'
                    + '<b>Last:</b>&nbsp;' + formatDate(evts[e].lastTime)
                    + '</td></tr>';
                evtHtml = evtHtml + msg;
                evts[e].used = true;
            }
            k8cData[fnum].Events = evts;
            evtHtml = evtHtml + '</table></div>';

            if (typeof workloadEventsInfo[fnum] === 'undefined') {
                workloadEventsInfo[fnum] = evtHtml;
            } else {
                workloadEventsInfo[fnum] = evtHtml;
            }
        }

        // show the events icon if there are events
        if (hl > 0) {
            let evtMsg = '' + hl + ' events'
            let evtBtn = '<rect  x="200" y="90" width="75" height="75" rx="5" stroke-dasharray="1, 2" '
                + ' stroke-width="1"  stroke="black" fill="#c5a3ff"/>'
                + '<text x="241" y="102" class="pickIcon">Events</text>'

                + '<image x="218"  y="105" width="40"  height="40" href="images/k8/evt.svg" onmousemove="showVpkTooltip(evt, \''
                + buildSvgInfo(evtMsg, fnum, 'Events')
                + '\');" onmouseout="hideVpkTooltip()"  onclick="getEvtsTable(\'' + fnum + '\')" />'
            html = html + evtBtn;

        }
    }
}


function svgHeader(data, fnum) {
    let nodeInfo = { 'name': 'Node', 'fnum': '<unk>' };
    if (typeof data.node !== 'undefined') {
        nodeInfo.name = data.node;
        for (let i = 0; i < k8cData['0000-clusterLevel'].Node.length; i++) {
            if (data.node === k8cData['0000-clusterLevel'].Node[i].name) {
                nodeInfo.fnum = k8cData['0000-clusterLevel'].Node[i].fnum;
            }
        }
    }
    let rect1 = '<rect  x="0"   y="20" width="845" height="50" rx="5" stroke-dasharray="1, 2" '
        + ' stroke-width="1"  stroke="none" fill="#c4c3be"/>';

    let rect2 = '<rect  x="870" y="20" width="250" height="50" rx="5" fill="#626262"/>';

    let rectH = 45;
    let rtn = '';
    let bnds = { 'height': 0, 'width': 845, 'show': true };

    // namespace and cluster icons
    rectH = 45;
    bnds.height = 45;
    rtn = rtn
        + '<image x="10"  y="22" width="45"  height="45" href="images/k8/ns.svg" onmousemove="showVpkTooltip(evt, \''
        + buildSvgInfo(data.namespace, fnum, 'Namespace')
        + '\');" onmouseout="hideVpkTooltip()"  onclick="getNsTable(\'' + data.namespace + '\')"/>'
        + '<text x="80" y="50" fill="white" class="workloadText">Namespace level resources</text>'

        + '<image x="1065" y="72" width="48"  height="48" href="images/k8/node.svg" onmousemove="showVpkTooltip(evt, \''
        + buildSvgInfo(nodeInfo, nodeInfo.fnum, 'Node')
        + '\');" onmouseout="hideVpkTooltip()"  onclick="getDefFnum(\'' + nodeInfo.fnum + '\')"/>'
        + '<text x="930" y="50" fill="white" class="workloadText">Cluster level resources</text>'

        + '<image x="750"  y="22" width="45"  height="45" href="images/k8/security.svg" onmousemove="showVpkTooltip(evt, \''
        + buildSvgInfo(data.namespace, '0000', 'RBAC Security')
        + '\');" onmouseout="hideVpkTooltip()"  onclick="showSecGraph(\'' + data.namespace + '\')"/>';

    if (bnds.show === true) {
        rtn = rect1 + rect2 + rtn;
    }
    return { 'bnds': bnds, 'rtn': rtn }
}


function svgPVC(data, fnum) {
    let rectP1a = '<rect  x="0" y="0" width="';
    let rectP1b = '" height="';
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="#fcdc79"/>'
        + '<text x="5" y="12" class="pickIcon">Storage</text>';
    let rectH = 0;
    let rectW = 0
    let rtn = '';
    let bnds = { 'height': 0, 'width': 150, 'show': false, 'clusterBar': false };
    // config PVC
    if (typeof data.PersistentVolumeClaim !== 'undefined') {
        bnds.height = bnds.height + 100;
        rectH = rectH + 100;
        rectW = rectW + 150;
        bnds.show = true;
        rtn = rtn
            + '<image x="50"  y="25" width="50"  height="50" href="images/k8/pvc.svg" onmousemove="showVpkTooltip(evt, \''
            + buildSvgInfo(data.PersistentVolumeClaim, fnum, 'PersistentVolumeClaim')
            + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'PVC@' + fnum + '\')"/>'
            + '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';

        if (data.PersistentVolumeClaim[0].pvName !== '') {
            rectW = rectW + 200;
            bnds.clusterBar = true;
            rtn = rtn
                + '<image x="250"  y="25" width="50"  height="50" href="images/k8/pv.svg" onmousemove="showVpkTooltip(evt, \''
                + buildSvgInfo(data.PersistentVolumeClaim, fnum, 'PersistentVolume')
                + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'PersistentVolume@' + data.PersistentVolumeClaim[0].pvFnum + '\')"/>'
                + '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="100" x2="250" y1="50" y2="50"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="100" x2="105" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="100" x2="105" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="250" x2="245" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="250" x2="245" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
        }


        if (data.PersistentVolumeClaim[0].storageClassName !== '') {
            rectW = rectW + 75;
            bnds.clusterBar = true;
            rtn = rtn
                + '<image x="350"  y="25" width="50"  height="50" href="images/k8/sc.svg" onmousemove="showVpkTooltip(evt, \''
                + buildSvgInfo(data.PersistentVolumeClaim, fnum, 'StorageClass')
                + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'StorageClass@' + data.PersistentVolumeClaim[0].storageClassFnum + '\')"/>'
                + '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                + '<line  x1="300" x2="350" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
                + '<line  x1="300" x2="305" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
                + '<line  x1="300" x2="305" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>';
        }

        if (bnds.show = true) {
            rtn = rectP1a + rectW + rectP1b + rectH + rectP2 + rtn;
        };

    }
    return { 'bnds': bnds, 'rtn': rtn }
}


function svgIAM(data, fnum) {
    let rectP1a = '<rect  x="0" y="0" width="';
    let rectP1b = '" height="';
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="#bfffda"/>'
        + '<text x="5" y="12" class="pickIcon">Security</text>';
    let rectH = 0;
    let rectW = 150;
    let rtn = '';
    let bnds = { 'height': 0, 'width': 250, 'show': false };
    // config ServiceAccounts
    if (typeof data.ServiceAccount !== 'undefined') {
        bnds.height = bnds.height + 100;
        rectH = rectH + 100;
        bnds.show = true;
        rtn = rtn
            + '<image x="50"  y="25" width="50"  height="50" href="images/k8/sa.svg" onmousemove="showVpkTooltip(evt, \''
            + buildSvgInfo(data.ServiceAccount, fnum, 'ServiceAccount')
            + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'ServiceAccount@' + fnum + '\')"/>'
            + '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'

            + '<line  x1="75" x2="75"   y1="25"    y2="-75" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="75" x2="-100" y1="-75"  y2="-75" stroke="black" stroke-width="1" stroke-linecap="round"/>'

            + '<line  x1="-100" x2="-95" y1="-75"  y2="-80" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="-100" x2="-95" y1="-75"  y2="-70"  stroke="black" stroke-width="1" stroke-linecap="round"/>'

        let nsKey = '0000-' + data.namespace;
        if (typeof k8cData[nsKey] !== 'undefined') {
            if (typeof data.ServiceAccount[0].name !== 'undefined') {
                let saName = data.ServiceAccount[0].name;
                if (typeof k8cData[nsKey].CRB !== 'undefined') {
                    let crb = k8cData[nsKey].CRB;
                    for (let c = 0; c < crb.length; c++) {
                        if (crb[c].subName === saName) {
                            let cFnum = crb[c].crbFnum;
                            rtn = rtn
                                + '<image x="250"  y="25" width="50"  height="50" href="images/k8/crb.svg" onmousemove="showVpkTooltip(evt, \''
                                + buildSvgInfo(crb[c], cFnum, 'ClusterRoleBinding')
                                + '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + cFnum + '\')"/>'
                                + '<line  x1="100" x2="250" y1="50" y2="50"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                                + '<line  x1="100" x2="105" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                                + '<line  x1="100" x2="105" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>'

                                + '<line  x1="300" x2="350" y1="50" y2="50"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                                + '<line  x1="350" x2="345" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                                + '<line  x1="350" x2="345" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>'


                            cFnum = crb[c].roleRefFnum
                            rtn = rtn
                                + '<image x="350"  y="25" width="50"  height="50" href="images/k8/c-role.svg" onmousemove="showVpkTooltip(evt, \''
                                + buildSvgInfo(crb[c], cFnum, 'ClusterRole')
                                + '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + cFnum + '\')"/>';
                            rectW = rectW + 275;
                            bnds.clusterBar = true;

                            break;
                        }
                    }
                }
            }
        }

        if (bnds.show = true) {
            //rtn = rectP1 + rectH + rectP2 + rtn;
            rtn = rectP1a + rectW + rectP1b + rectH + rectP2 + rtn;
        };
    }
    return { 'bnds': bnds, 'rtn': rtn }
}


function svgNetwork(data, fnum) {
    let rectP1 = '<rect  x="0" y="0" width="250" height="'
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="#a2d5fa"/>'
        + '<text x="205" y="12" class="pickIcon">Network</text>';

    let rectH = 0;
    let rtn = '';
    let bnds = { 'height': 0, 'width': 250, 'show': false };
    // config Services
    if (typeof data.Services !== 'undefined') {
        bnds.height = bnds.height + 100;
        rectH = rectH + 100;
        bnds.show = true;
        rtn = rtn
            + '<image x="50"  y="25" width="50"  height="50" href="images/k8/svc.svg" onmousemove="showVpkTooltip(evt, \''
            + buildSvgInfo(data.Services, fnum, 'Service')
            + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'Service@' + fnum + '\')"/>'
            + '<line  x1="100" x2="150" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="150" x2="145" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round"/>'
            + '<line  x1="150" x2="145" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round"/>';

        if (typeof data.Services[0] !== 'undefined') {
            let svcDef = false;
            if (typeof data.Services[0].eps !== 'undefined') {
                if (data.Services[0].eps !== '') {
                    svcDef = true;
                    rtn = rtn
                        + '<image x="150"  y="25" width="50"  height="50" href="images/k8/eps.svg" onmousemove="showVpkTooltip(evt, \''
                        + buildSvgInfo(data.Services, fnum, 'EndPointSlice')
                        + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'EndPointSlice@' + fnum + '\')"/>'
                        + '<line  x1="200" x2="300" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="300" x2="295" y1="50" y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="300" x2="295" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';
                }
            }
            if (typeof data.Services[0].ep !== 'undefined') {
                if (svcDef !== true) {
                    if (data.Services[0].ep !== '') {
                        rtn = rtn
                            + '<image x="150"  y="25" width="50"  height="50" href="images/k8/ep.svg" onmousemove="showVpkTooltip(evt, \''
                            + buildSvgInfo(data.Services, fnum, 'EndPoint')
                            + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'EndPoint@' + fnum + '\')"/>'
                            + '<line  x1="200" x2="300" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                            + '<line  x1="300" x2="295" y1="50" y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>'
                            + '<line  x1="300" x2="295" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';
                    }
                }
            }
            if (data.Services[0].eps !== '' && data.Services[0].ep !== '') {
                rtn = rtn
                    + '<text x="90" y="12" class="pickIcon">(ep and eps both located</text>'
                    + '<text x="94" y="20" class="pickIcon">only showing one item)</text>'
            }
        }
        if (bnds.show = true) {
            rtn = rectP1 + rectH + rectP2 + rtn;
        };
    }
    return { 'bnds': bnds, 'rtn': rtn }
}

function svgGenerators(data, fnum) {
    let rectP1a = '<rect  x="'
    let rectP1b = '"   y="0"  width="'
    let rectP1c = '" height="'
    let rectP2a = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="';
    let rectP2b = '"/>'
        + '<text x="195" y="12" class="pickIcon">Generators</text>';;
    let rectFill = 'pink';
    let rectH = 0;
    let rtn = '';
    let x = 100;
    let width = 150;
    let refLetter = '(a)';
    let bnds = { 'height': 0, 'width': 150, 'show': false, 'crev': false };
    // config generators
    if (typeof data.creationChain !== 'undefined') {
        let kind;
        let image;

        if (typeof data.creationChain.level0 !== 'undefined') {
            if (data.creationChain.level0 === 'NoCreationChain') {
                bnds.show = true;
                bnds.height = bnds.height + 100;
                rectH = rectH + 100;
                rectFill = 'none';
                image = checkImage('Unknown', 'Unknown');
                rtn = rtn
                    + '<image x="150" y="25"  width="50" height="50" fill="red" href="images/' + image + '" '
                    + 'onmousemove="showVpkTooltip(evt, \''
                    + buildSvgInfo('', fnum, 'Unknown')
                    + '\');" onmouseout="hideVpkTooltip()" />'
            }
        }

        if (typeof data.creationChain.level1Kind !== 'undefined') {
            bnds.show = true;
            bnds.height = bnds.height + 100;
            rectH = rectH + 100;
            kind = data.creationChain.level1Kind;
            image = checkImage(kind, data.creationChain.level1API);
            rtn = rtn
                + '<image x="150" y="25"  width="50" height="50" href="images/' + image + '" '
                + 'onmousemove="showVpkTooltip(evt, \''
                + buildSvgInfo(data, fnum, kind)
                //			+ '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + fnum +'\')"/>' 
                + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'level1@' + fnum + '\')"/>'
                + '<line  x1="200" x2="300" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
                + '<line  x1="300" x2="295" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round"/>'
                + '<line  x1="300" x2="295" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round"/>'

            if (typeof data.creationChain.level2Kind !== 'undefined') {
                kind = data.creationChain.level2Kind;
                image = checkImage(kind, data.creationChain.level2API);
                if (image === 'other/unk.svg') {
                    countUnkImage++
                    utl.logMsg('No icon for resouce kind: ' + kind + ' fnum: ' + fnum)
                }
                width = width + 100;
                x = 0;
                bnds.width = width;
                rtn = rtn
                    + '<image x="50" y="25"  width="50" height="50" href="images/' + image + '" '
                    + 'onmousemove="showVpkTooltip(evt, \''
                    + buildSvgInfo(data, fnum, kind)
                    + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'level2@' + fnum + '\')"/>'
                    + '<line  x1="100" x2="150" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'
                    + '<line  x1="150" x2="145" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round"/>'
                    + '<line  x1="150" x2="145" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round"/>'
            };
        }

        if (typeof data.ControllerRevision !== 'undefined') {
            bnds.crev = true;
            rectH = rectH + 75;
            kind = 'ControllerRevision';
            image = checkImage(kind);
            let crFnum = '';
            if (typeof data.ControllerRevision[0] !== 'undefined') {
                if (typeof data.ControllerRevision[0].fnum !== 'undefined') {
                    let crFnum = data.ControllerRevision[0].fnum
                    rtn = rtn
                        + '<image x="150" y="100"  width="50" height="50" href="images/' + image + '" '
                        + 'onmousemove="showVpkTooltip(evt, \''
                        + buildSvgInfo(data.ControllerRevision, crFnum, kind)
                        + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'ControllerRevision@' + crFnum + '\')"/>'
                        + '<line  x1="175" x2="175" y1="75" y2="100"  stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'

                        + '<line  x1="175" x2="170" y1="100" y2="95" stroke="red" stroke-width="2" stroke-linecap="round"  stroke-dasharray="3, 3"/>'
                        + '<line  x1="175" x2="180" y1="100" y2="95" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>'

                }
            }
        }

        if (typeof data.HPA !== 'undefined') {
            // when adding the HPA increase the bnds.height
            rectH = rectH + 75;
            let hPos = 50;
            if (typeof data.spec !== 'undefined') {
                if (typeof data.spec.scaleTargetRef !== 'undefined') {
                    if (data.spec.scaleTargetRef.kind !== 'Deployment') {
                        hPos = 150;
                    }
                }
            }
            kind = 'HorizontalPodAutoscaler';
            image = checkImage(kind);
            let hpaFnum = '';
            if (typeof data.HPA.fnum !== 'undefined') {
                hpaFnum = data.HPA.fnum
                if (typeof data.HPA.spec !== 'undefined') {
                    rtn = rtn
                        + '<image x="' + hPos + '" y="100"  width="50" height="50" href="images/' + image + '" '
                        + 'onmousemove="showVpkTooltip(evt, \''
                        + buildSvgInfo(data.HPA, hpaFnum, kind)
                        + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'HorizontalPodAutoscaler@' + hpaFnum + '\')"/>'

                    if (hPos === 50) {  // Deployment 
                        rtn = rtn
                            + '<line  x1="75" x2="75" y1="75" y2="100" stroke="black" stroke-width="1" stroke-linecap="round" />'
                            + '<line  x1="75" x2="70" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                            + '<line  x1="75" x2="80" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                    } else {            // Other
                        rtn = rtn
                            + '<line  x1="175" x2="175" y1="75" y2="100" stroke="black" stroke-width="1" stroke-linecap="round" />'
                            + '<line  x1="175" x2="170" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                            + '<line  x1="175" x2="180" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                    }
                }
            }
        }

        if (typeof data.CRD !== 'undefined') {
            if (typeof data.CRD[0].level1CRD !== 'undefined') {
                if (data.CRD[0].level1CRD === true) {
                    if (typeof data.creationChain.level2API !== 'undefined') {
                        let chkVal = data.creationChain.level2API;
                        if (chkVal.indexOf('openshift') > -1) {
                            image = checkImage('OCP-CRD');
                        } else if (chkVal.indexOf('monitoring.coreos') > -1) {
                            image = checkImage('OCP-CRD');
                        } else {
                            image = checkImage('CRD');
                        }
                    } else {
                        image = checkImage('CRD');
                    }

                    let cFnum1 = data.CRD[0].level1Fnum;
                    let action1 = buildSvgInfo('Refer to cluster level CRD', refLetter, 'Ref')
                    let what1 = '<circle cx="134" cy="23" r="10" stroke="black" stroke-width="0.5" fill="#000'
                        + ' onmousemove="showVpkTooltip(evt, \''
                        + action1
                        + '\');" onmouseout="hideVpkTooltip()" />'
                        + '<text x="126" y="27" fill="white" font-weight="bold">' + refLetter + '</text>'
                        + '<line  x1="175" x2="175" y1="20" y2="26"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="175" x2="147" y1="20" y2="20"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="147" x2="151" y1="20" y2="15"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="147" x2="151" y1="20" y2="25"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                    rtn = rtn + what1;
                    bnds.crd1 = cFnum1;
                    bnds.act1 = action1;
                    bnds.img1 = image;
                    bnds.ltr1 = refLetter;
                    bnds.clusterBar = true;
                    refLetter = '(b)';
                }
            }

            if (typeof data.CRD[0].level2CRD !== 'undefined') {
                if (data.CRD[0].level2CRD === true) {
                    if (typeof data.creationChain.level2API !== 'undefined') {
                        let chkVal = data.creationChain.level2API;
                        if (chkVal.indexOf('openshift') > -1) {
                            image = checkImage('OCP-CRD');
                        } else if (chkVal.indexOf('monitoring.coreos') > -1) {
                            image = checkImage('OCP-CRD');
                        } else {
                            image = checkImage('CRD');
                        }
                    } else {
                        image = checkImage('CRD');
                    }

                    let cFnum2 = data.CRD[0].level2Fnum;
                    let action2 = buildSvgInfo('Refer to cluster level CRD', refLetter, 'Ref')
                    let what2 = '<circle cx="33" cy="23" r="10" stroke="black" stroke-width="1.5" fill="#000" '
                        + ' onmousemove="showVpkTooltip(evt, \''
                        + action2
                        + '\');" onmouseout="hideVpkTooltip()" />'
                        + '<text x="25" y="27" fill="white" font-weight="bold">' + refLetter + '</text>'
                        + '<line  x1="75" x2="75" y1="20" y2="26"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="75" x2="47" y1="20" y2="20"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="47" x2="51" y1="20" y2="15"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                        + '<line  x1="47" x2="51" y1="20" y2="25"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
                    rtn = rtn + what2;
                    bnds.crd2 = cFnum2;
                    bnds.act2 = action2;
                    bnds.img2 = image;
                    bnds.ltr2 = refLetter;
                    bnds.clusterBar = true;
                }
            }
        }

        if (bnds.show === true) {
            rtn = rectP1a + x + rectP1b + width + rectP1c + rectH + rectP2a + rectFill + rectP2b + rtn;
        }
    }

    return { 'bnds': bnds, 'rtn': rtn }
}


function svgConfig(data, fnum) {
    let rectP1 = '<rect  x="0"   y="0"  width="250" height="'
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="lightyellow"/>'
        + '<text x="95" y="12" class="pickIcon">Configuration</text>';;
    let rectH = 0;
    let rtn = '';
    let bnds = { 'height': 0, 'width': 250, 'show': false };

    // config configMaps
    if (typeof data.ConfigMap !== 'undefined') {
        rectH = 100;
        bnds.height = 100;
        bnds.show = true;
        rtn = rtn
            + '<image x="50"  y="25" width="50"  height="50" href="images/k8/cm.svg" onmousemove="showVpkTooltip(evt, \''
            + buildSvgInfo(data.ConfigMap, fnum, 'ConfigMap')
            + '\');" onmouseout="hideVpkTooltip()"  onclick="getDef2(\'ConfigMap@' + fnum + '\')"/>'
            + '<line  x1="75" x2="75" y1="75" y2="150" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="75" x2="70" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="75" x2="80" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
        if (data.ConfigMap.length > 0) {
            rtn = rtn + '<text x="95" y="80" class="small">(' + data.ConfigMap.length + ')</text>'
        }
    }

    // config secrets
    if (typeof data.Secret !== 'undefined') {
        rectH = 100;
        bnds.height = 100;
        bnds.show = true;
        rtn = rtn
            + '<image x="150"  y="25" width="50"  height="50" href="images/k8/secret.svg" onmousemove="showVpkTooltip(evt, \''
            + buildSvgInfo(data.Secret, fnum, 'Secret')
            + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'Secret@' + fnum + '\')"/>'
            + '<line  x1="175" x2="175" y1="75" y2="150" stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="175" x2="170" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>'
            + '<line  x1="175" x2="180" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
        if (data.Secret.length > 0) {
            rtn = rtn + '<text x="195" y="80" class="small">(' + data.Secret.length + ')</text>'
        }
    }

    if (bnds.show === true) {
        rtn = rectP1 + rectH + rectP2 + rtn;
    }
    return { 'bnds': bnds, 'rtn': rtn }
}


function svgPod(data, fnum, podH) {
    let bkgFill = "#e3e3e3";
    let rectP1 = '<rect  x="0"   y="0"  width="250" height="'
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="' + bkgFill + '"/>'
        + '<text x="115" y="12" class="pickIcon">Pod</text>';
    let rectH = 0;
    let rtn = '';
    let yS = 0;
    let evtV;
    let bnds = { 'height': 0, 'width': 250, 'show': false };
    let outterName = 'No located workload information';

    outterName = data.name;
    bnds.height = bnds.height + 100;
    bnds.show = true;
    rectH = 100;
    rtn = rtn
        + '<image x="100"  y="25" width="50"  height="50" href="images/k8/pod.svg" onmousemove="showVpkTooltip(evt, \''
        + buildSvgInfo(data, fnum, 'Pod')
        + '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'workload@' + fnum + '\')"/>';
    let cy;

    rtn = rtn
        + '<line x1="0" x2="250" y1="80" y2="80"  stroke="black" stroke-width="0.5" stroke-linecap="round"/>';

    rtn = rtn
        + '<text x="5" y="95" class="small">Pod Information:</text>';

    // ============= Pod Phase 
    let statusFill = 'white'
    let phaseContent = 'No Phase found';
    let errInfo = ''
    if (typeof data.phase !== 'undefined') {
        if (data.phase === 'Pending') {
            statusFill = "#fa7373";
            if (typeof data.status.reason !== 'undefined') {
                errInfo = ' - ' + data.status.reason
            }
        } else if (data.phase === 'Failed') {
            statusFill = "#fa7373";
            if (typeof data.status.reason !== 'undefined') {
                errInfo = ' - ' + data.status.reason
            }
        } else if (data.phase === 'Running') {
            statusFill = "lightgreen";
        }
        phaseContent = data.phase + errInfo;
    }

    evtV = buildSvgInfo(data, fnum, 'Phase');

    rtn = rtn
        + '<text x="44" y="118" class="small" '
        + ' onmousemove="showVpkTooltip(evt, \''
        + evtV
        + '\');" onmouseout="hideVpkTooltip()" >Phase</text>'

    rtn = rtn
        + '<rect x="75" y="105" width="150" height="20" rx="5" stroke-width="0.5" stroke="black" fill="' + statusFill + '" '
        + ' onmousemove="showVpkTooltip(evt, \''
        + evtV
        + '\');" onmouseout="hideVpkTooltip()" />';

    rtn = rtn
        + '<text x="90" y="118" class="small" '
        + ' onmousemove="showVpkTooltip(evt, \''
        + evtV
        + '\');" onmouseout="hideVpkTooltip()" >'
        + phaseContent
        + '</text>';

    // ============= Pod Conditions

    if (typeof data.status.conditions !== 'undefined') {

        rectH = rectH + 50;
        evtV = buildSvgInfo(data.status, fnum, 'Conditions')

        rtn = rtn
            + '<text x="25" y="148" class="small" '
            + ' onmousemove="showVpkTooltip(evt, \''
            + evtV
            + '\');" onmouseout="hideVpkTooltip()">Conditions</text>'

        rtn = rtn
            + '<rect x="75" y="135"  width="150" height="20" rx="5" stroke-width="0.5" stroke="black" fill="white" '
            + ' onmousemove="showVpkTooltip(evt, \''
            + evtV
            + '\');" onmouseout="hideVpkTooltip()" />'

        let pStatus = [];
        pStatus[0] = 'none';
        pStatus[1] = 'none';
        pStatus[2] = 'none';
        pStatus[3] = 'none';

        if (typeof data.status !== 'undefined') {
            if (typeof data.status.conditions !== 'undefined') {
                if (typeof data.status.conditions[0] !== 'undefined') {
                    for (let s = 0; s < data.status.conditions.length; s++) {
                        if (typeof data.status.conditions[s] !== 'undefined') {
                            if (typeof data.status.conditions[s].status !== 'undefined') {
                                pStatus[s] = data.status.conditions[s].status;
                            }
                        }
                    }
                }
            }
        }

        let pColor;
        let cX = 100;
        for (let c = 0; c < 4; c++) {
            if (pStatus[c] !== 'none') {
                if (pStatus[c] === false || pStatus[c] === 'False') {
                    pColor = 'red';
                } else {
                    pColor = 'lightgreen';
                }
                rtn = rtn + '<circle cx="' + cX + '" cy="145" r="7" stroke="black" stroke-width="0.5" fill="' + pColor + '" '
                    + ' onmousemove="showVpkTooltip(evt, \''
                    + evtV
                    + '\');" onmouseout="hideVpkTooltip()" />';
                cX = cX + 35;
            }
        }
    }

    rtn = rtn
        + '<line x1="0" x2="250" y1="165" y2="165"  stroke="black" stroke-width="0.5" stroke-linecap="round"/>';

    rtn = rtn
        + '<text x="5" y="180" class="small">Container Information:</text>';

    yS = 180

    rectH = rectH + 50;
    statusFill = 'white';
    let statusInfo = '';
    let cHl = 0;
    let fndStatus = false;
    if (typeof data.status !== 'undefined') {
        //containerStatuses
        if (typeof data.status.containerStatuses !== 'undefined') {
            fndStatus = true;
            if (typeof data.status.containerStatuses[0] !== 'undefined') {
                cHl = data.status.containerStatuses.length;
                for (let c = 0; c < cHl; c++) {
                    countContainer++;
                    yS = yS + 25
                    bnds.height = bnds.height + 40;
                    statusInfo = buildContainerStatus(data.status.containerStatuses[c])
                    statusFill = statusInfo.fill;

                    evtV = buildSvgInfo(data.status.containerStatuses[c], 'C' + countContainer, 'ContainerStatus')

                    rtn = rtn
                        + '<text x="15" y="' + (yS - 2) + '" class="small" >Container[' + c + ']</text>'

                    rtn = rtn
                        + '<rect x="75" y="' + (yS - 15) + '"  width="150" height="20" rx="5" stroke-width="0.5" stroke="black" fill="' + statusFill + '" '
                        + ' onmousemove="showVpkTooltip(evt, \''
                        + evtV
                        + '\');" onmouseout="hideVpkTooltip()" />'
                    yS = yS + 13;
                    rtn = rtn
                        + '<text x="90" y="' + (yS - 15) + '" class="small" >'
                        + statusInfo.msg
                        + '</text>'
                    rectH = rectH + 35;
                }
            }
        }

        //initContainerStatuses
        if (typeof data.status.initContainerStatuses !== 'undefined') {
            fndStatus = true;
            if (typeof data.status.initContainerStatuses[0] !== 'undefined') {
                evtV = buildSvgInfo(data.status, fnum, 'ContainerStatus')
                cHl = data.status.initContainerStatuses.length;
                for (let c = 0; c < cHl; c++) {
                    countInitContainer++;
                    yS = yS + 25
                    bnds.height = bnds.height + 40;
                    statusInfo = buildContainerStatus(data.status.initContainerStatuses[c])
                    statusFill = statusInfo.fill;

                    evtV = buildSvgInfo(data.status.initContainerStatuses[c], 'I' + countInitContainer, 'InitContainerStatus')

                    rtn = rtn
                        + '<text x="2" y="' + (yS - 2) + '" class="small" >InitContainer[' + c + ']</text>'

                    rtn = rtn
                        + '<rect x="75" y="' + (yS - 15) + '"  width="150" height="20" rx="5" stroke-width="0.5" stroke="black" fill="' + statusFill + '" '
                        + ' onmousemove="showVpkTooltip(evt, \''
                        + evtV
                        + '\');" onmouseout="hideVpkTooltip()" />'
                    yS = yS + 13;
                    rtn = rtn
                        + '<text x="90" y="' + (yS - 15) + '" class="small" >'
                        + statusInfo.msg
                        + '</text>'
                    rectH = rectH + 35;
                }
            }
        }

        if (fndStatus === false) {
            rtn = rtn
                + '<text x="55" y="' + (yS + 25) + '" class="small">No container status available</text>';
            rectH = rectH + 20;
            if (phaseContent.indexOf('DeadlineEceeded')) {
                bnds.height = bnds.height + 100;
                rectH = rectH + 60;
            } else {
                bnds.height = bnds.height + 40;
            }
        }
    }

    bnds.height = bnds.height + 25;

    if (bnds.show === true) {
        if (podH > rectH) {
            rectH = podH;
        }
        rtn = rectP1 + rectH + rectP2 + rtn;
    }
    return { 'bnds': bnds, 'rtn': rtn, 'outterName': outterName }
}


function buildContainerStatus(data) {
    let statusMsg = '';
    let statusFill = ''
    if (typeof data.state !== 'undefined') {

        if (typeof data.state.waiting !== 'undefined') {
            if (typeof data.state.waiting.reason !== 'undefined') {
                let reason = data.state.waiting.reason;
                if (reason === 'CrashLoopBackOff') {
                    statusFill = '#fa7373';
                    statusMsg = statusMsg + 'CrashLoopBackOff';
                } else if (reason === 'ImagePullBackOff') {
                    statusFill = '#fa7373';
                    statusMsg = statusMsg + 'ImagePullBackOff';
                } else if (reason === 'ContainerCreating') {
                    statusFill = '#fa7373';
                    statusMsg = statusMsg + 'ContainerCreating';
                } else {
                    statusFill = 'grey';
                    statusMsg = statusMsg + data.state.waiting.reason;
                    //utl.logMsg('data.state.waiting.reason: ' + data.state.waiting.reason)
                }
            }
        } else if (typeof data.state.terminated !== 'undefined') {
            if (typeof data.state.terminated.reason !== 'undefined') {
                statusFill = 'lightgrey';
                statusMsg = data.state.terminated.reason;
            } else {
                statusFill = 'lightgrey';
                statusMsg = 'Unknown';
                //utl.logMsg('UnProcessed terminated status: ' + JSON.stringify(data.state.terminated, null, 2))
            }
        } else if (typeof data.state.running !== 'undefined') {
            statusFill = '#66ed8a';
            statusMsg = 'Running';
        }
    }
    return { 'msg': statusMsg, 'fill': statusFill }
}


function checkImage(kind, api) {
    let image;
    if (kind === 'k8') {
        image = 'k8.svg'
    } else if (kind === 'API' || kind === 'Api' || kind === 'APIService') {
        image = 'k8/api.svg';
    } else if (kind === 'Alertmanager') {
        image = 'other/ocp.svg';
    } else if (kind === 'CatalogSource') {
        image = 'other/ocp.svg';
    } else if (kind === 'CephCluster') {
        image = 'other/rook2.svg';
    } else if (kind === 'CertificateSigningRequest') {
        image = 'k8/k8.svg';
    } else if (kind === 'ClusterRole') {
        image = 'k8/c-role.svg';
    } else if (kind === 'ClusterRoleBinding') {
        image = 'k8/crb.svg';
    } else if (kind === 'ComponentStatus') {
        image = 'k8/k8.svg';
    } else if (kind === 'ConfigMap') {
        image = 'k8/cm.svg';
    } else if (kind === 'ControllerRevision') {
        image = 'k8/c-rev.svg';
    } else if (kind === 'CronJob') {
        image = 'k8/cronjob.svg';
    } else if (kind === 'CSIDriver') {
        image = 'k8/k8.svg';
    } else if (kind === 'CSINode') {
        image = 'k8/k8.svg';
    } else if (kind === 'CustomResourceDefinition' || kind === 'CRD') {
        image = 'k8/crd.svg';
    } else if (kind === 'DaemonSet') {
        image = 'k8/ds.svg';
    } else if (kind === 'Deployment') {
        image = 'k8/deploy.svg';
    } else if (kind === 'DeploymentConfig') {
        image = 'other/ocp.svg';
    } else if (kind === 'DNS') {
        image = 'other/ocp.svg';
    } else if (kind === 'Endpoints') {
        image = 'k8/ep.svg';
    } else if (kind === 'EndpointSlice') {
        image = 'k8/eps.svg';
    } else if (kind === 'Etcd') {
        image = 'k8/etcd.svg';
    } else if (kind === 'Event') {
        image = 'k8/evt.svg';
    } else if (kind === 'FlowSchema') {
        image = 'k8/k8.svg';
    } else if (kind === 'HorizontalPodAutoscaler') {
        image = 'k8/hpa.svg';
    } else if (kind === 'Ingress') {
        image = 'k8/ing.svg';
    } else if (kind === 'Job') {
        image = 'k8/job.svg';
    } else if (kind === 'Lease') {
        image = 'k8/k8.svg';
    } else if (kind === 'LimitRange') {
        image = 'k8/limits.svg';
    } else if (kind === 'MutatingWebhookConfiguration') {
        image = 'k8/k8.svg';
    } else if (kind === 'Namespace') {
        image = 'k8/ns.svg';
    } else if (kind === 'Network') {
        image = 'other/ocp.svg';
    } else if (kind === 'NetworkPolicy') {
        image = 'k8/netpol.svg';
    } else if (kind === 'NooBaa') {
        image = 'other/redhat.svg';
    } else if (kind === 'Node') {
        image = 'k8/node.svg';
    } else if (kind === 'OCP-CRD') {
        image = 'other/ocp.svg';
    } else if (kind === 'PersistentVolumeClaim') {
        image = 'k8/pvc.svg';
    } else if (kind === 'PersistentVolume') {
        image = 'k8/pv.svg';
    } else if (kind === 'Pod') {
        image = 'k8/pod.svg';
    } else if (kind === 'PodDisruptionBudget') {
        image = 'k8/k8.svg';
    } else if (kind === 'PodSecurityPolicy') {
        image = 'k8/psp.svg';
    } else if (kind === 'PodTemplate') {
        image = 'k8/k8.svg';
    } else if (kind === 'Prometheus') {
        image = 'other/ocp.svg';
    } else if (kind === 'PriorityClass') {
        image = 'k8/k8.svg';
    } else if (kind === 'ReplicaSet') {
        image = 'k8/rs.svg';
    } else if (kind === 'ReplicationController') {
        image = 'k8/rc.svg';
    } else if (kind === 'ResourceQuota') {
        image = 'k8/quota.svg';
    } else if (kind === 'Role') {
        image = 'k8/role.svg';
    } else if (kind === 'RoleBinding') {
        image = 'k8/rb.svg';
    } else if (kind === 'RuntimeClass') {
        image = 'k8/k8.svg';
    } else if (kind === 'Secret') {
        image = 'k8/secret.svg';
    } else if (kind === 'Service') {
        image = 'k8/svc.svg';
    } else if (kind === 'ServiceAccount') {
        image = 'k8/sa.svg';
    } else if (kind === 'StatefulSet') {
        image = 'k8/sts.svg';
    } else if (kind === 'StorageClass') {
        image = 'k8/sc.svg';
    } else if (kind === 'ValidatingWebhookConfiguration') {
        image = 'k8/k8.svg';
    } else if (kind === 'VolumeAttachment') {
        image = 'k8/k8.svg';
    } else if (kind === 'Unknown') {
        image = 'other/unk.svg';
    } else {
        image = 'other/unk.svg';
    }

    // if unknown use the apiGroup to determine image to display
    if (image === 'other/unk.svg') {
        if (typeof api !== 'undefined') {
            if (api.indexOf('openshift') > -1) {
                image = 'other/ocp.svg';
            } else if (api.indexOf('.coreos') > -1) {
                image = 'other/ocp.svg';
            } else if (api.indexOf('k8s.io') > -1) {
                image = 'k8/k8.svg';
            } else if (api.indexOf('.ibm.') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('.open-cluster-management.') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('.ansible.com') > -1) {
                image = 'other/redhat.svg';
            } else if (api.indexOf('core.hybridapp.io') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('tools.hybridapp.io') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('deploy.hybridapp.io') > -1) {
                image = 'other/ibm.svg';
            } else if (api.indexOf('noobaa.io') > -1) {
                image = 'other/redhat.svg';
            } else if (api.indexOf('.rook.') > -1) {
                image = 'other/rook2.svg';
            } else if (api.indexOf('.konghq.com') > -1) {
                image = 'other/kong.svg';
            } else if (api.indexOf('.cattle.') > -1) {
                image = 'other/rancher.svg';
            } else if (api.indexOf('.volcano.') > -1) {
                image = 'other/volcano.svg';
            } else if (api.indexOf('.fluentd.') > -1) {
                image = 'other/fluentd.svg';
            } else if (api.indexOf('.fluentd.') > -1) {
                image = 'other/coreDNS2.svg';
            }
        }
    }
    return image;
}

function buildSvgInfo(data, fnum, type) {
    let id = fnum + '.' + type;
    let tName = type;
    if (typeof vpk.svgInfo[id] === 'undefined') {
        vpk.svgInfo[id] = [];
    }
    let content = buildTipContent(data, type, fnum)
    if (type === 'Phase') {
        tName = 'Pod Phase / IPs'
    }
    if (type === 'CRD') {
        tName = 'CustomResourceDefinition'
    }
    // check if an entry already exists, if so skip
    if (typeof vpk.svgInfo[id][0] === 'undefined') {
        vpk.svgInfo[id].push('<span style="font-size: 0.80rem; text-decoration: underline;">' + tName + '</span><br><span style="font-size: 0.70rem;">' + content + '</span>');
    }
    return id;
}

function buildTipContent(data, type, fnum) {
    let cnt = 0;
    let content = '';

    if (typeof data === 'undefined') {
        content = 'No info available';
        content = '<div class="vpkfont-xsm">' + content + '</div>'
        return content;
    }

    if (type === 'Unknown') {
        content = 'No resource type located or failed to properly be created.';

    } else if (type === 'Cluster') {
        content = 'Name: ' + data + '<br>';

    } else if (type === 'ClusterRole') {
        if (typeof data !== 'undefined') {
            cnt = 0;
            content = content + 'Name: ' + data.roleRefName;
        }

    } else if (type === 'ClusterRoleBinding') {
        if (typeof data !== 'undefined') {
            cnt = 0;
            content = content + 'Name: ' + data.crbName;
        }

    } else if (type === 'Conditions') {
        if (typeof data.conditions !== 'undefined') {
            if (typeof data.conditions[0] !== 'undefined') {
                cnt = 0;
                for (let k = 0; k < data.conditions.length; k++) {
                    cnt++;
                    content = content + '- &nbsp;&nbsp;<b>Type:</b> ' + data.conditions[k].type + '<br>'
                        + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Status:</b> ' + data.conditions[k].status + '<br>';
                    if (typeof data.conditions[k].message !== 'undefined') {
                        content = content + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Message:</b> ' + data.conditions[k].message + '<br>'
                    }
                    if (typeof data.conditions[k].reason !== 'undefined') {
                        content = content + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Reason:</b> ' + data.conditions[k].reason + '<br>'
                    }
                    content = content + '<br>'
                }
            }
        }

    } else if (type === 'ConfigMap') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = content + '(' + cnt + ') Name: ' + data[k].name + ' (Used by: ' + data[k].use + ')<br>';
            }
        } else {
            if (typeof data.name !== 'undefined') {
                content = 'Name: ' + data.name;
            }
        }

    } else if (type === 'Container') {
        content = ''
        if (typeof data.containerNames !== 'undefined') {
            for (let k = 0; k < data.containerNames.length; k++) {
                content = content
                    + '- &nbsp;&nbsp;<b>Name:</b> ' + data.containerNames[k].c_name + '<br>'
                    + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Image:</b> ' + data.containerNames[k].c_image + '<br>';
            }
        }

    } else if (type === 'ContainerStatus' || type === 'InitContainerStatus') {    // container status
        if (typeof data !== 'undefined') {
            cnt = 0;
            content = '';
            //content = formatJSON(data) + '<br>' 
            content = content
                + 'Name: ' + data.name + '<br>'
                + 'Restart Count: ' + data.restartCount + '<br>'

        } else {
            content = 'No statuses located'
        }

    } else if (type === 'ControllerRevision') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            content = content + 'Name: ' + data[0].name;
        }

    } else if (type === 'CRD') {  //CustomResourceDefinition
        content = 'Name: ' + data;


    } else if (type === 'DaemonSet' ||
        type === 'Deployment' ||
        type === 'DeploymentConfig' ||
        type === 'ReplicaSet' ||
        type === 'ReplicationController' ||
        type === 'StatefulSet') {
        content = 'Name: ' + data.name;

    } else if (type === 'EndPoint') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            //			for (let k = 0; k < data.length; k++) {
            content = content + 'Name: ' + data[0].name + '<br>';
            //			}
        }

    } else if (type === 'EndPointSlice') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].name;
            }
        }

    } else if (type === 'Events') {
        if (typeof data[0] !== 'undefined') {
            content = content + 'Count: ' + data;
        }

    } else if (type === 'HorizontalPodAutoscaler') {
        content = formatJSON(data);

    } else if (type === 'Namespace') {
        content = 'Name: ' + data + '<br>';

    } else if (type === 'PersistentVolumeClaim') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].pvcName;
                if (typeof data[k].pcvStorageClass !== 'undefined') {
                    if (data[k].pcvStorageClass !== '') {
                        content = content + 'Storage class: ' + data[k].pcvStorageClass + '<br>';
                    }
                }
                if (typeof data[k].pcvVolumeName !== 'undefined') {
                    if (data[k].pcvVolumeName !== '') {
                        content = content + 'Volume name: ' + data[k].pcvVolumeName + '<br>';
                    }
                }
                if (typeof data[k].pcvSelectorLabel !== 'undefined') {
                    if (data[k].pcvSelectorLabel !== '') {
                        content = content + 'Selector label: ' + data[k].pcvSelectorLabel + '<br>';
                    }
                }
            }
        }

    } else if (type === 'PersistentVolume') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].pvName + '<br>';
                if (data[k].pvLocalPath !== '') {
                    content = content + 'Local path: ' + data[k].pvLocalPath + '<br>';
                }
                if (data[k].pvHostPath !== '') {
                    content = content + 'Host path: ' + data[k].pvHostPath + '<br>';
                }
                if (data[k].pvNFSPath !== '') {
                    content = content + 'NFS path: ' + data[k].pvNFSPath + '<br>';
                }
            }
        }

    } else if (type === 'Phase') {  //Pod Phase
        content = 'None located';
        if (typeof data.status !== 'undefined') {
            content = '';
            if (typeof data.status.hostIP !== 'undefined') {
                content = content + 'HostIP: ' + data.status.hostIP + '<br>';
            }
            if (typeof data.status.podIP !== 'undefined') {
                content = content + 'PodIP: ' + data.status.podIP + '<br>';
            }
            if (typeof data.status.podIPs !== 'undefined') {
                if (typeof data.status.podIPs.length > 1 !== 'undefined') {
                    content = content + 'PodIPs: <br>' + formatJSON(data.status.podIPs) + '<br>';
                }
            }
        }

    } else if (type === 'Pod') {
        content = '';
        if (typeof data.name !== 'undefined') {
            content = content + 'Name: ' + data.name + '<br>';
            if (typeof data.Volume !== 'undefined') {
                content = content + 'Volume(s):' + '<br>'
                cnt = 0;
                for (let k = 0; k < data.Volume.length; k++) {
                    cnt++;
                    content = content + '(' + cnt + ') ' + data.Volume[k].name + '<br>';
                }
            }
        }
    } else if (type === 'Node') {
        content = 'Name: ' + data.name + '<br>';

    } else if (type === 'Ref') {
        content = '';
        content = content + data;

    } else if (type === 'Secret') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = content + '(' + cnt + ') Name:' + data[k].name + ' (Used by:' + data[k].use + ')<br>';
            }
        }
    } else if (type === 'Roles') {
        content = '';

    } else if (type === 'RoleBinding') {
        content = '';

    } else if (type === 'Service') {
        content = fnum + '<br>'
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = 'Name: ' + data[k].name + '<br>';
                // if (typeof data[k].type !== 'undefined') {
                //     content = content + 'Type: ' + data[k].type;
                // }
            }
        }
    } else if (type === 'ServiceAccount') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = content + '(' + cnt + ') Name: ' + data[k].name + '<br>';
            }
        }

    } else if (type === 'StorageClass') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].storageClassName;
            }
        }

    } else if (type === 'Subject') {
        content = '';

    } else {
        content = 'Name: ' + data.name + '<br>' + 'Type: ' + type;
    }
    content = '<div class="vpkfont-xsm">' + content + '</div>'
    return content;
}

function formatJSON(content) {
    let cData = JSON.stringify(content, null, 2);
    cData = cData.split('\n');
    let nLine = '';
    let rtn = '';
    let pttrn = /^\s*/;
    let spc = 0;
    for (let i = 0; i < cData.length; i++) {
        nLine = '';
        spc = cData[i].match(pttrn)[0].length;
        if (spc > 0) {
            for (let s = 0; s < spc; s++) {
                nLine = nLine + '&nbsp;'
            }
        }
        rtn = rtn + nLine + cData[i].substring(spc) + '<br>';
    }
    return rtn;
}

function formatDate(data) {
    if (typeof data === 'undefined' || data === null) {
        return 'Unknown date';
    }
    let mydate = new Date(data);
    let fDate = mydate.toDateString();
    let tPart = data.split('T')
    if (typeof tPart[1] !== 'undefined') {
        fDate = fDate + ' ' + tPart[1]
        if (fDate.endsWith('Z')) {
            fDate = fDate.substring(0, fDate.length - 1) + ' GMT'
        }
    }
    return fDate;
}

function getRequestedData(ns) {
    if (ns === ':all-namespaces:') {
        return vpk.schematicSVGs;
    }
    let keys = ns.split(':');
    let rtn = {};
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] === '') {
            continue;
        }
        rtn[keys[i]] = vpk.schematicSVGs[keys[i]]
    }
    return rtn;
}

//------------------------------------------------------------------------------
// common routinesUserIdentityMapping
//------------------------------------------------------------------------------
export default {

    //------------------------------------------------------------------------------
    // run command on server
    //------------------------------------------------------------------------------
    create: function (cmd) {
        // Create deep copy of object
        k8cData = JSON.stringify(vpk.pods);
        k8cData = JSON.parse(k8cData);

        utl.logMsg('vpkUIS001 - Schematic invoked');
        schematic();
        // let cnt;
        // let ns;
        // let keys = Object.keys(vpk.schematicSVGs);
        // let svgKeys;
        // for (let i = 0; i < keys.length; i++) {
        //     ns = keys[i];
        //     console.log(`Namespace: ${keys[i]}`);
        //     cnt = 0;
        //     let svgKeys = Object.keys(vpk.schematicSVGs[keys[i]]);
        //     for (let k = 0; k < svgKeys.length; k++) {
        //         console.log(`    Pod Id: ${svgKeys[k]}`);
        //         cnt++;
        //     }
        //     console.log(`    ==== Total in namespace: ${ns} count: ${cnt}`)
        // }
        // console.log("D")
        return;
    },

    getSvg: function (ns) {
        let rtn = getRequestedData(ns)
        return rtn;
    }
}