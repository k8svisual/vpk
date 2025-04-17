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

//----------------------------------------------------------
// Event messages handler
//----------------------------------------------------------

let eventsInfo;
let evtPageNumber = 1;
let evtInterval = 0;
let evtTotalSeconds = 0;
let timelineWidth = 0;
let evtLeftWidth = 400;
let evtCount = 0;
let evtWidth;
let evtLeft = '';
let evtRight = '';
let evtDashes = [];
let evtMaxRecord = 0;
let evtCurrentPage = 0;
let evtPageBreak = 500;
let evtPageStart = 0;
let evtPageStop = 0;
let gapWidth = 0;
let evtGrpCnt = 0;
let evtNamespace = 'all-namespaces'
let evtCurrentView = '';
let evtTableData = [];
let evtFirstMinuteToShow = 0;
let offSetAdjustment = 0;
let showRedBarMsg = false;
let evtValidMinutes = false;
let evtLimitUid = ''
let evtShowTextZero = false;
let evtScrollFnum = 0;

const evtNoDataMsg = '<div><span class="vpkfont vpkblue">No Snapshot data loaded</span></></div>';
const redBarMsg = '<span class="fa-xs ml-5">Note: <span style="background-color: red; color: white;">'
    + 'Red</span> bars indicated the number of messages exceeded top range of chart.</span>'

$('#evtStatsGroup').hide();
$('#evtMsgsDetail').hide();
$('#evtControl').hide();
$('#evtSpan').hide();
$('#evtPageToStart').val(0);

function evtClearFilter() {
    evtLimitUid = '';
    $('#evtPageToStart').val(0);
    evtApplyNamespace();
}

function timelineForUid(uid, ns, fnum) {
    returnWhere = 'Workload';
    evtLimitUid = uid;
    evtCurrentView = 'timeline'
    evtNamespace = ns;
    evtScrollFnum = fnum;

    // Set the associated Namespace in the drop down
    let dropdown = document.getElementById("events-ns-filter");
    for (var i = 0; i < dropdown.options.length; i++) {
        if (dropdown.options[i].text === ns) {
            dropdown.selectedIndex = i;
            break;
        }
    }
    // Trigger a change event to notify any listeners (like event listeners or frameworks)
    let event = new Event("change");
    dropdown.dispatchEvent(event);

    // Filter the data
    evtApplyNamespace();
    // Close the modal with Event messages in Schematic tab
    $("#schemModal").modal('hide');

    $('#evtReturn').html(
        '<button type="button" class="mt-1 mb-1 btn btn-sm btn-secondary vpkButtons ml-2 px-2"'
        + 'onclick="returnToWhereTab(\'Workload\',\'evtReturn\')">Return</button>'
        + '<span class="px-2">to Workload Schematic tab</span>'
    )

    // Opent the events message tab
    $('[href="#evtMsgs"]').tab('show');

}

function evtScroll(fnum) {
    const targetElement = document.getElementById(elementId);

    if (targetElement) {
        // Scroll to the target element
        targetElement.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.log(`Element not found in evtScroll(), elementId ${elementId}`);
    }
}

function evtInvalidMinutesMsg() {
    showMessage(`Field: 'First minute to display' is out of range. Valid range is 0 to ${evtMaxMinutes}'`);
    return;
}

function evtShowStats() {
    if (typeof eventsInfo === 'undefined') {
        $('#evtStats').html(evtNoDataMsg);
        $('#evtStatInfoTop').hide();
        $('#evtStatsGroup').show();
        $('#evtMsgsDetail').hide();
        $('#evtControl').hide();
        $('#evtSpan').hide();
        return;
    }
    showRedBarMsg = false;
    evtValidMinutes = evtNsSelection();
    if (evtValidMinutes === true) {
        if (evtTableData.length === 0) {
            evtGetData();
        }
        evtCurrentView = 'stats';
        $('#evtStatsGroup').show();
        $('#evtMsgsDetail').hide();
        $('#evtControl').hide();
        $('#evtSpan').hide();
        loadStatsByMinutes();
    } else {
        evtInvalidMinutesMsg()
    }
}

function evtShowTable() {
    if (typeof eventsInfo === 'undefined') {
        $('#evtStats').html(evtNoDataMsg);
        $('#evtStatInfoTop').hide();
        $('#evtStatsGroup').show();
        $('#evtMsgsDetail').hide();
        $('#evtControl').hide();
        $('#evtSpan').hide();
        return;
    }
    evtValidMinutes = evtNsSelection();
    if (evtValidMinutes === true) {
        if (evtTableData.length === 0) {
            evtGetData();
        }
        evtCurrentView = 'table';
        $('#evtStatsGroup').hide();
        $('#evtMsgsDetail').show();
        $('#evtControl').hide();
        $('#evtSpan').hide();
        loadEvtMsgs();
    } else {
        evtInvalidMinutesMsg()
    }
}

