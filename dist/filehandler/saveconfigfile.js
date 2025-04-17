//-----------------------------------------------------------------------------
// save the user config file contents
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import fs from 'node:fs';
import fsPath from 'path';
export function saveConfigFile(data) {
    let fn = fsPath.join(process.cwd(), 'vpkconfig.json');
    try {
        if (typeof data !== 'undefined') {
            if (typeof data.managedFields !== 'undefined') {
                vpk.configFile.defaults.managedFields = data.managedFields;
            }
            if (typeof data.statusSection !== 'undefined') {
                vpk.configFile.defaults.statusSection = data.statusSection;
            }
            if (typeof data.redactSecrets !== 'undefined') {
                vpk.configFile.defaults.redactSecrets = data.redactSecrets;
            }
            if (typeof data.reloadAction !== 'undefined') {
                vpk.configFile.defaults.reloadAction = data.reloadAction;
            }
            if (typeof data.lightTheme !== 'undefined') {
                vpk.configFile.defaults.lightTheme = data.lightTheme;
            }
            if (typeof data.clusterBackground !== 'undefined') {
                vpk.configFile.defaults.clusterBackground = data.clusterBackground;
            }
        }
        if (typeof vpk.clusterFilters.clusterFilterNodes !== 'undefined') {
            vpk.configFile.clusterFilters = vpk.clusterFilters;
        }
        let doc = {
            defaults: vpk.configFile.defaults,
            snapshotDir: vpk.configFile.snapshotDir,
            clusterFilters: vpk.configFile.clusterFilters,
            search: vpk.configFile.search,
        };
        // Convert to string before writing to file
        doc = JSON.stringify(doc, null, 4);
        fs.writeFileSync(fn, doc);
        return {
            status: 'PASS',
            message: 'Successfully saved ',
        };
    }
    catch (e) {
        logMessage(`vpkUT484 - Error saving user configuration file, message: ${e}`);
        return { status: 'FAIL', message: 'Failed saving: ' + fn + ' message: ' + e };
    }
}
