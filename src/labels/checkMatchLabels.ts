//------------------------------------------------------------------------------
// spec.selector.matchLabels
//------------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

import { logMessage } from '../utils/logging.js';
import { checkType } from '../utils/checktype.js';

export function checkMatchLabels(ns: string, kind: string, name: string, matchLabels: any, fnum: any) {
    try {
        // grab matchLabels if they exist
        if (typeof matchLabels !== 'undefined') {
            for (var key in matchLabels) {
                var value = matchLabels[key];
                var labelKey = ns + '.' + kind + '.' + key + '.' + value;
                checkType(kind, labelKey);
                var tmp = vpk[kind][labelKey];
                var item = {
                    namespace: ns,
                    kind: kind,
                    objName: name,
                    key: key,
                    value: value,
                    fnum: fnum,
                };
                tmp.push(item);
                vpk[kind][labelKey] = tmp;
            }
        }
    } catch (err) {
        logMessage('LBL557 - Error processing file fnum: ' + fnum + ' message: ' + err);
        logMessage('LBL557 - Stack: ' + err.stack);
    }
}
