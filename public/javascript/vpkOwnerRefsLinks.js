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

//----------------------------------------------------------
// build svg data for ownerRef links
//----------------------------------------------------------
function initOwnerRefLinksVars() {
    oldBreak = '@';
    first = true;
    sortBy1 = 'Kind';
    sortBy2 = 'Namespace';
    ownerRefCnt = 0;
    ownCnt = 0;
    ownBreak;
    ownerCollapseIDs = [];
    ownerBreakID = 0;
}

function buildOwnerRefLinks() {
    initOwnerRefLinksVars();
    // get the selected sort keys;
    let tmp;
    tmp = $('#ownerSort1').select2('data');
    sortBy1 = tmp[0].text;
    if (sortBy1 === '') {
        sortBy1 = 'Kind';
    }
    tmp = $('#ownerSort2').select2('data');
    sortBy2 = tmp[0].text;
    if (sortBy2 === '') {
        sortBy2 = 'Namespace';
    }
    // sort by kind 
    if (sortBy1 === 'Kind') {
        if (sortBy2 === 'Namespace') {
            ownerRefLinks.sort((a, b) => (a.o1Kind > b.o1Kind) ? 1 : (a.o1Kind === b.o1Kind) ? ((a.o1NS > b.o1NS) ? 1 : -1) : -1);
        }
        if (sortBy2 === 'Levels') {
            ownerRefLinks.sort((a, b) => (a.o1Kind > b.o1Kind) ? 1 : (a.o1Kind === b.o1Kind) ? ((a.oLvl > b.oLvl) ? 1 : -1) : -1);
        }
    }
    // sort by namespace 
    if (sortBy1 === 'Namespace') {
        if (sortBy2 === 'Kind') {
            ownerRefLinks.sort((a, b) => (a.o1NS > b.o1NS) ? 1 : (a.o1NS === b.o1NS) ? ((a.o1Kind > b.o1Kind) ? 1 : -1) : -1);
        }
        if (sortBy2 === 'Levels') {
            ownerRefLinks.sort((a, b) => (a.o1NS > b.o1NS) ? 1 : (a.o1NS === b.o1NS) ? ((a.oLvl > b.oLvl) ? 1 : -1) : -1);
        }
    }
    // sort by levels
    if (sortBy1 === 'Levels') {
        if (sortBy2 === 'Namespace') {
            ownerRefLinks.sort((a, b) => (a.oLvl > b.oLvl) ? 1 : (a.oLvl === b.oLvl) ? ((a.o1NS > b.o1NS) ? 1 : -1) : -1);
        }
        if (sortBy2 === 'Kind') {
            ownerRefLinks.sort((a, b) => (a.oLvl > b.oLvl) ? 1 : (a.oLvl === b.oLvl) ? ((a.o1Kind > b.o1Kind) ? 1 : -1) : -1);
        }
    }

    //Build the SVG ownerRefLinks SVG
    let html = buildOwnerRefSVG();
    //If no images were built display message to inform user
    if (ownCnt === 0) {
        html = '<div class="vpkfont vpkcolor"><br><p>No ownerRef links located for the selected snapshot</p></div>'
    }
    //Update the browser DOM
    $("#ownerRefLinksDetail").html(html);
    $("#ownerRefLinksDetail").show();

}

