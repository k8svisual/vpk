//-----------------------------------------------------------------------------
// redact the secret information
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
export function redactSecret(data: any) {
    let keys: any[];
    if (typeof data.data !== 'undefined') {
        keys = Object.keys(data.data);
        for (let i: number = 0; i < keys.length; i++) {
            data.data[keys[i]] = vpk.redactMsg;
        }
    }
    return data;
}
