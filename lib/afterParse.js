/*
Copyright (c) 2018-2023 Dave Weilert

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

/*------------------------------------------------------------------------------
Generic template to parse kubernetes resource type/kind
*/
'use strict';

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import security from '../lib/security.js';
import uiSchematic from '../lib/uiSchematic.js';
import schematic from '../lib/svgSchematic.js';
import storage from '../lib/storage.js';

var volAtt = {};
const cellBorder = 'border-left: 1px solid #cdd0d4; border-bottom: 1px solid #cdd0d4;'

//------------------------------------------------------------------------------

var addCSINodeToNode = function () {
    utl.logMsg('vpkAFT200 - ProcessingVolmueAttachments for CSINodes');
    let nodeKeys = Object.keys(vpk.nodesFnum);
    let csiKeys = Object.keys(vpk.csiNodeFnum);
    let nodeName;
    let n;
    let c;
    try {
        for (n = 0; n < nodeKeys.length; n++) {
            nodeName = vpk.nodesFnum[nodeKeys[n]][0].name;
            for (c = 0; c < csiKeys.length; c++) {
                if (vpk.csiNodeFnum[csiKeys[c]][0].name === nodeName) {
                    // add csiNode info to the Node data
                    vpk.nodesFnum[nodeKeys[n]][0].csiNodes.push(vpk.csiNodeFnum[csiKeys[c]][0])
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkAFT003 - Error processing csiNode, message: ' + err);
        utl.logMsg('vpkAFT003 - Stack: ' + err.stack);
    }
};


var addEventRoot = function () {
    utl.logMsg('vpkAFT030 - Processing event root resources');
    let root;
    let key;
    let i;
    let fCnt = 0;
    let nfCnt = 0;
    let id = 0;
    try {
        for (i = 0; i < vpk.eventMessage.length; i++) {
            id++;
            vpk.eventMessage[i].id = id;
            if (vpk.eventMessage[i].involvedKind === 'Pod') {
                fCnt++;
                key = 'Pod.' + vpk.eventMessage[i].namespace + '.' + vpk.eventMessage[i].involvedName;
                if (typeof vpk.kindNSName[key] !== 'undefined') {
                    root = vpk.kindNSName[key];
                    if (typeof root !== 'undefined' && root.length > 0) {
                        vpk.eventMessage[i].root = root[0]
                    }
                } else {
                    nfCnt++;
                    vpk.eventMessage[i].root = '0000.0';   // No Pod found
                }
            } else {
                vpk.eventMessage[i].root = 'none';
            }

            if (vpk.eventMessage[i].firstTime === null) {
                vpk.eventMessage[i].firstTime = '';

            }
            if (vpk.eventMessage[i].lastTime === null) {
                vpk.eventMessage[i].lastTime = '';
            }


            // Build the Event message HTML and populate 
            //vpk.eventMessage[i].html = buildEventHTML(vpk.eventMessage[i]);

        }
        utl.logMsg('vpkAFT032 - Pod found count    : ' + fCnt)
        utl.logMsg('vpkAFT033 - Pod not found count: ' + nfCnt)
    } catch (err) {
        utl.logMsg('vpkAFT031 - Error processing event root, message: ' + err);
        utl.logMsg('vpkAFT031 - Stack: ' + err.stack)
    }
}


var addParentFnum = function () {
    utl.logMsg('vpkAFT020 - Processing onwerReferences parent uids');
    let key;

    try {
        for (let n = 0; n < vpk.oRefLinks.length; n++) {
            key = vpk.oRefLinks[n].parent;
            if (typeof vpk.allUids[key] !== 'undefined') {
                vpk.oRefLinks[n].parentFnum = vpk.allUids[key].fnum;
            } else {
                vpk.oRefLinks[n].parentFnum = 'notFound';
            }
        }
        // This is a dual sort for th ownerReference information, sort by
        // namespace and then parent uid
        vpk.oRefLinks = vpk.oRefLinks.sort((a, b) => {
            // First, compare by 'firstName'
            const firstComparison = a.ns.localeCompare(b.ns);

            // If 'firstName' is the same, compare by 'lastName'
            if (firstComparison === 0) {
                return a.parent.localeCompare(b.parent);
            }
            return firstComparison; // Return the result of the 'namespace' comparison
        });
        utl.logMsg('vpkAFT022 - Completed updating ownerReferences parent Uids');
    } catch (err) {
        utl.logMsg('vpkAFT021 - Error processing parent Uids, message: ' + err);
        utl.logMsg('vpkAFT021 - Stack: ' + err.stack);
    }
};


var addVolumeAttachmentToCSI = function () {
    try {
        utl.logMsg('vpkAFT200 - ProcessingVolmueAttachments for CSINodes');
        let csiKeys = Object.keys(vpk.csiNodeFnum);
        let key;
        let k;
        let d;

        // loop through all csiNode data, get associated node name, loop through nodes and update
        for (k = 0; k < csiKeys.length; k++) {
            if (typeof vpk.csiNodeFnum[csiKeys[k]] !== 'undefined') {
                if (typeof vpk.csiNodeFnum[csiKeys[k]][0] !== 'undefined') {
                    if (typeof vpk.csiNodeFnum[csiKeys[k]][0].drivers !== 'undefined') {
                        if (vpk.csiNodeFnum[csiKeys[k]][0].drivers !== null) {
                            for (d = 0; d < vpk.csiNodeFnum[csiKeys[k]][0].drivers.length; d++) {
                                vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].volAtt = [];
                                key = vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].nodeID + '::' + vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].name;
                                if (typeof volAtt[key] !== 'undefined') {
                                    vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].volAtt.push({
                                        'pvName': volAtt[key].pvName,
                                        'fnum': volAtt[key].fnum,
                                        'volAttName': volAtt[key].name
                                    })
                                }
                            }
                        }
                    }
                }
            }
        }
        volAtt = null;
    } catch (err) {
        utl.logMsg('vpkAFT003 - Error processing csiNode, message: ' + err);
        utl.logMsg('vpkAFT003 - Stack: ' + err.stack);
    }
};


