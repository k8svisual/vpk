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
// document ready
//----------------------------------------------------------


let getFileIsSecret;

$(document).ready(function () {

    // get version from server
    getVersion();

    // Vpk splash modal, hide after 3.5 seconds
    $("#splashVpKModal").modal('show');
    setTimeout(function () {
        $("#splashVpKModal").modal('hide');
    }, 3500);

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


    $("#searchview").removeClass("active");
    $("#searchview").removeClass("show");

    $("#searchResults").hide();

    $("#stats").removeClass("active");
    $("#stats").removeClass("show");

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

    $("#evtMsgs").removeClass("active");
    $("#evtMsgs").removeClass("show");

    // get the name of selected tab and process
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (evt) {
        currentTab = $(evt.target).attr('href');
        let px;
        let element;
        hideVpkTooltip()
        timeLapseClose();
        setCurrentTab(currentTab);
    });

    $("#tableSearch").on("click-cell.bs.table", function (field, value, row, $el) {
        selectedDef = $el.src;
        if ($el.kind === 'Secret') {
            getDefSec(selectedDef);   // secret modal with decode option
        } else {
            getDefFnum(selectedDef);
        }
    });

    $("#tableContainerImages").on("click-cell.bs.table", function (field, value, row, $el) {
        selectedDef = $el.fnum;
        if ($el.kind === 'Secret') {
            getDefSec(selectedDef);   // secret modal with decode option
        } else {
            getDefFnum(selectedDef);
        }
    });

    $("#tableEvents").on("click-cell.bs.table", function (field, value, row, $el) {
        let html = "";
        let root = $el.root;
        if (typeof root === 'undefined') {
            evtMsgsShowSource($el.fnum);
        } else {
            html = '<div>'
                + '<span class="text-center">'
                + '<span class="mt-1 mr-4">'
                + '<button type="button" class="btn btn-sm btn-primary ml-2" '
                + ' onclick="evtMsgsShowSchematic(\'' + $el.namespace + '\',\'' + $el.root + '\')">View schematic for involved resource'
                + '</button>'
                + '</span>'
                + '<span class="mt-1 pl-5 pr-5">'
                + '<button type="button" class="btn btn-sm btn-primary ml-2 pl-4 pr-4" '
                + ' onclick="evtMsgsShowSource(\'' + $el.fnum + '\')"><span pl-5 pr-5>&nbsp;&nbsp;View Event message source&nbsp;&nbsp;</span>'
                + '</button>'
                + '</span></span></div>'

            $('#evtMsgsBody').html(html)
            $("#evtMsgsModal").modal('show');
        }
    });

    // ChgDir modal
    $('#dsInstances').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select snapshot",
        multiple: false,
        width: 500
    });
    // Cluster tab
    $('#cluster-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select namespace(s)",
        multiple: true,
        width: 250
    });

    $('#timeLapse-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select namespace(s)",
        multiple: true,
        width: 250
    });

    // Workload Schematic tab
    $('#schematic-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select namespace",
        multiple: false,
        width: 300
    });
    // Network tab
    $('#network-type-node-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select network filter type",
        multiple: false,
        width: 200
    });

    $('#network-type-node-filter').on('select2:select', function (e) {
        var selected = $('#network-type-node-filter option:selected').val();
        getNetworkFilterTypeLevel(selected);
    });

    $('#network-type-service-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select network filter type",
        multiple: false,
        width: 200
    });

    $('#network-type-service-filter').on('select2:select', function (e) {
        var selected = $('#network-type-service-filter option:selected').val();
        getNetworkFilterTypeLevel(selected);
    });

    $('#network-data-node-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select network filter type",
        multiple: true,
        width: 400
    });

    $('#network-data-service-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select network filter type",
        multiple: true,
        width: 400
    });



    // OwnerRef tab
    $('#ownerRef-kind-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select kinds(s), default is ALL kinds",
        multiple: false,
        width: 300
    });

    // Security tab
    $('#security-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select namespace",
        multiple: false,
        width: 300
    });
    // Security tab - filter
    $("#secTable").on("click-cell.bs.table", function (field, value, row, $el) {
        selectedDef = $el.fnum;
        getDefFnum(selectedDef);
    });
    // OwnerRef Links tab
    $('#ownerRef-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select namespace",
        multiple: false,
        width: 300
    });
    $('#ownerRef-kind-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select kinds(s), default is ALL kinds",
        multiple: false,
        width: 300
    });
    // Event Msgs tab
    $('#events-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "all-namespaces",
        multiple: false,
        width: 300
    });
    // Stata View tab
    $('#stats-ns-filter').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select namespace(s)",
        multiple: false,
        width: 275
    });

    $("#stats-kind-filter").select2({
        dropdownCssClass: "vpkselect2",
        containerCssClass: "vpkselect2",
        placeholder: "select kind",
        multiple: false,
        width: 275
    });
    // Container Images tab
    $('#repository-list').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select repository"
    });
    // Search tab
    $("#ns-filter").select2({
        dropdownCssClass: "vpkselect2",
        containerCssClass: "vpkselect2",
        placeholder: "select namespace(s)",
        multiple: true,
        width: 550
    });
    $("#kind-filter").select2({
        dropdownCssClass: "vpkselect2",
        containerCssClass: "vpkselect2",
        placeholder: "select kind(s)",
        multiple: true,
        width: 550
    });

    $('#clusterBG').select2({
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2"
    });



    //=========================================================================
    // Watch EVENTS 
    //=========================================================================
    $("#searchBtn").click(function (e) {
        e.preventDefault();
        searchObj();
    });

    $('#dirStatMin').on("change", function () {
        dirStats();
    });

    $('#dirStatMax').on("change", function () {
        dirStats();
    });

    $('#dirStatLabels').on("change", function () {
        dirStats();
    });

    $('#stats-ns-select').on("change", function () {
        dirStats();
    });

    $('#stats-kind-select').on("change", function () {
        dirStats();
    });

    $('#cluster-bar1-select').focusout(function () {
        filter3DView();
    });

    $('#clusterBG').on("change", function () {
        let selected = $('#clusterBG').select2('data');
        clusterBack = selected[0].text;
    });

    $('#events-ns-select').on("change", function () {
        evtApplyNamespace();
    });

    $('#evtPageToStart').on("change", function () {
        evtApplyNamespace();
    });

    // timeLapse 3D filters
    $('input[name=timeLapseFilterNetwork]').change(function () {
        filterTimeLapseView();
    });

    $('input[name=timeLapseFilterStorage]').change(function () {
        filterTimeLapseView();
    });

    $('#timeLapse-bar-select').focusout(function () {
        filterTimeLapseView();
    });


    // 3d cluster filters
    $('input[name=clusterFilterNodes]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterStorage]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterNetwork]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterRunning]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterWarning]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterFailed]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterSuccessful]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterDSPods]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterMemoryLimit]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterMemoryRequest]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterCPULimit]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterCPURequest]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterNodeMemory]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterNodeCPU]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterNodeStorage]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterControlP]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterWorkload]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterService]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterConfigStorage]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterAuthentication]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterAuthorization]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterPolicy]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterExtend]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterCluster]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterOther]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterThirdParty]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterCSI]').change(function () {
        filter3DView();
    });

    $('input[name=clusterFilterIngress]').change(function () {
        filter3DView();
    });

    $('[data-toggle="popover"]').popover();

    $('[data-toggle="tooltip"]').tooltip();

    $("#cluster_filter").click(function (event) {
        $("#cluster_filter_box").addClass("active")
    });

    $("#schematic_filter").click(function (event) {
        schematicFilterShow();
    });

    $("#ownerRef_filter").click(function (event) {
        ownerRefFilterShow();
    });

    $("#security_filter").click(function (event) {
        securityFilterShow();
    });

    $("#network_filter").click(function (event) {
        openNetworkFilter();
    });

    $("#slideIn_box").click(function (event) {
        $("#slideIn").addClass("active");
    });

    $("#slideIn_box").click(function (event) {
        $("#slideIn").addClass("active");
    });

    // Event handlers for checkbox selection of Workload Schematic filter table: tableWS
    $('#tableWS').on('check.bs.table', function (e, row) {
        schematicCheckedRows.push({ id: row.id, ns: row.ns, pod: row.pod });

    });

    $('#tableWS').on('uncheck.bs.table', function (e, row) {
        $.each(schematicCheckedRows, function (index, value) {
            let check = true;
            if (typeof value === 'undefined') {
                check = false;
            }
            if (typeof row === 'undefined') {
                check = false;
            }
            if (check === true) {
                if (value.id === row.id) {
                    schematicCheckedRows.splice(index, 1);
                }
            }
        });
    });


    // Event handlers for checkbox selection of OwnerRef filter table: tableORef
    $('#tableORef').on('check.bs.table', function (e, row) {
        ownerRefCheckedRows.push({ id: row.id, ns: row.ns, kind: row.kind, name: row.name });
    });

    $('#tableORef').on('uncheck.bs.table', function (e, row) {
        $.each(ownerRefCheckedRows, function (index, value) {
            let check = true;
            if (typeof value === 'undefined') {
                check = false;
            }
            if (typeof row === 'undefined') {
                check = false;
            }
            if (check === true) {
                if (value.id === row.id) {
                    ownerRefCheckedRows.splice(index, 1);
                }
            }
        });
    });

    // ACE editor linked to html id
    editor = ace.edit("editor");

    // clearDisplay();
    getSelectLists();
    getConfig();

});

