import vpk from '../../lib/vpk.js';
import { nsChange } from './nsChange.js';
export function buildNoPods(k8cData, collapseIDs, collapseNamespaces, breakID) {
    let keys = Object.keys(k8cData);
    let key;
    let noPo = '';
    let line;
    let newKey;
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        line = '';
        if (key.startsWith('0000-@')) {
            continue;
        }
        if (key.startsWith('0000-#')) {
            continue;
        }
        if (!key.startsWith('0000-')) {
            continue;
        }
        if (key === '0000-clusterLevel') {
            continue;
        }
        if (typeof k8cData[key] !== 'undefined') {
            if (typeof k8cData[key].Pods === 'undefined') {
                //wCnt++; // increment the workload found counter, even though there is no workload Pods
                newKey = key.substring(5);
                // generate the list of resources in the namespace
                nsChange(newKey, k8cData);
                breakID++;
                // output the bar
                line =
                    '<div class="breakBar">' +
                        '<button type="button" class="btn btn-warning btn-sm vpkButtons" ' +
                        'data-toggle="collapse" data-target="#collid-' +
                        breakID +
                        '">&nbsp;&nbsp;' +
                        newKey +
                        '&nbsp;&nbsp;' +
                        '</button>' +
                        '<hr>' +
                        '</div>' +
                        '<div id="collid-' +
                        breakID +
                        '" class="collapse">' +
                        '<div class="mb-1">' +
                        '<span class="vpkblue vpkfont-md ml-4 mt-2">No Workload Schematic located. Press icon to view resources in namespace</span>' +
                        '</div>' +
                        '<div class="ml-4 mb-1"><img style="vertical-align:middle;" src="images/k8/ns.svg" width="50" height="40" ' +
                        ' onclick="getNsTable(\'' +
                        newKey +
                        '\')">' +
                        '</div>' +
                        '</div>';
                noPo = noPo + line;
                collapseIDs.push(breakID);
                collapseNamespaces[newKey] = breakID;
                vpk.schematicSVGs[newKey] = {};
                vpk.schematicKeys[newKey] = {};
                vpk.schematicSVGs[newKey]['NoPod'] = line;
                vpk.schematicKeys[newKey]['NoPod'] = {};
            }
        }
    }
    return noPo;
}
