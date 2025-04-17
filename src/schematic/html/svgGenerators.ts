import { buildSvgInfo } from './buildSvgInfo.js';
import { checkImage } from './checkImage.js';
import { logMessage } from '../../utils/logging.js';

export function svgGenerators(data: any, fnum: any) {
    let rectP1a: string = '<rect  x="';
    let rectP1b: string = '"   y="0"  width="';
    let rectP1c: string = '" height="';
    let rectP2a: string = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="';
    let rectP2b: string = '"/>' + '<text x="145" y="12" class="pickIcon">Generator OwnerRefs</text>';
    let rectFill: string = 'pink';
    let rectH: number = 0;
    let rtn: string = '';
    let x: number = 100;
    let width: number = 150;
    let refLetter: string = '(a)';
    let bnds: any = { height: 0, width: 150, show: false, crev: false };
    // config generators
    if (typeof data.creationChain !== 'undefined') {
        let kind: string;
        let image: any;

        if (typeof data.creationChain.level0 !== 'undefined') {
            if (data.creationChain.level0 === 'NoCreationChain') {
                bnds.show = true;
                bnds.height = bnds.height + 100;
                rectH = rectH + 100;
                rectFill = 'none';
                image = checkImage('Unknown', 'Unknown');
                rtn =
                    rtn +
                    '<image x="150" y="25"  width="50" height="50" fill="red" href="images/' +
                    image +
                    '" ' +
                    'onmousemove="showVpkTooltip(evt, \'' +
                    buildSvgInfo('', fnum, 'Unknown') +
                    '\');" onmouseout="hideVpkTooltip()" />';
            }
        }

        if (typeof data.creationChain.level1Kind !== 'undefined') {
            bnds.show = true;
            bnds.height = bnds.height + 100;
            rectH = rectH + 100;
            kind = data.creationChain.level1Kind;
            image = checkImage(kind, data.creationChain.level1API);
            rtn =
                rtn +
                '<image x="150" y="25"  width="50" height="50" href="images/' +
                image +
                '" ' +
                'onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data, fnum, kind) +
                //			+ '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' + fnum +'\')"/>'
                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'level1@' +
                fnum +
                '\')"/>' +
                '<line  x1="200" x2="300" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
                '<line  x1="300" x2="295" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round"/>' +
                '<line  x1="300" x2="295" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round"/>';

            if (typeof data.creationChain.level2Kind !== 'undefined') {
                kind = data.creationChain.level2Kind;
                image = checkImage(kind, data.creationChain.level2API);
                if (image === 'other/unk.svg') {
                    logMessage('No icon for resouce kind: ' + kind + ' fnum: ' + fnum);
                }
                width = width + 100;
                x = 0;
                bnds.width = width;
                rtn =
                    rtn +
                    '<image x="50" y="25"  width="50" height="50" href="images/' +
                    image +
                    '" ' +
                    'onmousemove="showVpkTooltip(evt, \'' +
                    buildSvgInfo(data, fnum, kind) +
                    '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'level2@' +
                    fnum +
                    '\')"/>' +
                    '<line  x1="100" x2="150" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
                    '<line  x1="150" x2="145" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round"/>' +
                    '<line  x1="150" x2="145" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round"/>';
            }
        }

        if (typeof data.ControllerRevision !== 'undefined') {
            bnds.crev = true;
            rectH = rectH + 75;
            kind = 'ControllerRevision';
            image = checkImage(kind, '');
            let crFnum: any;
            if (typeof data.ControllerRevision[0] !== 'undefined') {
                if (typeof data.ControllerRevision[0].fnum !== 'undefined') {
                    crFnum = data.ControllerRevision[0].fnum;
                    rtn =
                        rtn +
                        '<image x="150" y="100"  width="50" height="50" href="images/' +
                        image +
                        '" ' +
                        'onmousemove="showVpkTooltip(evt, \'' +
                        buildSvgInfo(data.ControllerRevision, crFnum, kind) +
                        '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'ControllerRevision@' +
                        crFnum +
                        '\')"/>' +
                        '<line  x1="175" x2="175" y1="75" y2="100"  stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
                        '<line  x1="175" x2="170" y1="100" y2="95" stroke="red" stroke-width="2" stroke-linecap="round"  stroke-dasharray="3, 3"/>' +
                        '<line  x1="175" x2="180" y1="100" y2="95" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>';
                }
            }
        }

        if (typeof data.HPA !== 'undefined') {
            // when adding the HPA increase the bnds.height
            rectH = rectH + 75;
            let hPos: number = 50;
            if (typeof data.spec !== 'undefined') {
                if (typeof data.spec.scaleTargetRef !== 'undefined') {
                    if (data.spec.scaleTargetRef.kind !== 'Deployment') {
                        hPos = 150;
                    }
                }
            }
            kind = 'HorizontalPodAutoscaler';
            image = checkImage(kind, '');
            let hpaFnum: string = '';
            if (typeof data.HPA.fnum !== 'undefined') {
                hpaFnum = data.HPA.fnum;
                if (typeof data.HPA.spec !== 'undefined') {
                    rtn =
                        rtn +
                        '<image x="' +
                        hPos +
                        '" y="100"  width="50" height="50" href="images/' +
                        image +
                        '" ' +
                        'onmousemove="showVpkTooltip(evt, \'' +
                        buildSvgInfo(data.HPA, hpaFnum, kind) +
                        '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'HorizontalPodAutoscaler@' +
                        hpaFnum +
                        '\')"/>';

                    if (hPos === 50) {
                        // Deployment
                        rtn =
                            rtn +
                            '<line  x1="75" x2="75" y1="75" y2="100" stroke="black" stroke-width="1" stroke-linecap="round" />' +
                            '<line  x1="75" x2="70" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                            '<line  x1="75" x2="80" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
                    } else {
                        // Other
                        rtn =
                            rtn +
                            '<line  x1="175" x2="175" y1="75" y2="100" stroke="black" stroke-width="1" stroke-linecap="round" />' +
                            '<line  x1="175" x2="170" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                            '<line  x1="175" x2="180" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
                    }
                }
            }
        }

        if (typeof data.CRD !== 'undefined') {
            if (typeof data.CRD[0].level1CRD !== 'undefined') {
                if (data.CRD[0].level1CRD === true) {
                    if (typeof data.creationChain.level2API !== 'undefined') {
                        let chkVal: string = data.creationChain.level2API;
                        if (chkVal.indexOf('openshift') > -1) {
                            image = checkImage('OCP-CRD', '');
                        } else if (chkVal.indexOf('monitoring.coreos') > -1) {
                            image = checkImage('OCP-CRD', '');
                        } else {
                            image = checkImage('CRD', '');
                        }
                    } else {
                        image = checkImage('CRD', '');
                    }

                    let cFnum1: any = data.CRD[0].level1Fnum;
                    let action1: string = buildSvgInfo('Refer to cluster level CRD', refLetter, 'Ref');
                    let what1: string =
                        '<circle cx="134" cy="23" r="12" stroke="black" stroke-width="0.5" fill="#000' +
                        ' onmousemove="showVpkTooltip(evt, \'' +
                        action1 +
                        '\');" onmouseout="hideVpkTooltip()" />' +
                        '<text x="123" y="27" fill="white" font-weight="bold">' +
                        refLetter +
                        '</text>' +
                        '<line  x1="175" x2="175" y1="20" y2="26"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                        '<line  x1="175" x2="147" y1="20" y2="20"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                        '<line  x1="147" x2="151" y1="20" y2="15"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                        '<line  x1="147" x2="151" y1="20" y2="25"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
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
                        let chkVal: string = data.creationChain.level2API;
                        if (chkVal.indexOf('openshift') > -1) {
                            image = checkImage('OCP-CRD', '');
                        } else if (chkVal.indexOf('monitoring.coreos') > -1) {
                            image = checkImage('OCP-CRD', '');
                        } else {
                            image = checkImage('CRD', '');
                        }
                    } else {
                        image = checkImage('CRD', '');
                    }

                    let cFnum2: any = data.CRD[0].level2Fnum;
                    let action2: string = buildSvgInfo('Refer to cluster level CRD', refLetter, 'Ref');
                    let what2: string =
                        '<circle cx="33" cy="23" r="12" stroke="black" stroke-width="1.5" fill="#000" ' +
                        ' onmousemove="showVpkTooltip(evt, \'' +
                        action2 +
                        '\');" onmouseout="hideVpkTooltip()" />' +
                        '<text x="22" y="27" fill="white" font-weight="bold">' +
                        refLetter +
                        '</text>' +
                        '<line  x1="75" x2="75" y1="20" y2="26"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                        '<line  x1="75" x2="47" y1="20" y2="20"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                        '<line  x1="47" x2="51" y1="20" y2="15"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                        '<line  x1="47" x2="51" y1="20" y2="25"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
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

    return { bnds: bnds, rtn: rtn };
}