function buildOwnerRefSVG() {
    let keys = Object.keys(ownerRefLinks);
    let grpBreak = false;
    let rdata = '';
    let breakData = '';
    let breakKey = '';
    let ownerInfo;
    let ownerData;
    // process data 
    for (let k = 0; k < keys.length; k++) {
        ownCnt++;
        ownerData = ownerRefLinks[keys[k]];
        grpBreak = false;
        //check for break in grouping of data
        if (sortBy1 === 'Kind') {
            if (ownerData.o1Kind !== oldBreak) {
                grpBreak = true;
                oldBreak = ownerData.o1Kind;
                breakKey = 'Kind - ' + ownerData.o1Kind;
            }
        } else if (sortBy1 === 'Namespace') {
            if (ownerData.o1NS !== oldBreak) {
                grpBreak = true;
                oldBreak = ownerData.o1NS;
                breakKey = 'Namespace - ' + ownerData.o1NS;
            }
        } else if (sortBy1 === 'Levels') {
            if (ownerData.oLvl !== oldBreak) {
                grpBreak = true;
                oldBreak = ownerData.oLvl;
                breakKey = 'Level - ' + ownerData.oLvl;
            }
        }

        if (grpBreak === true) {
            ownBreakID++;
            if (first) {
                first = false;
                rdata = rdata + '<span class="breakBar vpkcolor mt-2 ml-5">'
                    + 'Press the buttons below to view the ownerRef links for the shown grouping'
                    + '<span class="ml-4"><button type="button" class="btn btn-outline-primary btn-sm vpkButtons pr-4 pl-4"'
                    + ' onclick="openAll(\'ownref-\')">Open all</button></span>'
                    + '<span class="ml-4"><button type="button" class="btn btn-outline-primary btn-sm vpkButtons pr-4 pl-4"'
                    + ' onclick="closeAll(\'ownref-\')">Close all</button></span>'
                    + '<hr class="mt-1"><span>'

            } else {
                rdata = rdata + '</div>'
            }
            // output the break bar
            breakData =
                '<div class="breakBar"><button type="button" '
                + ' class="btn btn-primary btn-sm vpkButtons pl-4 pr-4" data-toggle="collapse" data-target="#ownref-'
                + ownBreakID + '">' + breakKey + '</button>'
                + '<hr></div>'
                + '<div id="ownref-' + ownBreakID + '" class="collapse">';

            // print button
            breakData = breakData + '<div class="header-right">'
                + '<a href="javascript:printDiv(\'ownref-' + ownBreakID + '\')">'
                + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                + '</a>'
                + '</div>';

            ownerCollapseIDs.push(ownBreakID);
            rdata = rdata + breakData;
        }
        ownerInfo = processOwnerRefs(ownerData);
        rdata = rdata + ownerInfo;
    }
    rdata = rdata + '</div>'
    return rdata
}

