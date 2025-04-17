//-----------------------------------------------------------------------------
// read the license file and put content in memory var
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import fs from 'node:fs';
export function readLicenseFile() {
    let base = process.cwd();
    let fn = base + '/LICENSE';
    let found = false;
    try {
        if (fs.existsSync(fn)) {
            found = true;
        }
        if (found) {
            let content = fs.readFileSync(fn);
            content = content.toString();
            vpk.LICENSE = content;
            return;
        }
        else {
            vpk.LICENSE = 'Open source software, MIT license';
        }
    }
    catch (err) {
        logMessage(`FHL834 - Failed to read LICENSE file, message: ${err}`);
        return 'Open source software, MIT license';
    }
}