function setCurrentTab(currentTab) {
    // take action based on what tab was shown
    if (currentTab === "instructions") {
        px = 75;
        documentationTabTopic = 'introduction';
        $('#instructions').show();
        $('#instructionsHdr').show();
    } else {
        $('#instructions').hide();
        $('#instructionsHdr').hide();
    }
    if (currentTab === "#cluster") {
        px = 110;
        checkIfDataLoaded();
        documentationTabTopic = 'cluster';
        $('#cluster').show();
        $('#clusterHdr').show();
        $('#cluster_filter').show();
        $('#slideIn_box').show();
    } else {
        $('#cluster').hide();
        $('#clusterHdr').hide();
        $('#cluster_filter').hide();
        $('#slideIn_box').hide();
        $('#clusterReportView').hide();
    }
    if (currentTab === "#schematic") {
        px = 120;
        checkIfDataLoaded();
        documentationTabTopic = 'schematics';
        $('#schematic').show();
        $('#schematicHdr').show();
        $('#schematic_filter').show();
    } else {
        $('#schematic').hide();
        $('#schematicHdr').hide();
        $('#schematic_filter').hide();
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
    if (currentTab === "#network") {
        px = 120;
        checkIfDataLoaded();
        documentationTabTopic = 'network';
        $('#network').show();
        $('#networkHdr').show();
        $('#network_filter').show();
        openNetworkTab();
    } else {
        $('#network').hide();
        $('#networkHdr').hide();
        $('#network_filter').hide();
    }

    if (currentTab === "#security") {
        px = 120;
        checkIfDataLoaded();
        documentationTabTopic = 'security';
        $('#security').show();
        $('#securityHdr').show();
        $('#security_filter').show();
    } else {
        $('#security').hide();
        $('#securityHdr').hide();
        $('#security_filter').hide();
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
    if (currentTab === "#evtMsgs") {
        px = 120;
        checkIfDataLoaded();
        documentationTabTopic = 'eventmsgs';
        $('#evtMsgsHdr').show();
        $('#evtMsgs').show();
        if (evtLimitUid !== '') {
            $('#evtFilter').show();
        } else {
            $('#evtFilter').hide();
        }
        loadEvtMsgs();
    } else {
        $('#evtMsgs').hide();
        $('#evtMsgsHdr').hide();
        $('#evtFilter').hide();
    }
    if (currentTab === "#stats") {
        px = 120;
        checkIfDataLoaded();
        documentationTabTopic = 'stats';
        $('#stats').show();
        $('#statsHdr').show();
        $('#statsSlideIn').show();
        $('#stats_filter').show();
        openStatsTab();
    } else {
        $('#stats').hide();
        statsHdr
        $('#statsHdr').hide();
        $('#statsSlideIn').hide();
        $('#stats_filter').hide();
        statsFilterClose();
    }
    if (currentTab === "#containerImages") {
        px = 120;
        checkIfDataLoaded();
        documentationTabTopic = 'containerimages';
        $('#containerImages').show();
        $('#containerImagesHdr').show();
    } else {
        $('#containerImages').hide();
        $('#containerImagesHdr').hide();
    }
    if (currentTab === "#searchview") {
        px = 255;
        checkIfDataLoaded();
        documentationTabTopic = 'search';
        $('#searchview').show();
        $('#searchviewHdr').show();
    } else {
        $('#searchview').hide();
        $('#searchviewHdr').hide();
    }

    element = document.getElementById("banner")
    element.style['height'] = px + "px";
    element = document.getElementById("viewarea")
    px++;
    element.style['top'] = px + "px";


}


//----------------------------------------------------------
function editObj() {
    $("#viewTypeModal").modal('hide');
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



// Get VpK configuration data
//----------------------------------------------------------
function getConfig() {
    socket.emit('getConfigData');
}

//==========================================================


//----------------------------------------------------------
console.log('loaded vpkMain.js');
