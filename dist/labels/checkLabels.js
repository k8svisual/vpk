//-----------------------------------------------------------------------------
// Get the K8s resource type and emit message after processing
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { checkLabel } from '../utils/checklabel.js';
import { checkType } from '../utils/checktype.js';
export function checkLabels(ns, kind, name, metadata, fnum) {
    try {
        // grab labels if they exist
        if (typeof metadata !== 'undefined') {
            if (typeof metadata.labels !== 'undefined') {
                for (var key in metadata.labels) {
                    var value = metadata.labels[key];
                    var labelKey = ns + '.' + kind + '.' + key + '.' + value;
                    if (typeof vpk.idxLabels[key] === 'undefined') {
                        vpk.idxLabels[key] = [];
                        vpk.idxLabels[key].push(fnum);
                    }
                    else {
                        vpk.idxLabels[key].push(fnum);
                    }
                    if (typeof vpk.idxLabelsValue[value] === 'undefined') {
                        vpk.idxLabelsValue[value] = [];
                        vpk.idxLabelsValue[value].push(fnum);
                    }
                    else {
                        vpk.idxLabelsValue[value].push(fnum);
                    }
                    checkLabel(key, value, fnum);
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
        }
    }
    catch (err) {
        logMessage('LBL555 - Error processing file fnum: ' + fnum + ' message: ' + err);
        logMessage('LBL555 - Stack: ' + err.stack);
    }
}
