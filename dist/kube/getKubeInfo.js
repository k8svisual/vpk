//-----------------------------------------------------------------------------
// Get data for request
// kga (Kubernetes Get Array)
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { kubeget } from './kubeget.js';
export async function getKubeInfo(kinfo, kga, client) {
    try {
        const namespace = kinfo.namespace || 'all-namespaces';
        if (!namespace || namespace.length < 3) {
            logMessage('KUB009 - Invalid or missing namespace value: ' + namespace);
            return 'FAIL';
        }
        const newKind = kga.endsWith(':t') ? kga.substring(0, kga.length - 2) : kga.substring(0, kga.length - 2);
        const newNS = kga.endsWith(':t') ? namespace : '';
        // Avoid duplicate gets
        if (vpk.kindList && vpk.kindList.includes(newKind)) {
            logMessage('KUB429 - Duplicate get for kind: ' + newKind);
            return 'SKIP';
        }
        else {
            vpk.kindList = vpk.kindList || [];
            vpk.kindList.push(newKind);
        }
        // Prepare the command
        const glbGet = kinfo.command.split(' ')[0]; // Ensure base command
        const glbSSH = kinfo.host_ip ? `sshpass -p '${kinfo.host_pswd}' ssh -o StrictHostKeyChecking=no ${kinfo.host_user}@${kinfo.host_ip} ` : '';
        client.emit('kubeGet', `Processing kind: ${newKind}`);
        // Fetch the data asynchronously
        const data = await kubeget(newNS, newKind, glbGet, glbSSH);
        // Handle the data
        if (data !== 'No resources found') {
            if (data.length > 143 && data.endsWith('}\n') && data.startsWith('{')) {
                const parsedData = JSON.parse(data);
                if (parsedData.items.length > 0) {
                    if (parsedData.items) {
                        vpk.rtn.items.push(...parsedData.items); // Push items into global store
                        logMessage(`KUB392 - Kind: ${newKind} Pushed: ${parsedData.items.length}`);
                    }
                    else {
                        logMessage(`KUB171 - No items found for kind: ${newKind}`);
                    }
                    client.emit('dynamicResults', { kind: newKind, count: parsedData.items.length });
                }
                else {
                    logMessage(`KUB176 - No items found for kind: ${newKind}`);
                }
            }
            else {
                if (data.indexOf('"items": []') > 0) {
                    logMessage(`KUB177 - Empty list for kind: ${newKind}`);
                }
                else {
                    logMessage(`KUB172 - Unknown or invalid JSON structure for kind: ${newKind}`);
                    logMessage(`KUB178 - ${data}`);
                }
            }
        }
        else {
            logMessage(`KUB173 - No items found for kind: ${newKind}`);
        }
        return 'SUCCESS';
    }
    catch (error) {
        logMessage(`KUB174 - Error getting kube information for kind: ${kga}. Message: ${error.message}`);
        client.emit('error', { kind: kga, message: error.message });
        return 'FAIL';
    }
}
