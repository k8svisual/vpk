//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function ripServiceInPods() {
    let rtn = {};
    let sIP;
    try {
        vpk.networkServicesToPod = {};
        let keys = Object.keys(vpk.pods);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].startsWith('0000')) {
                continue;
            }
            if (vpk.pods[keys[i]].kind === 'Pod') {
                // let temp = vpk.pods[keys[i]];
                if (typeof vpk.pods[keys[i]].Services !== 'undefined') {
                    for (let s = 0; s < vpk.pods[keys[i]].Services.length; s++) {
                        if (typeof rtn[vpk.pods[keys[i]].Services[s].fnum] === 'undefined') {
                            if (typeof vpk.ipsServiceFnums[vpk.pods[keys[i]].Services[s].fnum] !== 'undefined') {
                                if (typeof vpk.ipsServiceFnums[vpk.pods[keys[i]].Services[s].fnum][0] !== 'undefined') {
                                    sIP = vpk.ipsServiceFnums[vpk.pods[keys[i]].Services[s].fnum][0];
                                }
                                else {
                                    sIP = 'Unknown';
                                }
                            }
                            else {
                                sIP = 'Unknown';
                            }
                            rtn[vpk.pods[keys[i]].Services[s].fnum] = {
                                name: vpk.pods[keys[i]].Services[s].name,
                                pods: [],
                                ip: sIP,
                            };
                        }
                        rtn[vpk.pods[keys[i]].Services[s].fnum].pods.push({
                            fnum: keys[i],
                            ns: vpk.pods[keys[i]].namespace,
                            name: vpk.pods[keys[i]].name,
                            dsp: vpk.pods[keys[i]].daemonSetPod,
                            status: vpk.pods[keys[i]].status.phase,
                            ips: vpk.pods[keys[i]].status.podIPs,
                            node: vpk.pods[keys[i]].node,
                            type: vpk.nodeType[vpk.pods[keys[i]].node].type,
                            nodeFnum: vpk.nodeType[vpk.pods[keys[i]].node].fnum,
                            nodeIP: vpk.nodeType[vpk.pods[keys[i]].node].address,
                        });
                    }
                }
            }
        }
        vpk.networkServicesToPod = rtn;
    }
    catch (err) {
        logMessage('AFT279 - Error processing ripServicesInPods, message: ' + err);
        logMessage('AFT279 - Stack: ' + err.stack);
        vpk.networkServicesToPod = rtn;
    }
}
