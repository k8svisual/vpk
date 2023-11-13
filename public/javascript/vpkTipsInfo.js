/*
Copyright (c) 2018-2023 k8sVisual

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
    let yAdj = 80;
    if (typeof svgInfo[key] !== 'undefined') {
        info = svgInfo[key]
    }

    if (key === '0000.RBAC Security') {
        info = '<span style="font-size: 0.80rem; text-decoration: underline;">Security</span><br><span style="font-size: 0.70rem;">RBAC security graph</span>';
    }

    // Set the text of the tooltip
    tooltip.innerHTML = info;

    let pageY = evt.pageY;
    let offTop = $("#schematicDetail").offset().top;
    let tipX = evt.pageX + 5;
    // adjust for fixed portion of page
    if (offTop < 0) {
        offTop = offTop * -1;
        offTop = offTop + 200;
    } else {
        offTop = 199 - offTop;
    }

    let tipY = offTop + pageY;
    tipY = tipY - yAdj;

    // Adjust for the scrollable area
    const scrollableSection = document.getElementById('schematicDetail');
    const rect = scrollableSection.getBoundingClientRect();
    if (rect.top < 1) {
        tipY = tipY + rect.top
        tipY = tipY - (yAdj + 40);
    }

    tooltip.style.display = "block";
    tooltip.style.left = tipX + 'px';
    tooltip.style.top = tipY + 'px';

}

function hideOwnerRefTooltip() {
    hideVpkTooltip();
}

function hideVpkTooltip() {
    var tooltip = document.getElementById("tooltip");
    tooltip.style.display = "none";
}

function showMessage(msg, level) {
    level = 'docBackground'
    let txt = '<div class="text-center mt-3 mb-3 ml-2 mr-2 ' + level + '">' + msg + '</div>';
    $('#messageBody').html(txt);
    $("#messageModal").modal('show');
}

function hideMessage() {
    $("#messageModal").modal('hide');
}

function hideMessage2() {
    $('#messageText').html('');
    $('#messageDiv').removeClass('show');
    $('#messageDiv').addClass('hide');
}



//----------------------------------------------------------
console.log('loaded vpkTipsInfo.js');
