//-----------------------------------------------------------------------------
// read and load the version file
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import fs from 'node:fs';
import fsPath from 'path';
export function processComponents() {
    if (vpk.kubeSystemComponents === '') {
        return;
    }
    let fn = fsPath.join(vpk.dirname, 'components.json');
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
            if (typeof content.components !== 'undefined') {
                vpk.kubeSystemComponents = content.components;
            }
            else {
                vpk.kubeSystemComponents = [];
            }
            vpk.stats['k8sComponents'] = content;
            logMessage(`FHL493 - Components information loaded`);
            return;
        }
    }
    catch (err) {
        logMessage(`FHL494 - Failed to read : ${fn} message: ${err}`);
        return;
    }
    if (typeof vpk.kubeSystemComponents !== 'undefined') {
        try {
            let content = {};
            if (typeof vpk.kubeSystemComponents !== 'undefined') {
                content.components = vpk.kubeSystemComponents.components;
            }
            else {
                content.components = [];
            }
            vpk.stats['k8sComponents'] = content;
            let doc = JSON.stringify(content);
            fs.writeFileSync(fn, doc);
            logMessage(`FHL393 - Created components file ${fn}`);
        }
        catch (e) {
            logMessage(`FHL395 - Error saving file: ${fn} message: ${e}`);
        }
    }
    else {
        logMessage(`FHL396 - No vpk.kubeSystemComponents available to save`);
        return;
    }
}