var buildVolumeAttachmentInfo = function () {
    volAtt = {};
    try {
        utl.logMsg('vpkAFT200 - Processing VolmueAttachments');
        let keys = Object.keys(vpk.volumeAttachment);
        for (let k = 0; k < keys.length; k++) {
            volAtt[vpk.volumeAttachment[keys[k]][0].nodeName + '::' + vpk.volumeAttachment[keys[k]][0].attacher] =
            {
                'fnum': vpk.volumeAttachment[keys[k]][0].fnum,
                'pvName': vpk.volumeAttachment[keys[k]][0].pvName,
                'name': vpk.volumeAttachment[keys[k]][0].name,
            };
        }
    } catch (err) {
        utl.logMsg('vpkAFT002 - Error processing volumeAttachmentRelated, message: ' + err);
        utl.logMsg('vpkAFT002 - Stack: ' + err.stack);
    }
};


var eventMessageGrapic = function () {
    let oldKey;
    let nextKey;
    let ni;
    let firstMulti = 0;
    try {
        for (let i = 0; i < vpk.eventGraphics.length; i++) {
            //vpk.eventGraphics[i].key = vpk.eventGraphics[i].namespace + '.' + vpk.eventGraphics[i].involvedName + '.' + vpk.eventGraphics[i].firstTime + '.' + vpk.eventGraphics[i].lastTime + '.' + vpk.eventGraphics[i].root;
            vpk.eventGraphics[i].key = vpk.eventGraphics[i].namespace + '.' + vpk.eventGraphics[i].involvedName + '.' + vpk.eventGraphics[i].fnum + '.' + vpk.eventGraphics[i].root;

        }

        // // Sort array by key
        // vpk.eventGraphics.sort((a, b) => (a.key > b.key) ? 1 : -1)
        // // Save first key for comparison
        // oldKey = vpk.eventGraphics[0].namespace + '.' + vpk.eventGraphics[0].involvedName;

        // Sort array by involvedObject.uid & metadata.creationDate
        sortByKey(vpk.eventMessage, 'sortKey')
        oldKey = vpk.eventGraphics[0].involvedUid;

        for (let i = 0; i < vpk.eventGraphics.length; i++) {
            // oldKey != currentKey
            // if (oldKey !== vpk.eventGraphics[i].namespace + '.' + vpk.eventGraphics[i].involvedName) {
            if (oldKey !== vpk.eventGraphics[i].involvedUid) {

                if ((i + 1) < vpk.eventGraphics.length) {
                    ni = i + 1;
                    //nextKey = vpk.eventGraphics[ni].namespace + '.' + vpk.eventGraphics[ni].involvedName;
                    nextKey = vpk.eventGraphics[ni].involvedUid;

                    //if (nextKey === vpk.eventGraphics[i].namespace + '.' + vpk.eventGraphics[i].involvedName) {
                    if (nextKey === vpk.eventGraphics[i].involvedUid) {
                        firstMulti = i;   // save pointer to first of this set
                    } else {
                        firstMulti = -1;
                    }
                } else {
                    if (firstMulti > -1) {
                        vpk.eventGraphics[firstMulti].multiCnt = (i - firstMulti);
                    }
                }
                //oldKey = vpk.eventGraphics[i].namespace + '.' + vpk.eventGraphics[i].involvedName;
                oldKey = vpk.eventGraphics[i].involvedUid;

            } else {
                if (firstMulti > -1) {
                    vpk.eventGraphics[firstMulti].multiCnt = (i - firstMulti);
                }
            }
        }
    } catch (err) {
        utl.logMsg('vpkAFT431 - Error processing event message graphic, message: ' + err);
        utl.logMsg('vpkAFT431 - Stack: ' + err.stack)
    }
}


