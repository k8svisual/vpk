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
// Screen handling code for the Stats tab
//----------------------------------------------------------


//----------------------------------------------------------

let dsCounts = '';                           // dataSource stats kind counts by namespace
let dsToggle = 'kind';                       // Controls what stats are shown
let statsViewType = 'graph'                  // default report type

function openStatsTab() {
    // If the tab is empty populate with treeMap
    if (statsViewType === 'graph') {
        let html = document.getElementById("snapshot_treeMap").innerHTML;
        if (html.trim() === '') {
            dirStats();
        }
    }
}

function statsFilterOpen() {
    $('#statsSlideIn').addClass('open');
}

function statsFilterClose() {
    $('#statsSlideIn').removeClass('open');
}

// What chart is being created and if needed get the selected Namespaces    
function showSnapshotView(type) {
    hideMessage();
    statsViewType = type;
    if (type === 'report') {
        $('#dirStatType').hide();
        $('#statsDirKind').hide();
        $('#statsDirNS').hide();
    }
    // Check if data has bee pulled if not get data
    if (dsCounts === '') {
        dirStats()
    } else {
        createStatsView()
    }
}


function createStatsView() {
    if (statsViewType === 'graph') {
        $('#statsTableSection').hide();
        $('#statsTreeMapSection').show();
        setGraphicView('snapshot')
        if (dsToggle === 'kind' || dsToggle === '') {
            buildKindStats();
        } else {
            buildNamespaceStats();
        }
    } else if (statsViewType === 'report') {
        $('#statsTreeMapSection').hide();
        $('#statsTableSection').show();
        if (dsToggle === 'kind' || dsToggle === '') {
            statsShowReport('Kind')
        } else {
            statsShowReport('Namespace')
        }
    }
}

function buildStatsToggle() {
    if (dsToggle === 'kind') {
        buildNamespaceStats();
        dsToggle = 'ns'
    } else {
        buildKindStats();
        dsToggle = 'kind'
    }
}

function buildStatsTableToggle() {
    if (dsToggle === 'kind') {
        //buildNamespaceStatsTable();
        statsShowReport('Namespace')
        dsToggle = 'ns'
    } else {
        //buildKindStatsTable();
        statsShowReport('Kind')
        dsToggle = 'kind'
    }
}

// Control showing or hiding graphs
function setGraphicView(what) {
    if (what === 'snapshot') {
        $('#dirStatsChart').show();
    } else {
        $('#dirStatsChart').hide();
    }
}

function getSelectedNamespaces() {
    let namespaces = [];
    let tmp;
    let options = $('#stats-ns-filter').select2('data');
    for (var i = 0; i < options.length; i++) {
        tmp = options[i].text;
        tmp = tmp.trim();
        if (tmp.length === 0) {
            namespaces.push('all-namespaces');
            break;
        } else {
            namespaces.push(tmp);
        }
    };
    if (namespaces.length === 0) {
        namespaces.push('all-namespaces');
    }
    return namespaces;
}

function getSelectedKinds() {
    let kinds = [];
    let tmp;
    let options = $('#stats-kind-filter').select2('data');
    for (var i = 0; i < options.length; i++) {
        tmp = options[i].text;
        tmp = tmp.trim();
        if (tmp.length === 0) {
            kinds.push('all-kinds');
            break;
        } else {
            kinds.push(tmp);
        }
    };
    if (kinds.length === 0) {
        kinds.push('all-kinds');
    }
    return kinds;
}

//----------------------------------------------------------
// show server statistics
function dirStats() {
    socket.emit('getDirStats');
}
//...
socket.on('dirStatsResult', function (data) {
    dsCounts = data;
    createStatsView();
});

//... supporting functions
function buildKindStats() {
    if (typeof dsCounts === 'undefined') {
        return;
    }
    if (typeof dsCounts.kind === 'undefined') {
        return;
    }
    dsToggle = 'kind';
    $('#dirStatType').show();
    $('#statsDirKind').show();
    $('#statsDirNS').hide();
    $('#dirStatType').html('Kind(s)');
    data = dsCounts.kind;
    let kinds = getSelectedKinds();
    d3TreeMap(data, kinds);
    $('[href="#stats"]').tab('show');
}

