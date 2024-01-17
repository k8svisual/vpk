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
// Browser usage info on the configuration screen
//----------------------------------------------------------


function getExplain(kind, api) {
    if (typeof kind !== 'undefined') {
        if (typeof explainInfo[kind] !== 'undefined') {
            $("#explainKind").html(explainInfo[kind].kind)
            $("#explainVersion").html(explainInfo[kind].version)
            $("#explainDesc").html(explainInfo[kind].desc)
            $('#explainModal').modal('show');
        } else {
            $("#explainKind").html(kind)
            $("#explainVersion").html('No version information found')
            $("#explainDesc").html('No description information found')
            $('#explainModal').modal('show');
        }
    }
}


function showVpkTooltip(evt, key) {
    let tooltip = document.getElementById("tooltip");
    let info = 'No information available';
    if (typeof svgInfo[key] !== 'undefined') {
        info = svgInfo[key]
    }
    if (key === '0000.RBAC Security') {
        info = '<span style="font-size: 0.80rem; text-decoration: underline;">Security</span><br><span style="font-size: 0.70rem;">RBAC security graph</span>';
    }
    tooltip.innerHTML = info;
    let clientXPos = evt.clientX;
    let clientYPos = evt.clientY;
    let offTop = $("#schematicDetail").offset().top;
    if (offTop < 1) {
        clientYPos = clientYPos + (offTop * -1);
    } else {
        clientYPos = clientYPos - offTop;
    }
    tooltip.style.display = "block";
    tooltip.style.left = clientXPos + 'px';
    tooltip.style.top = clientYPos + 'px';
}