var printVolumeCounts = function (type) {
    let keys;
    if (type === 'node') {
        keys = Object.keys(vpk.volumeCountsNode);
    } else if (type === 'ns') {
        keys = Object.keys(vpk.volumeCountsNS);
    } else if (type === 'pod') {
        keys = Object.keys(vpk.volumeCountsPod);
    } else if (type === 'type') {
        keys = Object.keys(vpk.volumeCountsType);
    }

    keys.sort();

    let count;
    for (let i = 0; i < keys.length; i++) {
        if (type === 'node') {
            count = vpk.volumeCountsNode[keys[i]];
        } else if (type === 'ns') {
            count = vpk.volumeCountsNS[keys[i]];
        } else if (type === 'pod') {
            count = vpk.volumeCountsPod[keys[i]];
        } else if (type === 'type') {
            count = vpk.volumeCountsType[keys[i]];
        }
        console.log(`${padZeros(count)}  : ${keys[i]}`)
    }
}


var padZeros = function (num) {
    if (num < 10) {
        return '0000' + num;
    } else if (num < 100) {
        return '000' + num;
    } else if (num < 1000) {
        return '00' + num;
    } else if (num < 10000) {
        return '0' + num;
    }
}


var sercurityRelatedInfo = function () {
    let tmp;
    try {
        utl.logMsg('vpkAFT100 - Sorting Role ApiGroups');
        tmp = utl.sortJSONByKeys(vpk.secApiGroups);
        vpk.secApiGroups = tmp;
        utl.logMsg('vpkAFT101 - Sorting Role Resources');
        tmp = utl.sortJSONByKeys(vpk.secResources);
        vpk.secResources = tmp;
        vpk.secSubjectsHierarchy = security.buildSubjectHierarchy();
        vpk.secResourcesHierarchy = security.buildResourceHierarchy();
    } catch (err) {
        utl.logMsg('vpkAFT001 - Error processing securityRelated, message: ' + err);
        utl.logMsg('vpkAFT001 - Stack: ' + err.stack);
    }
};


//ToDo:  Move this to clientIO.js as a funciton and post to the browser
var sendServerData = function (client) {
    try {
        utl.logMsg('vpkAFT005 - Building schematic information ');
        schematic.parse();
        uiSchematic.create();
        storage.buildStorage();
    } catch (err) {
        utl.logMsg('vpkAFT006 - Error processing schematic, message: ' + err);
        utl.logMsg('vpkAFT006 - Stack: ' + err.stack);
    }
}

/**
 * 
 * Event TimeStamp
 * 
 * Creation Timestamp: This is the time when the event object was created in 
 * the Kubernetes system. It is set at the moment the event is initially recorded.
 *
 * First Timestamp: This represents the time when the first occurrence of the 
 * event happened. For events that can happen multiple times, this helps to 
 * identify when the event was first observed.
 *
 * Last Timestamp: This represents the time of the most recent occurrence of 
 * the event. It is updated every time the event is recorded.
 *
 * These timestamps are useful for understanding the chronological order of 
 * events and for troubleshooting issues within the cluster. By examining 
 * these timestamps, you can identify when an event was first observed, 
 * when subsequent occurrences happened, and when the most recent occurrence 
 * took place.
 */

