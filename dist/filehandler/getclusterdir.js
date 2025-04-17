//-----------------------------------------------------------------------------
// read the root directory that contains the snapshot directories
//-----------------------------------------------------------------------------
import fs from 'node:fs';
import fsPath from 'path';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function getClusterDir() {
    let cwd;
    if (vpk.snapshotDir !== '') {
        cwd = vpk.snapshotDir;
    }
    else {
        cwd = process.cwd();
        let os = process.platform;
        if (os.startsWith('win')) {
            cwd = cwd + '\\cluster\\';
        }
        else {
            cwd = cwd + '/cluster/';
        }
    }
    let dirs = [];
    let content;
    let item;
    try {
        content = fs.readdirSync(cwd);
        for (let i = 0; i < content.length; i++) {
            // build file name to process
            item = fsPath.join(cwd, content[i]);
            // is this item a directory
            if (fs.statSync(item).isDirectory()) {
                dirs.push(item);
            }
        }
    }
    catch (err) {
        logMessage(`FHL056 - Error reading cluster directory, message: ${err}`);
    }
    return dirs;
}
