//-----------------------------------------------------------------------------
// If old data exists convert to new format
//-----------------------------------------------------------------------------
'use strict';
import fs from 'node:fs';
import path from 'path';
import { logMessage } from '../utils/logging.js';
export function removeOldFiles(directoryPath) {
    try {
        let cnt = 0;
        logMessage('SNP911 - Deleting old snapshot yaml files');
        fs.readdirSync(directoryPath).forEach((file) => {
            if (file.startsWith('config') && file.endsWith('.yaml')) {
                const filePath = path.join(directoryPath, file);
                try {
                    fs.unlinkSync(filePath);
                    cnt++;
                }
                catch (error) {
                    logMessage('SNP912 - Error deleting JSON from file' + filePath + ': ' + error.message);
                }
            }
        });
        logMessage('SNP914 - Removed ' + cnt + ' old .yaml files');
    }
    catch (err) {
        logMessage('SNP913 - Remove old files error, message: = ' + err);
        return;
    }
}
