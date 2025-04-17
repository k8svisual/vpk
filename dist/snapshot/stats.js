//-----------------------------------------------------------------------------
// Process the snapshot directory
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { saveStatMsg } from './saveStatMsg.js';
import { formatBytes } from '../utils/formatbytes.js';
import { processComponents } from '../filehandler/processcomponents.js';
import { processExplains } from '../filehandler/processexplains.js';
import { processReadyz } from '../filehandler/processreadyz.js';
import { processVersion } from '../filehandler/processversion.js';
export function stats() {
    const dashline = '----------------------------------------------------------------------';
    let statMessages = [];
    // statMessages = [];
    let info;
    if (vpk.fCnt > 0) {
        //saveStatMsg('dl', ' ');
        saveStatMsg('Dirs read', vpk.dCnt, statMessages, dashline);
        saveStatMsg('Files read', vpk.fCnt, statMessages, dashline);
        saveStatMsg('Valid yaml', vpk.yCnt, statMessages, dashline);
        saveStatMsg('Skipped', vpk.xCnt, statMessages, dashline);
        //saveStatMsg('dl', ' ');
    }
    if (vpk.fCnt > 0) {
        saveStatMsg('SNP202 - Binding subjects not defined', vpk.subjectMissingCnt, statMessages, dashline);
        //saveStatMsg('dl', ' ');
    }
    if (typeof vpk.childUids !== 'undefined') {
        info = [];
        saveStatMsg('SNP201 - OwnerRef Single-level', vpk.cLvl, statMessages, dashline);
        saveStatMsg('SNP201 - OwnerRef Double-level', vpk.pLvl, statMessages, dashline);
        saveStatMsg('SNP201 - OwnerRef Triple-level', vpk.gpLvl, statMessages, dashline);
        saveStatMsg('SNP201 - OwnerRef Quad-level', vpk.ggpLvl, statMessages, dashline);
        saveStatMsg('SNP201 - OwnerRef Penta-level', vpk.gggpLvl, statMessages, dashline);
        info.push(`Single-level: ${vpk.cLvl}`);
        info.push(`Double-level: ${vpk.pLvl}`);
        info.push(`Triple-level: ${vpk.gpLvl}`);
        info.push(`Quad-level: ${vpk.ggpLvl}`);
        info.push(`Penta-level: ${vpk.gggpLvl}`);
        vpk.stats['ownerRef'] = info;
    }
    if (typeof vpk.spaceReqSC !== 'undefined') {
        let keys = Object.keys(vpk.spaceReqSC);
        let size;
        info = [];
        for (let i = 0; i < keys.length; i++) {
            size = formatBytes(vpk.spaceReqSC[keys[i]].space);
            let sMsg = [];
            sMsg.push(vpk.gggpLvl);
            saveStatMsg('SNP202 - StorageClass: ' + keys[i], size, sMsg, dashline);
            info.push({
                storageClass: keys[i],
                size: size,
            });
        }
        vpk.stats['storageClass'] = info;
    }
    logMessage('SNP245 - Process explains.json');
    processExplains();
    logMessage('SNP246 - Process version.json');
    processVersion();
    logMessage('SNP247 - Process components.json');
    processComponents();
    logMessage('SNP248 - Process readyz.json');
    processReadyz();
}
