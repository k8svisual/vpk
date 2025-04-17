//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
export function populateHPA() {
    let keys = Object.keys(vpk.hpaLinks);
    let cKeys = Object.keys(vpk.pods);
    let cKey;
    let chl = cKeys.length;
    let hKind;
    let hName;
    let found;
    let key;
    try {
        for (let k = 0; k < keys.length; k++) {
            key = keys[k];
            // get the HPA TargetRef values
            hKind = vpk.hpaLinks[key][0].hpaLinkKind;
            hName = vpk.hpaLinks[key][0].hpaLinkName;
            found = false;
            for (let c = 0; c < chl; c++) {
                cKey = cKeys[c];
                found = false;
                if (typeof vpk.pods[cKey].creationChain !== 'undefined') {
                    if (vpk.pods[cKey].creationChain.level1Name === hName) {
                        if (vpk.pods[cKey].creationChain.level1Kind === hKind) {
                            found = true;
                        }
                    }
                    if (vpk.pods[cKey].creationChain.level2Name === hName) {
                        if (vpk.pods[cKey].creationChain.level2Kind === hKind) {
                            found = true;
                        }
                    }
                    if (found === true) {
                        vpk.pods[cKey].HPA = {
                            fnum: vpk.hpaLinks[key][0].fnum,
                            spec: vpk.hpaLinks[key][0].spec,
                        };
                    }
                }
            }
        }
    }
    catch (err) {
        logMessage('SCM069 - Error processing HPA, message: ' + err);
        logMessage('SCM169 - Stack: ' + err.stack);
    }
}
