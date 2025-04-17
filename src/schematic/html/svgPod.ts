import { buildSvgInfo } from './buildSvgInfo.js';
import { buildContainerStatus } from './buildContainerStatus.js';

export function svgPod(data: any, fnum: any, podH: number, countContainer: number, countInitContainer: number) {
    let bkgFill: string = '#e3e3e3';
    let rectP1: string = '<rect  x="0"   y="0"  width="250" height="';
    let rectP2: string =
        '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="' +
        bkgFill +
        '"/>' +
        '<text x="115" y="12" class="pickIcon">Pod</text>';
    let rectH: number = 0;
    let rtn: string = '';
    let yS: number = 0;
    let evtV: any;
    let bnds: any = { height: 0, width: 250, show: false };
    let outterName: string = 'No located workload information';

    outterName = data.name;
    bnds.height = bnds.height + 100;
    bnds.show = true;
    rectH = 100;
    rtn =
        rtn +
        '<image x="100"  y="25" width="50"  height="50" href="images/k8/pod.svg" onmousemove="showVpkTooltip(evt, \'' +
        buildSvgInfo(data, fnum, 'Pod') +
        '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'workload@' +
        fnum +
        '\')"/>';
    //let cy;

    rtn = rtn + '<line x1="0" x2="250" y1="80" y2="80"  stroke="black" stroke-width="0.5" stroke-linecap="round"/>';

    rtn = rtn + '<text x="5" y="95" class="pickIcon">Pod Information:</text>';

    // ============= Pod Phase
    let statusFill: string = 'white';
    let phaseContent: string = 'No Phase found';
    let errInfo: string = '';
    //TODO - set the color of the Pod Phase background to match 3D pod colors

    // .podRunning {
    //     background-color: #00ff00;
    // }

    // .podWarn {
    //     background-color: #ffff00;
    // }

    // .podFail {
    //     background-color: #bf0000;
    // }

    // .podSuccessful {
    //     background-color: #00a6ff;
    // }

    if (typeof data.phase !== 'undefined') {
        if (data.phase === 'Pending') {
            statusFill = '#ffff00';
            if (typeof data.status.reason !== 'undefined') {
                errInfo = ' - ' + data.status.reason;
            }
        } else if (data.phase === 'Failed') {
            statusFill = '#bf0000';
            if (typeof data.status.reason !== 'undefined') {
                errInfo = ' - ' + data.status.reason;
            }
        } else if (data.phase === 'Succeeded') {
            statusFill = '#00a6ff';
            if (typeof data.status.reason !== 'undefined') {
                errInfo = ' - ' + data.status.reason;
            }
        } else if (data.phase === 'Running') {
            statusFill = '#00ff00';
        }
        phaseContent = data.phase + errInfo;
    }

    evtV = buildSvgInfo(data, fnum, 'Phase');

    rtn =
        rtn +
        '<text x="44" y="118" class="pickIcon" ' +
        ' onmousemove="showVpkTooltip(evt, \'' +
        evtV +
        '\');" onmouseout="hideVpkTooltip()" >Phase</text>';

    rtn =
        rtn +
        '<rect x="80" y="105" width="145" height="20" rx="5" stroke-width="0.5" stroke="black" fill="' +
        statusFill +
        '" ' +
        ' onmousemove="showVpkTooltip(evt, \'' +
        evtV +
        '\');" onmouseout="hideVpkTooltip()" />';

    rtn =
        rtn +
        '<text x="90" y="118" class="pickIcon" ' +
        ' onmousemove="showVpkTooltip(evt, \'' +
        evtV +
        '\');" onmouseout="hideVpkTooltip()" >' +
        phaseContent +
        '</text>';

    // ============= Pod Conditions

    if (typeof data.status.conditions !== 'undefined') {
        rectH = rectH + 50;
        evtV = buildSvgInfo(data.status, fnum, 'Conditions');

        rtn =
            rtn +
            '<text x="22" y="148" class="pickIcon" ' +
            ' onmousemove="showVpkTooltip(evt, \'' +
            evtV +
            '\');" onmouseout="hideVpkTooltip()">Conditions</text>';

        rtn =
            rtn +
            '<rect x="80" y="135"  width="145" height="20" rx="5" stroke-width="0.5" stroke="black" fill="white" ' +
            ' onmousemove="showVpkTooltip(evt, \'' +
            evtV +
            '\');" onmouseout="hideVpkTooltip()" />';

        let pStatus: any[] = [];
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

        let pColor: string;
        let cX: number = 100;
        for (let c: number = 0; c < 4; c++) {
            if (pStatus[c] !== 'none') {
                if (pStatus[c] === false || pStatus[c] === 'False') {
                    pColor = 'red';
                } else {
                    pColor = 'lightgreen';
                }
                rtn =
                    rtn +
                    '<circle cx="' +
                    cX +
                    '" cy="145" r="7" stroke="black" stroke-width="0.5" fill="' +
                    pColor +
                    '" ' +
                    ' onmousemove="showVpkTooltip(evt, \'' +
                    evtV +
                    '\');" onmouseout="hideVpkTooltip()" />';
                cX = cX + 35;
            }
        }
    }

    rtn = rtn + '<line x1="0" x2="250" y1="165" y2="165"  stroke="black" stroke-width="0.5" stroke-linecap="round"/>';

    rtn = rtn + '<text x="5" y="180" class="pickIcon">Container Information:</text>';

    yS = 180;

    rectH = rectH + 50;
    statusFill = 'white';
    let statusInfo: any = '';
    let cHl: number = 0;
    let fndStatus: boolean = false;
    if (typeof data.status !== 'undefined') {
        //containerStatuses
        if (typeof data.status.containerStatuses !== 'undefined') {
            fndStatus = true;
            if (typeof data.status.containerStatuses[0] !== 'undefined') {
                cHl = data.status.containerStatuses.length;
                for (let c: number = 0; c < cHl; c++) {
                    countContainer++;
                    yS = yS + 25;
                    bnds.height = bnds.height + 40;
                    statusInfo = buildContainerStatus(data.status.containerStatuses[c]);
                    statusFill = statusInfo.fill;

                    evtV = buildSvgInfo(data.status.containerStatuses[c], 'C' + countContainer, 'ContainerStatus');

                    rtn = rtn + '<text x="12" y="' + (yS - 2) + '" class="pickIcon" >Container[' + c + ']</text>';

                    rtn =
                        rtn +
                        '<rect x="80" y="' +
                        (yS - 15) +
                        '"  width="145" height="20" rx="5" stroke-width="0.5" stroke="black" fill="' +
                        statusFill +
                        '" ' +
                        ' onmousemove="showVpkTooltip(evt, \'' +
                        evtV +
                        '\');" onmouseout="hideVpkTooltip()" />';
                    yS = yS + 13;
                    rtn = rtn + '<text x="90" y="' + (yS - 15) + '" class="pickIcon" >' + statusInfo.msg + '</text>';
                    rectH = rectH + 35;
                }
            }
        }

        //initContainerStatuses
        if (typeof data.status.initContainerStatuses !== 'undefined') {
            fndStatus = true;
            if (typeof data.status.initContainerStatuses[0] !== 'undefined') {
                evtV = buildSvgInfo(data.status, fnum, 'ContainerStatus');
                cHl = data.status.initContainerStatuses.length;
                for (let c: number = 0; c < cHl; c++) {
                    countInitContainer++;
                    yS = yS + 25;
                    bnds.height = bnds.height + 40;
                    statusInfo = buildContainerStatus(data.status.initContainerStatuses[c]);
                    statusFill = statusInfo.fill;

                    evtV = buildSvgInfo(data.status.initContainerStatuses[c], 'I' + countInitContainer, 'InitContainerStatus');

                    rtn = rtn + '<text x="2" y="' + (yS - 2) + '" class="pickIcon" >InitContainer[' + c + ']</text>';

                    rtn =
                        rtn +
                        '<rect x="80" y="' +
                        (yS - 15) +
                        '"  width="145" height="20" rx="5" stroke-width="0.5" stroke="black" fill="' +
                        statusFill +
                        '" ' +
                        ' onmousemove="showVpkTooltip(evt, \'' +
                        evtV +
                        '\');" onmouseout="hideVpkTooltip()" />';
                    yS = yS + 13;
                    rtn = rtn + '<text x="90" y="' + (yS - 15) + '" class="pickIcon" >' + statusInfo.msg + '</text>';
                    rectH = rectH + 35;
                }
            }
        }

        if (fndStatus === false) {
            rtn = rtn + '<text x="55" y="' + (yS + 25) + '" class="pickIcon">No container status available</text>';
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
    return { bnds: bnds, rtn: rtn, outterName: outterName };
}
