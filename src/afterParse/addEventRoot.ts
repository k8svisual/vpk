//-----------------------------------------------------------------------------
// Common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function addEventRoot(): void {
    logMessage('AFT030 - Processing event root resources');

    let foundCount = 0;
    let notFoundCount = 0;
    let id = 0;

    try {
        for (const event of vpk.eventMessage) {
            id++;
            event.id = id;

            if (event.involvedKind === 'Pod') {
                foundCount++;
                const key = `Pod.${event.namespace}.${event.involvedName}`;
                const root = vpk.kindNSName[key]?.[0];

                if (root) {
                    event.root = root;
                } else {
                    notFoundCount++;
                    event.root = '0000.0'; // No Pod found
                }
            } else {
                event.root = 'none';
            }

            // Handle potential null values with fallback
            event.firstTime = event.firstTime ?? '';
            event.lastTime = event.lastTime ?? '';

            // Uncomment and implement if `buildEventHTML` is available
            // event.html = buildEventHTML(event);
        }

        logMessage(`AFT032 - Pod found count    : ${foundCount}`);
        logMessage(`AFT033 - Pod not found count: ${notFoundCount}`);
    } catch (err) {
        logMessage(`AFT031 - Error processing event root, message: ${err}`);
        if (err instanceof Error) {
            logMessage(`AFT031 - Stack: ${err.stack}`);
        }
    }
}
