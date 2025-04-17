//-----------------------------------------------------------------------------
// If old data exists convert to new format
//-----------------------------------------------------------------------------
'use strict';
import fs from 'node:fs';
import path from 'path';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

import { removeOldFiles } from './removeOldFiles.js';

export function checkForOldData(directoryPath: any) {
    let startTime: any;
    let endTime: any;
    let timeElapsed: any;
    try {
        vpk.k8sResc = {};
        const jsonFile: any = path.join(directoryPath, 'vpk.snapshot.json');
        if (fs.existsSync(jsonFile)) {
            startTime = new Date();
            logMessage('SNP901 - Located snapshot json file');
            let snapshotContents: any = fs.readFileSync(jsonFile, 'utf-8');
            vpk.k8sResc = JSON.parse(snapshotContents);
            snapshotContents = null;
            endTime = new Date();
            timeElapsed = endTime - startTime;
            logMessage('SNP603 - Time to load snapshot into memory: ' + timeElapsed + ' milliseconds');
            return;
        }

        logMessage('SNP901 - Processing for old snapshot yaml files');
        fs.readdirSync(directoryPath).forEach((file) => {
            if (file.startsWith('config') && file.endsWith('.yaml')) {
                const configFile: any = path.join(directoryPath, file);
                const integerPart: any = parseInt(file.substring(6, file.length - 5)); // Extract the integer from the filename
                const fileContents: any = fs.readFileSync(configFile, 'utf-8');
                try {
                    const parsedContents: any = JSON.parse(fileContents);
                    vpk.k8sResc[integerPart] = parsedContents;
                } catch (error) {
                    logMessage('SNP902 - Error parsing JSON from file' + configFile + ': ' + error.message);
                }
            }
        });

        const snapshotFilePath: any = path.join(directoryPath, 'vpk.snapshot.json');
        const jsonString: any = JSON.stringify(vpk.k8sResc, null, 0); // Adding 2 spaces for indentation

        fs.writeFileSync(snapshotFilePath, jsonString, 'utf-8');
        logMessage('SNP902 - Snapshot saved to ' + snapshotFilePath);
        removeOldFiles(directoryPath);
        return;
    } catch (err) {
        logMessage('SNP001 - Error - Reading directory, message: = ' + err);
        // clear the file array since there is an error and not able to process
        vpk.baseFS = [];
    }
}
