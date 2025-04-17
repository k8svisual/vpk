//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { getChildUid } from './getChildUid.js';
export function chkUidChain() {
    vpk.cLvl = 0;
    vpk.pLvl = 0;
    vpk.gpLvl = 0;
    vpk.ggpLvl = 0;
    vpk.gggpLvl = 0;
    if (typeof vpk.childUids === 'undefined') {
        return;
    }
    let keys = Object.keys(vpk.childUids);
    let childKey;
    let uid;
    let item;
    // vpk.childUids contains the child and parent info.  Check this array to see if
    // there is a defined parent, grandParent, greatGrandParent
    try {
        for (let i = 0; i < keys.length; i++) {
            childKey = keys[i];
            uid = keys[i];
            item = getChildUid(uid, childKey);
            if (item.uid === 'x' || item.uid === 'unk') {
                continue;
            }
            else {
                vpk.cLvl++;
                uid = item.uid;
                item = getChildUid(uid, childKey);
                if (item.uid === 'x' || item.uid === 'unk') {
                    continue;
                }
                else {
                    vpk.pLvl++;
                    uid = item.uid;
                    item = getChildUid(uid, childKey);
                    if (item.uid === 'x' || item.uid === 'unk') {
                        continue;
                    }
                    else {
                        vpk.gpLvl++;
                        uid = item.uid;
                        item = getChildUid(uid, childKey);
                        if (item.uid === 'x' || item.uid === 'unk') {
                            continue;
                        }
                        else {
                            vpk.ggpLvl++;
                            uid = item.uid;
                            item = getChildUid(uid, childKey);
                            if (item.uid === 'x' || item.uid === 'unk') {
                                continue;
                            }
                            else {
                                vpk.gggpLvl++;
                            }
                        }
                    }
                }
            }
        }
    }
    catch (err) {
        logMessage('OWN129 - Error checking owner chains: ' + err);
        logMessage(err.stack);
    }
}
