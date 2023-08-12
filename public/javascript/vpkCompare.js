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
// build data for cluster tab
//----------------------------------------------------------
let getSnapFile1Name;
let getSnapFile2Name;
let compFile1Content;
let compFile2Content;
let newSnap1;
let newSnap2;

// replace a single back-slash with double back-slashes to support Windows opsys file names
function doubleSlash(fname) {
    let nVal = '';
    for (let i = 0; i < fname.length; i++) {
        if (fname.substring(i, i + 1) === '\\') {
            nVal = nVal + fname.substring(i, i) + '\\\\'
        } else {
            nVal = nVal + fname.substring(i, i + 1);
        }
    }
    return nVal;
}

function buildCompareResults(data, snap1, snap2) {
    console.log('Compare results started')
    let sortKey;
    let tmp;

    if (typeof data.result === 'undefined') {
        //TODO add error message to UI
        return;
    }

    tmp = $('#compareSort1').select2('data');
    let compSortBy1 = tmp[0].text;
    if (compSortBy1 === '') {
        compSortBy1 = 'Namespace';
    }
    tmp = $('#compareSort2').select2('data');
    let compSortBy2 = tmp[0].text;
    if (compSortBy2 === '') {
        compSortBy2 = 'Name';
    }

    sortKey = setSortOrder(compSortBy1, compSortBy2);
    console.log('Compare sort keys: ' + compSortBy1 + ', and ' + compSortBy2)
    tmp = $('#compareView').select2('data');
    let compView = tmp[0].text;
    if (compView === '') {
        compView = 'All';   // All, Matching, Non-matching
    }

    console.log('Compare Sort Order: ' + compSortBy1 + ' & ' + compSortBy2 + ' with View Results: ' + compView)

    data = data.result.resources;

    let html = '<div class="events"><table style="width:100%">';
    let hS = '<tr class="partsList centerText">';
    let hNs = '<th class="pt-1 pb-1 pr-1 pl-5">Namespace</th>';
    let hNa = '<th class="pt-1 pb-1 pr-1 pl-5">Name</th>';
    let hKi = '<th colspan="2" class="pt-1 pb-1 pr-1 pl-5">Kind</th>';
    let hFlags = '<th>Snapshot</th><th>CreateTime</th><th>Spec Match</th>';
    let hE = '</tr>';
    let ic1 = '<img class="pl-2" style="vertical-align:middle;" src="images/';
    let ic2 = '" width="25" height="25" onclick="getExplain(\'';
    let ic3 = '\',\'';
    let ic4 = '\')">&nbsp;';
    let getS1 = '<td><span onclick="getSnapFile(\'';
    let getS2 = '\',\'';
    let getS3 = '\')">&nbsp;';
    let getS4 = '</td>';
    let sTd = '<td>';
    let sTd2 = '<td class="paleRed">';
    let sTdx = '<td ';
    let eTd = '</td>';
    let sTr = '<tr class="border_bottom">';
    let eTR = '</tr>';
    let paleG = 'class="paleGreen pl-1 pr-1">';
    let paleR = 'class="paleRed pl-1 pr-1">';
    let eSpan = '';
    let spY = '&nbsp;Y&nbsp;';
    let spN = '&nbsp;N&nbsp;';
    let sp1Only = '&nbsp;Snap 1 Only&nbsp;';
    let sp2Only = '&nbsp;Snap 2 Only&nbsp;';
    let spBoth = '&nbsp;Both&nbsp;';
    let newK = [];

    let hl;
    let k;
    let kind;
    let api;
    let image;
    let item;
    let keys;
    let key;
    let ns;
    let fn1;
    let fn2;
    let icon;
    let name;
    let kindOut;
    let flags;
    let pKs;

    // set header for table;
    if (sortKey === 'Namespace.Name.Kind') {
        html = html + hS + hNs + hNa + hKi + hFlags + hE;
    } else if (sortKey === 'Namespace.Kind.Name') {
        html = html + hS + hNs + hKi + hNa + hFlags + hE;
    } else if (sortKey === 'Name.Kind.Namespace') {
        html = html + hS + hNa + hKi + hNs + hFlags + hE;
    } else if (sortKey === 'Name.Namespace.Kind') {
        html = html + hS + hNa + hNs + hKi + hFlags + hE;
    } else if (sortKey === 'Kind.Name.Namespace') {
        html = html + hS + hKi + hNa + hNs + hFlags + hE;
    } else if (sortKey === 'Kind.Namespace.Name') {
        html = html + hS + hKi + hNs + hNa + hFlags + hE;
    }

    // get keys from object, build sort keys, and sort
    keys = Object.keys(data);

    console.log('Number of compare keys: ' + keys.length);

    if (sortKey !== 'Namespace.Name.Kind') {
        for (let n = 0; n < keys.length; n++) {
            key = keys[n];
            if (typeof key !== 'undefined') {
                pKs = key.split(':@:');
                if (pKs.length === 3) {
                    if (sortKey === 'Namespace.Kind.Name') {
                        tmp = pKs[0] + ':@:' + pKs[2] + ':@:' + pKs[1];
                    } else if (sortKey === 'Name.Kind.Namespace') {
                        tmp = pKs[1] + ':@:' + pKs[2] + ':@:' + pKs[0];
                    } else if (sortKey === 'Name.Namespace.Kind') {
                        tmp = pKs[1] + ':@:' + pKs[0] + ':@:' + pKs[2];
                    } else if (sortKey === 'Kind.Name.Namespace') {
                        tmp = pKs[2] + ':@:' + pKs[1] + ':@:' + pKs[0];
                    } else if (sortKey === 'Kind.Namespace.Name') {
                        tmp = pKs[2] + ':@:' + pKs[0] + ':@:' + pKs[1];
                    }
                    newK.push(tmp);
                } else {
                    console.log('Compare did not find 3-part key: ' + key)
                }
            }
        }
        keys = newK;
    }

    // sort keys to selected sortKey
    keys.sort();

    console.log('Keys sorted');

    newK = [];

    if (sortKey !== 'Namespace.Name.Kind') {
        for (let y = 0; y < keys.length; y++) {
            key = keys[y];
            pKs = key.split(':@:');
            if (sortKey === 'Namespace.Kind.Name') {
                tmp = pKs[0] + ':@:' + pKs[2] + ':@:' + pKs[1];
            } else if (sortKey === 'Name.Kind.Namespace') {
                tmp = pKs[2] + ':@:' + pKs[0] + ':@:' + pKs[1];
            } else if (sortKey === 'Name.Namespace.Kind') {
                tmp = pKs[1] + ':@:' + pKs[0] + ':@:' + pKs[2];
            } else if (sortKey === 'Kind.Name.Namespace') {
                tmp = pKs[2] + ':@:' + pKs[1] + ':@:' + pKs[0];
            } else if (sortKey === 'Kind.Namespace.Name') {
                tmp = pKs[1] + ':@:' + pKs[2] + ':@:' + pKs[0];
            }
            newK.push(tmp);
        }
        keys = newK;
    }

    hl = keys.length;


    try {

        console.log('Platform: ' + navigator.userAgent);
        // check if Windows opsys, if so change snap1 and snap2 to support Windows file names
        if (navigator.userAgent.indexOf("Win") != -1) {
            console.log('Windows OS detected');
            newSnap1 = doubleSlash(snap1)
            console.log('New snap1: ' + newSnap1);
            newSnap2 = doubleSlash(snap2)
            console.log('New snap2: ' + newSnap2);
        };

        if (hl > 0) {
            for (k = 0; k < hl; k++) {
                key = keys[k];
                if (data[key] !== null) {
                    // build output parts
                    item = '';
                    kind = data[key].kind
                    api = data[key].api
                    image = checkImage(kind, api);

                    // if window opsys set build name of file with double back-slashes, thus needing four slashes
                    if (navigator.userAgent.indexOf("Win") != -1) {
                        fn1 = newSnap1 + '\\\\' + data[key].fn1;
                        fn2 = newSnap2 + '\\\\' + data[key].fn2;
                    } else {
                        fn1 = snap1 + '/' + data[key].fn1;
                        fn2 = snap2 + '/' + data[key].fn2;
                    }

                    // build output elements
                    icon = '<td>' + ic1 + image + ic2 + kind + ic3 + api + ic4 + '</td>';
                    // remove '@' from ns if @clusterLevel
                    if (data[key].ns === '@clusterLevel') {
                        ns = getS1 + fn1 + getS2 + fn2 + getS3 + 'clusterLevel' + getS4;
                    } else {
                        ns = getS1 + fn1 + getS2 + fn2 + getS3 + data[key].ns + getS4;
                    }
                    name = getS1 + fn1 + getS2 + fn2 + getS3 + data[key].name + getS4;
                    kindOut = icon + sTd + data[key].kind + eTd;

                    flags = '';
                    match = true
                    // build name flag
                    if (data[key].fn1 === 'ndf') {
                        flags = flags + sTdx + paleR + sp2Only + eSpan + eTd;
                        match = false;
                    } else if (data[key].fn2 === 'ndf') {
                        flags = flags + sTdx + paleR + sp1Only + eSpan + eTd;
                        match = false;
                    } else {
                        flags = flags + sTdx + paleG + spBoth + eSpan + eTd;
                    }

                    // build time flag
                    if (data[key].timeOK === true) {
                        flags = flags + sTdx + paleG + spY + eSpan + eTd;
                    } else {
                        flags = flags + sTdx + paleR + spN + eSpan + eTd;
                        match = false;
                    }

                    // build spec flag
                    if (data[key].specOK === true) {
                        flags = flags + sTdx + paleG + spY + eSpan + eTd;
                    } else {
                        flags = flags + sTdx + paleR + spN + eSpan + eTd;
                        match = false;
                    }

                    if (sortKey === 'Namespace.Name.Kind') {
                        item = sTr + ns + name + kindOut + flags + eTR;
                    } else if (sortKey === 'Namespace.Kind.Name') {
                        item = sTr + ns + kindOut + name + flags + eTR;
                    } else if (sortKey === 'Name.Kind.Namespace') {
                        item = sTr + name + kindOut + ns + flags + eTR;
                    } else if (sortKey === 'Name.Namespace.Kind') {
                        item = sTr + name + ns + kindOut + flags + eTR;
                    } else if (sortKey === 'Kind.Name.Namespace') {
                        item = sTr + kindOut + name + ns + flags + eTR;
                    } else if (sortKey === 'Kind.Namespace.Name') {
                        item = sTr + kindOut + ns + name + flags + eTR;
                    }

                    // Outpur based on compView    
                    if (compView === 'All') {
                        html = html + item;
                    } else if (compView === 'Matching' && match === true) {
                        html = html + item;
                    } else if (compView === 'Non-matching' && match === false) {
                        html = html + item;
                    }
                } else {
                    console.log('Record key: ' + key + ' is null')
                }
            }
        }
        html = html + '</table></div>';
        $("#compareDetail").html(html);
    } catch (err) {
        console.log('Compare table build error, message: ' + err);
        console.log('Stack: ' + err.stack);
        console.log('Record key: ' + key)
        console.log(JSON.stringify(data[key], null, 4));
    }
    //return html;
}

