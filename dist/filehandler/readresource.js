//-----------------------------------------------------------------------------
// read a k8 resource file, files end with yaml but are json content
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function readResourceFile(fn) {
    let key;
    try {
        if (fn.indexOf('.')) {
            key = fn.split('.');
            key = parseInt(key[0]);
        }
        else {
            key = fn;
        }
        let content = vpk.k8sResc[key];
        // check if managedFields should be removed
        if (typeof vpk.defaultSettings.managedFields !== 'undefined') {
            if (vpk.defaultSettings.managedFields === false) {
                if (typeof content.metadata.managedFields !== 'undefined') {
                    delete content.metadata.managedFields;
                }
            }
        }
        // check if status section should be removed
        if (typeof vpk.defaultSettings.statusSection !== 'undefined') {
            if (vpk.defaultSettings.statusSection === false) {
                if (typeof content.status !== 'undefined') {
                    delete content.status;
                }
            }
        }
        return content;
    }
    catch (err) {
        logMessage(`FHL324 - Failed to read : ${fn} message: ${err}`);
        return '';
    }
}
