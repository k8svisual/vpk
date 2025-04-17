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
// WORKLOAD SCHEMATICS tab processing
//----------------------------------------------------------

// Schematic related variables
let collapseNamespaces = {};
let schematicKeys = {};
let schematicWKeys = [];
let schematicCheckedRows = [];
let schematicData;
let schematicDataOrig;
let schematicOneDiv = false;
let singleSchematicData = '';
let schematicClusterView = false;
let svgWhere = '';

//----------------------------------------------------------
/* 
    Called from Properties button push to display schematic for 
    the selected Pod in the 3d view.
*/
function showSchematic(ns, podId, where) {
    returnWhere = where;
    schematicClusterView = true;
    schematicWKeys = [];

    schematicWKeys.push({
        state: '',
        ns: ns,
        pod: 'Cluster view pod',
        id: '0',
    });

    // build the Workload Schematic filter table
    $('#tableWS').bootstrapTable('load', schematicWKeys);
    $('#tableWS').bootstrapTable('hideColumn', 'id');

    openTabSchecmatics();
    getSchematic(ns, podId);
}

function openTabSchecmatics() {
    $('[href="#schematic"]').tab('show');
}

function applySchematicFilter() {
    $('#schematicFilterModal').modal('hide');
    formatFilterSVG();
}

function schematicFilterShow() {
    $('#schematicFilterModal').modal('show');
}

// Build and send the WebSocket request to the server
function getSchematic(ns, pod) {
    if (ns !== null && typeof ns !== 'undefined') {
        svgWhere = pod;
        schematicClusterView = true;
    } else {
        svgWhere = '';
        schematicClusterView = false;
    }

    let namespaces = '';
    if (svgWhere === '') {
        let tmp;
        /* 
            Get the namespaces that have been selected in the drop down
            field in the UI.
        */
        let selected = $('#schematic-ns-filter').select2('data');
        for (var i = 0; i < selected.length; i++) {
            tmp = selected[i].text;
            tmp = tmp.trim();
            if (tmp.length === 0) {
                namespaces = namespaces + ':all-namespaces';
            } else {
                namespaces = namespaces + ':' + tmp;
            }
        }
        if (namespaces === '') {
            namespaces = ':all-namespaces:';
        }
    } else {
        namespaces = ':' + ns;
    }
    socket.emit('getSchematicSvg', namespaces);
}

//---------------------------------------------------
// Handle the WebSocket respaonse
socket.on('schematicGetSvgResult', function (data) {
    // Reset variables and save the data
    // so it can be used in flitering

    schematicKeys = {};
    schematicWKeys = [];
    schematicCheckedRows = [];

    schematicData = data.data;
    //schematicDataOrig = data.data;

    if (svgWhere === '') {
        schematicClusterView = false;
        let html = formatSchematicSVG(data);
        // Build the filter modal table and html
        buildSchematicFilterTable(data);

        $('#schematicDetail').html(html);

        // un-collaspe if there is only one div
        if (schematicOneDiv === true) {
            $('#collid-1').collapse('show');
        }
    } else {
        schematicClusterView = true;
        singleSchematicData = formatSingleSVG(data.data, svgWhere);
        $('#schematicDetail').html(singleSchematicData);
    }
});

// Build the UI html using the returned data
function formatSchematicSVG(data) {
    if (schematicClusterView === true) {
        return;
    }
    let newData = data.data;
    let nsKeys = Object.keys(newData);
    let podKeys;
    let html = '';
    let podsFound;
    let collNum = 0;

    for (let i = 0; i < nsKeys.length; i++) {
        podsFound = false;
        podKeys = Object.keys(newData[nsKeys[i]]);
        for (let p = 0; p < podKeys.length; p++) {
            if (podKeys[p] === 'NoPod') {
                html = html + newData[nsKeys[i]][podKeys[p]];
                continue;
            } else {
                podsFound = true;
                collNum++;
                if (p === 0) {
                    html =
                        html +
                        '<div class="breakBar"><button type="button" ' +
                        ' class="btn btn-primary btn-sm vpkButtons pl-4 pr-4" data-toggle="collapse" data-target="#collid-' +
                        collNum +
                        '">' +
                        nsKeys[i] +
                        '</button>' +
                        '<hr></div>' +
                        '<div id="collid-' +
                        collNum +
                        '" class="collapse">' +
                        '<div class="header-right">' +
                        '<a href="javascript:printDiv(\'collid-' +
                        collNum +
                        '\')">' +
                        '<i class="fas fa-print mr-3 vpkblue vpkfont-lg"></i>' +
                        '</a>' +
                        '</div>' +
                        newData[nsKeys[i]][podKeys[p]];
                } else {
                    html = html + newData[nsKeys[i]][podKeys[p]];
                }
            }
        }

        if (podsFound === true) {
            html = html + '</div>';
        }
    }

    // Set flag that indicates the collaspible should be
    // opened if only on namespace
    if (nsKeys.length === 1) {
        schematicOneDiv = true;
    } else {
        schematicOneDiv = false;
    }
    return html;
}

