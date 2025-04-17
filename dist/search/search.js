//------------------------------------------------------------------------------
// loop through all types and determine if it should be included in results
//------------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
import { checkNsOrKind } from './checkNsOrKind.js';
import { parseValueFilter } from './parseValueFilter.js';
import { buildReturn } from './buildReturn.js';
export function search(nsFilter, kindFilter, valueFilter, fnumBase) {
    try {
        // Check Namespaces
        if (nsFilter !== '::all-namespaces::') {
            let what = nsFilter.split('::');
            if (typeof what === 'undefined' || what.length === 0 || what === null) {
                logMessage('SCH004 - Did not locate any namespace filter data');
                return [];
            }
            checkNsOrKind(what, 'NS', fnumBase);
        }
        // Check Kinds
        if (kindFilter !== '::all-kinds::') {
            let what = kindFilter.split('::');
            if (typeof what === 'undefined' || what.length === 0 || what === null) {
                logMessage('SCH006 - Did not locate any namespace filter data');
                return [];
            }
            checkNsOrKind(what, 'KIND', fnumBase);
        }
        // Check searchValue
        if (valueFilter !== '*') {
            parseValueFilter(valueFilter, fnumBase);
        }
    }
    catch (err) {
        logMessage('SCH005 - Error processing, message: ' + err);
        logMessage('SCH005 - Stack: ' + err.stack);
        return [];
    }
    return buildReturn(fnumBase);
}
