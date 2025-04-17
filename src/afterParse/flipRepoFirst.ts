//-----------------------------------------------------------------------------
// Flip the data to the fnum of the key and the repository for the data
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function flipRepoFirst() {
    try {
        let keys: string[] = Object.keys(vpk.imageRepositoryFirst);
        let newD: any = {};
        for (let i: number = 0; i < keys.length; i++) {
            if (typeof newD[vpk.imageRepositoryFirst[keys[i]]] === 'undefined') {
                newD[vpk.imageRepositoryFirst[keys[i]]] = [];
            }
            newD[vpk.imageRepositoryFirst[keys[i]]].push(keys[i]);
        }
        vpk.imageRepositoryFirst = newD;
    } catch (err) {
        logMessage('AFT267 - Error processing flipRepoFirst, message: ' + err);
        logMessage('AFT267 - Stack: ' + err.stack);
    }
}
