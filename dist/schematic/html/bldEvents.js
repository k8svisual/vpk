import vpk from '../../lib/vpk.js';
import { formatDate } from './formatDate.js';
import { buildSvgInfo } from './buildSvgInfo.js';
export function bldEvents(fnum, k8cData, html) {
    // build the table of Event messages
    if (typeof k8cData[fnum].Events !== 'undefined') {
        let evts = k8cData[fnum].Events;
        let hl = evts.length;
        let bgColor;
        if (hl > 0) {
            let msg;
            let evtHtml = '<div class="events">' +
                '<div class="mb-2"><button type="button" class="btn btn-primary btn-sm vpkButtons px-2" ' +
                'onclick="timelineForUid(\'' +
                k8cData[fnum].uid +
                "','" +
                k8cData[fnum].namespace +
                "','" +
                fnum +
                '\')">View Event(s) timeline' +
                '</button></div>' +
                '<table style="width:100%">' +
                '<tr class="eventsList text-center" ><th>Type</th><th>Reason</th><th>Object (kind / name)</th>' +
                '<th>Message</th><th>Occurences</th></tr>';
            for (let e = 0; e < hl; e++) {
                if (evts[e].type.startsWith('Fail')) {
                    bgColor = ' style="background-color: red; color: white;"';
                }
                else if (evts[e].type.startsWith('Warn')) {
                    bgColor = ' style="background-color: yellow; color: grey;"';
                }
                else if (evts[e].type.startsWith('Norm')) {
                    bgColor = ' style="background-color: green; color: white;"';
                }
                else {
                    bgColor = '';
                }
                msg =
                    '<tr class="mb-0 mt-0">' +
                        '<td width="5%"><hr class="mb-0 mt-0"></td>' +
                        '<td width="10%"><hr class="mb-0 mt-0"></td>' +
                        '<td width="20%"><hr class="mb-0 mt-0"></td>' +
                        '<td width="45%"><hr class="mb-0 mt-0"></td>' +
                        '<td width="20%"><hr class="mb-0 mt-0"></td></tr>' +
                        '<tr>' +
                        '<td width="5%"  class="vpkfont-sm text-center"  onclick="getDefFnum(\'' +
                        evts[e].fnum +
                        '\')"' +
                        bgColor +
                        '>' +
                        evts[e].type +
                        '</td>' +
                        '<td width="10%" class="vpkfont-sm pl-1 text-center" onclick="getDefFnum(\'' +
                        evts[e].fnum +
                        '\')">' +
                        evts[e].reason +
                        '</td>' +
                        '<td width="20%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' +
                        evts[e].fnum +
                        '\')">' +
                        evts[e].involvedKind +
                        ' / ' +
                        evts[e].involvedName +
                        '</td>' +
                        '<td width="45%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' +
                        evts[e].fnum +
                        '\')">' +
                        evts[e].message +
                        '</td>' +
                        '<td width="20%" class="vpkfont-sm pl-1" onclick="getDefFnum(\'' +
                        evts[e].fnum +
                        '\')">' +
                        '<b>Occurence count:</b> ' +
                        evts[e].count +
                        '<br>' +
                        '<b>First:</b> ' +
                        formatDate(evts[e].firstTime) +
                        '<br>' +
                        '<b>Last:</b>&nbsp;' +
                        formatDate(evts[e].lastTime) +
                        '</td></tr>';
                evtHtml = evtHtml + msg;
                evts[e].used = true;
            }
            k8cData[fnum].Events = evts;
            evtHtml = evtHtml + '</table></div>';
            if (typeof vpk.workloadEventsInfo[fnum] === 'undefined') {
                vpk.workloadEventsInfo[fnum] = evtHtml;
            }
            else {
                vpk.workloadEventsInfo[fnum] = evtHtml;
            }
        }
        // show the events icon if there are events
        if (hl > 0) {
            let evtMsg = '' + hl + ' events';
            let evtBtn = '<rect  x="200" y="90" width="75" height="75" rx="5" stroke-dasharray="1, 2" ' +
                ' stroke-width="1"  stroke="black" fill="#c5a3ff"/>' +
                '<text x="241" y="102" class="pickIcon">Events</text>' +
                '<image x="218"  y="105" width="45"  height="45" href="images/k8/evt.svg" onmousemove="showVpkTooltip(evt, \'' +
                buildSvgInfo(evtMsg, fnum, 'Events') +
                '\');" onmouseout="hideVpkTooltip()"  onclick="getEvtsTable(\'' +
                fnum +
                '\')" />';
            html = html + evtBtn;
        }
    }
}
