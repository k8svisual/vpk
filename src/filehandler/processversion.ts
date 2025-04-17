//-----------------------------------------------------------------------------
// read and load the version file
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';

import { logMessage } from '../utils/logging.js';

import fs from 'node:fs';
import fsPath from 'path';

export function processVersion() {
    // if (vpk.version === '') {
    //     return;
    // }
    let fn = fsPath.join(vpk.dirname, 'version.json');
    let found = false;
    try {
        if (fs.existsSync(fn)) {
            found = true;
        }
        if (found) {
            //
            let content: any = fs.readFileSync(fn);
            content = content.toString();
            content = JSON.parse(content);
            vpk.version = content;
            vpk.stats['k8sVersion'] = content;
            logMessage(`FHL473 - Version information loaded`);
            return;
        }
    } catch (err) {
        logMessage(`FHL474 - Failed to read : ${fn} message: ${err}`);
        return;
    }

    if (typeof vpk.version !== 'undefined') {
        try {
            let doc: string = JSON.stringify(vpk.version);
            fs.writeFileSync(fn, doc);
            logMessage(`FHL373 - Created version file ${fn}`);
        } catch (e) {
            logMessage(`FHL375 - Error saving file: ${fn} message: ${e}`);
        }
    } else {
        logMessage(`FHL376 - No vpk.explains available to save`);
        return;
    }
}
