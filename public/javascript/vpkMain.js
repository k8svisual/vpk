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

let svgWhere = "";
let svgPassData = "";
let childwin;
const childname = "schematicWindow";
const themeToggle = document.getElementById("theme-toggle");

$(document).ready(function () {

    // get version from server
    getVersion();

    // Listen for messages from the child window
    window.addEventListener('message', function (event) {
        // This indicates the child window is open, now send the
        // svg data to the child.
        sendChildSvg();
    });

    $('.carousel-item', '.multi-item-carousel').each(function () {
        var next = $(this).next();
        if (!next.length) {
            next = $(this).siblings(':first');
        }
        next.children(':first-child').clone().appendTo($(this));
    }).each(function () {
        var prev = $(this).prev();
        if (!prev.length) {
            prev = $(this).siblings(':last');
        }
        prev.children(':nth-last-child(2)').clone().prependTo($(this));
    });

    $('.modal').on("hidden.bs.modal", function (e) {
        --bootstrapModalCounter;
        if (bootstrapModalCounter > 0) {
            //don't need to recalculate backdrop z-index; already handled by css
            $('body').addClass('modal-open');
        }
    }).on("show.bs.modal", function (e) {
        ++bootstrapModalCounter;
        //don't need to recalculate backdrop z-index; already handled by css
    });

    $("#instructions").addClass("active");
    $("#instructions").addClass("show");
    $("#tableview").removeClass("active");
    $("#tableview").removeClass("show");
    $("#searchResults").hide();
    $("#graphic").removeClass("active");
    $("#graphic").removeClass("show");
    $("#schematic").removeClass("active");
    $("#schematic").removeClass("show");
    $("#security").removeClass("active");
    $("#security").removeClass("show");
    $("#storage").removeClass("active");
    $("#storage").removeClass("show");
    $("#cluster").removeClass("active");
    $("#cluster").removeClass("show");
    $("#ownerlinks").removeClass("active");
    $("#ownerlinks").removeClass("show");
    $('#ownerlinks').hide();
    // get the name of selected tab and process
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (evt) {
        currentTab = $(evt.target).attr('href');
        let px;
        let element;
        // take action based on what tab was shown
        if (currentTab === "#instructions") {
            px = 75;
            documentationTabTopic = 'overview';
            $('#instructions').show();
            $('#instructionsHdr').show();
        } else {
            $('#instructions').hide();
            $('#instructionsHdr').hide();
        }
        if (currentTab === "#tableview") {
            px = 255;
            checkIfDataLoaded();
            documentationTabTopic = 'tableview';
            $('#tableview').show();
            $('#tableviewHdr').show();
        } else {
            $('#tableview').hide();
            $('#tableviewHdr').hide();
        }
        if (currentTab === "#schematic") {
            px = 120;
            checkIfDataLoaded();
            documentationTabTopic = 'schematics';
            $('#schematic').show();
            $('#schematicHdr').show();
        } else {
            $('#schematic').hide();
            $('#schematicHdr').hide();
        }
        if (currentTab === "#graphic") {
            px = 120;
            checkIfDataLoaded();
            documentationTabTopic = 'graphicview';
            $('#graphic').show();
            $('#graphicHdr').show();
        } else {
            $('#graphic').hide();
            $('#graphicHdr').hide();
        }
        if (currentTab === "#security") {
            px = 120;
            checkIfDataLoaded();
            documentationTabTopic = 'security';
            $('#security').show();
            $('#securityHdr').show();
        } else {
            $('#security').hide();
            $('#securityHdr').hide();
        }
        if (currentTab === "#storage") {
            px = 120;
            checkIfDataLoaded();
            documentationTabTopic = 'storage';
            $('#storage').show();
            $('#storageHdr').show();
        } else {
            $('#storage').hide();
            $('#storageHdr').hide();
        }
        if (currentTab === "#cluster") {
            px = 110;
            checkIfDataLoaded();
            documentationTabTopic = 'cluster';
            $('#cluster').show();
            $('#clusterHdr').show();
        } else {
            $('#cluster').hide();
            $('#clusterHdr').hide();
        }
        if (currentTab === "#ownerlinks") {
            px = 120;
            checkIfDataLoaded();
            documentationTabTopic = 'ownerref';
            $('#ownerlinks').show();
            $('#ownerlinksHdr').show();
        } else {
            $('#ownerlinks').hide();
            $('#ownerlinksHdr').hide();
        }

        element = document.getElementById("banner")
        element.style['height'] = px + "px";
        element = document.getElementById("viewarea")
        px++;
        element.style['top'] = px + "px";
    });

    $("#tableL").on("click-cell.bs.table", function (field, value, row, $el) {
        selectedDef = $el.src;
        if ($el.kind === 'Secret') {
            getDefSec(selectedDef);   // secret modal with decode option
        } else {
            getDefFnum(selectedDef);
        }
    });

    $("#secTable").on("click-cell.bs.table", function (field, value, row, $el) {
        selectedDef = $el.fnum;
        getDefFnum(selectedDef);
    });

    $('#pickDataSource').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "Select option"
    });

    $('#pickDataSource').on('select2:select', function (e) {
        var selected = $('#pickDataSource option:selected').val();
        pickData(selected);
        $('#pickDataSource').val(null)
    });

    $('#pickDataSource2').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "Select option"
    });

    $('#pickDataSource2').on('select2:select', function (e) {
        var selected = $('#pickDataSource2 option:selected').val();
        pickData(selected);
        $('#pickDataSource2').val(null)
    });

    $('#anno-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md"
    });

    $('#dsInstances').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select snapshot"
    });

    $('#schematic-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace(s)"
    });

    $('#graphic-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace(s)"
    });

    $('#schematic-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace(s)"
    });

    $('#security-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace"
    });

    $('#ownerRef-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace"
    });

    $('#cluster-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace(s)"
    });

    $("#searchBtn").click(function (e) {
        e.preventDefault();
        searchObj();
    });

    //-- ownerRef dropdowns
    $('#ownerSort1').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "sort order"
    });
    $('#ownerSort2').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "sort order"
    });

    $('#cluster-bar1-select').focusout(function () {
        console.log('No FOCUS')
        filter3DView()
    });

    $('input[name=clusterFilterNodes]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterStorage]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterNetwork]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterRunning]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterWarning]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterFailed]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterSuccessful]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterDSPods]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterMemoryLimit]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterMemoryRequest]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterCPULimit]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterCPURequest]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterNodeMemory]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterNodeCPU]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterNodeStorage]').change(function () {
        filter3DView()
    });

    $('input[name=clusterFilterControlP]').change(function () {
        filter3DView()
    });

    editor = ace.edit("editor");
    editorC1 = ace.edit("editorC1");
    editorC2 = ace.edit("editorC2");

    $('[data-toggle="popover"]').popover();

    $('[data-toggle="tooltip"]').tooltip();

    $("#cluster_filter").click(function (event) {
        $("#cluster_filter_box").addClass("active")
    });

    $("#slideIn_box").click(function (event) {
        $("#slideIn").addClass("active")
    });

    //clearDisplay();
    getSelectLists();
    getConfig();

});


