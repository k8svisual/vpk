//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

export function populateEndpoints() {
    let ckeys: any[] = Object.keys(vpk.pods);
    let ekeys: any[] = Object.keys(vpk.endpointsLinks);
    let ckey: string;
    let ekey: string;
    let sName: string;
    let eFnum: string;
    let tmp: any;
    try {
        // loop containers
        for (let c = 0; c < ckeys.length; c++) {
            ckey = ckeys[c];
            if (typeof vpk.pods[ckey].Services !== 'undefined') {
                sName = vpk.pods[ckey].Services[0].name;
                for (let e = 0; e < ekeys.length; e++) {
                    ekey = ekeys[e];
                    eFnum = '';
                    if (typeof vpk.endpointsLinks[ekey] !== 'undefined') {
                        if (typeof vpk.endpointsLinks[ekey][0].targetUid !== 'undefined') {
                            if (typeof vpk.allUids[vpk.endpointsLinks[ekey][0].targetUid] !== 'undefined') {
                                tmp = vpk.allUids[vpk.endpointsLinks[ekey][0].targetUid];
                                if (tmp.fnum === ckey) {
                                    eFnum = vpk.endpointsLinks[ekey][0].fnum;
                                    vpk.pods[ckey].Services[0].ep = eFnum;
                                    vpk.pods[ckey].Services[0].epName = vpk.endpointsLinks[ekey][0].name;

                                    if (typeof vpk.networkServices[ckey] === 'undefined') {
                                        vpk.networkServices[ckey] = [];
                                    }
                                    vpk.networkServices[ckey].push(vpk.pods[ckey].Services);

                                    continue;
                                }
                            }
                        }

                        if (typeof vpk.endpointsLinks[ekey][0].oRef !== 'undefined') {
                            if (typeof vpk.endpointsLinks[ekey][0].oRef[0] !== 'undefined') {
                                if (typeof vpk.endpointsLinks[ekey][0].oRef[0].uid !== 'undefined') {
                                    if (typeof vpk.allUids[vpk.endpointsLinks[ekey][0].oRef[0].uid] !== 'undefined') {
                                        tmp = vpk.allUids[vpk.endpointsLinks[ekey][0].oRef[0].uid];
                                        if (tmp.fnum === ckey) {
                                            eFnum = vpk.endpointsLinks[ekey][0].fnum;
                                            vpk.pods[ckey].Services[0].ep = eFnum;
                                            vpk.pods[ckey].Services[0].epName = eFnum = vpk.endpointsLinks[ekey][0].name;
                                            if (typeof vpk.networkServices[ckey] === 'undefined') {
                                                vpk.networkServices[ckey] = [];
                                            }
                                            vpk.networkServices[ckey].push(vpk.pods[ckey].Services);
                                            continue;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (typeof vpk.endpointsLinks[ekey] !== 'undefined') {
                        if (typeof vpk.endpointsLinks[ekey][0].name !== 'undefined') {
                            if (vpk.endpointsLinks[ekey][0].name === sName) {
                                vpk.pods[ckey].Services[0].ep = ekey;
                                vpk.pods[ckey].Services[0].epName = sName;

                                if (typeof vpk.networkServices[ckey] === 'undefined') {
                                    vpk.networkServices[ckey] = [];
                                }
                                vpk.networkServices[ckey].push(vpk.pods[ckey].Services);
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        logMessage('SCM032 - Error processing schematic, message: ' + err.stack);
    }
}
