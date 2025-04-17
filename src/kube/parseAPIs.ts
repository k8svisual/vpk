//-----------------------------------------------------------------------------
// Parse the api resoures info to the the list of kinds to process
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function parseAPIs(data: string) {
    const tmp = data.split('\n');
    if (tmp.length < 1) {
        return [];
    }

    const nPos = tmp[0].indexOf('NAMESPACED');
    const vPos = tmp[0].indexOf('VERBS');
    const ePos = tmp[0].indexOf('SHORT') - 1;
    const gPos = tmp[0].indexOf('APIGROUP');
    const kPos = tmp[0].indexOf('KIND');

    const rtn: any[] = [];
    let found = ':';

    for (let i = 1; i < tmp.length; i++) {
        const item = tmp[i];
        const fp = item.indexOf(' ');
        const kind = item.substring(0, fp);
        if (found.indexOf(':' + kind + ':') > -1) {
            logMessage('KUB521 - API resource kind: ' + kind + ' already found');
            continue;
        } else {
            found += kind + ':';
        }

        if (item.length > vPos) {
            const wrk = item.substring(vPos);
            if (wrk.indexOf('get') > -1) {
                const entry = item.substring(0, ePos).trim() + ':' + item.substring(nPos, nPos + 1);
                rtn.push(entry);

                let apiG = item.substring(gPos, nPos - 1).trim();
                apiG = apiG.length === 0 ? '-none-' : apiG;

                const kind2 = item.substring(kPos, vPos - 1).trim();
                const nsd = item.substring(nPos, kPos - 1).trim();
                const key = `${apiG}:${kind2}`;

                if (typeof vpk.apitypes[key] === 'undefined') {
                    vpk.apitypes[key] = {
                        group: apiG,
                        kind: kind2,
                        namespaced: nsd,
                    };
                }
            }
        }
    }
    return rtn;
}
