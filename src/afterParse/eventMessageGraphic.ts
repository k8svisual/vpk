//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { sortByKey } from './sortByKey.js';

export function eventMessageGraphic() {
    let oldKey: string;
    let nextKey: string;
    let ni: number;
    let firstMulti: number = 0;
    try {
        if (typeof vpk.eventGraphics[0] !== 'undefined') {
            for (let i: number = 0; i < vpk.eventGraphics.length; i++) {
                vpk.eventGraphics[i].key =
                    vpk.eventGraphics[i].namespace +
                    '.' +
                    vpk.eventGraphics[i].involvedName +
                    '.' +
                    vpk.eventGraphics[i].fnum +
                    '.' +
                    vpk.eventGraphics[i].root;
            }

            // Sort array by involvedObject.uid & metadata.creationDate
            sortByKey(vpk.eventMessage, 'sortKey');
            oldKey = vpk.eventGraphics[0].involvedUid;

            for (let i: number = 0; i < vpk.eventGraphics.length; i++) {
                if (oldKey !== vpk.eventGraphics[i].involvedUid) {
                    if (i + 1 < vpk.eventGraphics.length) {
                        ni = i + 1;
                        nextKey = vpk.eventGraphics[ni].involvedUid;

                        if (nextKey === vpk.eventGraphics[i].involvedUid) {
                            firstMulti = i; // save pointer to first of this set
                        } else {
                            firstMulti = -1;
                        }
                    } else {
                        if (firstMulti > -1) {
                            vpk.eventGraphics[firstMulti].multiCnt = i - firstMulti;
                        }
                    }
                    oldKey = vpk.eventGraphics[i].involvedUid;
                } else {
                    if (firstMulti > -1) {
                        vpk.eventGraphics[firstMulti].multiCnt = i - firstMulti;
                    }
                }
            }
        }
    } catch (err) {
        logMessage('AFT431 - Error processing event message graphic, message: ' + err);
        logMessage('AFT431 - Stack: ' + err.stack);
    }
}
