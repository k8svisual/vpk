//-----------------------------------------------------------------------------
// reload snapshot directory
//-----------------------------------------------------------------------------
'use strict';
import fs from 'node:fs';
import vpk from '../lib/vpk.js';
import vpkReset from '../lib/vpkReset.js';
import { logMessage } from '../utils/logging.js';
import { fileio } from '../fileio/fileio.js';
import { resetVpkObject } from '../utils/resetvpkobject.js';
import { stats } from './stats.js';
import { checkForOldData } from './checkForOldData.js';
export function processDir(dir, client) {
    if (fs.existsSync(dir)) {
        logMessage('SNP311 - Using snapshot: ' + dir);
        vpk.resetReq = true;
        resetVpkObject();
        let holdVer = vpk.version;
        vpkReset.resetAll();
        vpk.version = holdVer;
        vpk.dirFS.push(dir);
        vpk.startDir = dir;
        vpk.validDir = true;
        checkForOldData(dir);
        // Start reading located resources
        fileio(client);
        // fileio.checkDir(client);
        vpk.dirname = dir;
        stats();
    }
    else {
        vpk.startDir = dir;
        vpk.validDir = false;
    }
}
