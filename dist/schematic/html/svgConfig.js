import vpk from '../../lib/vpk.js';
import { buildSvgInfo } from './buildSvgInfo.js';
export function svgConfig(data, fnum) {
    vpk.configMapsFound = true;
    let rectP1 = '<rect  x="0"   y="0"  width="250" height="';
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="lightyellow"/>' +
        '<text x="95" y="12" class="pickIcon">Configuration</text>';
    let rectH = 0;
    let rtn = '';
    let bnds = { height: 0, width: 250, show: false };
    // config configMaps
    if (typeof data.ConfigMap !== 'undefined') {
        rectH = 100;
        bnds.height = 100;
        bnds.show = true;
        rtn =
            rtn +
                '<image x="50"  y="25" width="50"  height="50" href="images/k8/cm.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data.ConfigMap, fnum, 'ConfigMap') +
                '\');" onmouseout="hideVpkTooltip()"  onclick="getDef2(\'ConfigMap@' +
                fnum +
                '\')"/>' +
                '<line  x1="75" x2="75" y1="75" y2="150" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="75" x2="70" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="75" x2="80" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
        if (data.ConfigMap.length > 0) {
            rtn = rtn + '<text x="95" y="80" class="pickIcon">(' + data.ConfigMap.length + ')</text>';
        }
    }
    // config secrets
    if (typeof data.Secret !== 'undefined') {
        vpk.secretsFound = true;
        rectH = 100;
        bnds.height = 100;
        bnds.show = true;
        rtn =
            rtn +
                '<image x="150"  y="25" width="50"  height="50" href="images/k8/secret.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data.Secret, fnum, 'Secret') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'Secret@' +
                fnum +
                '\')"/>' +
                '<line  x1="175" x2="175" y1="75" y2="150" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="175" x2="170" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="175" x2="180" y1="75" y2="80"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
        if (data.Secret.length > 0) {
            rtn = rtn + '<text x="195" y="80" class="pickIcon">(' + data.Secret.length + ')</text>';
        }
    }
    if (bnds.show === true) {
        rtn = rectP1 + rectH + rectP2 + rtn;
    }
    return { bnds: bnds, rtn: rtn };
}