function evtShowTimeline() {
    try {
        if (typeof eventsInfo === 'undefined') {
            $('#evtStats').html(evtNoDataMsg);
            $('#evtStatInfoTop').hide();
            $('#evtStatsGroup').show();
            $('#evtMsgsDetail').hide();
            $('#evtControl').hide();
            $('#evtSpan').hide();
            return;
        }
        evtValidMinutes = evtNsSelection();
        if (evtValidMinutes === true) {
            if (evtTableData.length === 0) {
                evtGetData();
            }
            evtCurrentView = 'timeline';
            $('#evtStatsGroup').hide();
            $('#evtMsgsDetail').hide();
            $('#evtControl').show();
            $('#evtSpan').show();
            loadEvtTimeline();
        } else {
            evtInvalidMinutesMsg()
        }
    } catch (err) {
        console.log(`Error in evtShowTimeline(), message: ${err}`)
        console.log(`Error stack: ${err.stack}`)
    }

}

function evtGetData() {
    evtTableData = [];
    if (evtNamespace !== 'all-namespaces') {
        for (let i = 0; i < eventsInfo.length; i++) {
            if (eventsInfo[i].namespace === evtNamespace) {
                evtTableData.push(eventsInfo[i]);
            }
        }
    } else {
        evtTableData = new Object(eventsInfo);
    }
    if (evtNamespace !== 'all-namespaces') {
        for (let i = 0; i < eventsInfo.length; i++) {
            if (eventsInfo[i].namespace === evtNamespace) {
                evtTableData.push(eventsInfo[i]);
            }
        }
    } else {
        evtTableData = new Object(eventsInfo);
    }
}

function evtNsSelection() {
    let ns;
    let option
    option = $('#events-ns-filter').select2('data');
    ns = option[0].text;
    ns = ns.trim();
    if (ns.text === '' || ns.length === 0) {
        evtNamespace = 'all-namespaces';
    } else {
        evtNamespace = ns;
    }
    evtFirstMinuteToShow = $('#evtPageToStart').val();
    if (evtFirstMinuteToShow > evtMaxMinutes) {
        return false;
    }
    offSetAdjustment = (evtFirstMinuteToShow * 60);
    return true;
}

function evtApplyNamespace() {
    try {
        if (evtLimitUid !== '') {
            $('#evtFilter').show();
        } else {
            $('#evtFilter').hide();
        }

        // Invoked when UI events required view to be recreated
        evtNsSelection();
        evtTableData = [];
        evtFirstTime = '3000-12-30T23:59:59Z';
        evtLastTime = '';
        evtShowTextZero = false;
        let skipChecking = false;

        if (evtLimitUid !== '') {
            let offset = 999999;
            for (let i = 0; i < eventsInfo.length; i++) {
                if (eventsInfo[i].involvedUid === evtLimitUid) {
                    evtTableData.push(eventsInfo[i]);
                    if (eventsInfo[i].firstTime < evtFirstTime) {
                        evtFirstTime = eventsInfo[i].firstTime;
                    }
                    if (eventsInfo[i].lastTime > evtLastTime) {
                        evtLastTime = eventsInfo[i].lastTime;
                    }
                    if (eventsInfo[i].offset < offset) {
                        offset = eventsInfo[i].offset;
                    }
                }
            }
            skipChecking = true;
            offset = parseInt(offset / 60);

            $('#evtPageToStart').val(offset);
            evtShowTextZero = true;
        }

        // is everything set????

        if (skipChecking === false) {
            evtNsSelection();
            if (evtNamespace !== 'all-namespaces') {
                for (let i = 0; i < eventsInfo.length; i++) {
                    if (eventsInfo[i].namespace === evtNamespace) {
                        if (evtFirstMinuteToShow > 0) {
                            //if ((eventsInfo[i].offset / 60) >= evtFirstMinuteToShow) {
                            if (eventsInfo[i].offset >= offSetAdjustment) {
                                evtTableData.push(eventsInfo[i]);
                            }

                            if (eventsInfo[i].firstTime < evtFirstTime) {
                                evtFirstTime = eventsInfo[i].firstTime;
                            }
                            if (eventsInfo[i].lastTime > evtLastTime) {
                                evtLastTime = eventsInfo[i].lastTime;
                            }
                        } else {
                            evtTableData.push(eventsInfo[i]);
                            if (eventsInfo[i].firstTime < evtFirstTime) {
                                evtFirstTime = eventsInfo[i].firstTime;
                            }
                            if (eventsInfo[i].lastTime > evtLastTime) {
                                evtLastTime = eventsInfo[i].lastTime;
                            }
                        }
                    }
                }
                evtTotalDuration = timeDiff(evtFirstTime, evtLastTime);
            } else {
                if (evtFirstMinuteToShow > 0) {
                    for (let i = 0; i < eventsInfo.length; i++) {
                        if ((eventsInfo[i].offset / 60) >= evtFirstMinuteToShow) {
                            evtTableData.push(eventsInfo[i]);
                            if (eventsInfo[i].firstTime < evtFirstTime) {
                                evtFirstTime = eventsInfo[i].firstTime;
                            }
                            if (eventsInfo[i].lastTime > evtLastTime) {
                                evtLastTime = eventsInfo[i].lastTime;
                            }
                        }
                    }
                    evtTotalDuration = timeDiff(evtFirstTime, evtLastTime);
                } else {
                    evtFirstTime = evtStatsFirstTime;
                    evtLastTime = evtStatsLastTime;
                    evtTotalDuration = evtStatsTotalDuration;
                    evtTableData = new Object(eventsInfo);
                }
            }
        }

        evtTableData.sort((a, b) => (a.fnum > b.fnum) ? 1 : -1);

        evtPageNumber = 1;
        evtGrpCnt = 0;
        $('#evtPage').html(evtPageNumber)

        if (evtCurrentView === 'stats') {
            evtShowStats();
        } else if (evtCurrentView === 'timeline') {
            evtShowTimeline();
        } else if (evtCurrentView === 'table') {
            evtShowTable();
        } else if (evtCurrentView === '') {
            evtShowStats();
        }
    } catch (err) {
        console.log(`Error in evtApplyNamespace(), message: ${err}`)
        console.log(`Error stack: ${err.stack}`)
    }
}

