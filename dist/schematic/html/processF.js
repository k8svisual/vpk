import { svgHeader } from './svgHeader.js';
import { svgConfig } from './svgConfig.js';
import { svgPod } from './svgPod.js';
import { svgGenerators } from './svgGenerators.js';
import { svgNetwork } from './svgNetwork.js';
import { svgIAM } from './svgIAM.js';
import { svgPVC } from './svgPVC.js';
import { buildSvgInfo } from './buildSvgInfo.js';
import { bldEvents } from './bldEvents.js';
export function processF(fnum, k8cData, countContainer, countInitContainer, crdRefCnt) {
    let genS = 0;
    let cfgS = 0;
    let iamS = 0;
    let podS = 0;
    let netS = 0;
    let pvcS = 0;
    let genH = 0;
    let cfgH = 0;
    let iamH = 0;
    let podH = 0;
    let netH = 0;
    let pvcH = 0;
    // let allH: number = 0;
    let outterName = 'No defined workload name';
    let html = '';
    let height = 0;
    // add the namespace and cluster icons
    let rtnHeader = svgHeader(k8cData[fnum], fnum, k8cData);
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
        bldEvents(fnum, k8cData, html);
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
        }
        else {
            genS = 50;
        }
        if (rtnGen.bnds.width > 150) {
            html = html + '<g id="gen-' + fnum + '" transform="translate(50, ' + genS + ')">' + rtnGen.rtn + '</g>';
        }
        else {
            html = html + '<g id="gen-' + fnum + '" transform="translate(50, ' + genS + ')">' + rtnGen.rtn + '</g>';
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
            }
            else {
                netS = cfgS + cfgH + 50;
            }
        }
        else {
            if (genH > 0) {
                netS = genS + genH + 50;
            }
            else {
                netS = 50;
            }
        }
        html = html + '<g id="net-' + fnum + '" transform="translate(50, ' + netS + ')">' + rtnNet.rtn + '</g>';
        netH = height + rtnNet.bnds.height;
    }
    // security / IAM
    let rtnIAM = svgIAM(k8cData[fnum], fnum, k8cData);
    if (rtnIAM.bnds.show === true) {
        if (cfgS > 0) {
            iamS = cfgS + cfgH + 50;
        }
        else {
            iamS = 50;
        }
        html = html + '<g id="iam-' + fnum + '" transform="translate(650, ' + iamS + ')">' + rtnIAM.rtn + '</g>';
        iamH = height + rtnIAM.bnds.height;
    }
    // PVC
    let rtnPvc = svgPVC(k8cData[fnum], fnum);
    if (rtnPvc.bnds.show === true) {
        if (cfgH > 0) {
            if (iamH > 0) {
                pvcS = cfgS + cfgH + iamH + 100;
            }
            else {
                pvcS = cfgS + cfgH + 50;
            }
        }
        else {
            if (iamH > 0) {
                pvcS = cfgS + cfgH + 50;
            }
            else {
                pvcS = 50;
            }
        }
        html = html + '<g id="pvc-' + fnum + '" transform="translate(650, ' + pvcS + ')">' + rtnPvc.rtn + '</g>';
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
    }
    else {
        height = lH;
    }
    let rtnPod = svgPod(k8cData[fnum], fnum, height, countContainer, countInitContainer);
    if (rtnPod.bnds.show === true) {
        outterName = rtnPod.outterName;
        if (cfgS > 0) {
            podS = cfgS + cfgH + 50;
        }
        else {
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
            }
            else {
                height = cfgH + 100;
                maxL = height;
            }
        }
        else {
            if (netH > 0) {
                height = cfgH + netH + 150;
                maxL = height;
            }
            else {
                height = cfgH + 100;
                maxL = height;
            }
        }
    }
    else {
        if (genH > 0) {
            if (netH > 0) {
                height = genH + netH + 150;
                maxL = height;
            }
            else {
                height = genH + 100;
                maxL = height;
            }
        }
        else {
            if (netH > 0) {
                height = netH + 100;
                maxL = height;
            }
            else {
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
        }
        else {
            height = cfgH + 100;
            maxM = height;
        }
    }
    else {
        if (podH > 0) {
            height = podH + 150;
            maxM = height;
        }
        else {
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
            }
            else {
                height = cfgH + iamH + 150;
                maxR = height;
            }
        }
        else {
            if (pvcH > 0) {
                height = cfgH + pvcH + 150;
                maxR = height;
            }
            else {
                height = cfgH + 100;
                maxR = height;
            }
        }
    }
    else {
        if (iamH > 0) {
            if (pvcH > 0) {
                height = iamH + pvcH + 150;
                maxR = height;
            }
            else {
                height = iamH + 100;
                maxR = height;
            }
        }
        else {
            if (pvcH > 0) {
                height = pvcH + 100;
                maxR = height;
            }
            else {
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
        html =
            html +
                '<rect  x="875" y="0" width="250" height="' +
                height +
                '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="none"/>';
    }
    if (rtnGen.bnds.clusterBar === true) {
        let xPos = 900;
        if (typeof rtnGen.bnds.crd1 !== 'undefined') {
            crdRefCnt++;
            let what1 = '<image x="' +
                xPos +
                '" y="50"  width="50" height="50" href="images/' +
                rtnGen.bnds.img1 +
                '" ' +
                'onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo('CRD for note: ' + rtnGen.bnds.ltr1, crdRefCnt, 'Ref') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' +
                rtnGen.bnds.crd1 +
                '\')"/>';
            html = html + what1;
            let note1 = '<circle cx="' +
                (xPos - 6) +
                '" cy="97" r="12" stroke="black" stroke-width="1.5" fill="#000" />' +
                '<text x="' +
                (xPos - 16) +
                '" y="102" fill="white" font-weight="bold">' +
                rtnGen.bnds.ltr1 +
                '</text>';
            html = html + note1;
            xPos = xPos + 100;
        }
        if (typeof rtnGen.bnds.crd2 !== 'undefined') {
            crdRefCnt++;
            let what2 = '<image x="' +
                xPos +
                '" y="50"  width="50" height="50" href="images/' +
                rtnGen.bnds.img2 +
                '" ' +
                'onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo('CRD for note: ' + rtnGen.bnds.ltr2, crdRefCnt, 'Ref') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' +
                rtnGen.bnds.crd2 +
                '\')"/>';
            html = html + what2;
            let note2 = '<circle cx="' +
                (xPos - 6) +
                '" cy="97" r="12" stroke="black" stroke-width="1.5" fill="#000" />' +
                '<text x="' +
                (xPos - 16) +
                '" y="102" fill="white" font-weight="bold">' +
                rtnGen.bnds.ltr2 +
                '</text>';
            html = html + note2;
            xPos = xPos + 100;
        }
    }
    // build the outter box
    let outterBox = '<g>' +
        '<rect  x="5" y="0" width="845" height="' +
        height +
        '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="none"/>' +
        '<text x="15" y="67" class="workloadText">Pod: ' +
        outterName +
        '</text>' +
        '<text x="15" y="80" class="pickIcon">(Click icons to view additional detail)</text>' +
        '<line  x1="15" x2="55" y1="95" y2="95" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
        '<line  x1="55" x2="50" y1="95" y2="90" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
        '<line  x1="55" x2="50" y1="95" y2="100" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
        '<text  x="65" y="100" >References</text>' +
        '<line  x1="15" x2="55" y1="115" y2="115" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
        '<line  x1="55" x2="50" y1="115" y2="110" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
        '<line  x1="55" x2="50" y1="115" y2="120" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
        '<text  x="65" y="120" >Creates</text>' +
        '</g>';
    html = html + outterBox;
    height = height + 50; // adding visual space between svg
    html = '<svg id="fnum-' + fnum + '" width="1285" height="' + height + '">' + html + '</svg>';
    return html;
}