// Build the data that will populate the workload schematic
// filter modal.
function buildSchematicFilterTable(data) {
    schematicWKeys = [];
    let filterData = data.data;
    let nsKeys = Object.keys(filterData);
    let podKeys;

    for (let i = 0; i < nsKeys.length; i++) {
        podKeys = Object.keys(filterData[nsKeys[i]]);
        for (let p = 0; p < podKeys.length; p++) {
            if (podKeys[p] === 'NoPod') {
                continue;
            } else {
                // Search the SVG data and build the workload pod keys
                let psvg = filterData[nsKeys[i]][podKeys[p]];
                let wp = psvg.indexOf('Pod: ');
                if (wp > -1) {
                    let podName = psvg.substring(wp);
                    let ewp = podName.indexOf('</text>');
                    //let wpKey = nsKeys[i] + '::' + podName.substring(5, ewp) + '::' + podKeys[p];
                    schematicWKeys.push({
                        state: '',
                        ns: nsKeys[i],
                        pod: podName.substring(5, ewp),
                        id: podKeys[p],
                    });
                }
                // build the table
                $('#tableWS').bootstrapTable('load', schematicWKeys);
                $('#tableWS').bootstrapTable('hideColumn', 'id');
            }
        }
    }
}

// Build display of requested Workloads via filter modal
function formatFilterSVG() {
    if (schematicClusterView === true) {
        $('#schematicFilterModal').modal('hide');
        return;
    }
    let nsCount = 0;
    let newData2 = {};
    if (schematicCheckedRows.length > 0) {
        let id = '';
        let ns = '';
        for (let i = 0; i < schematicCheckedRows.length; i++) {
            id = schematicCheckedRows[i].id;
            ns = schematicCheckedRows[i].ns;
            if (typeof newData2[ns] === 'undefined') {
                newData2[ns] = {};
                nsCount++;
            }
            let tmp = schematicData[ns][id];
            newData2[ns][id] = tmp;
        }
    }
    let html = formatSchematicSVG({ data: newData2 });
    $('#schematicFilterModal').modal('hide');
    $('#schematicDetail').html(html);

    // upen collaspe if there is only one div
    if (nsCount === 1) {
        schematicOneDiv = true;
        $('#collid-1').collapse('show');
    }
}

// Clear the selected filter setting in the filter UI
// and populate the tab UI with all the returned data
function clearAllSchematicFilters() {
    if (schematicClusterView === true) {
        $('#schematicFilterModal').modal('hide');
        return;
    }
    if (schematicWKeys.length === 0) {
        // No data to process
        return;
    }
    schematicCheckedRows = [];
    for (let i = 0; i < schematicWKeys.length; i++) {
        schematicWKeys[i].state = false;
    }
    let html = formatSchematicSVG({ data: schematicData });
    $('#schematicFilterModal').modal('hide');
    $('#schematicDetail').html(html);

    let countKeys = Object.keys(schematicData);
    if (countKeys.length === 1) {
        schematicOneDiv = true;
        $('#collid-1').collapse('show');
    }
}

// Show a single schematic
function formatSingleSVG(data, pod) {
    schematicClusterView === true;
    schematicOneDiv = true;
    let nsKeys = Object.keys(data);
    let podKeys;

    for (let i = 0; i < nsKeys.length; i++) {
        podKeys = Object.keys(data[nsKeys[i]]);
        for (let p = 0; p < podKeys.length; p++) {
            if (podKeys[p] !== pod) {
                continue;
            } else {
                $('#schematicReturn').html(
                    '<div class="vpkfont vpkblue vpk-rtn-bg mt-1 mb-2 ml-2">' +
                        '<button type="button" class="mt-1 mb-1 btn btn-sm btn-secondary vpkButtons ml-2 px-2" ' +
                        ' onclick="returnToWhereTab(\'' +
                        returnWhere +
                        "','schematicReturn')\">Return</button>" +
                        '<span class="px-1">to</span>' +
                        returnWhere +
                        '<span class="px-1">tab</span>' +
                        '</div>',
                );
                return data[nsKeys[i]][podKeys[p]];
            }
        }
    }
    return '';
}

//----------------------------------------------------------
console.log('loaded vpkTabSchematics.js');
