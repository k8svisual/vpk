//-----------------------------------------------------------------------------
// Add node to networkNodes
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function ripPods(data) {
    let pStatus;
    let node;
    try {
        if (typeof data.podIPs !== 'undefined') {
            for (let i = 0; i < data.podIPs.length; i++) {
                pStatus = 'unknown';
                node = 'unknown';
                if (typeof data.podIPs[i].ip !== 'undefined') {
                    if (typeof vpk.ipsPod[data.podIPs[i].ip] === 'undefined') {
                        vpk.ipsPod[data.podIPs[i].ip] = [];
                    }
                    vpk.ipsPod[data.podIPs[i].ip].push(data.fnum);
                    // Add pod network IPs to the associated node
                    if (typeof vpk.networkNodes[data.nodeName] !== 'undefined') {
                        if (typeof vpk.podStatus[data.fnum] !== 'undefined') {
                            pStatus = vpk.podStatus[data.fnum].status;
                        }
                        if (typeof vpk.pods[data.fnum] !== 'undefined') {
                            if (typeof vpk.pods[data.fnum].Services !== 'undefined') {
                                if (typeof vpk.pods[data.fnum].node !== 'undefined') {
                                    node = vpk.pods[data.fnum].node;
                                }
                                for (let n = 0; n < vpk.pods[data.fnum].Services.length; n++) {
                                    if (typeof vpk.networkNodes[data.nodeName].services[vpk.pods[data.fnum].Services[n].name] === 'undefined') {
                                        vpk.networkNodes[data.nodeName].services.push({
                                            name: vpk.pods[data.fnum].Services[n].name,
                                            fnum: vpk.pods[data.fnum].Services[n].fnum,
                                        });
                                    }
                                }
                            }
                        }
                        if (typeof vpk.networkNodes[data.nodeName].pods[data.podIPs[i].ip] === 'undefined') {
                            vpk.networkNodes[data.nodeName].pods[data.podIPs[i].ip] = [];
                        }
                        vpk.networkNodes[data.nodeName].pods[data.podIPs[i].ip].push({
                            fnum: data.fnum,
                            podStatus: pStatus,
                            hostNetwork: data.hostNetwork,
                            node: node,
                        });
                    }
                    else {
                        logMessage(`AFT221 - No Node found for this node name: ${data.nodeName} `);
                    }
                }
            }
        }
    }
    catch (err) {
        logMessage('AFT254 - Error processing ripPods, message: ' + err);
        logMessage('AFT254 - Stack: ' + err.stack);
    }
}