function showSchematic(ns, podId) {
    getSchematic(ns, podId);
}

function sendChildSvg() {
    // workloadEventsInfo needs to be parsed to NS and sent
    let msg = { 'svg': svgPassData, 'tips': svgInfo };
    childwin.postMessage(msg, '*');
    childwin.focus();
}


//----------------------------------------------------------
//----------------------------------------------------------
// socket io definitions for incoming and out-bound 
//----------------------------------------------------------
//----------------------------------------------------------
function saveConfig(what) {
    if (typeof what === 'undefined') {
        let sFlds = document.getElementById('statusFlds').checked;
        let mFlds = document.getElementById('mgmFlds').checked;

        if (typeof sFlds === 'undefined') {
            sFlds = false;
        }
        if (typeof mFlds === 'undefined') {
            mFlds = false;
        }
        socket.emit('saveConfig', { "managedFields": mFlds, "statusSection": sFlds });
    } else {
        socket.emit('saveConfig', { "xrefData": xrefData });
    }
}
//...
socket.on('saveConfigResult', function (data) {
    $("#configModal").modal('hide');
    if (data.result.status !== 'PASS') {
        showMessage(data.result.message, 'fail')
    }
});
//==========================================================


//----------------------------------------------------------
function showConfig() {
    socket.emit('getConfig');
}
//...
socket.on('getConfigResult', function (data) {

    if (data.config.managedFields === true) {
        $('#mgmFlds').bootstrapToggle('on');
    } else {
        $('#mgmFlds').bootstrapToggle('off');
    }

    if (data.config.statusSection === true) {
        $('#statusFlds').bootstrapToggle('on');
    } else {
        $('#statusFlds').bootstrapToggle('off');
    }
    $("#configModal").modal('show');
});
//==========================================================


//----------------------------------------------------------
function getDocumentation(data) {
    let what;
    if (typeof data === 'undefined') {
        if (documentationTabTopic !== '') {
            // question mark in top pressed, select the appropriate topic          
            what = { 'doc': documentationTabTopic };
        }
    } else {
        // inside documentation modal, navigate to desired topic
        what = { 'doc': data };
    }
    socket.emit('getDocumentation', what);
}
//...
socket.on('getDocumentationResult', function (data) {
    let content = data.content;
    console.log(data.content);
    $('#docsBody').html(content)
    $("#docsModal").modal('show');
});
//... using functions
function docNextTopic(link) {
    let next;
    if (typeof link === 'undefined') {
        next = $("#topicNext").attr("link")
    } else {
        next = link;
    }
    getDocumentation(next)
}
function docPrevTopic() {
    let prev = $("#topicBack").attr("link")
    getDocumentation(prev)
}
//==========================================================


