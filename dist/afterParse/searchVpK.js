//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { processSearch } from '../search/processSearch.js';
export function searchVpK() {
    let networkInfo = {};
    let data;
    let rtn = [];
    try {
        // If search section of config file exists perform searches
        if (typeof vpk.configFile.search !== 'undefined') {
            for (let i = 0; i < vpk.configFile.search.length; i++) {
                rtn = [];
                if (vpk.configFile.search[i].type === 'network') {
                    data = {
                        searchValue: vpk.configFile.search[i].value,
                        kindFilter: vpk.configFile.search[i].kinds,
                        namespaceFilter: vpk.configFile.search[i].ns,
                    };
                    // Call search and determine if the search values exist
                    rtn = processSearch(data);
                    if (rtn.length > 0) {
                        if (typeof networkInfo[vpk.configFile.search[i].result] === 'undefined') {
                            networkInfo[vpk.configFile.search[i].result] = rtn;
                            logMessage(`AFT371 - Located network: ${vpk.configFile.search[i].result} count: ${rtn.length}`);
                        }
                        else {
                            let tmp = networkInfo[vpk.configFile.search[i].result];
                            tmp.push(...rtn);
                            networkInfo[vpk.configFile.search[i].result] = tmp;
                            logMessage(`AFT372 - Updated network: ${vpk.configFile.search[i].result} count: ${rtn.length}`);
                        }
                    }
                }
            }
        }
        // Add network type located added to vpk.status
        if (networkInfo.length === 0) {
            vpk.stats['networkSearchResults'] = ['Unknown'];
        }
        else {
            vpk.stats['networkSearchResults'] = networkInfo;
        }
    }
    catch (err) {
        logMessage('AFT379 - Error processing searchVpK, message: ' + err);
        logMessage('AFT379 - Stack: ' + err.stack);
    }
}
