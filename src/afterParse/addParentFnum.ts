//-----------------------------------------------------------------------------
// Common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function addParentFnum(): void {
    logMessage('AFT020 - Processing ownerReferences parent UIDs');

    try {
        for (const link of vpk.oRefLinks) {
            const key = link.parent;
            link.parentFnum = vpk.allUids[key]?.fnum ?? 'notFound';
        }

        // Dual sort by namespace and then parent UID
        vpk.oRefLinks.sort((a, b) => {
            const nsComparison = a.ns.localeCompare(b.ns);
            return nsComparison !== 0 ? nsComparison : a.parent.localeCompare(b.parent);
        });

        logMessage('AFT022 - Completed updating ownerReferences parent UIDs');
    } catch (err) {
        logMessage(`AFT021 - Error processing parent UIDs, message: ${err}`);
        if (err instanceof Error) {
            logMessage(`AFT021 - Stack: ${err.stack}`);
        }
    }
}