function buildNamespaceStats() {
    if (typeof dsCounts === 'undefined') {
        return;
    }
    if (typeof dsCounts.ns === 'undefined') {
        return;
    }
    dsToggle = 'ns';
    $('#dirStatType').show();
    $('#statsDirKind').hide();
    $('#statsDirNS').show();
    $('#dirStatType').html('Namespace(s)');
    data = dsCounts.ns;
    let namespaces = getSelectedNamespaces();
    d3TreeMap(data, namespaces);
    $('[href="#stats"]').tab('show');
}

function d3TreeMap(data, filter) {
    if (data === null) {
        dirStats();
    }
    let treemapData = [{ 'name': 'Cluster', 'children': [] }];
    let kindKeys = Object.keys(data);
    let kindData;
    let newData = {};
    let fKeys;

    dirStatFilter = '';

    let bottomValue = $("#dirStatMin").val();
    let topValue = $("#dirStatMax").val();
    // Set number boundries
    if (bottomValue.trim() === "") {
        bottomValue = 1;
    } else {
        bottomValue = parseInt(bottomValue);
    }
    if (topValue.trim() === "") {
        topValue = 999999;
    } else {
        topValue = parseInt(topValue);
    }

    if (filter[0] === 'all-namespaces' || filter[0] === 'all-kinds') {
        // Keep existing data
    } else {
        // Loop through data and get selected data
        for (let k = 0; k < kindKeys.length; k++) {
            if (filter.includes(kindKeys[k])) {
                fKeys = Object.keys(data[kindKeys[k]])
                let total = 0;
                for (let r = 0; r < fKeys.length; r++) {
                    if (fKeys[r] === "_cnt") {
                        continue;
                    }
                    newData[fKeys[r]] = { '_cnt': data[kindKeys[k]][fKeys[r]] };
                }
                break;
            }
        }
        // Save filtered data and rebuild keys
        data = newData;
        kindKeys = Object.keys(data);
        treemapData = [{ 'name': filter[0], 'children': [] }];
        dirStatFilter = filter[0];
    }

    for (let k = 0; k < kindKeys.length; k++) {
        if (kindKeys[k] === '_total') {
            continue;
        }
        if (data[kindKeys[k]]['_cnt'] >= bottomValue && data[kindKeys[k]]['_cnt'] <= topValue) {
            kindData = { 'name': kindKeys[k], 'value': data[kindKeys[k]]['_cnt'] }
            treemapData[0].children.push(kindData);
        }
    }

    try {
        let showDirStatLabels;
        showDirStatLabels = $("#dirStatLabels").is(":checked")

        const width = window.innerWidth - 80;
        const height = window.innerHeight - 250;

        // Clear the html and build new 
        $("#snapshot_treeMap").html('')

        // Set up the D3 treemap layout
        var treemapLayout = d3.treemap()
            .size([width, height])   // Set the size of the treemap
            .padding(2);             // Set padding between tiles

        // Create the treemap chart
        var treemap = d3.select("#snapshot_treeMap")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .call(d3.zoom().on("zoom", function () {

                treemap.attr("transform", event.transform);
            }))
            .append("g");

        treemap.call(zoom)

        // Build the treemap using the data
        var root = d3.hierarchy(treemapData[0]);
        root.sum(function (d) { return d.value; });

        treemapLayout(root);

        // Define color scale for first and second level children
        var colorScale = d3.scaleLinear()
            .domain([0, 1000])  // Input domain (range of numbers)
            .range(["lightblue", "orange"]);  // Output range (colors)

        // Create the treemap tiles
        var cells = treemap.selectAll("g")
            .data(root.leaves())
            .enter().append("g")
            .attr("transform", function (d) { return "translate(" + d.x0 + "," + d.y0 + ")"; });

        // Add rectangles to represent the treemap tiles
        cells.append("rect")
            .attr("width", function (d) { return d.x1 - d.x0; })
            .attr("height", function (d) { return d.y1 - d.y0; })
            .attr("fill", function (d) {
                // Use color scale for first-level children, otherwise use a default color
                return d.depth <= 2 ? colorScale(d.value) : "lightgray";
            })
            .on("mouseover", function (d) {
                let name = d.currentTarget['__data__']['data'].name;
                let value = d.currentTarget['__data__']['data'].value
                let xPos = d.currentTarget['__data__'].x0;
                let yPos = d.currentTarget['__data__'].y0;

                // Show tooltip on mouseover
                tooltip.transition()
                    .duration(100)
                    .style("opacity", .9);
                tooltip.html('<div class="vpk-d3-tip">Name: ' + name + '<br>Value: ' + value + '</div>')
                    .style("left", (xPos) + "px")
                    .style("top", (yPos) + 50 + "px");
            })
            .on("mouseout", function (d) {
                // Hide tooltip on mouseout
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("click", function (d) {
                // Open search tab with Kind selected
                returnWhere = 'Stats'
                let name = d.currentTarget['__data__']['data'].name;
                openSearch(name, 'StatsDirStats')
            });

        // Add text labels to the treemap tiles
        if (showDirStatLabels === true) {
            cells.append("text")
                .attr("x", function (d) { return (d.x1 - d.x0) / 4; })
                .attr("y", function (d) { return (d.y1 - d.y0) / 2; })
                .attr("dy", "0.35em")
                .attr("fill", "#666666")
                .attr("font-size", ".65em")
                .text(function (d) { return d.data.name });
        }

        // Add tooltip div
        var tooltip = d3.select("#snapshot_treeMap")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
    } catch (err) {
        console.log(`d3TreeMap() error: ${err}`)
        console.log(`Error stack: ${err.stack}`)
    }
}

function d3Children(data, keys) {
    let rtn = [];
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] === '_cnt') {
            continue;
        }
        rtn.push({ 'name': keys[i], 'value': data[keys[i]] })
    }
    return rtn;
}

