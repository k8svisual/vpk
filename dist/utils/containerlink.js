//-----------------------------------------------------------------------------
// vpk.container related routine to add information to the container
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
export function containerLink(fnum, type, name, whereUsed, spec) {
    if (typeof vpk.pods[fnum][type] === 'undefined') {
        vpk.pods[fnum][type] = [];
    }
    if (type === 'Secret' || type === 'ConfigMap') {
        if (typeof whereUsed === 'undefined') {
            whereUsed = 'Not provided';
        }
        // check if reference is already added
        let tmp = vpk.pods[fnum][type];
        for (let i = 0; i < tmp.length; i++) {
            if (tmp[i].name === name) {
                if (tmp[i].use === whereUsed) {
                    return;
                }
            }
        }
        vpk.pods[fnum][type].push({ name: name, use: whereUsed });
    }
    else {
        if (typeof spec !== 'undefined') {
            vpk.pods[fnum][type].push({ name: name, info: spec });
        }
        else {
            vpk.pods[fnum][type].push({ name: name });
        }
    }
}