function loadEvtMsgs() {
    //Populate the table defined in index.ejs id="evtMsgs"
    $("#tableEvents").bootstrapTable('load', evtTableData)
    $("#tableEvents").bootstrapTable('hideColumn', 'root');
    $("#tableEvents").bootstrapTable('hideColumn', 'firstTime');
    $("#tableEvents").bootstrapTable('hideColumn', 'lastTime');
    $("#tableEvents").bootstrapTable('hideColumn', 'involvedName');
    $("#tableEvents").bootstrapTable('hideColumn', 'fnum');
}

function loadEvtTimeline() {
    try {
        evtLeft = '<div id="hdr-text" style="height: 25px; background-color: #e6e6e6; padding-left: 25px; color: #600;" class="vpkfont">Component'
            + '<span style="color: #aaaaaa; padding-left: 97px;" class="pr-1">- Reason</span>'
            + '<span style="color: #aaaaaa;" class="vpkfont">(first minute of data)</span></div>';

        evtRight = '';
        evtWidth = getScreenWidth();
        evtWidth = evtWidth - 585;  // Subtract left side, border, and margins
        evtGrpCnt = evtTableData.length / evtPageBreak;

        if (evtTableData.length > 0) {
            $('#evtPage').html(evtPageNumber);
            evtGrpCnt = parseInt(evtGrpCnt) + 1;
            $('#evtGroupCnt').html('of ' + evtGrpCnt);
        } else {
            $('#evtPage').html('0');
            $('#evtGroupCnt').html('of ' + evtGrpCnt);
        }
        calcEvtInterval();
        if (typeof evtStatsTotalDuration === 'number') {
            buildEvtHeaders();
            buildEvtTimeline();
            if (evtShowTextZero === true) {
                evtToggle('evt-0');
            }
        } else {
            evtLeft = '<div><span>No Snapshot data loaded</span></></div>'
            evtRight = '<div><span>No Snapshot data loaded</span></></div>'
            $('#evtLeft').html('');
            $('#evtRight').html('');

            $('#evtLeft').html(evtLeft);
            $('#evtRight').html(evtRight);
        }
    } catch (err) {
        console.log(`Error in loadEvtTimeline(), message: ${err}`)
        console.log(`Error stack: ${err.stack}`)
    }

}

function evtMsgsShowSource(fnum) {
    $("#evtMsgsModal").modal('hide');
    getDefFnum(fnum);
}

function evtMsgsShowSchematic(ns, fnum) {
    $("#evtMsgsModal").modal('hide');
    showSchematic(ns, fnum, 'Event');

}

function cellStyle(value, row, index) {
    // Format the type cell based on the text
    if (value.startsWith('Fail')) {
        return {
            css: {
                background: 'red', color: 'white'
            }
        }
    } else if (value.startsWith('Warn')) {
        return {
            css: {
                background: 'yellow', color: 'grey'
            }
        }
    } else if (value.startsWith('Norm')) {
        return {
            css: {
                background: 'green', color: 'white'
            }
        }
    }
    return {
        css: {
            background: 'grey', color: 'white'
        }
    }
}

function evtScrollPageLess() {
    if (evtPageNumber > 1) {
        evtPageNumber = evtPageNumber - 1;
    }
    loadEvtTimeline()
    $('#evtPage').html(evtPageNumber)
}

function evtScrollPageMore() {
    evtPageNumber++;
    if (evtPageNumber > evtGrpCnt) {
        evtPageNumber = evtGrpCnt;
        return;
    }
    loadEvtTimeline()
    $('#evtPage').html(evtPageNumber)
}

