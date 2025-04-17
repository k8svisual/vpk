//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

export function getChildUid(uid: string, outUid: string) {
    let rtn: any = { uid: 'x' };
    let child: any;
    let tmp: any;
    if (typeof vpk.childUids[uid] !== 'undefined') {
        child = vpk.childUids[uid];
        if (child.parentUid === uid) {
            return rtn;
        }
        rtn = {
            api: child.childAPI,
            uid: uid,
            kind: child.childKind,
            name: child.childName,
            ns: child.childNS,
            fnum: child.childFnum,
            multi: child.parentMulti.length,
            ownerUid: child.parentUid,
            ownerKind: child.parentKind,
            ownerAPI: child.parentAPI,
        };
    } else {
        if (typeof vpk.allUids[uid] !== 'undefined') {
            tmp = vpk.allUids[uid];
            rtn = {
                api: tmp.api,
                uid: uid,
                kind: tmp.kind,
                name: tmp.name,
                ns: tmp.namespace,
                fnum: tmp.fnum,
                multi: '0',
                ownerUid: 'unk',
                ownerKind: 'unk',
            };
        }
    }
    if (typeof vpk.ownerChains[outUid] === 'undefined') {
        vpk.ownerChains[outUid] = [];
    }
    if (rtn.uid !== 'x') {
        vpk.ownerChains[outUid].push(rtn);
    }

    if (typeof rtn.ownerUid === 'undefined') {
        rtn = { uid: 'x' };
    } else {
        rtn = { uid: rtn.ownerUid };
    }

    if (rtn.api === 'undefined') {
        console.log('OwnerRes.js: no apiVersion located, research');
    }

    return rtn;
}