function statsToggle(id) {
    // Toggle carets and show or hide sections of related messages.
    let targetText = "#tc-collapse-" + id;
    let targetCaret = "#tc-caret-" + id;
    let isTargetExpanded = $(targetText).hasClass('in');
    if (isTargetExpanded) {
        $(targetText).addClass('collapse').removeClass("in"); // collapse clicked target
        $(targetCaret).html('<i class="fas fa-xl fa-caret-right mr-2"></i>')
    } else {
        $(targetText).removeClass('collapse').addClass("in"); // expand clicked target
        $(targetCaret).html('<i class="fas fa-xl fa-caret-down mr-2"></i>')
    }
}

function statsShowReport(type) {
    if (typeof dsCounts === 'undefined' || dsCounts === null) {
        dirStats();
    }
    let subType = '';
    let data;
    if (type === 'Kind') {
        dsToggle = 'kind';
        data = dsCounts.kind;
        subType = 'Namespace'
    } else if (type === 'Namespace') {
        dsToggle = 'ns';
        data = dsCounts.ns;
        subType = 'Kind'
    }

    let keys = Object.keys(data);
    let cKeys;
    let nsText = '';
    let htm = '';
    let newD = [];
    let amt = 0;



    let bottomValue = $("#dirStatMin").val();
    let topValue = $("#dirStatMax").val();
    // Set number boundries
    if (bottomValue.trim() === "") {
        bottomValue = 1;
    } else {
        bottomValue = parseInt(bottomValue);
    }
    if (topValue.trim() === "") {
        topValue = 999999;
    } else {
        topValue = parseInt(topValue);
    }



    // build data in order needed
    for (let i = 0; i < keys.length; i++) {
        //Filter data
        if (keys[i] === '_total') {
            continue;
        }
        if (data[keys[i]]._cnt < bottomValue) {
            continue
        }
        if (data[keys[i]]._cnt > topValue) {
            continue
        }


        amt = '0000000' + data[keys[i]]._cnt;
        newD.push({ 'cnt': amt.slice(-7), 'key': keys[i] })
    }
    newD.sort((a, b) => b.cnt - a.cnt);
    keys = [];
    for (let i = 0; i < newD.length; i++) {
        keys.push(newD[i].key)
    }

    htm = htm + '<div class="mt-1">'
        + '   <div id="ts-heading-' + i + '" class="row">'
        + '      <div class="statsHeader" style="width: 480px; display: inline-block; text-align: left; padding-left: 10px;">' + type
        + '      </div>'
        + '      <div class="statsHeader" style="width: 100px; display: inline-block; text-align: center;">Count'
        + '      </div>'
        + '   </div>'
        + '</div>'

    for (let i = 0; i < keys.length; i++) {
        // Kind banner 
        if (keys[i].startsWith('_')) {
            continue;
        }
        htm = htm + '<div class="mt-1">'
            + '   <div id="ts-heading-' + i + '" class="row">'
            + '       <div class="mb-0 align-left" onclick="statsToggle(\'' + i + '\')" id="tc-caret-' + i + '">'
            + '           <i class="fas fa-xl fa-caret-right mr-2"></i>'
            + '      </div>'
            + '      <div  class="vkp-bottom-line" style="width: 480px; display: inline-block;" '
            + ' onclick="openSearch(\'' + keys[i] + '::' + type + '\',\'' + 'StatsDirRpt' + '\')">' + keys[i]
            + '      </div>'
            + '      <div class="vkp-bottom-line" style="width: 80px; display: inline-block; text-align: center;">' + data[keys[i]]._cnt
            + '      </div>'
            + '   </div>'
            + '</div>'

        // Inner table
        cKeys = Object.keys(data[keys[i]]);
        cKeys.sort();

        // build kind breadout data in order needed
        newD = [];
        for (let k = 0; k < cKeys.length; k++) {
            if (cKeys[k] === '_cnt') {
                continue;
            }
            amt = '0000000' + data[keys[i]][cKeys[k]];
            newD.push({ 'cnt': amt.slice(-7), 'key': cKeys[k] })
        }
        newD.sort((a, b) => b.cnt - a.cnt);
        cKeys = [];
        for (let i = 0; i < newD.length; i++) {
            cKeys.push(newD[i].key)
        }

        htm = htm + '<div id="tc-collapse-' + i + '" data-toggle="collapse" class="collapse">'
            + '<table class="vpkfont-md">'
            + '  <tr class="statsHeader" style="text-align:center">'
            + '    <th width="40">&nbsp;</th>'
            + '    <th width="400">' + subType + '</th>'
            + '    <th width="100">&nbsp;</th>'
            + '  </tr>'
        for (let c = 0; c < cKeys.length; c++) {
            if (cKeys[c].startsWith('_')) {
                continue;
            } else {
                nsText = cKeys[c];
                if (nsText === 'cluster-level') {
                    nsText = '< Cluster Level >'
                }
                htm = htm + '<tr>'
                    + '<td width="40">&nbsp</td>'
                    + '<td class="pl-2 vkp-bottom-line" '
                    + ' onclick="openSearch(\'' + keys[i] + '::' + cKeys[c] + '::' + type + '\',\'' + 'StatsDirRptSub' + '\')" '
                    + '>' + nsText + '</td>'
                    + '<td class="pl-2 vkp-bottom-line" style="text-align: center;"'
                    + ' onclick="openSearch(\'' + keys[i] + '::' + cKeys[c] + '::' + type + '\',\'' + 'StatsDirRptSub' + '\')" '
                    + '>' + data[keys[i]][cKeys[c]] + '</td>'
                    + '</tr>'
            }
        }
        htm = htm + '</table></div></div>'
    };

    $("#statContentsTable").empty();
    $("#statContentsTable").html('');
    $("#statContentsTable").html(htm);
}


//==========================================================


//----------------------------------------------------------
console.log('loaded vpkTabStats.js');