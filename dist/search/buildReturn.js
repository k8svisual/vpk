//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
export function buildReturn(fnumBase) {
    try {
        let keys = Object.keys(fnumBase);
        let key;
        let rtn = [];
        let item;
        let fn;
        for (let i = 0; i < keys.length; i++) {
            key = keys[i];
            fn = fnumBase[key];
            item = {
                namespace: fn.ns,
                kind: fn.kind,
                name: fn.name,
                fnum: key,
            };
            rtn.push(item);
        }
        return rtn;
    }
    catch (err) {
        logMessage('SCH005 - Error processing, message: ' + err);
        logMessage('SCH005 - Stack: ' + err.stack);
        return [];
    }
}
