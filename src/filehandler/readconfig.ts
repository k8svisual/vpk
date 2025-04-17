//-----------------------------------------------------------------------------
// read configuration file
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

import fs from 'node:fs';
import fsPath from 'path';

export function readConfig() {
    var status: string = 'OK';
    let fn: any = fsPath.join(process.cwd(), 'vpkconfig.json');
    logMessage(`FHL380 - Using configuration file: ${fn}`);

    try {
        let contents: any = fs.readFileSync(fn, 'utf8');
        if (contents !== '') {
            // Populate global vpk object with vpkconfig.json provided parms
            try {
                vpk.configFile = JSON.parse(contents);
                // Validate 'defaults' parameter
                if (typeof vpk.configFile.defaults === 'undefined') {
                    vpk.configFile.defaults = {};
                    vpk.configFile.defaults.managedFields = false;
                    vpk.configFile.defaults.statusSection = false;
                    vpk.configFile.defaults.redactSecrets = false;
                    vpk.configFile.defaults.reloadAction = false;
                    vpk.configFile.defaults.lightTheme = true;
                    vpk.configFile.defaults.clusterBackground = 'grey';
                }
                if (typeof vpk.configFile.snapshotDir === 'undefined') {
                    vpk.configFile.snapshotDir = '';
                }
                // Save validated parameters to new global variable
                vpk.defaultSettings = vpk.configFile.defaults;
                let useDir: string = '';
                let dirFromStartup: any;
                let dirFromConfig: any;

                // Check if the "-s" startup parameter snapshot directory exists
                // 'none' indicates the parameter was not provided
                if (vpk.snapshotDir !== 'none') {
                    dirFromStartup = fs.existsSync(vpk.snapshotDir);
                    if (dirFromStartup === false) {
                        logMessage(`FHL383 - Startup parameter "-s" for snapshot directory does not exist: ${vpk.snapshotDir}`);
                    }
                } else {
                    dirFromStartup = false;
                }

                // Check if the vpkconfig.json parameter was provided and check if snapshot directory exists
                if (vpk.configFile.snapshotDir !== '') {
                    dirFromConfig = fs.existsSync(vpk.configFile.snapshotDir);
                    if (dirFromConfig === false) {
                        logMessage(`FHL385 - vpkconfig.json provided parameter for snapshot directory 
                            does not exist: ${vpk.configFile.snapshotDir}`);
                    }
                } else {
                    dirFromConfig = false;
                }

                // Set what directory will be used
                // check one
                if (dirFromStartup === true) {
                    // Use this value as the snapshot directory
                    useDir = vpk.snapshotDir;
                    logMessage(`FHL387 - Snapshot directory from startup parameter will be used: ${vpk.snapshotDir}`);
                }
                // Check two
                if (useDir === '' && dirFromConfig === true) {
                    // Use this value as the snapshot directory
                    useDir = vpk.configFile.snapshotDir;
                    logMessage(`FHL389 - Snapshot directory from vpkconfig.json parameter will be used: ${vpk.configFile.snapshotDir}`);
                }
                // Use default
                if (useDir === '') {
                    let os: string = process.platform;
                    if (os.startsWith('win')) {
                        useDir = `${process.cwd()}\\cluster`;
                    } else {
                        useDir = `${process.cwd()}/cluster`;
                    }
                    logMessage(`FHL384 - Default snapshot directory will be used: ${useDir}`);
                }

                if (typeof vpk.configFile.search !== 'undefined') {
                    if (Array.isArray(vpk.configFile.search)) {
                        logMessage(`FHL417 - Located search count: ${vpk.configFile.search.length}`);
                    }
                }

                vpk.snapshotDir = useDir;
                status = 'OK';
            } catch (e) {
                logMessage(`FHL385 - VPK config file: ${fn} has invalid format, message: ${e}`);
                logMessage(`FHL385 - Stack: ${e.stack}`);
                status = 'FAIL';
            }
        } else {
            vpk.configFile = {};
            vpk.configFile.defaults = {};
            vpk.configFile.defaults.managedFields = false;
            vpk.configFile.defaults.statusSection = false;
            vpk.configFile.defaults.redactSecrets = false;
            vpk.configFile.defaults.reloadAction = false;
            vpk.configFile.defaults.lightTheme = true;
            vpk.configFile.defaults.clusterBackground = 'grey';
            vpk.configFile.snapshotDir = '';
            logMessage(`FHL386 - VpK config is empty. Add parameters to file: vpkconfig.json`);
            this.saveConfigFile();
            status = 'OK';
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            vpk.configFile = {};
            vpk.configFile.defaults = {};
            vpk.configFile.defaults.managedFields = false;
            vpk.configFile.defaults.statusSection = false;
            vpk.configFile.defaults.redactSecrets = false;
            vpk.configFile.defaults.reloadAction = false;
            vpk.configFile.defaults.lightTheme = true;
            vpk.configFile.defaults.clusterBackground = 'grey';
            vpk.configFile.snapshotDir = '';
            logMessage(`FHL387 - VPK config file: ${fn} does not exist, creating file`);
            this.saveConfigFile();
            status = 'OK';
        } else if (err.code === 'EACCES') {
            logMessage(`FHL388 - VPK config file: ${fn} has Permission error(s)`);
            status = 'FAIL';
        } else {
            logMessage(`FHL389 - VPK config file: ${fn} has Unknown Error(s)`);
            status = 'FAIL';
        }
    }
    return status;
}