//----------------------------------------------------------
// show change directory modal 
function changeDir() {
    let data = { 'which': 0 };
    socket.emit('clusterDir', data);
    $("#validateBtn").show();
    $("#loadStatus").hide();
    $("#chgDirFooter").show();
}

//...
socket.on('clusterDirResult', function (data) {
    //build the drop down of existing directories, hide messages, open modal
    var items = bldClusterDir(data.dirs);
    hideMessage();

    if (data.which === "0" || data.which === 0) {
        $('#dsInstances').html(items);
        $("#chgDirModal").modal('show');
    }
    k8cData = null;

});
//==========================================================


//----------------------------------------------------------
// process cluster info input and pass to server 
function dynamic() {
    $("#clusterRunning").show();
    var kinfo = {};
    kinfo.snapshot_prefix = document.getElementById("snapshot_prefix").value;
    kinfo.command = document.getElementById("get_cmd").value;
    var k8n = document.getElementById("k8_namespace").value;
    if (k8n === "<all>") {
        kinfo.namespace = "";
    } else {
        kinfo.namespace = k8n;
    }

    socket.emit('connectK8', kinfo);
    $("#clusterStatus").empty();
    var resp = '<div><span class="vkpfont vpkcolor" style="vertical-align: middle;">Request will take several seconds to complete</span></div>';
    $("#clusterStatus").html(resp);
}
//...
socket.on('getKStatus', function (data) {
    //$("#clusterModalFooter").hide();
    $("#clusterStatus").empty();
    $("#clusterStatus").html('');
    let msg = 'Processing request'
    if (typeof data.msg !== 'undefined') {
        msg = data.msg
    }
    // If the number processed is equal to the total
    // change msg to indicated processing is done
    if (msg.startsWith("Processed count")) {
        let tmp = msg.split(' of ');
        let fNum = tmp[0].split('count');
        let sNum = tmp[1].split(' - ');
        if (fNum[1].trim() === sNum[0].trim()) {
            msg = "Processing completed"
        }
    }
    let resp = '<br><div class="vpkfont vpkcolor">' + msg + '</div>';
    $("#clusterStatus").html(resp);

});

socket.on('parseStatus', function (data) {
    let msg;
    if (typeof data.msg !== 'undefined') {
        msg = data.msg
    } else {
        msg = 'Parsing files'
    }
    let resp = '<br><div class="vpkfont vpkcolor">' + msg + '</div>';
    $("#parseStatus").html(resp);

});
//==========================================================


//----------------------------------------------------------
// send request to decode object
function getDefDecode(def, secret) {
    //$("#multiModal").modal('hide');
    selectedDef = def;
    if (selectedDef.indexOf('undefined') > -1) {
        showMessage('Unable to locate source yaml.', 'fail');
    } else {
        data = { "file": selectedDef, "secret": secret }
        socket.emit('getDecode', data);
    }
}
//...
socket.on('getDecodeResult', function (data) {
    var content = data.result;
    var keys = Object.keys(content);
    var key;
    var html = '';
    var item = '';

    for (var k = 0; k < keys.length; k++) {
        key = keys[k];
        item = content[key];
        if (item.type === 'JSON') {
            value = JSON.stringify(item.value, null, 4);
        } else {
            value = item.value;
        }
        html = html + '\nKEY: ' + key + '\n' + '\n' + value + '\n' + '\n';
    }

    $("#decodeName").empty();
    //    $("#decodeName").html('<span>' + data.secret + '</span>');
    $("#decode").empty();
    $("#decode").html(html);
    $('#decodeModal').modal('show');
});
//==========================================================


//----------------------------------------------------------
function editObj() {
    $("#viewTypeModal").modal('hide');
    selectedAction = 'edit';
    //console.log(selectedDef)
    socket.emit('getDef', selectedDef);
}
function browseObj() {
    $("#viewTypeModal").modal('hide');
    selectedAction = 'browse';
    socket.emit('getDef', selectedDef);
}
//...
socket.on('objectDef', function (data) {
    // always edit, no longer provide browse 
    editDef(data);
});
//==========================================================


//----------------------------------------------------------
function getFileByCid(data, secret) {
    if (typeof secret === 'undefined') {
        if (typeof data[1] !== 'undefined') {
            if (data[1].indexOf('::Secret::') > -1) {
                secret = true;
            } else {
                secret = false;
            }
        }
    }
    getFileIsSecret = secret;
    socket.emit('getFileByCid', data);
}
//...
socket.on('getFileByCidResults', function (data) {
    // always edit, no longer provide browse 
    if (getFileIsSecret === true) {
        getDefSec(data);
    } else {
        getDefFnum(data)
    }
});
//==========================================================


