import vpk from '../../lib/vpk.js';
import { processF } from './processF.js';
import { logMessage } from '../../utils/logging.js';
import { nsChange } from './nsChange.js';

export function buildCSVG(
    k8cData: any,
    fnum: any,
    oldNS: string,
    breakData: string,
    breakID: number,
    first: boolean,
    rdata: any,
    countContainer: number,
    countInitContainer: number,
    crdRefCnt: number,
    collapseIDs: any[],
    collapseNamespaces: any,
) {
    let keys: any[] = Object.keys(k8cData);
    let newKeys: any[] = [];
    let newKey: string;
    let tmpSVG: any;
    let nsWide: string;

    try {
        for (let p: number = 0; p < keys.length; p++) {
            newKey = keys[p];
            if (k8cData[newKey].display === true) {
                newKeys.push({ namespace: k8cData[newKey].namespace, fnum: newKey });
            } else {
                //newKeys.push({'namespace': k8cData[newKey].namespace, 'fnum': newKey});
            }
        }

        // sort by namespace & kind
        newKeys.sort((a, b) => (a.namespace > b.namespace ? 1 : a.namespace === b.namespace ? (a.fnum > b.fnum ? 1 : -1) : -1));

        // clear the old unsorted keys
        keys = [];

        // build new sorted array: keys
        for (let t = 0; t < newKeys.length; t++) {
            newKey = newKeys[t].fnum;
            keys.push(newKey);
        }

        // process data
        for (let k = 0; k < keys.length; k++) {
            fnum = keys[k];
            if (fnum.startsWith('0000-')) {
                continue;
            } else {
                //wCnt++; // increment the workload found counter
            }

            if (k8cData[fnum].namespace !== oldNS) {
                oldNS = k8cData[fnum].namespace;
                vpk.schematicSVGs[k8cData[fnum].namespace] = {};
                vpk.schematicKeys[k8cData[fnum].namespace] = {};

                breakID++;
                if (first) {
                    first = false;
                    rdata = rdata + '';
                } else {
                    rdata = rdata + '</div>';
                }
                // output the break bar
                breakData =
                    '<div class="breakBar"><button type="button" ' +
                    ' class="btn btn-primary btn-sm vpkButtons pl-4 pr-4" data-toggle="collapse" data-target="#collid-' +
                    breakID +
                    '">' +
                    k8cData[fnum].namespace +
                    '</button>' +
                    '<hr></div>' +
                    '<div id="collid-' +
                    breakID +
                    '" class="collapse">';

                // print button
                breakData =
                    breakData +
                    '<div class="header-right">' +
                    '<a href="javascript:printDiv(\'collid-' +
                    breakID +
                    '\')">' +
                    '<i class="fas fa-print mr-3 vpkblue vpkfont-lg"></i>' +
                    '</a>' +
                    '</div>';

                collapseIDs.push(breakID);
                collapseNamespaces[oldNS] = breakID;
                nsWide = nsChange(oldNS, k8cData);
                rdata = rdata + breakData + nsWide;
            }
            // Build the actual svg
            tmpSVG = processF(fnum, k8cData, countContainer, countInitContainer, crdRefCnt);
            // Save svg in object
            vpk.schematicSVGs[k8cData[fnum].namespace][fnum] = tmpSVG;
            vpk.schematicKeys[k8cData[fnum].namespace][fnum] = {
                daemonSet: k8cData[fnum].daemonSetPod,
                phase: k8cData[fnum].phase,
                name: k8cData[fnum].name,
            };

            // New school string
            rdata = `${rdata}${tmpSVG}`;
        }
        rdata = rdata + '</div>';
        return rdata;
    } catch (e) {
        logMessage(`UIS002 - Error building SVG: ${e}`);
        logMessage(`UIS002 - Error stack: ${e.stack}`);
    }
}
