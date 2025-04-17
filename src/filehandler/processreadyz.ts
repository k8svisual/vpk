//-----------------------------------------------------------------------------
// read and load the version file
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import vpkSpan from '../lib/vpkSpan.js';

import { logMessage } from '../utils/logging.js';

import fs from 'node:fs';
import fsPath from 'path';

export function processReadyz() {
    if (vpkSpan.readyz === '') {
        return;
    }
    if (vpk.dirname === '') {
        return;
    }

    let fn = fsPath.join(vpk.dirname, 'readyz.json');
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
            if (typeof content !== 'undefined') {
                vpkSpan.readyz = content;
            } else {
                vpkSpan.readyz = [];
            }
            vpk.stats['k8sReadyz'] = content;
            logMessage(`FHL493 - Readyz information loaded`);
            return;
        }
    } catch (err) {
        logMessage(`FHL494 - Failed to read : ${fn} message: ${err}`);
        return;
    }

    if (typeof vpkSpan.readyz !== 'undefined') {
        try {
            let content: any = {};
            content = vpkSpan.readyz;
            //if (vpkSpan.readyz.length > 0) {
            //    content = vpkSpan.readyz;
            //} else {
            //    content = [];
            //}
            vpk.stats['k8sReadyz'] = content;
            let doc: string = JSON.stringify(content);
            fs.writeFileSync(fn, doc);
            logMessage(`FHL393 - Created readyz file ${fn}`);
        } catch (e) {
            logMessage(`FHL395 - Error saving file: ${fn} message: ${e}`);
        }
    } else {
        logMessage(`FHL396 - No vpk.readyz available to save`);
        return;
    }
}