//----------------------------------------------------------
// send request to server to get security rules data
function getSecurityRules() {
    hideMessage();
    let parms = { 'vset': [], 'rsc': [], 'apiG': [], 'ns': ['kube-system'] };
    socket.emit('getSecurityRules', parms);
}
//...
socket.on('getSecurityRulesResult', function (data) {
    console.log('SecurityRules data received');
    $("#secTable").bootstrapTable('load', data)
    $("#secTable").bootstrapTable('hideColumn', 'fnum');
});

//----------------------------------------------------------
// send request to server to get hierarchy data
function getSecurityViewData(namespace) {
    hideMessage();
    let ns;
    if (typeof namespace === 'undefined' || namespace === null) {
        let option = $('#security-ns-filter').select2('data');
        ns = option[0].text;
        ns = ns.trim();
        if (ns.text === '' || ns.length === 0) {
            showMessage('Select a namespace it cannot be blank.')
        }
    } else {
        ns = namespace;
    }

    if (ns === '<cluster-level>') {
        ns = 'cluster-level';
    }
    $("#secViz").empty();
    $("#secViz").html('');
    socket.emit('getSecurityViewData', ns);
}
//...
socket.on('getSecurityViewDataResult', function (data) {
    console.log('SecurityView data received');
    buildSecGraph(data);
});


//----------------------------------------------------------
// send request to server to get hierarchy data
function getChart(type, what) {
    hideMessage();
    chartType = type;
    if (what !== null) {
        chartWhat = what;
    } else {
        chartWhat = 'none';
    }

    $("#graphicCharts2").empty();
    $("#chartInfo").empty();
    $("#chartInfo").html(processingRequest);

    let namespaces = '';
    let tmp;
    let options = $('#graphic-ns-filter').select2('data');
    for (var i = 0; i < options.length; i++) {
        tmp = options[i].text;
        tmp = tmp.trim();
        if (tmp.length === 0) {
            namespaces = namespaces + ':all-namespaces:';
        } else {
            namespaces = namespaces + ':' + tmp + ':';
        }
    };

    if (namespaces === '') {
        namespaces = ':all-namespaces:';
    }

    socket.emit('getHierarchy', { "namespaceFilter": namespaces });
}
//...
socket.on('hierarchyResult', function (data) {
    $("#graphicCharts2").empty();
    $("#graphicCharts2").html('');
    if (chartType === 'hierarchy') {
        $("#graphicCharts2").removeAttr("viewBox");
        chartHierarchy(data, 'g');
    } else if (chartType === 'collapsible') {
        $("#graphicCharts2").removeAttr("height");
        $("#graphicCharts2").removeAttr("width");
        chartCollapsible(data, 'g');
    } else if (chartType === 'circlePack') {
        $("#graphicCharts2").removeAttr("height");
        $("#graphicCharts2").removeAttr("width");
        chartCirclePack(data, 'g');
    }
});
//==========================================================


//----------------------------------------------------------
function about() {
    socket.emit('getUsage');
    $("#version").empty();
    $("#version").html('');
    $("#version").html('VERSION&nbsp;' + version);
    $("#usageResult").hide();
    $("#aboutModal").modal();
}
//...
socket.on('usageResult', function (data) {
    let content = '';
    if (typeof data.empty !== 'undefined') {
        content = '<div class="text-center align-middle font-weight-bold vpkfont-lg">' + data.message + '</div>';
    } else {
        content = formatUsage(data);
    }
    $("#usageRunning").hide();
    $("#usageResult").empty();
    $("#usageResult").html(content);
    $("#usageResult").show();
});
//==========================================================


