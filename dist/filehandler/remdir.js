//-----------------------------------------------------------------------------
// remove a directory
//-----------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
import fs from 'node:fs';
export function remdir(dir) {
    try {
        // remove the directory if it already exists;
        if (fs.existsSync(dir)) {
            fs.unlinkSync(dir);
        }
        // create the directory
        fs.mkdirSync(dir);
        logMessage(`FHL164 - Creating directory: ${dir}`);
    }
    catch (err) {
        logMessage(`FHL155 - Unable to create snapshot directory: ${dir} error message: ${err}`);
        logMessage(`FHL155 - ${err.stack}`);
    }
}