var setEvtTimes = function () {
    try {
        vpk.eventGraphics = new Object(vpk.eventMessage);
        // let firstTime = '3000-12-30T23:59:59Z';
        // let lastTime = '';
        let offset;
        let duration;
        let durationFromFirst;
        // let sTime;
        // let eTime;
        let dGTZ = 0;
        let minutes = [];
        let ns = {}
        let nsSum = {};
        let tmp;
        let totalMinutes;

        // Calculate overall timespan for all Events based on createDate value
        vpk.evtTotalDuration = utl.timeDiff(vpk.evtFirstTime, vpk.evtLastTime);
        totalMinutes = parseInt(vpk.evtTotalDuration / 60);
        totalMinutes = totalMinutes + 1;
        for (let i = 0; i <= totalMinutes; i++) {
            minutes[i] = 0
        }

        for (let i = 0; i < vpk.eventGraphics.length; i++) {
            if (typeof vpk.eventGraphics[i].firstTime !== 'undefined' && vpk.eventGraphics[i].firstTime !== null) {
                if (vpk.eventGraphics[i].firstTime !== '0') {
                    durationFromFirst = utl.timeDiff(vpk.eventGraphics[i].firstTime, vpk.eventGraphics[i].createTime);;
                } else {
                    durationFromFirst = 0;
                }
            } else {
                durationFromFirst = 0;
            }

            // New time caluculations
            offset = utl.timeDiff(vpk.evtFirstTime, vpk.eventGraphics[i].createTime);
            duration = 0;

            vpk.eventGraphics[i].offset = offset;
            vpk.eventGraphics[i].duration = duration;
            vpk.eventGraphics[i].durationFromFirst = durationFromFirst;

            if (duration > 1) {
                dGTZ++
            }
            // Stats for event message
            if (offset < 60) {
                tmp = 0;
            } else {
                tmp = parseInt(offset / 60)
            }
            minutes[tmp] = minutes[tmp] + 1;

            if (typeof ns[vpk.eventGraphics[i].namespace] === 'undefined') {
                ns[vpk.eventGraphics[i].namespace] = []
                for (let p = 0; p <= totalMinutes; p++) {
                    ns[vpk.eventGraphics[i].namespace][p] = 0
                }
                nsSum[vpk.eventGraphics[i].namespace] = 0;
            }
            ns[vpk.eventGraphics[i].namespace][tmp] = ns[vpk.eventGraphics[i].namespace][tmp] + 1;
            nsSum[vpk.eventGraphics[i].namespace] = nsSum[vpk.eventGraphics[i].namespace] + 1;
        }
        vpk.evtMinutes = minutes;
        vpk.evtNs = ns;
        vpk.evtNsSum = nsSum;
        utl.logMsg('vpkAFT232 - Count of durations greater than one: ' + dGTZ);

    } catch (err) {
        utl.logMsg('vpkAFT237 - Error processing Event times, message: ' + err);
        utl.logMsg('vpkAFT237 - Stack: ' + err.stack)
    }
}

// Generic sorting function
var sortByKey = function (array, sortKey) {
    return array.sort((a, b) => {
        if (a[sortKey] < b[sortKey]) {
            return -1;
        } else if (a[sortKey] > b[sortKey]) {
            return 1;
        } else {
            return 0;
        }
    });
}
//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    process: function (client) {
        sercurityRelatedInfo();
        buildVolumeAttachmentInfo();
        addVolumeAttachmentToCSI();
        addCSINodeToNode();
        sendServerData(client);
        addParentFnum();
        addEventRoot();
        setEvtTimes();
        eventMessageGrapic();

        // console.log('======================= Type Level counts');
        // printVolumeCounts('type');

        // console.log('======================= NODE Level counts');
        // printVolumeCounts('node');

        // console.log('======================= NAMESPACE Level counts');
        // printVolumeCounts('ns');

        // console.log('======================= POD Level counts');
        // printVolumeCounts('pod');

    }
};