//----------------------------------------------------------
// show server statistics
function dirStats() {
    socket.emit('getDirStats');
}
//...
socket.on('dirStatsResult', function (data) {
    dsCounts = data;
    if (dsToggle === 'kind' || dsToggle === '') {
        buildKindStats();
    } else {
        buildNamespaceStats();
    }
});
//... supporting functions
function buildKindStats() {
    dsToggle = 'kind';
    if (typeof dsCounts === 'undefined') {
        return;
    }
    if (typeof dsCounts.kind === 'undefined') {
        return;
    }
    data = dsCounts.kind;

    if (typeof data._total === 'undefined') {
        return;
    }

    let keys = Object.keys(data);
    keys.sort();

    let total = data._total._cnt;
    let cKeys;
    let nsText = '';
    let htm = '<table class="vpkfont-md"><thead><tr class="statsHeader" style="text-align:center">'
        + '<th>-Kind-</th><th class="pl-2">-Count-</th><th class="pl-2">-Namespace-</th>'
        + '</tr></thead><tbody>';
    // add overall total line
    htm = htm + '<tr style="text-align:center"><td width="200">All</td><td width="200" class="pd-4">' + total + '</td><td width="300" class="pl-2">All</td></tr>'


    for (let i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('_')) {
            continue;
        }
        htm = htm + '<tr><td><hr></td><td><hr></td><td><hr></td></tr>'

        htm = htm + '<tr><td>' + keys[i] + '</td><td>&nbsp;</td><td>&nbsp;</td></tr>'

        cKeys = Object.keys(data[keys[i]]);
        cKeys.sort();
        for (let c = 0; c < cKeys.length; c++) {
            if (cKeys[c].startsWith('_')) {
                continue;
            } else {
                nsText = cKeys[c];
                if (nsText === 'cluster-level') {
                    nsText = '< Cluster Level >'
                }
                htm = htm + '<tr><td>&nbsp;</td><td class="pl-4">' + data[keys[i]][cKeys[c]] + '</td><td class="pl-2">' + nsText + '</td></tr>'
            }
        }
    };
    htm = htm + '</tbody></table>';
    $("#statContents").empty();
    $("#statContents").html('');
    $("#statContents").html(htm);
    $("#statsModal").modal();
}
function buildNamespaceStats(stats) {
    if (typeof dsCounts === 'undefined') {
        return;
    }
    if (typeof dsCounts.ns === 'undefined') {
        return;
    }
    dsToggle = 'ns';
    data = dsCounts.ns;
    let keys = Object.keys(data);
    keys.sort();
    let total = dsCounts.kind._total._cnt;  // get overall total from the kinds stats
    let cKeys;
    let nsText = '';
    let htm = '<table class="vpkfont-md"><thead><tr class="statsHeader" style="text-align:center">'
        + '<th>-Namespace-</th><th class="pl-2">-Count-</th><th class="pl-2">-Kind-</th>'
        + '</tr></thead><tbody>';
    // add overall total line
    htm = htm + '<tr style="text-align:center"><td width="200">All</td><td width="200" class="pd-4">' + total + '</td><td width="300" class="pl-2">All</td></tr>'


    for (let i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('_')) {
            continue;
        }
        htm = htm + '<tr><td><hr></td><td><hr></td><td><hr></td></tr>'
        nsText = keys[i];
        if (nsText === 'cluster-level') {
            nsText = '< Cluster Level >'
        }

        htm = htm + '<tr><td>' + nsText + '</td><td>&nbsp;</td><td>&nbsp;</td></tr>'

        cKeys = Object.keys(data[keys[i]]);
        cKeys.sort();
        for (let c = 0; c < cKeys.length; c++) {
            if (cKeys[c].startsWith('_')) {
                continue;
            } else {
                htm = htm + '<tr><td>&nbsp;</td><td class="pl-4">' + data[keys[i]][cKeys[c]] + '</td><td class="pl-2">' + cKeys[c] + '</td></tr>'
            }
        }
    };
    htm = htm + '</tbody></table>';
    $("#statContents").empty();
    $("#statContents").html('');
    $("#statContents").html(htm);
    $("#statsModal").modal();
}
//==========================================================


//----------------------------------------------------------
function getSelectLists() {
    socket.emit('getSelectLists');
}

function closeGetCluster() {
    getSelectLists();
    $("#clusterModal").modal('hide');
}
//$$
//$$ Also invoked in  $(document).ready(function() $$
//...
socket.on('selectListsResult', function (data) {
    k8cData = data.pods;
    schematicKeys = data.keys;
    svgInfo = data.info;
    nsResourceInfo = data.nsRI;
    workloadEventsInfo = data.evts;
    populateSelectLists(data);
    socket.emit('getServerData');
});
//==========================================================


//----------------------------------------------------------
// send request to server to get software version
function getVersion() {
    socket.emit('getVersion');
}
//...
socket.on('versionResult', function (data) {
    version = data.version;
    runMode = data.runMode;
    if (runMode === 'L') {
        console.log('VpK runMode: Local')
    } else {
        console.log('VpK runMode: Container')
    }
    // hide one of the select sections in the html
    if (runMode === 'C') {
        var link = document.getElementById('runLocal');
        link.style.display = 'none'; //or
        link.style.visibility = 'hidden';
    } else {
        var link = document.getElementById('runContainer');
        link.style.display = 'none'; //or
        link.style.visibility = 'hidden';
    }
});


//==========================================================