function processOwnerRefs(data) {
    let rtn = '';
    let item1;
    let image1;
    let item2;
    let image2;
    let item3;
    let image3;
    let item4;
    let image4;
    let item5;
    let image5;
    let recWidth = 420;
    let rect1a = '<svg width="';
    let rect1b = '" height="65"><rect x="5" y="0" width="'
    let rect1c = '" height="60" rx="5" stroke-dasharray="1, 2" stroke-width="1" stroke="black" fill="#fff"/>';

    // ownerRef data
    if (typeof data.o1Kind !== 'undefined') {
        image1 = checkImage(data.o1Kind, data.o1API);
        item1 = { 'kind': data.o1Kind, 'name': data.o1Name, 'ns': data.o1NS };
        rtn = rtn
            + '<image x="10"  y="10" width="40"  height="40" href="images/' + image1 + '" onmousemove="showOwnerRefTooltip(evt, \''
            + buildOwnerSvgInfo(item1)
            + '\');" onmouseout="hideOwnerRefTooltip()"  onclick="getDefFnum(\'' + data.o1Fnum + '\')"/>'
            + '<text x="50" y="55" fill="black" font-weight="">' + data.o1Kind + '</text>';
    }

    // Level 2 data
    if (typeof data.o2Name !== 'undefined') {
        recWidth = 420;
        rtn = rtn
            + '<line  x1="50" x2="210" y1="30" y2="30" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="50" x2="55"  y1="30" y2="35" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="50" x2="55"  y1="30" y2="25" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>';
        image2 = checkImage(data.o2Kind, data.o2API);
        item2 = { 'kind': data.o2Kind, 'name': data.o2Name, 'ns': data.o2NS };
        rtn = rtn
            + '<image x="210"  y="10" width="40"  height="40" href="images/' + image2 + '" onmousemove="showOwnerRefTooltip(evt, \''
            + buildOwnerSvgInfo(item2)
            + '\');" onmouseout="hideOwnerRefTooltip()"  onclick="getDefFnum(\'' + data.o2Fnum + '\')"/>'
            + '<text x="250" y="55" fill="black" font-weight="">' + data.o2Kind + '</text>';

    } else {
        rtn = rtn
            + '<line  x1="50" x2="210" y1="30" y2="30" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="50" x2="55"  y1="30" y2="35" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="50" x2="55"  y1="30" y2="25" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>';
        image2 = checkImage(data.o2Kind, data.o2API);
        item2 = { 'kind': data.o2Kind, 'name': 'Information not available', 'ns': 'Information not available' };
        rtn = rtn
            + '<image x="210"  y="10" width="40"  height="40" href="images/' + image2 + '" onmousemove="showOwnerRefTooltip(evt, \''
            + buildOwnerSvgInfo(item2)
            + '\');" onmouseout="hideOwnerRefTooltip()"  onclick="getDefFnum(\'' + 'missing' + '\')"/>'
            + '<text x="250" y="55" fill="black" font-weight="">' + data.o2Kind + '</text>';
    }

    // Level 3 data
    if (typeof data.o3Kind !== 'undefined') {
        recWidth = 630;
        rtn = rtn
            + '<line  x1="250" x2="410" y1="30" y2="30" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="250" x2="255" y1="30" y2="35" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="250" x2="255" y1="30" y2="25" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>';

        image3 = checkImage(data.o3Kind, data.o3API);
        item3 = { 'kind': data.o3Kind, 'name': data.o3Name, 'ns': data.o3NS };
        rtn = rtn
            + '<image x="410"  y="10" width="40"  height="40" href="images/' + image3 + '" onmousemove="showOwnerRefTooltip(evt, \''
            + buildOwnerSvgInfo(item3)
            + '\');" onmouseout="hideOwnerRefTooltip()"  onclick="getDefFnum(\'' + data.o3Fnum + '\')"/>'
            + '<text x="450" y="55" fill="black" font-weight="">' + data.o3Kind + '</text>';
    }

    // Level 4 data
    if (typeof data.o4Kind !== 'undefined') {
        recWidth = 840;
        rtn = rtn
            + '<line  x1="450" x2="610" y1="30" y2="30" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="450" x2="455" y1="30" y2="35" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="450" x2="455" y1="30" y2="25" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>';

        image4 = checkImage(data.o4Kind, data.o4API);
        item4 = { 'kind': data.o4Kind, 'name': data.o4Name, 'ns': data.o4NS };
        rtn = rtn
            + '<image x="610"  y="10" width="40"  height="40" href="images/' + image4 + '" onmousemove="showOwnerRefTooltip(evt, \''
            + buildOwnerSvgInfo(item4)
            + '\');" onmouseout="hideOwnerRefTooltip()"  onclick="getDefFnum(\'' + data.o4Fnum + '\')"/>'
            + '<text x="650" y="55" fill="black" font-weight="">' + data.o4Kind + '</text>';
    }

    // Level 5 data
    if (typeof data.o5Kind !== 'undefined') {
        recWidth = 1060;
        rtn = rtn
            + '<line  x1="650" x2="810" y1="30" y2="30" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="650" x2="655" y1="30" y2="35" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>'
            + '<line  x1="650" x2="655" y1="30" y2="25" stroke="red" stroke-width="1" stroke-linecap="round" stroke-dasharray="3, 3"/>';

        image5 = checkImage(data.o5Kind, data.o5API);
        item5 = { 'kind': data.o5Kind, 'name': data.o5Name, 'ns': data.o5NS };
        rtn = rtn
            + '<image x="810"  y="10" width="40"  height="40" href="images/' + image5 + '" onmousemove="showOwnerRefTooltip(evt, \''
            + buildOwnerSvgInfo(item5)
            + '\');" onmouseout="hideOwnerRefTooltip()"  onclick="getDefFnum(\'' + data.o5Fnum + '\')"/>'
            + '<text x="850" y="45" fill="black" font-weight="">' + data.o5Kind + '</text>';
    }




    let tw = recWidth + 10;
    rtn = rect1a + tw + rect1b + recWidth + rect1c + rtn + '</svg><br>'
    return rtn;

}

//----------------------------------------------------------
console.log('loaded vpkOwnerRefsLinks.js');
