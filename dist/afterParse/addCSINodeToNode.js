//-----------------------------------------------------------------------------
// Common routines
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function addCSINodeToNode() {
    logMessage('AFT201 - Processing CSINode to Node');
    const nodeKeys = Object.keys(vpk.nodesFnum);
    const csiKeys = Object.keys(vpk.csiNodeFnum);
    try {
        for (const nodeKey of nodeKeys) {
            // The ?. operator prevents an error by only proceeding if the
            // left-hand side (vpk.nodesFnum[nodeKey]) is neither null nor undefined.
            const node = vpk.nodesFnum[nodeKey]?.[0];
            if (!node) {
                continue;
            }
            const nodeName = node.name;
            for (const csiKey of csiKeys) {
                const csiNode = vpk.csiNodeFnum[csiKey]?.[0];
                if (csiNode?.name === nodeName) {
                    // Add CSI Node info to the Node data
                    node.csiNodes = node.csiNodes || []; // Ensure csiNodes array exists
                    node.csiNodes.push(csiNode);
                }
            }
        }
    }
    catch (err) {
        logMessage(`AFT003 - Error processing csiNode, message: ${err}`);
        if (err instanceof Error) {
            logMessage(`AFT003 - Stack: ${err.stack}`);
        }
    }
}
