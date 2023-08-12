/*
Copyright (c) 2018-2022 K8Debug

Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
and associated documentation files (the "Software"), to deal in the Software without restriction, 
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*----------------------------------------------------------
OwnerRef processing
*/
'use strict';

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
const { labelKeys } = require('../lib/vpk');

let fullKeys = [];

var getChildUid = function (uid, outUid) {
    let rtn = { 'uid': 'x' };
    let child;
    let tmp;
    if (typeof vpk.childUids[uid] !== 'undefined') {
        child = vpk.childUids[uid];
        if (child.parentUid === uid) {
            return rtn;
        }
        rtn = {
            'api': child.childAPI,
            'uid': uid,
            'kind': child.childKind,
            'name': child.childName,
            'ns': child.childNS,
            'fnum': child.childFnum,
            'multi': child.parentMulti.length,
            'ownerUid': child.parentUid,
            'ownerKind': child.parentKind,
            'ownerAPI': child.parentAPI
        }
    } else {
        if (typeof vpk.allUids[uid] !== 'undefined') {
            tmp = vpk.allUids[uid];
            rtn = {
                'api': tmp.api,
                'uid': uid,
                'kind': tmp.kind,
                'name': tmp.name,
                'ns': tmp.namespace,
                'fnum': tmp.fnum,
                'multi': '0',
                'ownerUid': 'unk',
                'ownerKind': 'unk'
            }
        }
    }
    if (typeof vpk.ownerChains[outUid] === 'undefined') {
        vpk.ownerChains[outUid] = [];
    }
    if (rtn.uid !== 'x') {
        vpk.ownerChains[outUid].push(rtn);
    }

    if (typeof rtn.ownerUid === 'undefined') {
        rtn = { 'uid': 'x' };
    } else {
        rtn = { 'uid': rtn.ownerUid }
    }

    if (rtn.api === 'undefined') {
        console.log('OwnerRes.js: no apiVersion located, research')
    }

    return rtn;
}



//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------