function formatDuration(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${days} days, ${hours} hours, ${minutes} minutes, ${remainingSeconds} seconds`;
}


function showEvtTooltip(event, createTime, firstTime, lastTime, duration, totalDuration, message) {
    let tooltip = document.getElementById("tooltip");
    let clientXPos = event.clientX;
    let clientYPos = event.clientY;
    let offTop = $("#evtSpan").offset().top;
    let info;
    let durTime = '';
    let totalDur = '';

    if (typeof duration === 'undefined' || duration === 'undefined' || duration === null || duration === '') {
        durTime = 'Unknown'
    } else {
        if (duration < 60) {
            durTime = duration + ' seconds'
        } else {
            durTime = formatDuration(duration);
        }
    }

    if (typeof totalDuration === 'undefined' || totalDuration === 'undefined' || totalDuration === null || totalDuration === '') {
        totalDur = 'Unknown'
    } else {
        if (totalDuration < 60) {
            totalDur = totalDuration + ' seconds'
        } else {
            totalDur = formatDuration(totalDuration);
        }
    }

    if (typeof firstTime === 'undefined' || firstTime === 'undefined' || firstTime === null || firstTime === '') {
        firstTime = 'Unknown';
    }
    if (typeof lastTime === 'undefined' || lastTime === 'undefined' || lastTime === null || lastTime === '') {
        lastTime = 'Unknown';
    }
    if (typeof createTime === 'undefined' || createTime === 'undefined' || createTime === null || createTime === '') {
        createTime = 'Unknown';
    }

    info = '<div class="fa-1x pl-2" style="width: 400px;"><table>'
        + '<tr><td><b>Date:</b></td><td><span class="pl-2">' + createTime.substring(0, 10) + ' at ' + createTime.substring(11, 19) + '</span></td></tr>'
        + '<tr><td><b>Duration:</b></td><td><span class="pl-2">' + durTime + '</span></td></tr>'
        + '<tr><td><b>FirstTime:</b></td><td><span class="pl-2">' + firstTime + '</span></td></tr>'
        + '<tr><td><b>LastTime:</b></td><td><span class="pl-2">' + lastTime + '</span></td></tr>'
        + '<tr><td><b>Total Time:</b></td><td><span class="pl-2">' + totalDur + '</span></td></tr>'

        + '</table><hr class="tipLine">'
        + '<span class="pt-2"><b>Message:</b></span><br><span style="word-break: break-word;">' + message
        + '</span></div>'
    tooltip.innerHTML = info;
    if (offTop < 1) {
        clientYPos = clientYPos + (offTop * -1);
    } else {
        clientYPos = clientYPos - offTop;
    }

    clientXPos = clientXPos + 10;
    clientYPos = clientYPos + 20;
    tooltip.style.display = "block";
    tooltip.style.left = clientXPos + 'px';
    tooltip.style.top = clientYPos + 'px';
}

function showEvtDist(event, minute, total) {
    let tooltip = document.getElementById("tooltip");
    let clientXPos = event.clientX;
    let clientYPos = event.clientY;
    let offTop = $("#evtStats").offset().top;
    let info;
    info = '<div class="fa-1x pl-1" style="width: 100px;">'
        + '<span class="pr-2">Minute:</span>' + minute + '<br>'
        + '<span class="pr-2">Count:</span>' + total + '</span>'
        + '</div>'
    tooltip.innerHTML = info;
    if (offTop < 1) {
        clientYPos = clientYPos + (offTop * -1);
    } else {
        clientYPos = clientYPos - offTop;
    }
    clientXPos = clientXPos + 10;
    tooltip.style.display = "block";
    tooltip.style.left = clientXPos + 'px';
    tooltip.style.top = clientYPos + 'px';
}

function showNetworkTooltip(evt, key) {
    let parts = key.split('::');
    let tooltip = document.getElementById("tooltip");
    let info = '';
    let data = networkNodes[parts[0]].pods[parts[1]];
    let img;
    let bgEven = "#ddd";
    let bgOdd = "#fff";
    let bgCurrent = true;
    let bgColor;

    if (typeof data !== 'undefined') {
        info = info + '<div class="fa-1x pl-2" style="width: 675px;">'
            + '<table><tr class="statsHeader mb-2">'
            + '<th colspan="2" style="width: 525px;">Pod information for IP: ' + parts[1] + '</th><th>DaemonSet</th><th>HostNetwork</th></tr>'
        for (let i = 0; i < data.length; i++) {
            if (typeof k8cData[data[i].fnum] !== 'undefined') {

                if (data[i].podStatus === 'Running') {
                    img = 'images/3d/3d-podGreen.png';                   // Running
                } else if (data[i].podStatus === 'Succeeded') {
                    img = 'images/3d/3d-podBlue.png';                    // Complete
                } else {
                    console.log(`showNetworkTooltip() did not handle Pod Status: ${data[i].podStatus}`);
                    img = 'images/3d/3d-podGreen.png';
                }

                if (k8cData[data[i].fnum].daemonSetPod === true) {
                    img = 'images/3d/3d-podGrey.png';
                }

                if (bgCurrent === true) {
                    bgColor = bgEven;
                    bgCurrent = false;
                } else {
                    bgColor = bgOdd;
                    bgCurrent = true;
                }

                info = info + '<tr style="background-color: ' + bgColor + ';">'
                    + '<td style="width: 100px;" class="text-center"><img src="' + img + '" width="20"></td>'
                    + '<td class="pl-2 fa-1x">' + k8cData[data[i].fnum].name + '</td>'
                    + '<td style="width: 75px; height:20px;" class="pl-2 text-center fa-1x">' + k8cData[data[i].fnum].daemonSetPod + '</td>'
                    + '<td style="width: 75px; height:20px;" class="pl-2 text-center fa-1x">' + data[i].hostNetwork + '</td>'
                    + '</tr>'
                    + '<tr style="background-color: ' + bgColor + ';">'
                    + '<td style="font-style: italic; height:20px;" class="text-right fa-1x ">Namespace:</td>'
                    + '<td colspan="3" style="height:20px;" class="pl-2 fa-1x">' + k8cData[data[i].fnum].namespace + '</td></tr>'

                // + '<tr><td>&nbsp;</td><td>&nbsp;</td></tr>'
            }
        }
        info = info + '</table></div>'
    }

    tooltip.innerHTML = info;
    let clientXPos = evt.clientX;
    let clientYPos = evt.clientY;
    let offTop = $("#networkDetail").offset().top;
    if (offTop < 1) {
        clientYPos = clientYPos + (offTop * -1);
    } else {
        clientYPos = clientYPos - offTop;
    }
    tooltip.style.display = "block";
    tooltip.style.left = clientXPos + 'px';
    tooltip.style.top = clientYPos + 'px';
}


function showTooltipMessage(evt, msg, sec) {
    let tooltip = document.getElementById("tooltip");
    tooltip.innerHTML = msg;
    let clientXPos = evt.clientX;
    let clientYPos = evt.clientY;
    let offTop;
    if (sec === 0) {
        offTop = $("#networkNodeDetail").offset().top;
    } else {
        offTop = $("#networkServiceDetail").offset().top;
    }

    if (offTop < 1) {
        clientYPos = clientYPos + (offTop * -1);
    } else {
        clientYPos = clientYPos - offTop;
    }
    tooltip.style.display = "block";
    tooltip.style.left = clientXPos + 'px';
    tooltip.style.top = clientYPos + 'px';
}


function hideOwnerRefTooltip() {
    hideVpkTooltip();
}

function hideVpkTooltip() {
    var tooltip = document.getElementById("tooltip");
    tooltip.style.display = "none";
}

function showMessage(msg, level) {
    let txt = ''
    if (level !== 'processing') {
        txt = '<div class="text-center mt-3 mb-3 ml-2 mr-2 docBackground">' + msg + '</div>';
    } else {
        txt = '<div class="text-center mt-3 mb-3 ml-2 mr-2 docBackground">' + msg + '</div>'
            + '<div class="row text-center mx-auto mt-5">'
            + '<img src="images/loading.gif" width="45" height="45" />'
            + '</div>'
    }
    $('#messageBody').html(txt);
    $("#messageModal").modal('show');
}

function hideMessage() {
    $("#messageModal").modal('hide');
}

//----------------------------------------------------------
console.log('loaded vpkTipsInfo.js');
