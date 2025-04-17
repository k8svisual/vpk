//-----------------------------------------------------------------------------
// Save extracted resource JSON to file for snapshot
//-----------------------------------------------------------------------------
'use strict';
import fs from 'node:fs';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { makedir } from '../filehandler/makedir.js';
import { remdir } from '../filehandler/remdir.js';
import { processDir } from './processDir.js';
export function saveK8sData(dynDir, client) {
    logMessage('SNP606 - Write files invoked');
    let rdata = {};
    rdata.status = 'PASS';
    rdata.message = 'OK';
    let startTime;
    let endTime;
    let timeElapsed;
    try {
        remdir(dynDir);
        let mkresult = makedir(dynDir);
        if (mkresult === 'PASS') {
            vpk.k8sResc = {};
            let fnum = 1000;
            let fn;
            let oldKind = '@startUp';
            let input;
            //let cnt: number = 0;
            let i;
            for (i = 0; i < vpk.rtn.items.length; i++) {
                input = vpk.rtn.items[i];
                if (typeof input.kind !== 'undefined') {
                    if (oldKind !== input.kind) {
                        logMessage('SNP609 - Kind: ' + oldKind + ' fnum: ' + fnum);
                        oldKind = input.kind;
                    }
                }
                // Increment fnum and add K8s recource to object
                fnum++;
                vpk.k8sResc[fnum] = input;
            }
            i++;
            logMessage('SNP607 - Created memory map for ' + i + ' K8s resources');
            // Save K8s resource data to snapshot directory
            startTime = new Date();
            fn = dynDir + '/' + 'vpk.snapshot.json';
            fs.writeFileSync(fn, JSON.stringify(vpk.k8sResc));
            endTime = new Date();
            timeElapsed = endTime - startTime;
            logMessage('SNP608 - Time to load snapshot file to memory: ' + timeElapsed + ' milliseconds');
            // read and load newly created files for snapshot
            processDir(dynDir, client);
        }
        else {
            logMessage('SNP605 - Unable to create directory: ' + dynDir);
            rdata.status = 'FAIL';
            rdata.message = 'SNP605 - Unable to create directory: ' + dynDir;
        }
    }
    catch (err) {
        logMessage('SNP606 - Error creating directory: ' + dynDir + ' message: ' + err);
        rdata.status = 'FAIL';
        rdata.message = 'SNP606 - Error creating directory: ' + dynDir + ' message: ' + err;
        return rdata;
    }
    delete vpk.rtn;
    return rdata;
}