function evtToggle(id) {
    // Toggle carets and showing or hiding sections of related messages.
    let targetText = "#" + id + "-text"
    let targetBars = "#" + id + "-bars"
    let targetCaretDown = id + "-caret-down"
    let targetCaretRight = id + "-caret-right"

    let isTargetExpanded = $(targetText).hasClass('in');
    if (isTargetExpanded) {
        $(targetText).addClass('collapse').removeClass("in"); // collapse clicked target
        $(targetBars).addClass('collapse').removeClass("in"); // collapse clicked target            
        document.getElementById(targetCaretDown).style.visibility = "hidden";
        document.getElementById(targetCaretRight).style.visibility = "visible";
    } else {
        $(targetText).removeClass('collapse').addClass("in"); // expand clicked target
        $(targetBars).removeClass('collapse').addClass("in"); // expand clicked target
        document.getElementById(targetCaretRight).style.visibility = "hidden";
        document.getElementById(targetCaretDown).style.visibility = "visible";
    }
}

function calcEvtInterval() {
    evtInterval = 2;
}

function loadStatsByMinutes() {
    showRedBarMsg = false;
    if (evtNamespace === 'all-namespaces') {
        $('#evtRptNS').html('all namespaces')
        evtMinutesData = evtMinutes;
    } else {
        $('#evtRptNS').html(evtNamespace)
        evtMinutesData = evtNs[evtNamespace];
    }

    //let maxMsgs = 0;
    let maxMinutes = 0;
    let startHdr = ''
    let line = '';
    let set = ';'
    let top;
    let height;
    let width = 5;
    let left = 50;
    let tipData;
    let color;
    let yPos = 804;
    let xPos = 57;
    let xPosPrt = 55;
    let legendNumber = 0;
    if (typeof evtMinutesData === 'undefined') {
        return;
    }
    maxMinutes = evtMinutesData.length;
    maxMinutes = maxMinutes - evtFirstMinuteToShow;
    let maxWidth = (maxMinutes * 13) + 60;
    let prtCnt = 10;
    //let mm = 0;

    if (evtMinutes.length > 0) {
        startHdr = '<div><svg xmlns="http://www.w3.org/2000/svg" width="' + maxWidth + '" height="860">'
            + '<line x1="45" y1="0" x2="' + maxWidth + '" y2="0" style="stroke:#ddd;" stroke-width="2" />';

        for (let i = 0; i < 8; i++) {
            startHdr = startHdr + '<text text-anchor="start" x="20" y="' + yPos + '" fill="#aaa" class="fa-xs">' + legendNumber + '</text>'
                + '<line x1="45" y1="' + yPos + '" x2="' + maxWidth + '" y2="' + yPos + '" style="stroke:#ddd;" stroke-width="2" />'
            yPos = yPos - 100;
            legendNumber = legendNumber + 100;
        }
        startHdr = startHdr + '<text text-anchor="start" x="20" y="12" fill="#aaa" class="fa-xs">' + legendNumber + '</text>'

        for (let i = evtFirstMinuteToShow; i < (evtFirstMinuteToShow + maxMinutes); i++) {
            startHdr = startHdr + '<line x1="' + xPos + '" y1="804" x2="' + xPos + '" y2="814" style="stroke:#ddd;" />'

            if (prtCnt === 10) {
                xPosPrt = xPos;
                startHdr = startHdr + '<line x1="' + xPos + '" y1="804" x2="' + xPos + '" y2="814" style="stroke:#ddd;" stroke-width="2" />'
                    + '<text text-anchor="middle" x="' + xPosPrt + '" y="828" fill="#aaa" class="fa-xs">' + i + '</text>'
                prtCnt = 1;
            } else {
                prtCnt = prtCnt + 1;
            }
            xPos = xPos + 13;
        }

        startHdr = startHdr + '<text text-anchor="middle" transform="translate(12,400) rotate(270)" fill="#888">Number of Event messages</text>'
        // + '<text text-anchor="left" x="50" y="845" fill="#aaa" class="fa-1x">Minutes starting on  '
        // + evtFirstTime.substring(0, 10) + ' at ' + evtFirstTime.substring(11, 19) + '</text > '
    }

    for (let i = evtFirstMinuteToShow; i < evtMinutes.length; i++) {
        if (evtMinutesData[i] > 0) {
            top = (200 - evtMinutesData[i]);
            top = top + 600;
            height = evtMinutesData[i];
            height = height + 3;
            if (height > 800) {
                showRedBarMsg = true;
            }
        } else {
            top = 0;
            height = 0;
        }
        left = left + 5;
        if (height > 599) {
            color = 'red';
        } else {
            color = 'green';
        }
        tipData = "'" + i + "','" + evtMinutesData[i] + "'";

        set = '<rect x="' + left + '" y="' + top + '" width="' + width + '"'
            + ' height="' + height + '" fill="' + color + '" '
            + ' onmousemove="showEvtDist(evt,' + tipData + ')" '
            + ' onmouseout="hideVpkTooltip()" '
            + ' />'
        line = line + set;
        left = left + (width + 3);
    }

    $('#evtStats').html(startHdr + line + '</svg></div>');

    if (showRedBarMsg === true) {
        $('#evtStatInfoBottom').html(redBarMsg);
    } else {
        $('#evtStatInfoBottom').html('')
    }

}

