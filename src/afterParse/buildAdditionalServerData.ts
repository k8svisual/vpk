//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';

import { schematicParse } from '../schematic/data/schematicParse.js';
import { schematicHtml } from '../schematic/html/schematicHtml.js';
import { buildStorage } from '../lib/buildStorage.js';
import { logMessage } from '../utils/logging.js';

export function buildAdditionalServerData(client: any) {
    try {
        logMessage('AFT005 - Building schematic information ');
        schematicParse();
        schematicHtml();
        buildStorage();
        client.emit('getKStatus', { msg: 'Building schematic information, press "Close" button.' });
    } catch (err) {
        logMessage('AFT006 - Error processing schematic, message: ' + err);
        logMessage('AFT006 - Stack: ' + err.stack);
    }
}
