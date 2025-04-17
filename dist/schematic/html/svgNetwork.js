import { buildSvgInfo } from './buildSvgInfo.js';
export function svgNetwork(data, fnum) {
    let rectP1 = '<rect  x="0" y="0" width="250" height="';
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="#a2d5fa"/>' + '<text x="205" y="12" class="pickIcon">Network</text>';
    let rectH = 0;
    let rtn = '';
    let bnds = { height: 0, width: 250, show: false };
    // config Services
    if (typeof data.Services !== 'undefined') {
        bnds.height = bnds.height + 100;
        rectH = rectH + 100;
        bnds.show = true;
        rtn =
            rtn +
                '<image x="50"  y="25" width="50"  height="50" href="images/k8/svc.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data.Services, fnum, 'Service') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'Service@' +
                fnum +
                '\')"/>' +
                '<line  x1="100" x2="150" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
                '<line  x1="150" x2="145" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round"/>' +
                '<line  x1="150" x2="145" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round"/>';
        if (typeof data.Services[0] !== 'undefined') {
            let svcDef = false;
            if (typeof data.Services[0].eps !== 'undefined') {
                if (data.Services[0].eps !== '') {
                    svcDef = true;
                    rtn =
                        rtn +
                            '<image x="150"  y="25" width="50"  height="50" href="images/k8/eps.svg" onmousemove="showVpkTooltip(evt, \'' +
                            buildSvgInfo(data.Services, fnum, 'EndPointSlice') +
                            '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'EndPointSlice@' +
                            fnum +
                            '\')"/>' +
                            '<line  x1="200" x2="300" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                            '<line  x1="300" x2="295" y1="50" y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                            '<line  x1="300" x2="295" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';
                }
            }
            if (typeof data.Services[0].ep !== 'undefined') {
                if (svcDef !== true) {
                    if (data.Services[0].ep !== '') {
                        rtn =
                            rtn +
                                '<image x="150"  y="25" width="50"  height="50" href="images/k8/ep.svg" onmousemove="showVpkTooltip(evt, \'' +
                                buildSvgInfo(data.Services, fnum, 'EndPoint') +
                                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'EndPoint@' +
                                fnum +
                                '\')"/>' +
                                '<line  x1="200" x2="300" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                '<line  x1="300" x2="295" y1="50" y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                '<line  x1="300" x2="295" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';
                    }
                }
            }
            if (data.Services[0].eps !== '' && data.Services[0].ep !== '') {
                rtn =
                    rtn +
                        '<text x="70" y="12" class="pickIcon">(ep and eps both located</text>' +
                        '<text x="72" y="20" class="pickIcon">only showing one item)</text>';
            }
        }
        if ((bnds.show = true)) {
            rtn = rectP1 + rectH + rectP2 + rtn;
        }
    }
    return { bnds: bnds, rtn: rtn };
}
