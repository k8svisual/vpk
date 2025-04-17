//-----------------------------------------------------------------------------
// build svg for workloads
//-----------------------------------------------------------------------------

'use strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';
import { showTimeDiff } from '../../utils/showtimedif.js';
import { getPTime } from '../../utils/getptime.js';

import { getRequestedData } from './getRequestedData.js';
import { buildCSVG } from './buildCSVG.js';
import { buildNoPods } from './buildNoPods.js';

let oldNS: string = '@';
let first: boolean = true;
let rdata: string = '';
let breakData: string = '';
let breakID: number = 0;
let fnum: any = '';
let countContainer: number = 0;
let countInitContainer: number = 0;
let collapseIDs = [];
let crdRefCnt: number = 0;
let collapseNamespaces: any = {};

// Data structure that will be sent to the web browser
let k8cData: any;

function initSchematicVars() {
    oldNS = '@';
    first = true;
    rdata = '';
    breakData = '';
    breakID = 0;
    fnum = '';
    countContainer = 0;
    countInitContainer = 0;
    collapseIDs = [];
    crdRefCnt = 0;
    collapseNamespaces = {};

    // Global values that are reset each time the schematics are created
    vpk.schematicSVGs = {};
    vpk.schematicKeys = {};
    vpk.nsResourceInfo = {};
    vpk.svgInfo = {};
    vpk.workloadEventsInfo = {};
}

function schematic() {
    //Clear and initialize the variables
    initSchematicVars();
    buildCSVG(k8cData, fnum, oldNS, breakData, breakID, first, rdata, countContainer, countInitContainer, crdRefCnt, collapseIDs, collapseNamespaces);
    buildNoPods(k8cData, collapseIDs, collapseNamespaces, breakID);
    logMessage('UIS001 - Schematic process completed');
}

//------------------------------------------------------------------------------
// common routinesUserIdentityMapping
//------------------------------------------------------------------------------
export function schematicHtml() {
    let startT: any = getPTime();
    // Create copy of vpk.pods
    k8cData = new Object(vpk.pods);
    logMessage('UIS001 - Schematic invoked');
    schematic();
    let stopT: any = getPTime();
    showTimeDiff(startT, stopT, 'uiSchematic.schematic()');

    return;
}

export function getSchematic(ns: string) {
    let rtn = getRequestedData(ns);
    return rtn;
}
