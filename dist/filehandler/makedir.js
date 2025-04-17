//-----------------------------------------------------------------------------
// create a directory
//-----------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
import fs from 'node:fs';
export function makedir(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            logMessage(`FHL158 - Created directory: ${dir}`);
        }
        else {
            logMessage(`FHL159 - Directory: ${dir} exists`);
        }
        return 'PASS';
    }
    catch (e) {
        logMessage(`FHL160 - Failed to create directory: ${dir} error message: ${e}`);
        return 'FAIL';
    }
}