//----------------------------------------------------------
// send request to load new directory
function reload() {
    $("#validateBtn").hide();
    $("#chgDirFooter").hide();
    $("#loadStatus").show();
    var newDir = $('#dsInstances').select2('data');
    newDir = newDir[0].text;
    $("#searchResults").hide();
    $("#graphicCharts").empty();
    $("#graphicCharts").html('<svg width="950" height="5000"></svg>');
    $("#svgResults").empty();
    $("#svgResults").html('');
    $("#schematicDetail").empty();
    $("#schematicDetail").html('');
    $("#ownerRefLinksDetail").empty();
    $("#ownerRefLinksDetail").html('');
    $("#cluster3DView").hide();

    //This will clear any previously loaded data
    k8cData = null;
    socket.emit('reload', newDir);
}

//$$ also client.emit('selectListsResult', result) when reload is sent to server
//...
socket.on('resetResults', function (data) {
    if (data.validDir === false) {
        setBaseDir(data.baseDir);
        $("#chgDirModal").modal('hide');
        showMessage('Failed to connect to datasource', 'fail');
    } else {
        setBaseDir(data.baseDir);
        rootDir = data.baseDir;
        baseDir = data.baseDir;
        $("#loadStatus").hide();
        $("#chgDirFooter").show();
        $("#chgDirModal").modal('hide');
        showMessage('Data snapshot connected', 'pass');
        // clear display areas of old data
        $("#chartInfo").html('')
        $("#graphicCharts2").html('')
        $("#schematicDetail").html('')
        $("#securityDetail").html('')
        $("#xrefInfo").html('')
        $("#xrefCharts2").html('')
        $("#storageDetail").html('')
        $("#clusterDetail").html('')
        getSelectLists();
        // Issue #17 fix
        foundNSNamesBuilt = false;
        bldSchematic()
    }
});
//==========================================================
function closeVpK() {
    $("#closeVpKModal").modal('show');
}
function cancelShutdown() {
    $("#closeVpKModal").modal('hide');
}
function shutdownVpK() {
    let html1 = '<div>&nbsp;</div>'
    let html2 = '<div class="text-center vpkcolor vpkfont-lg mb-5 mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="100" height="100"></div>'
        + '<div class="text-center mt-2 vpkfont-giant vpkcolor">'
        + '<span id="shutdownMsg">VpK shutdown in progress</span></div></div>'
    $("#closeVpKModal").modal('hide')
    $("#banner").html(html1);
    $("#viewarea").html(html2)
    let doit = setTimeout(sendShutdownS1, 1000);
}

function sendShutdownS1() {
    let html2 = '<div class="text-center vpkcolor vpkfont-lg mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="200" height="200"></div>'
        + '<div class="text-center mt-5 mb-5 vpkfont-giant vpkcolor">'
        + '<span id="shutdownMsg" >VpK shutdown in progress</span></div></div></div>'
    $("#viewarea").html(html2);
    let doit = setTimeout(sendShutdownS2, 1000);
}

function sendShutdownS2() {
    let html2 = '<div class="text-center vpkcolor vpkfont-lg mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="300" height="300"></div>'
        + '<div class="text-center mt-5 mb-5 vpkfont-giant vpkcolor">'
        + '<span id="shutdownMsg" >VpK shutdown complete</span></div></div></div>'
    $("#viewarea").html(html2);
    socket.emit('shutdownVpK');
}


//----------------------------------------------------------
function bldSchematic() {
    socket.emit('getServerData');
}

socket.on('getServerDataResult', function (data) {
    k8cData = data.pods;
    schematicKeys = data.keys;
    svgInfo = data.info;
    nsResourceInfo = data.nsRI;
    workloadEventsInfo = data.evts;
    oRefLinks = data.oRef;
    storageData = data.stor;

    hideMessage();
    populateSchematicList();
    buildStorage();

    showClusterTab();

});


//----------------------------------------------------------
function getSchematic(ns, pod) {
    if (ns !== null && typeof ns !== 'undefined') {
        svgWhere = pod;
    } else {
        svgWhere = ""
    }

    let namespaces = "";
    if (svgWhere === "") {
        let tmp;
        let selected = $('#schematic-ns-filter').select2('data');
        for (var i = 0; i < selected.length; i++) {
            tmp = selected[i].text;
            tmp = tmp.trim();
            if (tmp.length === 0) {
                namespaces = namespaces + ':all-namespaces';
            } else {
                namespaces = namespaces + ':' + tmp;
            }
        };
        if (namespaces === '') {
            namespaces = ':all-namespaces:';
        }
    } else {
        namespaces = ":" + ns;
    }
    socket.emit('schematicGetSvg', namespaces);
}
//...
socket.on('schematicGetSvgResult', function (data) {
    if (svgWhere === "") {
        let html = formatSVG(data);
        $("#schematicDetail").html(html)
    } else {
        svgPassData = formatSingleSVG(data.data, svgWhere);
        childwin = window.open('../views/child.html?cnt=0', childname, 'height=700px, width=1200px');
    }
});

