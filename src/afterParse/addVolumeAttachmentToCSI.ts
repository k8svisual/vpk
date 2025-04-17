//-----------------------------------------------------------------------------
// Common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function addVolumeAttachmentToCSI(volAtt: Record<string, any>): void {
    try {
        logMessage('AFT200 - Processing VolumeAttachments to CSINodes');

        const csiKeys = Object.keys(vpk.csiNodeFnum);

        for (const csiKey of csiKeys) {
            const csiNode = vpk.csiNodeFnum[csiKey]?.[0];
            if (!csiNode?.drivers) continue;

            for (const driver of csiNode.drivers) {
                driver.volAtt = [];

                const key = `${driver.nodeID}::${driver.name}`;
                const attachment = volAtt[key];

                if (attachment) {
                    driver.volAtt.push({
                        pvName: attachment.pvName,
                        fnum: attachment.fnum,
                        volAttName: attachment.name,
                    });
                }
            }
        }

        volAtt = null; // Release reference to volAtt
    } catch (err) {
        logMessage(`AFT003 - Error processing csiNode, message: ${err}`);
        if (err instanceof Error) {
            logMessage(`AFT003 - Stack: ${err.stack}`);
        }
    }
}
