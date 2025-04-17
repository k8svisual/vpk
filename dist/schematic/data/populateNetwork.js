//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import { logMessage } from '../../utils/logging.js';
import { populateEndpoints } from './populateEndpoints.js';
import { populateEndpointSlice } from './populateEndpointSlice.js';
export function populateNetwork() {
    try {
        populateEndpoints();
        populateEndpointSlice();
    }
    catch (err) {
        logMessage('SCM005 - Error processing schematic, message: ' + err);
        logMessage('SCM105 - Stack: ' + err.stack);
    }
}