function buildEvtHeaders() {
    gapWidth = 0;
    let max = 0
    let lPos = 0;
    let tPos = 0;
    let line = '';
    let tickMax;
    let evtRightHdr = ''
    let title = ''
    if (typeof evtStatsTotalDuration === 'number') {
        tickMax = (parseInt(evtStatsTotalDuration / 60)) + 3;
        timelineWidth = tickMax * 120;
        // Right side Header

        evtRightHdr = '<div  style="height: 25px; background-color: #ffe6e6;">';
        title = '<svg xmlns="http://www.w3.org/2000/svg" width="' + timelineWidth + '" height="25">'
            + '<rect x="0" y="0" width="' + timelineWidth + '" height="25" fill="#e6e6e6" />';
        evtDashes = [];
        gapWidth = 120;
        for (let i = evtFirstMinuteToShow; i < tickMax; i++) {
            line = '<line x1="' + lPos + '" y1="0" x2="' + lPos + '" y2="25" style="stroke:orange;" />'
            tPos = lPos + 2;
            line = line + '<text text-anchor="start" x="' + tPos + '" y="15" fill="#600" class="evtSmall" >' + i + '</text >'
            lPos = lPos + gapWidth;
            title = title + line;
            evtDashes.push(tPos);
        }
        evtRight = evtRightHdr + title + '</svg></div>';
    } else {
        evtRight = '<div><span>No Snapshot data loaded</span></></div>'
    }
}

function buildEvtTimeline() {
    try {
        evtCount = 0;
        let multiArray = [];
        let multiCnt = 0;
        let m;
        let np;
        let key;
        let nextRecKey;
        let chkRec = false;
        let serviceOp;
        let mLine;
        let pStart = 0;
        let pStop = 0;
        let pCnt = evtPageNumber;
        let tipMessage;
        let min;
        pStop = (evtPageBreak * pCnt);
        pStart = (pStop - evtPageBreak);

        if (evtTableData.length > 0) {
            // Back up till a multiCnt is found;
            if (pStart > 0) {
                let nPtr = pStart;
                let stay = true;
                while (stay === true) {
                    if (typeof evtTableData[nPtr].multiCnt === 'undefined') {
                        nPtr = nPtr - 1;
                    } else {
                        pStart = nPtr
                        stay = false;
                    }
                }
            }

            if (pStop > 0 && evtTableData.length > 500) {
                let nPtr = pStop;
                let stay = true;
                while (stay === true) {
                    if (typeof evtTableData[nPtr].multiCnt !== 'undefined') {
                        pStop = nPtr
                        stay = false;
                    } else {
                        nPtr = nPtr + 1;
                    }
                }
            }

            if (pStop > 0 && evtTableData.length < 500) {
                pStop = evtTableData.length;
            }

            if (pStart === 1) {
                pStart = 0;
            }
            if (pStop > evtTableData.length) {
                pStop = evtTableData.length;
            }

            for (let i = pStart; i < pStop; i++) {
                m = 0;
                if (typeof evtTableData[i].multiCnt !== 'undefined') {
                    key = evtTableData[i].namespace + '.' + evtTableData[i].involvedName;
                    multiArray = [];
                    multiCnt = evtTableData[i].multiCnt;
                    // Add row with multiCnt
                    multiArray.push(evtTableData[i])

                    for (m = 1; m <= multiCnt; m++) {
                        np = i + m;
                        multiArray.push(evtTableData[np])
                    }

                    chkRec = true;
                    while (chkRec) {
                        np = np + 1
                        if (typeof evtTableData[np] !== 'undefined') {
                            if (typeof evtTableData[np].namespace !== 'undefined') {
                                nextRecKey = evtTableData[np].namespace + '.' + evtTableData[np].involvedName;
                                if (key.startsWith(nextRecKey)) {
                                    multiArray.push(evtTableData[np])
                                    m = m + 1;
                                } else {
                                    chkRec = false;
                                }
                            } else {
                                chkRec = false;
                            }
                        } else {
                            chkRec = false;
                        }
                    }

                    // Sort array by key of firstTime
                    multiArray.sort((a, b) => (a.fnum > b.fnum) ? 1 : -1)
                    // Process left side of screen
                    mLine = buildEvtLeftMulti(multiArray);
                    evtLeft = evtLeft + mLine;
                    // Process right side of screen
                    mLine = buildEvtRightMulti(multiArray);
                    evtRight = evtRight + mLine;
                    // Set new pointer for next record
                    i = i + m;
                    i = i - 1;
                    evtCount++;
                } else {

                    if (typeof evtTableData[i].offset !== 'undefined') {
                        if (evtTableData[i].offset > 60) {
                            min = evtTableData[i].offset / 60;
                            min = parseInt(min);
                        } else {
                            min = 0;
                        }
                    } else {
                        min = 0;
                    }

                    //tipMessage = evtTableData[i].message.replace(/["']/g, "");
                    serviceOp = formatServiceOp(evtTableData[i]);
                    evtLeft = evtLeft + buildEvtLeft(serviceOp.srv, serviceOp.op, evtTableData[i].fnum, false, 0, min);
                    evtRight = evtRight + buildEvtRight(evtTableData[i]);
                    evtCount++;
                }
            }
        }
    } catch (err) {
        console.log(`Error creating Events graph, error: ${err}`)
        console.log(`Error stack: ${err.stack}`)
    }

    $('#evtLeft').html('');
    $('#evtRight').html('');

    $('#evtLeft').html(evtLeft);
    $('#evtRight').html(evtRight);
}

