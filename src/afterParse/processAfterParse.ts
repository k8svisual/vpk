//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';

import { showTimeDiff } from '../utils/showtimedif.js';
import { getPTime } from '../utils/getptime.js';

import { addVolumeAttachmentToCSI } from './addVolumeAttachmentToCSI.js';
import { addCSINodeToNode } from './addCSINodeToNode.js';
import { addParentFnum } from './addParentFnum.js';
import { addEventRoot } from './addEventRoot.js';
import { buildAdditionalServerData } from './buildAdditionalServerData.js';
import { buildVolumeAttachmentInfo } from './buildVolumeAttachmentInfo.js';
import { clusterSummary } from './clusterSummary.js';
import { eventMessageGraphic } from './eventMessageGraphic.js';
import { flipRepoFirst } from './flipRepoFirst.js';
import { setEvtTimes } from './setEvtTimes.js';
import { hogsReport } from './hogsReport.js';
import { ripNetwork } from './ripNetwork.js';
import { ripServiceInPods } from './ripServiceInPods.js';
import { searchVpK } from './searchVpK.js';
import { sercurityRelatedInfo } from './securityRelatedInfo.js';

export function processAfterParse(client) {
    let volAtt: any = {};

    let startT: any = getPTime();
    sercurityRelatedInfo();
    let stopT: any = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.sercurityRelatedInfo()');

    startT = getPTime();
    buildVolumeAttachmentInfo(volAtt);
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.buildVolumeAttachmentInfo()');

    startT = getPTime();
    addVolumeAttachmentToCSI(volAtt);
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.addVolumeAttachmentToCSI()');

    startT = getPTime();
    addCSINodeToNode();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.addCSINodeToNode()');

    startT = getPTime();
    buildAdditionalServerData(client);
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse. buildAdditionalServerData()');

    startT = getPTime();
    addParentFnum();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.addParentFnum()');

    startT = getPTime();
    addEventRoot();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.addEventRoot()');

    startT = getPTime();
    setEvtTimes();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.setEvtTimes()');

    startT = getPTime();
    eventMessageGraphic();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.eventMessageGrapic()');

    startT = getPTime();
    flipRepoFirst();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.flipRepoFirst()');

    // Process network info and create node level information
    startT = getPTime();
    ripNetwork();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.ripNetwork()');

    // Map services to pods
    startT = getPTime();
    ripServiceInPods();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.ripServicesInPods()');

    // Perform searches defined in the vpkconfig.json file
    startT = getPTime();
    searchVpK();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.searchVpK()');

    // Perform Pod CPU & Memory maximum reports
    startT = getPTime();
    hogsReport();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.hogsReport()');

    // Cluster Summary report
    startT = getPTime();
    clusterSummary();
    stopT = getPTime();
    showTimeDiff(startT, stopT, 'afterParse.clusterSummary()');
}
