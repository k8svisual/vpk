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
// document ready
//----------------------------------------------------------

let svg;


// Allow window to listen for a message
window.addEventListener("message", (event) => {
    svg = event.data.svg;
    // modify the svg to access the images directory
    svg = svg.replace(/images\//g, "../images/");
    // load the popup text into memory var
    svgInfo = event.data.tips;
    // modify the html and show the svg
    document.getElementById("schematicData").innerHTML = svg;
});

document.addEventListener("DOMContentLoaded", () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const startCnt = urlParams.get('cnt');
    sendMsgToParent(`ready`)
    let px = 40;
    let element = document.getElementById("banner")
    element.style['height'] = px + "px";
    element = document.getElementById("viewarea")
    px++;
    element.style['top'] = px + "px";
    element.style['display'] = "block";
    // 
    editor = ace.edit("editor");
});

function sendMsgToParent(msg) {
    window.opener.postMessage(msg);
}

function closeChild() {
    try {
        window.close();
    } catch (e) { console.log(e) }
    try {
        self.close();
    } catch (e) { console.log(e) }
}

function showVpkTooltip(evt, text) {
    let tooltip = document.getElementById("tooltip");
    let info = 'No information available';
    if (typeof svgInfo[text] !== 'undefined') {
        info = svgInfo[text]
    }

    let pageY = evt.pageY;
    let offTop = $("#schematicData").offset().top;
    let tipX = evt.pageX + 45;
    // adjust for fixed portion of page
    if (offTop < 0) {
        offTop = offTop * -1;
        offTop = offTop + 150;
    } else {
        offTop = 149 - offTop;
    }

    let tipY = offTop + pageY;
    tipY = tipY - 149;

    //-----------------------
    tooltip.innerHTML = info;
    tooltip.style.display = "block";
    tooltip.style.left = tipX + 'px';
    tooltip.style.top = tipY + 'px';
}

function hideVpkTooltip() {
    var tooltip = document.getElementById("tooltip");
    tooltip.style.display = "none";
}

// function getDefFnum(data) {
//     if (data === 'missing') {
//         $("#yamlModal").modal('show');
//         return;
//     }
//     selectedDef = data;
//     editObj();
// }

function showSecGraph(ns) {
    return;
}


//----------------------------------------------------------
console.log('loaded vpkMain.js');