function setSortOrder(s1, s2) {
    let ns = 'Namespace';
    let na = 'Name';
    let ki = 'Kind';

    if (s1 === s2) {
        return ns + '.' + na + '.' + ki;
    }

    if (s1 === ns && s2 === na) {
        return ns + '.' + na + '.' + ki;
    } else if (s1 === ns && s2 === ki) {
        return ns + '.' + ki + '.' + na;
    } else if (s1 === na && s2 === ns) {
        return na + '.' + ns + '.' + ki;
    } else if (s1 === na && s2 === ki) {
        return na + '.' + ki + '.' + ns;
    } else if (s1 === ki && s2 === ns) {
        return ki + '.' + ns + '.' + na;
    } else if (s1 === ki && s2 === na) {
        return ki + '.' + na + '.' + ns;
    }
}


function getSnapFile(fn1, fn2) {
    console.log('Snap1 file: ' + fn1);
    console.log('Snap2 file: ' + fn2);

    compFile1Content = null;
    compFile2Content = null;
    getSnapFile1Name = fn1;
    getSnapFile2Name = fn2;
    // Get first file
    getCompareFile(getSnapFile1Name, '1');
}

function getCompareFile2(which) {
    getCompareFile(getSnapFile2Name, '2');
}

//----------------------------------------------------------
console.log('loaded vpkCompare.js');
