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
let oldNS = '@';
let first = true;
let rdata = '';
let breakData = '';
let breakID = 0;
let fnum = '';
let countContainer = 0;
let countInitContainer = 0;
let collapseIDs = [];
let crdRefCnt = 0;
let collapseNamespaces = {};
// Data structure that will be sent to the web browser
let k8cData;
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
    let startT = getPTime();
    // Create copy of vpk.pods
    k8cData = new Object(vpk.pods);
    logMessage('UIS001 - Schematic invoked');
    schematic();
    let stopT = getPTime();
    showTimeDiff(startT, stopT, 'uiSchematic.schematic()');
    return;
}
export function getSchematic(ns) {
    let rtn = getRequestedData(ns);
    return rtn;
}