function formatSVG(data) {
    let = newData = data.data;
    let nsKeys = Object.keys(newData);
    let podKeys;
    let html = "";
    let podsFound;
    let collNum = 0;

    for (let i = 0; i < nsKeys.length; i++) {
        podsFound = false;
        //html = html + '<div><h6>' + nsKeys[i] + '</h6></div>';
        podKeys = Object.keys(newData[nsKeys[i]]);
        for (let p = 0; p < podKeys.length; p++) {
            if (podKeys[p] === 'NoPod') {
                html = html + newData[nsKeys[i]][podKeys[p]];
                continue;
            } else {
                podsFound = true;
                collNum++
                if (p === 0) {
                    html = html +
                        '<div class="breakBar"><button type="button" '
                        + ' class="btn btn-primary btn-sm vpkButtons pl-4 pr-4" data-toggle="collapse" data-target="#collid-'
                        + collNum + '">' + nsKeys[i] + '</button>'
                        + '<hr></div>'
                        + '<div id="collid-' + collNum + '" class="collapse">'
                        + '<div class="header-right">'
                        + '<a href="javascript:printDiv(\'collid-' + collNum + '\')">'
                        + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                        + '</a>'
                        + '</div>'
                        + newData[nsKeys[i]][podKeys[p]];
                } else {
                    html = html + newData[nsKeys[i]][podKeys[p]];
                }
            }
        }
        if (podsFound === true) {
            html = html + '</div>';
        }
    }
    return html;
}

function formatSingleSVG(data, pod) {
    let nsKeys = Object.keys(data);
    let podKeys;
    for (let i = 0; i < nsKeys.length; i++) {
        podKeys = Object.keys(data[nsKeys[i]]);
        for (let p = 0; p < podKeys.length; p++) {
            if (podKeys[p] !== pod) {
                continue;
            } else {
                return '<div>' + data[nsKeys[i]][podKeys[p]] + '</div>';
            }
        }
    }
    return '';
}


function getCluster3DInfo() {
    hideMessage();
    $('#cluster3DView').hide();
    // $("#resourceProps").html(processingRequest)
    getDataRequest = 'cluster3D';
    socket.emit('getServerData');
}


//==========================================================


//----------------------------------------------------------
function bldSecurity() {
    hideMessage();
    $("#securityDetail").html(processingRequest)
    console.log(typeof k8cData);
    if (typeof k8cData === 'undefined' || k8cData === null) {
        socket.emit('security');
    } else {
        console.log('k8cData exists')
        hideMessage();
        buildSecArrays();
        securityDefinitions();
    }
}
//...
socket.on('securityResult', function (data) {
    k8cData = data.data;
    hideMessage();
    buildSecArrays();
    securityDefinitions();
});
//==========================================================


//----------------------------------------------------------
function bldSecurityUsage() {
    hideMessage();
    $("#securityDetail").html(processingRequest)
    socket.emit('securityUsage');

    if (typeof k8cData === 'undefined' || k8cData === null) {
        socket.emit('securityUsage');
    } else {
        console.log('k8cData exists')
        hideMessage();
        buildSecArrays();
        securityUsage();
    }
}
//...
socket.on('securityUsageResult', function (data) {
    k8cData = data.data;
    hideMessage();
    buildSecArrays();
    securityUsage();
});
//==========================================================


//----------------------------------------------------------
function getOwnerRefLinks() {
    hideMessage();
    $("#ownerRefLinksDetail").html(processingRequest)
    socket.emit('getOwnerRefLinks');
}
//...
socket.on('getOwnerRefLinksResult', function (data) {
    ownerRefLinks = data.links;
    //console.log(JSON.stringify(ownerRefLinks, null, 3))
    buildOwnerRefLinks();
});
//==========================================================


//----------------------------------------------------------
function getStorageInfo() {
    hideMessage();
    $("#storageDetail").html(processingRequest)
    socket.emit('getStorage');
}
//...
socket.on('getStorageResult', function (data) {
    storageData = data.info;
    buildStorage();
});
//==========================================================


