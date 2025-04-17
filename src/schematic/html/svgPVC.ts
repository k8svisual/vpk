import { buildSvgInfo } from './buildSvgInfo.js';

export function svgPVC(data: any, fnum: any) {
    let rectP1a: string = '<rect  x="0" y="0" width="';
    let rectP1b: string = '" height="';
    let rectP2: string =
        '" rx="5" stroke-dasharray="1, 2" stroke-width="1"  stroke="black" fill="#fcdc79"/>' + '<text x="5" y="12" class="pickIcon">Storage</text>';
    let rectH: number = 0;
    let rectW: number = 0;
    let rtn: string = '';
    let bnds: any = { height: 0, width: 150, show: false, clusterBar: false };
    // config PVC
    if (typeof data.PersistentVolumeClaim !== 'undefined') {
        bnds.height = bnds.height + 100;
        rectH = rectH + 100;
        rectW = rectW + 150;
        bnds.show = true;
        rtn =
            rtn +
            '<image x="50"  y="25" width="50"  height="50" href="images/k8/pvc.svg" onmousemove="showVpkTooltip(evt, \'' +
            buildSvgInfo(data.PersistentVolumeClaim, fnum, 'PersistentVolumeClaim') +
            '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'PVC@' +
            fnum +
            '\')"/>' +
            '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
            '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
            '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>';

        if (data.PersistentVolumeClaim[0].pvName !== '') {
            rectW = rectW + 200;
            bnds.clusterBar = true;
            rtn =
                rtn +
                '<image x="250"  y="25" width="50"  height="50" href="images/k8/pv.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data.PersistentVolumeClaim, fnum, 'PersistentVolume') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'PersistentVolume@' +
                data.PersistentVolumeClaim[0].pvFnum +
                '\')"/>' +
                '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="100" x2="250" y1="50" y2="50"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="100" x2="105" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="100" x2="105" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="250" x2="245" y1="50" y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="250" x2="245" y1="50" y2="45"  stroke="black" stroke-width="1" stroke-linecap="round"/>';
        }

        if (data.PersistentVolumeClaim[0].storageClassName !== '') {
            rectW = rectW + 75;
            bnds.clusterBar = true;
            rtn =
                rtn +
                '<image x="350"  y="25" width="50"  height="50" href="images/k8/sc.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(data.PersistentVolumeClaim, fnum, 'StorageClass') +
                '\');" onmouseout="hideVpkTooltip()" onclick="getDef2(\'StorageClass@' +
                data.PersistentVolumeClaim[0].storageClassFnum +
                '\')"/>' +
                '<line  x1="50" x2="-50" y1="50" y2="50" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="50" x2="45" y1="50"  y2="45" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="50" x2="45" y1="50"  y2="55" stroke="black" stroke-width="1" stroke-linecap="round"/>' +
                '<line  x1="300" x2="350" y1="50" y2="50" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
                '<line  x1="300" x2="305" y1="50" y2="55" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>' +
                '<line  x1="300" x2="305" y1="50" y2="45" stroke="red" stroke-width="2" stroke-linecap="round" stroke-dasharray="3, 3"/>';
        }

        if ((bnds.show = true)) {
            rtn = rectP1a + rectW + rectP1b + rectH + rectP2 + rtn;
        }
    }
    return { bnds: bnds, rtn: rtn };
}
