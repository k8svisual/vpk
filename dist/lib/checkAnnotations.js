//------------------------------------------------------------------------------
// metadata.annotations
//------------------------------------------------------------------------------
'use strict';
import vpk from './vpk.js';
import { logMessage } from '../utils/logging.js';
export function checkAnnotations(annotations, fnum) {
    try {
        // grab labels if they exist
        if (typeof annotations !== 'undefined') {
            for (let key in annotations) {
                let value = annotations[key];
                // Save key
                if (typeof vpk.idxAnnotations[key] === 'undefined') {
                    vpk.idxAnnotations[key] = [];
                    vpk.idxAnnotations[key].push(fnum);
                }
                else {
                    vpk.idxAnnotations[key].push(fnum);
                }
                // Save value
                if (typeof vpk.idxAnnotationsValue[value] === 'undefined') {
                    vpk.idxAnnotationsValue[value] = [];
                    vpk.idxAnnotationsValue[value].push(fnum);
                }
                else {
                    vpk.idxAnnotationsValue[value].push(fnum);
                }
            }
        }
    }
    catch (err) {
        logMessage(`ANN555 - Error processing file fnum: ${fnum} message: ${err}`);
        logMessage(`ANN555 - Stack: ${err.stack}`);
    }
}
