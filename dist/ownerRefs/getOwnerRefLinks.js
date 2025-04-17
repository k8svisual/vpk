//-----------------------------------------------------------------------------
// build the entry to for the specific item
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
export function getOwnerRefLinks() {
    let links = [];
    let keys = Object.keys(vpk.ownerChains);
    let item;
    let owner;
    for (let k = 0; k < keys.length; k++) {
        item = vpk.ownerChains[keys[k]];
        try {
            if (typeof item[0] !== 'undefined') {
                owner = {
                    o1Kind: item[0].kind,
                    o1Name: item[0].name,
                    o1NS: item[0].ns,
                    o1Fnum: item[0].fnum,
                    o1API: item[0].api,
                    oLvl: '1',
                };
                if (typeof item[1] !== 'undefined') {
                    owner.o2Kind = item[1].kind;
                    owner.o2Name = item[1].name;
                    owner.o2NS = item[1].ns;
                    owner.o2Fnum = item[1].fnum;
                    owner.o2API = item[1].api;
                    owner.oLvl = '2';
                    if (typeof item[2] !== 'undefined') {
                        owner.o3Kind = item[2].kind;
                        owner.o3Name = item[2].name;
                        owner.o3NS = item[2].ns;
                        owner.o3Fnum = item[2].fnum;
                        owner.o3API = item[2].api;
                        owner.oLvl = '3';
                        if (typeof item[3] !== 'undefined') {
                            owner.o4Kind = item[3].kind;
                            owner.o4Name = item[3].name;
                            owner.o4NS = item[3].ns;
                            owner.o4Fnum = item[3].fnum;
                            owner.o4API = item[3].api;
                            owner.oLvl = '4';
                            if (typeof item[4] !== 'undefined') {
                                owner.o5Kind = item[4].kind;
                                owner.o5Name = item[4].name;
                                owner.o5NS = item[4].ns;
                                owner.o5Fnum = item[4].fnum;
                                owner.o5API = item[4].api;
                                owner.oLvl = '5';
                            }
                        }
                    }
                }
                else {
                    if (typeof item[0].ownerKind !== 'undefined') {
                        owner.o2Kind = item[0].ownerKind;
                        owner.o2API = item[0].ownerAPI;
                    }
                }
            }
            links.push(owner);
        }
        catch (err) {
            logMessage('OWN097 - Error building ownerRef links, msg: ' + err);
            logMessage('OWN098 - ' + err.stack);
        }
    }
    return links;
}
