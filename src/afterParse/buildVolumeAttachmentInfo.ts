//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function buildVolumeAttachmentInfo(volAtt) {
    // build an arrary of pvNames and associated fNums
    let pvNameAndFnum = {};
    let vaKeys = Object.keys(vpk.pvFnum);
    for (let i = 0; i < vaKeys.length; i++) {
        let tmp = vpk.pvFnum[vaKeys[i]];
        pvNameAndFnum[tmp[0].name] = {
            name: tmp[0].name,
            fnum: tmp[0].fnum,
        };
    }
    volAtt = {};
    try {
        logMessage('AFT202 - Processing VolmueAttachments information');
        let keys = Object.keys(vpk.volumeAttachment);
        let pvFnum;
        for (let k = 0; k < keys.length; k++) {
            pvFnum = pvNameAndFnum[vpk.volumeAttachment[keys[k]][0].pvName].fnum;
            // update vpk.volumeAttachment
            vpk.volumeAttachment[keys[k]][0].pvFnum = pvFnum;
            // update volAtt
            volAtt[vpk.volumeAttachment[keys[k]][0].nodeName + '::' + vpk.volumeAttachment[keys[k]][0].attacher] = {
                fnum: vpk.volumeAttachment[keys[k]][0].fnum,
                pvName: vpk.volumeAttachment[keys[k]][0].pvName,
                name: vpk.volumeAttachment[keys[k]][0].name,
                pvFnum: pvFnum,
            };
        }
        pvNameAndFnum = null;
    } catch (err) {
        logMessage('AFT002 - Error processing volumeAttachmentRelated, message: ' + err);
        logMessage('AFT002 - Stack: ' + err.stack);
    }
}
