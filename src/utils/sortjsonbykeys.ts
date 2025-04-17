//------------------------------------------------------------------------------
// sort object by keys
//------------------------------------------------------------------------------

import { logMessage } from '../utils/logging.js';

export function sortJSONByKeys(data) {
    let newJson: any = {};
    let keys: any[];
    let key: string;
    let k: number;
    try {
        keys = Object.keys(data);
        keys.sort();
        for (k = 0; k < keys.length; k++) {
            key = keys[k];
            newJson[key] = data[key];
        }
    } catch (err) {
        logMessage(`UTL086 - Error sorting, message: ${err}`);
        logMessage(`UTL086 - Error stack: ${err.stack}`);
    }
    return newJson;
}
