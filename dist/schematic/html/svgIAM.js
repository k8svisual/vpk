import { buildSvgInfo } from './buildSvgInfo.js';
export function svgIAM(data, fnum, k8cData) {
    let rectP1a = '<rect  x="0" y="0" width="';
    let rectP1b = '" height="';
    let rectP2 = '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="#bfffda"/>' + '<text x="5" y="12" class="pickIcon">Security</text>';
    let rectH = 0;
    let rectW = 150;
    let rtn = '';
    let bnds = { height: 0, width: 250, show: false };
    // config ServiceAccounts
    if (typeof data.ServiceAccount !== 'undefined') {
        bnds.height = bnds.height + 100;
        rectH = rectH + 100;
        bnds.show = true;
        rtn =
            rtn +
                '<image x="50"  y="25" width="50"  height="50" href="images/k8/sa.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data.ServiceAccount, fnum, 'ServiceAccount') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'ServiceAccount@' +
                fnum +
                '\')"/>' +
                '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';
        if (typeof data.ServiceAccountSecret !== 'undefined') {
            rtn =
                rtn +
                    '<line  x1="75" x2="75"   y1="25"    y2="-75" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                    '<line  x1="75" x2="-100" y1="-75"  y2="-75" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                    '<line  x1="-100" x2="-95" y1="-75"  y2="-80" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                    '<line  x1="-100" x2="-95" y1="-75"  y2="-70"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
        }
        let nsKey = '0000-' + data.namespace;
        if (typeof k8cData[nsKey] !== 'undefined') {
            if (typeof data.ServiceAccount[0].name !== 'undefined') {
                let saName = data.ServiceAccount[0].name;
                if (typeof k8cData[nsKey].CRB !== 'undefined') {
                    let crb = k8cData[nsKey].CRB;
                    for (let c = 0; c < crb.length; c++) {
                        if (crb[c].subName === saName) {
                            let cFnum = crb[c].crbFnum;
                            rtn =
                                rtn +
                                    '<image x="250"  y="25" width="50"  height="50" href="images/k8/crb.svg" onmousemove="showVpkTooltip(evt, \'' +
                                    buildSvgInfo(crb[c], cFnum, 'ClusterRoleBinding') +
                                    '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' +
                                    cFnum +
                                    '\')"/>' +
                                    '<line  x1="100" x2="250" y1="50" y2="50"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                    '<line  x1="100" x2="105" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                    '<line  x1="100" x2="105" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                    '<line  x1="300" x2="350" y1="50" y2="50"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                    '<line  x1="350" x2="345" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                                    '<line  x1="350" x2="345" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
                            cFnum = crb[c].roleRefFnum;
                            rtn =
                                rtn +
                                    '<image x="350"  y="25" width="50"  height="50" href="images/k8/c-role.svg" onmousemove="showVpkTooltip(evt, \'' +
                                    buildSvgInfo(crb[c], cFnum, 'ClusterRole') +
                                    '\');" onmouseout="hideVpkTooltip()" onclick="getDefFnum(\'' +
                                    cFnum +
                                    '\')"/>';
                            rectW = rectW + 275;
                            bnds.clusterBar = true;
                            break;
                        }
                    }
                }
            }
        }
        if ((bnds.show = true)) {
            //rtn = rectP1 + rectH + rectP2 + rtn;
            rtn = rectP1a + rectW + rectP1b + rectH + rectP2 + rtn;
        }
    }
    return { bnds: bnds, rtn: rtn };
}