function buildEvtLeft(srv, op, fnum, multi, len, min) {
    try {
        let line = '<div id="evt-' + evtCount + '-hdr">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="25">'

        // If multi add the Icon to expand/collapse
        if (multi === true) {
            line = line + '<g onclick="evtToggle(\'evt-' + evtCount + '\')">'
                + '  <g id="evt-' + evtCount + '-caret-right" style="visibility: visible">'
                + '    <polygon points="9,7 15,12  9,17" style="stroke:#666; fill:#666" />'
                + '  </g>'
                + '  <g id="evt-' + evtCount + '-caret-down" style="visibility: hidden">'
                + '    <polygon points="8,7 18,7 13,15" style="stroke:#666; fill:#666" />'
                + '  </g>'
                + '</g>'
        }

        // line = line + '<text text-anchor="start" x="25" y="15" fill="#600" class="evtSmall" onclick="getDefFnum(\'' + fnum + '\')">'
        //     + data + '(' + min + ')</text></svg></div>'

        line = line + '<g><text text-anchor="start" x="25"  y="15" fill="#600" class="evtSmall" onclick="getDefFnum(\'' + fnum + '\')">' + srv + '</text>'
            + '<text text-anchor="start" x="200" y="15" fill="#aaa" class="evtSmall" onclick="getDefFnum(\'' + fnum + '\')"> - ' + op + '(' + min + ')</text>'
            + '</g></svg></div>'

        return line;
    } catch (err) {
        console.log(`Error in buildEvtLeft(), error: ${err}`)
        console.log(`Error stack: ${err.stack}`)
        return line;
    }
}

function buildEvtLeftMulti(data) {
    let line = '';
    let rtn = '';
    let yPos = 0;
    let height = (data.length - 1) * 25;
    let serviceOp = formatServiceOp(data[0]);
    let min = 0;

    try {
        if (typeof data[0] !== 'undefined') {
            if (typeof data[0].offset !== 'undefined') {
                if (data[0].offset > 60) {
                    min = data[0].offset / 60;
                    min = parseInt(min);
                } else {
                    min = 0;
                }
            } else {
                min = 0;
            }
        } else {
            min = 0;
        }

        if (data.length === 1) {
            rtn = buildEvtLeft(serviceOp.srv, serviceOp.op, data[0].fnum, false, data.length, min);
        } else {
            rtn = buildEvtLeft(serviceOp.srv, serviceOp.op, data[0].fnum, true, data.length, min);
        }

        rtn = rtn + '<div id="evt-' + evtCount + '-text" class="collapse">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="' + height + '">'
        for (let i = 1; i < data.length; i++) {
            if (typeof data[i] !== 'undefined') {
                if (typeof data[i].offset !== 'undefined') {
                    if (data[i].offset > 60) {
                        min = data[i].offset / 60;
                        min = parseInt(min);
                    } else {
                        min = 0;
                    }
                } else {
                    min = 0;
                }
            } else {
                continue;
            }

            yPos = (25 * (i - 1)) + 15;
            serviceOp = formatServiceOp(data[i])
            // line = '<text text-anchor="start" x="25" y="' + yPos + '" class="evtSmall"  onclick="getDefFnum(\'' + data[i].fnum + '\')">'
            //     + serviceOp.srv + ' : ' + serviceOp.op + '(' + min + ')</text>'

            line = '<g>'
                + '<text text-anchor="start" x="25"  y="' + yPos + '" fill="#600" class="evtSmall" onclick="getDefFnum(\'' + data[i].fnum + '\')">' + serviceOp.srv + '</text>'
                + '    <text text-anchor="start" x="200" y="' + yPos + '" fill="#aaa" class="evtSmall" onclick="getDefFnum(\'' + data[i].fnum + '\')"> - ' + serviceOp.op + '(' + min + ')</text>'
                + '</g>'

            rtn = rtn + line;
        }
        rtn = rtn + '</svg></div>';
        return rtn;

    } catch (err) {
        console.log(`Error in buildEvtLeftMulti(), message: ${err}`)
        console.log(`Error stack: ${err.stack}`)
        return '';
    }
}