//----------------------------------------------------------
// send request to server to search for data
function searchObj() {
    hideMessage();
    var namespaces = '::';
    var kinds = '::';
    var labels = '::';
    var searchValue = '';
    var skipU = true;
    var nsKey = false;
    var kindKey = false;
    var kindnameKey = false;
    var labelKey = false;
    var options = $('#ns-filter').select2('data');
    for (var i = 0; i < options.length; i++) {
        var tmp = options[i].text;
        tmp.trim();
        if (tmp.length === 0) {
            namespaces = namespaces + '-blank-' + '::';
        } else {
            namespaces = namespaces + tmp + '::';
            nsKey = true;
        }
    };
    // reuse options var
    options = $('#kind-filter').select2('data');
    for (var i = 0; i < options.length; i++) {
        var tmp = options[i].text;
        tmp.trim();
        if (skipU === true) {
            if (tmp.indexOf('(U)') === -1) {
                kinds = kinds + tmp + '::';
                kindKey = true;
            }
        } else {
            kinds = kinds + tmp + '::';
            kindKey = true;
        }
    };

    searchValue = $("#search-value").val();
    if (typeof searchValue === 'undefined' || searchValue.length === 0) {
        searchValue = '';
    } else {
        kindnameKey = true;
    }

    if (namespaces === '::') {
        namespaces = '::all-namespaces::'
    }
    if (kinds === '::') {
        kinds = '::all-kinds::'
    }

    if (!nsKey && !kindKey && !kindnameKey && !labelKey) {
        namespaces = '::all-namespaces::'
        kinds = '::all-kinds::'
    }

    if (namespaces === '::') {
        namespaces = '::all-namespaces::'
    }
    if (kinds === '::') {
        kinds = '::all-kinds::'
    }

    var data = {
        "searchValue": searchValue,
        "namespaceFilter": namespaces,
        "kindFilter": kinds
    }
    socket.emit('search', data);
}
//...
socket.on('searchResult', function (data) {
    //console.log(JSON.stringify(data, null, 4))
    $("#searchResults").show();
    buildSearchResults(data);
});
//...


function buildSearchResults(data) {
    var tmp;
    var a, b, c, d;
    newData = [];
    id = 0;

    //Parse data and build JSON object for display table
    for (item in data) {
        tmp = data[item]
        a = tmp.namespace;
        b = tmp.kind;
        c = tmp.name;
        if (typeof tmp.fnum === 'undefined') {
            console.log('Missing fnum for namespace:' + a + ' kind: ' + ' name:' + c)
        }
        d = tmp.fnum;
        newData.push({
            namespace: a,
            kind: b,
            value: c,
            src: d
        })
    }
    // build the table
    $("#tableL").bootstrapTable('load', newData)
    $("#tableL").bootstrapTable('hideColumn', 'src');
}

//==========================================================

//----------------------------------------------------------
function getConfig() {
    socket.emit('getConfigData');
}

//==========================================================


//----------------------------------------------------------
// used by search section of main UI
function toggleStorage(id) {

    id = '#' + id;
    if ($(id).is('.collapse:not(.show)')) {
        // not open, open it
        $(id).collapse("show");
    } else {
        $(id).collapse("hide");
    }
}


//----------------------------------------------------------
// get Cluster information
function getCluster() {
    hideMessage();
    $("#clusterInfo").show();
    $("#clusterButton").show();
    $("#clusterModal").modal({
        backdrop: 'static',
        keyboard: false
    });
    $("#clusterRunning").hide();

    $("#clusterModalFooter").show();
    $("#clusterModal").modal('show');
    $("#clusterStatus").empty();
    $("#clusterStatus").html('&nbsp');
}

function sendCommand() {
    let command = $("#commandInput").val();
    console.log('send command: ' + command);
    socket.emit('runCommand', command);
}

socket.on('commandResult', function (data) {
    let out = data.output;
    let html = '';
    for (let i = 0; i < out.length; i++) {
        html = html + out[i] + '\n';
    }

    $("#commandOutput").html(html);
});

function closeRunCommand() {
    $("#commandModal").modal('hide');
}

function openRunCommand() {
    $("#commandModal").modal('show');
}
//----------------------------------------------------------
// build UI for the get Cluster
function buildClusterUI(s) {
    $("#clusterInfo").show();
    $("#clusterStatus").empty();
    $("#clusterStatus").html('&nbsp');
}

function getProvider(selected) {
    for (var p = 0; p < clusterProviders.length; p++) {
        if (clusterProviders[p].name === selected) {
            return clusterProviders[p].fields;
        }
    }
}

function searchValues() {
    $("#searchModal").modal('show');
}

// Function to close the filter slide-in on right side of screen
function closeSlideIn() {
    slideIn.classList.remove("active");
}

// Function to close the filter slide-in on left side of screen
function closeClusterFilter() {
    $("#cluster_filter_box").removeClass("active")
}

// Open and close the legend on the Security tab
function viewSecurityLegend() {
    $("#securityLegendModal").modal('show');
}
function viewClusterLegend() {
    $("#clusterLegendModal").modal('show');
}


// Switch to the Cluster tab and refresh the 3D view
function showClusterTab() {
    $("#clusterDetail").html('')
    $('.nav-tabs a[href="#cluster"]').tab('show');
    buildCluster3D();
}


//----------------------------------------------------------
console.log('loaded vpkMain.js');
