import vpk from '../../lib/vpk.js';
import { checkImage } from './checkImage.js';

export function nsChange(ns: string, k8cData: any) {
    let nsKey: string = '0000-' + ns;
    let divSection: string = '<div class="events" ><hr><table style="width:100%">';
    let header1: string = '<tr class="partsList"><th class="pt-1 pb-1 pr-1 pl-1">';
    let headerImg: any;
    let header2: string = 'API Version</th><th>Kind</th><th>Resource Name</th></tr>';
    let nsHtml: string = '';
    let keys: any;
    let key: string;
    let k: number;
    let d: number;
    let hl: number;
    let item: string;
    let rtn: string = '';
    let name: string;
    let fnum: any;
    let parts: any;
    let parm: any;
    //let fname;
    let api: any;
    let getDef: string = 'getDef';
    let getDefSec: string = 'getDefSec';
    let getD: string;
    let api4Hdr: any;
    let hdrImage: string;
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
            api4Hdr = parts[0].api;

            hdrImage = checkImage(key, api4Hdr);
            headerImg =
                '<img style="vertical-align:middle;" src="images/' +
                hdrImage +
                '" ' +
                ' onclick="getExplain(\'' +
                key +
                '\')" width="35" height="35">&nbsp;';
            nsHtml = nsHtml + header1 + headerImg + header2;

            let nArray: any = [];

            hl = parts.length;
            for (d = 0; d < hl; d++) {
                nArray.push(parts[d].name + '#@@#' + parts[d].fnum + '#@@#' + parts[d].api);
            }
            nArray.sort();
            parts = [];
            for (d = 0; d < hl; d++) {
                let bits = nArray[d].split('#@@#');
                parts.push({ name: bits[0], fnum: bits[1], api: bits[2] });
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
                item =
                    '<tr>' +
                    '<td width="25%"><span onclick="' +
                    getD +
                    "('" +
                    parm +
                    '\')">' +
                    api +
                    '</td>' +
                    '<td width="25%"><span onclick="' +
                    getD +
                    "('" +
                    parm +
                    '\')">' +
                    key +
                    '</td>' +
                    '<td width="50%"><span onclick="' +
                    getD +
                    "('" +
                    parm +
                    '\')">' +
                    name +
                    '</td>' +
                    '</tr>';
                nsHtml = nsHtml + item;
            }
        }
        nsHtml = nsHtml + '</table><hr></div>';
        vpk.nsResourceInfo[ns] = nsHtml;
    }
    return rtn;
}