module.exports = {


    // links: function () {
    //     fullKeys = [];
    //     try {
    //         let cKeys = Object.keys(vpk.childRefs);
    //         cKeys = cKeys.sort();
    //         console.log('orig key count: ' + cKeys.length)

    //         let oKeys = Object.keys(vpk.ownerRefs);
    //         oKeys = oKeys.sort();
    //         let rootKey = 0;
    //         let childKey = 0;
    //         // find root ownerRefs that are not a child
    //         for (let i = 0; i < oKeys.length; i++) {
    //             if (cKeys.includes(oKeys[i])) {
    //                 childKey++;
    //             } else {
    //                 if (typeof vpk.childRefs[oKeys[i]] === 'undefined') {
    //                     vpk.childRefs[oKeys[i]] = [];
    //                     vpk.childRefs[oKeys[i]].push(
    //                         {
    //                             'parentUid': 'cluster',
    //                             'parentKind': 'cluster',
    //                             'parentName': 'cluster',
    //                             'parentAPI': 'v1',
    //                             'childUid': oKeys[i],
    //                             'childKind': vpk.ownerRefs[oKeys[i]].kind,
    //                             'childAPI': 'apiVersion',
    //                             'childName': 'name',
    //                             'childFnum': 'fnum'
    //                         })
    //                 }
    //                 //console.log('added childKey: ' + oKeys[i]);

    //                 rootKey++;
    //             }
    //         }

    //         console.log('rootKey count: ' + rootKey + '  ChildKey root: ' + childKey);
    //         cKeys = Object.keys(vpk.childRefs);
    //         cKeys = cKeys.sort();
    //         console.log('new key count: ' + cKeys.length)

    //         let parent;
    //         for (let p = 0; p < cKeys.length; p++) {
    //             parent = vpk.childRefs[cKeys[p]][0].parentUid;
    //             if (parent === 'cluster') {
    //                 continue
    //             } else {
    //                 if (cKeys.includes(parent)) {
    //                     continue
    //                 } else {
    //                     console.log('{"id" : "' + vpk.childRefs[cKeys[p]][0].childUid + '", "parentId" : "' + vpk.childRefs[cKeys[p]][0].parentUid + '" },')
    //                 }
    //             }
    //             //console.log('{"id" : "' + vpk.childRefs[cKeys[p]][0].childUid + '", "parentId" : "' + vpk.childRefs[cKeys[p]][0].parentUid + '" },')
    //         }


    //     } catch (e) {
    //         console.log(e);
    //         console.log(e.stack);
    //     }

    // },



    //------------------------------------------------------------------------------
    // build the entry to for the specific item  
    //------------------------------------------------------------------------------
    getLinks: function () {
        let links = [];
        let keys = Object.keys(vpk.ownerChains);
        let item;
        let owner;
        for (let k = 0; k < keys.length; k++) {
            item = vpk.ownerChains[keys[k]];
            try {
                if (typeof item[0] !== 'undefined') {
                    owner = {
                        'o1Kind': item[0].kind,
                        'o1Name': item[0].name,
                        'o1NS': item[0].ns,
                        'o1Fnum': item[0].fnum,
                        'o1API': item[0].api,
                        'oLvl': '1'
                    }
                    if (typeof item[1] !== 'undefined') {
                        owner.o2Kind = item[1].kind;
                        owner.o2Name = item[1].name;
                        owner.o2NS = item[1].ns;
                        owner.o2Fnum = item[1].fnum;
                        owner.o2API = item[1].api,
                            owner.oLvl = '2';
                        if (typeof item[2] !== 'undefined') {
                            owner.o3Kind = item[2].kind;
                            owner.o3Name = item[2].name;
                            owner.o3NS = item[2].ns;
                            owner.o3Fnum = item[2].fnum;
                            owner.o3API = item[2].api,
                                owner.oLvl = '3';
                            if (typeof item[3] !== 'undefined') {
                                owner.o4Kind = item[3].kind;
                                owner.o4Name = item[3].name;
                                owner.o4NS = item[3].ns;
                                owner.o4Fnum = item[3].fnum;
                                owner.o4API = item[3].api,
                                    owner.oLvl = '4';
                                if (typeof item[4] !== 'undefined') {
                                    owner.o5Kind = item[4].kind;
                                    owner.o5Name = item[4].name;
                                    owner.o5NS = item[4].ns;
                                    owner.o5Fnum = item[4].fnum;
                                    owner.o5API = item[4].api,
                                        owner.oLvl = '5';
                                }
                            }
                        }
                    } else {
                        if (typeof item[0].ownerKind !== 'undefined') {
                            owner.o2Kind = item[0].ownerKind;
                            owner.o2API = item[0].ownerAPI;
                        }
                    }
                }
                links.push(owner)
            } catch (err) {
                utl.logMsg('vpkOWN097 - Error building ownerRef links, msg: ' + err);
                utl.logMsg('vpkOWN098 - ' + err.stack);
            }
        }
        return links;
    },

    chkUidChain: function () {

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
                } else {
                    vpk.cLvl++
                    uid = item.uid;
                    item = getChildUid(uid, childKey);
                    if (item.uid === 'x' || item.uid === 'unk') {
                        continue;
                    } else {
                        vpk.pLvl++
                        uid = item.uid;
                        item = getChildUid(uid, childKey);
                        if (item.uid === 'x' || item.uid === 'unk') {
                            continue;
                        } else {
                            vpk.gpLvl++
                            uid = item.uid;
                            item = getChildUid(uid, childKey);
                            if (item.uid === 'x' || item.uid === 'unk') {
                                continue;
                            } else {
                                vpk.ggpLvl++
                                uid = item.uid;
                                item = getChildUid(uid, childKey);
                                if (item.uid === 'x' || item.uid === 'unk') {
                                    continue;
                                } else {
                                    vpk.gggpLvl++
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            utl.logMsg('vpkOWN129 - Error checking owner chains: ' + err);
            utl.logMsg(err.stack);
        }
    }


    //end of export    
};