//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

export function populateServiceAccountSecrets() {
    let secKeys: any[] = Object.keys(vpk.secretFnum);
    let shl: number = secKeys.length;
    let fnum: any;
    let hl: number;
    let ns: string;
    let key: string;
    let keys: any;
    let already: boolean;
    try {
        keys = Object.keys(vpk.pods);
        for (let k = 0; k < keys.length; k++) {
            key = keys[k];
            if (key === 'undefined') {
                console.log(k);
            }

            if (key.startsWith('0000')) {
                continue;
            }
            if (typeof vpk.pods[key].ServiceAccount !== 'undefined') {
                if (typeof vpk.pods[key].ServiceAccount[0].fnum !== 'undefined') {
                    fnum = vpk.pods[key].ServiceAccount[0].fnum;
                    if (typeof vpk.serviceAccounts[fnum] !== 'undefined') {
                        // check for ImagePullSecrets
                        if (typeof vpk.serviceAccounts[fnum][0].imagePullSecrets !== 'undefined') {
                            hl = vpk.serviceAccounts[fnum][0].imagePullSecrets.length;
                            ns = vpk.serviceAccounts[fnum][0].namespace;
                            for (let s = 0; s < hl; s++) {
                                if (typeof vpk.serviceAccounts[fnum][0].imagePullSecrets[s] !== 'undefined') {
                                    if (typeof vpk.serviceAccounts[fnum][0].imagePullSecrets[s].name !== 'undefined') {
                                        let secName = vpk.serviceAccounts[fnum][0].imagePullSecrets[s].name;
                                        for (let k = 0; k < shl; k++) {
                                            if (vpk.secretFnum[secKeys[k]][0].name === secName && vpk.secretFnum[secKeys[k]][0].namespace === ns) {
                                                if (typeof vpk.pods[key].Secret === 'undefined') {
                                                    vpk.pods[key].Secret = [];
                                                }
                                                already = false;
                                                let work = vpk.pods[key].Secret;
                                                let newName = vpk.secretFnum[secKeys[k]][0].name;
                                                for (let h = 0; h < work.length; h++) {
                                                    let item = work[h];
                                                    if (item.name !== newName) {
                                                        continue;
                                                    } else {
                                                        if (item.use !== 'ServiceAccount-ImagePull') {
                                                            continue;
                                                        } else {
                                                            already = true;
                                                            //console.log('skipped already there')
                                                            break;
                                                        }
                                                    }
                                                }
                                                if (already === false) {
                                                    vpk.pods[key].Secret.push({
                                                        name: vpk.secretFnum[secKeys[k]][0].name,
                                                        use: 'ServiceAccount-ImagePull',
                                                        fnum: vpk.secretFnum[secKeys[k]][0].fnum,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // check for Secrets
                        if (typeof vpk.serviceAccounts[fnum][0].secrets !== 'undefined') {
                            hl = vpk.serviceAccounts[fnum][0].secrets.length;
                            ns = vpk.serviceAccounts[fnum][0].namespace;
                            for (let s = 0; s < hl; s++) {
                                if (typeof vpk.serviceAccounts[fnum][0].secrets[s] !== 'undefined') {
                                    if (typeof vpk.serviceAccounts[fnum][0].secrets[s].name !== 'undefined') {
                                        let secName = vpk.serviceAccounts[fnum][0].secrets[s].name;
                                        for (let k = 0; k < shl; k++) {
                                            if (vpk.secretFnum[secKeys[k]][0].name === secName && vpk.secretFnum[secKeys[k]][0].namespace === ns) {
                                                if (typeof vpk.pods[key].Secret === 'undefined') {
                                                    vpk.pods[key].Secret = [];
                                                }
                                                already = false;
                                                let work = vpk.pods[key].Secret;
                                                let newName = vpk.secretFnum[secKeys[k]][0].name;
                                                for (let h = 0; h < work.length; h++) {
                                                    let item = work[h];
                                                    if (item.name !== newName) {
                                                        continue;
                                                    } else {
                                                        if (item.use !== 'ServiceAccount-Secret') {
                                                            continue;
                                                        } else {
                                                            vpk.pods[key].ServiceAccountSecret = true;
                                                            already = true;
                                                            break;
                                                        }
                                                    }
                                                }

                                                if (already === false) {
                                                    vpk.pods[key].Secret.push({
                                                        name: vpk.secretFnum[secKeys[k]][0].name,
                                                        use: 'ServiceAccount-Secret',
                                                        fnum: vpk.secretFnum[secKeys[k]][0].fnum,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        logMessage('SCM052 - Error processing ServiceAccounts Secrets, message: ' + err);
        logMessage('SCM152 - Stack: ' + err.stack);
    }
}
