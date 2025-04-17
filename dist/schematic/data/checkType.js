//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
export function checkType(container, type, fnum) {
    let i = 0;
    let name;
    let key = '';
    let nFnum;
    try {
        if (typeof container[type] !== 'undefined') {
            for (i = 0; i < container[type].length; i++) {
                name = container[type][i].name;
                key = container.namespace + '.' + type + '.' + name;
                if (typeof vpk[type] !== 'undefined') {
                    if (typeof vpk[type][key] !== 'undefined') {
                        if (typeof vpk[type][key][0] !== 'undefined') {
                            if (typeof vpk[type][key][0].fnum === 'undefined') {
                                logMessage('SCM149 - Kind:' + type + ' Key:' + key + ' has no FNUM');
                            }
                            if (typeof vpk[type][key][0].fnum !== 'undefined') {
                                nFnum = vpk[type][key][0].fnum;
                            }
                            else {
                                nFnum = 'missing';
                            }
                            container[type][i].fnum = nFnum;
                        }
                    }
                    else {
                        container[type][i].notFound = true;
                        container[type][i].fnum = 'missing';
                    }
                }
                else {
                    logMessage('SCM428 - Fnum: ' + fnum + ' did not locate vpk.' + type + ' for key: ' + key);
                }
            }
        }
    }
    catch (err) {
        logMessage('SCM035 -  Error fnum ' + fnum + ' container type: ' + type + ' at entry: ' + i + ' using key (namespace.kind.name): ' + key);
        logMessage('SCM135 -  Stack: ' + err.stack);
    }
    return container;
}