function buildEvtRight(data) {
    let tickMarks = buildTickMarks(25);
    let message;
    let xVal = 0;
    let wVal = 0;
    try {
        let line = '';
        if (data.duration < 2) {
            data.duration = 2;
        }
        // Remove any single or double quotes from message
        message = data.message.replace(/["']/g, "");
        xVal = intervalOffsetAdjustment(data.Dateoffset);
        wVal = intervalDurationAdjustment(data.duration);

        line = '<div id="evt-' + evtCount + '-line">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="' + timelineWidth + '" height="25">'
            + tickMarks
            + tickMarks
            + '<rect x="' + xVal + '" y="5" width="' + wVal + '"'
            + ' height="15" rx="0" fill="green" '
            + ' onmousemove="showEvtTooltip(evt,\'' + data.createTime
            + '\',\'' + data.fistTime
            + '\',\'' + data.lastTime
            + '\',\'' + data.duration
            + '\',\'' + data.durationFromFirst
            + '\',\'' + message
            + '\')" '
            + ' onmouseout="hideVpkTooltip()" '
            + ' onclick="getDefFnum(\'' + data.fnum + '\')"/>'
            + '</svg></div>'

        return line;
    } catch (err) {
        console.log(`Error in buildEvtRight(), message: ${err}`);
        console.log(`Error stack: ${err.stack}`);
    }
}

function buildEvtRightMulti(data) {
    let rtn = '';
    let yPos = 0;
    let height = (data.length - 1) * 25;
    let line = '';
    let dur;
    let message;
    let tickMarks = buildTickMarks(height);
    let xVal = 0;
    let wVal = 0;
    try {
        tickMarks = buildTickMarks(25);
        dur = data[0].duration;
        // Mimimum width for timeline item
        if (dur < 2) {
            dur = 2;
        }
        message = data[0].message.replace(/["']/g, "");
        xVal = intervalOffsetAdjustment(data[0].offset);
        wVal = intervalDurationAdjustment(dur);

        rtn = '<div id="evt-' + evtCount + '-line">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="' + timelineWidth + '" height="25">'
            + tickMarks
            + tickMarks
            + '<rect x="' + xVal + '" y="5" width="' + wVal + '"'
            + ' height="15" rx="0" fill="green" '
            + ' onmousemove="showEvtTooltip(evt,\'' + data[0].createTime
            + '\',\'' + data[0].fistTime
            + '\',\'' + data[0].lastTime
            + '\',\'' + dur
            + '\',\'' + data[0].durationFromFirst
            + '\',\'' + message
            + '\')" '
            + ' onmouseout="hideVpkTooltip()" '
            + ' onclick="getDefFnum(\'' + data[0].fnum + '\')"/>'
            + '</svg></div>'
            + '<div id="evt-' + evtCount + '-bars" class="collapse">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="' + timelineWidth + '" height="' + height + '">'

        line = buildTickMarks(height);
        for (let i = 1; i < data.length; i++) {
            yPos = yPos = (25 * (i - 1)) + 5;
            if (typeof data[i] !== 'undefined') {
                if (typeof data[i].duration !== 'undefined') {
                    dur = data[i].duration;
                } else {
                    dur = 0;
                }
            } else {
                continue;
            }
            // Mimimum width for timeline item
            if (dur < 2) {
                dur = 2;
            }
            message = data[i].message.replace(/["']/g, "");
            xVal = intervalOffsetAdjustment(data[i].offset);
            wVal = intervalDurationAdjustment(dur);

            line = line + '<rect x="' + xVal + '" y="' + yPos + '" width="' + wVal + '"'
                + ' height="15" rx="0" fill="green"'
                + ' onmousemove="showEvtTooltip(evt,\'' + data[i].createTime
                + '\',\'' + data[i].fistTime
                + '\',\'' + data[i].lastTime
                + '\',\'' + dur
                + '\',\'' + data[i].durationFromFirst
                + '\',\'' + message
                + '\')" '
                + ' onmouseout="hideVpkTooltip()" '
                + ' onclick="getDefFnum(\'' + data[i].fnum + '\')"/>'
            rtn = rtn + line;
        }
        rtn = rtn + '</svg></div>'
        return rtn;
    } catch (err) {
        console.log(`Error in buildEvtRightMulti(), message: ${err}`);
        console.log(`Error stack: ${err.stack}`);
    }
}

function buildTickMarks(height) {
    let yPosTop;
    let yPosBottom;
    let line = '';
    let xPos;
    try {
        yPosTop = 0;
        yPosBottom = height;
        for (let i = 0; i < evtDashes.length; i++) {
            if (i === 0) {
                xPos = evtDashes[i] - 1;
            } else {
                xPos = evtDashes[i] - 2;
            }
            line = line + '<line x1="' + xPos + '" y1="' + yPosTop + '" x2="' + xPos + '" y2="' + yPosBottom + '" style="stroke:#ddd;" />'
        }
        return line;
    } catch (err) {
        console.log(`Error in buildTickMarks(), message: ${err}`);
        console.log(`Error stack: ${err.stack}`);
        return ' ';
    }
}

function formatServiceOp(data) {
    let op = 'Unknown';
    let source = 'Unknown';
    if (typeof data.sourceComponent !== 'undefined') {
        source = data.sourceComponent;
    } else {
        if (typeof data.reportingComponent !== 'undefined') {
            source = data.reportingComponent;
        } else {
            source = 'Unknown';
        }
    }
    if (typeof data.involvedKind !== 'undefined') {
        op = data.involvedKind + ' ' + data.reason;
    } else {
        op = data.reason;
    }
    if (typeof source === 'undefined') {
        source = '';
    }
    if (source.length > 30) {
        source = source.substring(0, 20) + ' . . . '
    }
    return { 'srv': source, 'op': op }
}

function intervalOffsetAdjustment(val) {
    if (typeof val === 'undefined' || val === null) {
        return 1
    }

    if (offSetAdjustment > 0) {
        val = val - offSetAdjustment;
    }

    if (val === 0 || val === 1) {
        if (evtInterval < 1) {
            return 1
        } else {
            return evtInterval
        }
    }

    return val * evtInterval

}

function intervalDurationAdjustment(val) {
    if (val === 0 || val === 1) {
        if (evtInterval < 1) {
            return 1
        } else {
            return evtInterval
        }
    }
    return val * evtInterval
}

function setTotalSeconds(startTime, endTime) {
    let totalSeconds = 0;
    try {
        totalSeconds = timeDiff(startTime, endTime)
        evtTotalSeconds = totalSeconds;
        if (evtTotalSeconds < evtWidth) {
            evtInterval = evtWidth / evtTotalSeconds;
        } else {
            evtInterval = evtTotalSeconds / evtWidth;
        }
        evtInterval = evtInterval.toFixed(3);
    } catch (err) {
        console.log(`Failed to calculate Event messages duration: ${err}`);
        console.log(`Error stack: ${err}`);
        evtInterval = 1;
    }
}

function timeDiff(startTime, endTime) {
    //------------------------------------------------------------------------------
    // Routine to calculate the total seconds of duration from first date time to 
    // end date time. As currently written the routine only handles maximum of
    // two consecutive days.
    //------------------------------------------------------------------------------
    if (typeof startTime === 'undefined' || startTime === null || startTime === "") {
        return 1
    }
    if (typeof endTime === 'undefined' || endTime === null || endTime === "") {
        return 1
    }
    try {
        //ToDo need to check if data has been f
        let sTmp = startTime.split('T');
        let eTmp = endTime.split('T');

        let sDay = sTmp[0].split('-');
        let sTime = sTmp[1].split(':');

        let eDay = eTmp[0].split('-');
        let eTime = eTmp[1].split(':');

        let sYYYY = sDay[0];
        let sMM = sDay[1];
        let sDD = sDay[2];
        let sHr = sTime[0];
        let sMin = sTime[1];
        let sSec = sTime[2].substring(0, 2);

        let eYYYY = eDay[0];
        let eMM = eDay[1];
        let eDD = eDay[2];
        let eHr = eTime[0];
        let eMin = eTime[1];
        let eSec = eTime[2].substring(0, 2);

        let totalSeconds = 0;
        let seconds = 0;

        let start_date;
        let end_date;

        if (sTmp[0] !== eTmp[0]) {
            // First day
            start_date = new Date(sYYYY, sMM, sDD, sHr, sMin, sSec)
            end_date = new Date(sYYYY, sMM, sDD, 23, 59, 59)
            seconds = (end_date - start_date) / 1000;
            timeDiffotalSeconds = seconds;
            // Second day
            start_date = new Date(eYYYY, eMM, eDD, 0, 0, 1)
            end_date = new Date(eYYYY, eMM, eDD, eHr, eMin, eSec)
            totalSeconds = (end_date - start_date) / 1000;
            seconds = (end_date - start_date) / 1000;
            totalSeconds = evtTotalSeconds + seconds;
        } else {
            start_date = new Date(sYYYY, sMM, sDD, sHr, sMin, sSec)
            end_date = new Date(eYYYY, eMM, eDD, eHr, eMin, eSec)
            seconds = (end_date - start_date) / 1000;
            totalSeconds = seconds;
        }
        return totalSeconds;
    } catch (err) {
        console.log(`Error calculating time duration, message: ${err}`);
        console.log(`Error stack: ${err.stack}`)
        return 1;
    }


}


//----------------------------------------------------------
console.log('loaded vpkTabEvtMsgs.js');
