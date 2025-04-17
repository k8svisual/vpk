//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
export function clusterLevel(data, type, fnum) {
    let name = '';
    let cName = '0000-clusterLevel';
    if (typeof data.value !== 'undefined') {
        name = data.value;
    }
    if (typeof data.name !== 'undefined') {
        name = data.name;
    }
    if (typeof vpk.pods[cName] === 'undefined') {
        vpk.pods[cName] = {};
    }
    if (typeof vpk.pods[cName][type] === 'undefined') {
        vpk.pods[cName][type] = [];
    }
    for (let i = 0; i < vpk.pods[cName][type].length; i++) {
        if (vpk.pods[cName][type][i].fnum === fnum) {
            return;
        }
    }
    if (type === 'Node') {
        let tmpData;
        if (typeof vpk.nodesFnum[fnum] !== 'undefined') {
            tmpData = vpk.nodesFnum[fnum];
            if (typeof tmpData[0] !== 'undefined') {
                tmpData[0].namespace = 'clusterLevel';
                tmpData[0].kind = data.kind;
                tmpData[0].api = data.apiVersion;
                vpk.pods[cName][type].push(tmpData[0]);
            }
        }
    }
    else {
        vpk.pods[cName][type].push({
            name: name,
            fnum: fnum,
            namespace: 'clusterLevel',
            kind: data.kind,
            api: data.apiVersion,
        });
    }
}
