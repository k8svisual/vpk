import { buildSvgInfo } from './buildSvgInfo.js';

export function svgHeader(data: any, fnum: any, k8cData: any) {
    let nodeInfo: any = { name: 'Node', fnum: '<unk>' };
    if (typeof data.node !== 'undefined') {
        nodeInfo.name = data.node;
        for (let i = 0; i < k8cData['0000-clusterLevel'].Node.length; i++) {
            if (data.node === k8cData['0000-clusterLevel'].Node[i].name) {
                nodeInfo.fnum = k8cData['0000-clusterLevel'].Node[i].fnum;
            }
        }
    }
    let rect1: string =
        '<rect  x="0"   y="20" width="845" height="50" rx="5" stroke-dasharray="1, 2" ' + ' stroke-width="1"  stroke="none" fill="#c4c3be"/>';

    let rect2: string = '<rect  x="870" y="20" width="250" height="50" rx="5" fill="#626262"/>';

    // let rectH = 45;
    let rtn: string = '';
    let bnds: any = { height: 0, width: 845, show: true };

    // namespace and cluster icons
    // rectH = 45;
    bnds.height = 45;
    rtn =
        rtn +
        '<image x="10"  y="22" width="45"  height="45" href="images/k8/ns.svg" onmousemove="showVpkTooltip(evt, \'' +
        buildSvgInfo(data.namespace, fnum, 'Namespace') +
        '\');" onmouseout="hideVpkTooltip()"  onclick="getNsTable(\'' +
        data.namespace +
        '\')"/>' +
        '<text x="80" y="50" fill="white" class="workloadText">Namespace level resources</text>' +
        '<image x="1065" y="72" width="48"  height="48" href="images/k8/node.svg" onmousemove="showVpkTooltip(evt, \'' +
        buildSvgInfo(nodeInfo, nodeInfo.fnum, 'Node') +
        '\');" onmouseout="hideVpkTooltip()"  onclick="getDefFnum(\'' +
        nodeInfo.fnum +
        '\')"/>' +
        '<text x="930" y="50" fill="white" class="workloadText">Cluster level resources</text>' +
        '<image x="750"  y="22" width="45"  height="45" href="images/k8/security.svg" onmousemove="showVpkTooltip(evt, \'' +
        buildSvgInfo(data.namespace, '0000', 'Security') +
        '\');" onmouseout="hideVpkTooltip()"  onclick="showSecGraph(\'' +
        data.namespace +
        '\')"/>';

    if (bnds.show === true) {
        rtn = rect1 + rect2 + rtn;
    }
    return { bnds: bnds, rtn: rtn };
}
