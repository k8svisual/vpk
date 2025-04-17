//-----------------------------------------------------------------------------
// read and load the explains file
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import fs from 'node:fs';
import fsPath from 'path';
export function processExplains() {
    if (vpk.dirname === '') {
        return;
    }
    let fn = fsPath.join(vpk.dirname, 'explains.json');
    let found = false;
    try {
        if (fs.existsSync(fn)) {
            found = true;
        }
        if (found) {
            //
            let content = fs.readFileSync(fn);
            content = content.toString();
            content = JSON.parse(content);
            vpk.explains = content;
            logMessage(`FHL373 - Explains information loaded`);
            return;
        }
    }
    catch (err) {
        logMessage(`FHL374 - Failed to read : ${fn} message: ${err}`);
        return;
    }
    if (typeof vpk.explains !== 'undefined') {
        try {
            let keys = Object.keys(vpk.explains);
            let doc = '';
            if (keys.length > 0) {
                doc = JSON.stringify(vpk.explains);
                fs.writeFileSync(fn, doc);
                logMessage(`FHL373 - Created explains file ${fn}`);
            }
        }
        catch (e) {
            logMessage(`FHL375 - Error saving file: ${fn} message: ${e}`);
        }
    }
    else {
        logMessage(`FHL376 - No vpk.explains available to save`);
        return;
    }
}
