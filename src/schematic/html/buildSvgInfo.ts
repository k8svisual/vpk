import vpk from '../../lib/vpk.js';
import { buildTipContent } from './buildTipContent.js';

export function buildSvgInfo(data: any, fnum: any, type: string) {
    let id: string = fnum + '.' + type;
    let tName: string = type;
    if (typeof vpk.svgInfo[id] === 'undefined') {
        vpk.svgInfo[id] = [];
    }
    let content: any = buildTipContent(data, type, fnum);
    if (type === 'Phase') {
        tName = 'Pod Phase / IPs';
    }
    if (type === 'CRD') {
        tName = 'CustomResourceDefinition';
    }
    // check if an entry already exists, if so skip
    if (typeof vpk.svgInfo[id][0] === 'undefined') {
        vpk.svgInfo[id].push(
            '<span style="font-size: 0.80rem; text-decoration: underline;">' +
                tName +
                '</span><br><span style="font-size: 0.70rem;">' +
                content +
                '</span>',
        );
    }
    return id;
}
