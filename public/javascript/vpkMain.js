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
// document ready
//----------------------------------------------------------
$(document).ready(function () {

    // get version from server
    getVersion();


    document.addEventListener("keypress", function onPress(event) {
        if (event.key === "p" && event.ctrlKey) {
            // Do something awesome
            console.log('got it, ctrl Z')
        }
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
    $("#xreference").removeClass("active");
    $("#xreference").removeClass("show");
    $("#ownerlinks").removeClass("active");
    $("#ownerlinks").removeClass("show");
    $('#ownerlinks').hide();
    $("#comparesnap").removeClass("active");
    $("#comparesnap").removeClass("show");

    $("#firstSnap").html('&lt;not selected&gt;');
    $("#secondSnap").html('&lt;not selected&gt;');

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
            px = 113;
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
            px = 157;
            checkIfDataLoaded();
            documentationTabTopic = 'graphicview';
            $('#graphic').show();
            $('#graphicHdr').show();
        } else {
            $('#graphic').hide();
            $('#graphicHdr').hide();
        }
        if (currentTab === "#security") {
            px = 123;
            checkIfDataLoaded();
            documentationTabTopic = 'security';
            $('#security').show();
            $('#securityHdr').show();
        } else {
            $('#security').hide();
            $('#securityHdr').hide();
        }
        if (currentTab === "#storage") {
            px = 123;
            checkIfDataLoaded();
            documentationTabTopic = 'storage';
            $('#storage').show();
            $('#storageHdr').show();
        } else {
            $('#storage').hide();
            $('#storageHdr').hide();
        }
        if (currentTab === "#cluster") {
            px = 165;
            checkIfDataLoaded();
            documentationTabTopic = 'cluster';
            $('#cluster').show();
            $('#clusterHdr').show();
        } else {
            $('#cluster').hide();
            $('#clusterHdr').hide();
        }
        if (currentTab === "#xreference") {
            px = 122;
            checkIfDataLoaded();
            documentationTabTopic = 'xreference';
            $('#xreference').show();
            $('#xreferenceHdr').show();
        } else {
            $('#xreference').hide();
            $('#xreferenceHdr').hide();
        }
        if (currentTab === "#ownerlinks") {
            px = 130;
            checkIfDataLoaded();
            documentationTabTopic = 'ownerref';
            $('#ownerlinks').show();
            $('#ownerlinksHdr').show();
        } else {
            $('#ownerlinks').hide();
            $('#ownerlinksHdr').hide();
        }
        if (currentTab === "#comparesnap") {
            px = 202;
            documentationTabTopic = 'comparesnap';
            $('#comparesnap').show();
            $('#comparesnapHdr').show();
        } else {
            $('#comparesnap').hide();
            $('#comparesnapHdr').hide();
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


    $('#label-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md"
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

    $('#graphic-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace(s)"
    });

    // $('#security-ns-filter').select2({
    //     dropdownCssClass: "vpkfont-md",
    //     containerCssClass: "vpkfont-md",
    //     placeholder: "select namespace"
    // });

    $('#security-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace"
    });

    $('#compareInstances').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select snapshot"
    });

    $('#compareInstances').on('select2:select', function (e) {
        var snapDir = $('#compareInstances').select2('data');
        compareSnapSelected = snapDir[0].text;
        console.log('Snap selected: ' + compareSnapSelected);
        $('#compareInstance').val(null)
    });


    $('#cluster-ns-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select namespace(s)"
    });

    $('#xref-filter').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select xref filter values"
    });

    $('#xref-type').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select xref"
    });

    $('#xrefEdit-type').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "select xref"
    });

    $('#xrefEdit-type').on('select2:select', function (e) {
        var selected = $('#xrefEdit-type option:selected').val();
        pickXref(selected);
        $('#xrefEdit-type').val(null)
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

    //-- compare dropdowns
    $('#compareSort1').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "Namespace"
    });
    $('#compareSort2').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "Name"
    });
    $('#compareView').select2({
        dropdownCssClass: "vpkfont-md",
        containerCssClass: "vpkfont-md",
        placeholder: "All"
    });

    $("#clusterType").change(function () {
        var selected = $('#clusterType option:selected').val();
        buildClusterUI(selected);
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

    //cluster tab slideout for filter and/or legend

    $(".cluster_legend").click(function (event) {
        $(".cluster_legend_box").addClass("active")
    });
    $(".cluster_legend_close").click(function (event) {
        $(".cluster_legend_box").removeClass("active")
    });

    $(".cluster_filter").click(function (event) {
        $(".cluster_filter_box").addClass("active")
    });
    $(".cluster_filter_close").click(function (event) {
        $(".cluster_filter_box").removeClass("active")
    });

    //clearDisplay();
    getSelectLists();
    getConfig();

});


// function checkForData() {
//     console.log('baseDir:@' + baseDir + '@')
//     if (baseDir !== null) {
//         if (baseDir !== '-none-') {
//             socket.emit('schematic');
//             console.log('Asked for k8cData')
//             clearInterval(checkInterval);
//         }
//     } else {
//         console.log('Interval fired')
//     }
// }

// let checkInterval = setInterval(checkForData, 1000);


// // Cluster tab slideout filter panel
// var hideClusterPanel = function () {
//     clusterPanelIsClosed = true;
//     clusterFilterPanel.style.webkitTransform = "translateX(300px)";
//     clusterFilterPanel.style.transform = "translateX(300px)"
// };

// var check3DFilter = function () {
//     if (clusterPanelIsClosed) {
//         clusterPanelIsClosed = false;
//         clusterFilterPanel.style.webkitTransform = "translateX(0px)";
//         clusterFilterPanel.style.transform = "translateX(0px)"
//     } else {
//         hideClusterPanel()
//     }
// }


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
function getCompareSnap(which) {
    compareSnapButton = which;
    let data = { 'which': which };
    socket.emit('clusterDir', data);
}

function setCompareSnap() {
    if (compareSnapButton === "1" || compareSnapButton === 1) {
        compareSnap1Selected = compareSnapSelected;
        $("#firstSnap").html(compareSnap1Selected);
    } else if (compareSnapButton === "2" || compareSnapButton === 2) {
        compareSnap2Selected = compareSnapSelected;
        $("#secondSnap").html(compareSnap2Selected);
    }
    $("#compareModal").modal('hide');
}


//...
socket.on('clusterDirResult', function (data) {
    //build the drop down of existing directories, hide messages, open modal
    var items = bldClusterDir(data.dirs);
    hideMessage();

    if (data.which === "0" || data.which === 0) {
        $('#dsInstances').html(items);
        $("#chgDirModal").modal('show');
    } else if (data.which === "1" || data.which === 1) {
        $('#compareInstances').html(items);
        $("#compareModal").modal('show');
    } else if (data.which === "2" || data.which === 2) {
        $('#compareInstances').html(items);
        $("#compareModal").modal('show');
    }
    k8cData = null;

});
//==========================================================


//----------------------------------------------------------
// snapshoit compare 
function compareSnapshots() {
    // check if snapshots are selected before running the compare
    if (compareSnap1Selected === '' && compareSnap1Selected === '') {
        showMessage('Both Snapshots must be selected before compare processing can be started. '
            + '<br><br>Use the Snapshot 1 and Snapshot 2 buttons to select the snapshots to be compared.'
            + '<br><br>Optionally set the Sorting and View Results if desired.')
    } else {
        // show processing gif and saned request for compare
        console.log('Snap 1: ' + compareSnap1Selected + '  Snap 2: ' + compareSnap2Selected);
        $("#compareDetail").empty();
        $("#compareDetail").html(processingRequest);

        let data = { 'snap1': compareSnap1Selected, 'snap2': compareSnap2Selected };
        socket.emit('compareSnapshots', data);
    }
}

//...
socket.on('compareSnapshotsResults', function (data) {
    // pass results data to the compare build UI
    buildCompareResults(data, compareSnap1Selected, compareSnap2Selected);
});

//==========================================================


//----------------------------------------------------------
// process cluster info input and pass to server 
function dynamic() {
    $("#clusterButton").hide();
    $("#clusterRunning").show();
    //$("#clusterModalFooter").hide();

    var kinfo = {};
    var kStr = '';
    if (inputFlds.length > 0) {
        for (var f = 0; f < inputFlds.length; f++) {
            var fld = inputFlds[f];
            fld = fld.trim();
            var content = document.getElementById(fld).value;
            content = content.trim();
            if (f === 0) {
                kStr = kStr + '"' + fld + '":"' + content + '" '
            } else {
                kStr = kStr + ', "' + fld + '":"' + content + '" '
            }
        }
        kStr = '{' + kStr + '}';
    }

    kinfo = JSON.parse(kStr);
    kinfo.ctype = $("#clusterType option:selected").val();
    socket.emit('connectK8', kinfo);
    $("#clusterStatus").empty();
    var resp = '<br><div><span class="vkpfont vpkcolor" style="vertical-align: middle;">Request will take several seconds to complete</span></div>';
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
function getCompareFile(fn, which) {
    socket.emit('getCompareFile', { 'fn': fn, 'which': which });
}
//...
socket.on('getCompareFileResults', function (data) {
    // if results of first file, get second file, else show files
    if (data.which === '1') {
        compFile1 = data.content;
        getCompareFile2();
    }
    if (data.which === '2') {
        compFile2 = data.content;
        compareShowFiles();
    }
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
// send request to server to get hierarchy data
function getSecurityChart(type) {
    hideMessage();
    $("#securityChartInfo").empty();
    $("#securityChartInfo").html('');
    socket.emit('getSecurityHier', { "type": type, "namespaceFilter": 'n' });
}
//...
socket.on('getSecurityHierResult', function (data) {
    console.log(JSON.stringify(data, null, 2))
    $("#securityCharts").removeAttr("height");
    $("#securityCharts").removeAttr("width");
    chartCollapsible(data, 's');
});


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
    clusterProviders = data.providers;
    populateSelectLists(data);
});
//==========================================================


//----------------------------------------------------------
// send request to server to get software version
function getVersion() {
    socket.emit('getVersion');
}
//...
socket.on('version', function (data) {
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

    // if (typeof createDefaultEngine !== 'undefined') {
    //     createDefaultEngine = null;
    //     $("#canvas3D").html('<canvas id="renderCanvas"></canvas>');
    // }
    // if (typeof engine !== null) {
    //     $("#canvas3D").html('<canvas id="renderCanvas"></canvas>');
    // }

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
        getSelectLists('y');
        // Issue #17 fix
        foundNSNamesBuilt = false;

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
    hideMessage();
    $("#schematicDetail").html(processingRequest)
    getDataRequest = 'schematic';
    if (typeof k8cData === 'undefined' || k8cData === null) {
        socket.emit('schematic');
    } else {
        if (typeof k8cData['0000-clusterLevel'] === 'undefined') {
            socket.emit('schematic');
        } else {
            console.log('k8cData exists')
            schematic();
        }
    }
}

function getCluster3DInfo() {
    hideMessage();
    // $("#clusterDetail").hide();
    // $("#clusterDetail").html('');
    $('#cluster3DView').hide();
    $("#resourceProps").html(processingRequest)
    getDataRequest = 'cluster3D';
    socket.emit('schematic');

    // if (typeof k8cData === 'undefined' || k8cData === null) {
    //     socket.emit('schematic');
    // } else {
    //     console.log('k8cData exists')
    //     buildCluster3D();
    // }
}

//...
socket.on('schematicResult', function (data) {
    k8cData = data.data;
    hideMessage();
    $("#clusterDetail").html('')
    if (getDataRequest === 'schematic') {
        schematic();
    }
    if (getDataRequest === 'cluster3D') {
        buildCluster3D();
    }
    // if (getDataRequest === 'clusterTable') {
    //     buildClusterTable();
    // }

});

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
    var kindnameValue = '';
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
    // reuse options var
    options = $('#label-filter').select2('data');
    for (var i = 0; i < options.length; i++) {
        var tmp = options[i].text;
        tmp.trim();
        labels = labels + tmp + '::';
        labelKey = true;
    };

    kindnameValue = $("#kind-name").val();
    if (typeof kindnameValue === 'undefined' || kindnameValue.length === 0) {
        kindnameValue = '';
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
        "kindnameValue": kindnameValue,
        "namespaceFilter": namespaces,
        "kindFilter": kinds,
        "skipU": skipU,
        "labelFilter": labels
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
function bldXrefChart(type) {
    hideMessage();
    chartType = type;
    let filter = '';
    let tmp;
    let data;
    let xref = $('#xref-type').select2('data');
    let options = $('#xref-type').select2('data');
    for (var i = 0; i < options.length; i++) {
        tmp = options[i].text;
        tmp = tmp.split(' : ');
        if (tmp[0] !== '') {
            xref = tmp[0];
        } else {
            showMessage('No xref type selected', 'warn');
            return;
        }
    };
    $("#xrefCharts").empty();
    $("#xrefInfo").empty();
    $("#xrefInfo").html(processingRequest);
    if (filter === '') {
        filter = ':all:-xref:';
    }
    data = { 'xref': xref, 'filter': filter };
    socket.emit('xreference', data);
}
//...
socket.on('xrefResult', function (data) {
    $("#xrefCharts2").empty();
    $("#xrefCharts2").html('');
    if (chartType === 'hierarchy') {
        $("#xrefCharts2").removeAttr("viewBox");
        chartHierarchy(data, 'x');
    } else if (chartType === 'collapsible') {
        $("#xrefCharts2").removeAttr("height");
        $("#xrefCharts2").removeAttr("width");
        chartCollapsible(data, 'x');
    } else if (chartType === 'circlePack') {
        $("#xrefCharts2").removeAttr("height");
        $("#xrefCharts2").removeAttr("width");
        chartCirclePack(data, 'x');
    }
});
//==========================================================


//----------------------------------------------------------
function xrefGetData(tmp) {
    hideMessage();
    socket.emit('getXrefRules');
}
//...
socket.on('getXrefRulesResult', function (data) {
    xrefData = data;
    xrefEditModalDialog();
});
//==========================================================


//----------------------------------------------------------
// send request to server to get xref list
function getXrefFilter(data) {
    socket.emit('getXrefFilter', data);
}
//...
socket.on('getXrefFilterResults', function (data) {
    console.log(JSON.stringify(data, null, 4))
});
//==========================================================




//----------------------------------------------------------
function getConfig() {
    socket.emit('getConfigData');
}
//...
//==========================================================

//----------------------------------------------------------
//...
//==========================================================
//==========================================================
//==========================================================
//==========================================================
//==========================================================


//----------------------------------------------------------
// item was selected from xref edit dialog
function pickXref(tmp) {
    tmp = tmp.split(':');
    tmp = tmp[0].trim();
    xrefData.picked = tmp;
    xrefHhandleSelection();
}

//==========================================================



//----------------------------------------------------------
// used by search section of main UI
function toggleFilterPanel() {

    let px;
    if ($('#filterdata').is('.collapse:not(.show)')) {
        // open filter panel
        $("#filterButton").html('Close filter panel');
        $("#filterdata").collapse("show");
        px = 303;
    } else {
        $("#filterButton").html('Open filter panel');
        $("#filterdata").collapse("hide");
        px = 113;
    }

    element = document.getElementById("banner")
    element.style['height'] = px + "px";

    element = document.getElementById("viewarea")
    px++;
    element.style['top'] = px + "px";

}


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
    // generate the UI base on selected cluster
    $('#clusterType').val('none');
    $("#clusterInfo").hide();
    $("#clusterInfo").html('');
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
function buildClusterUI(selected) {
    $("#clusterInfo").empty();
    $("#clusterInfo").html('');

    var bttn = '<div id="clusterButton">'
        + '<div style="padding-top: 20px;">'
        + '<button id="clusterBtn" type="button" class="btn btn-outline-primary btn-sm" onclick="dynamic()" style="margin: 5px;">'
        + 'Connect'
        + '</button>'
        + '</div></div>';
    // values to be used in building the UI
    var tmp00 = '<dir class="form-row">';
    var tmp01 = '<label class="col-sm-4 col-form-label vpkcolor" for="';       //add name part 1
    var tmp02 = '" style="padding-top: 15px;">';                               //add name part 2
    var tmp03 = '</label>';
    var tmp04 = '<input id="'                                                  //add ???
    var tmp05t = '" type="text" class="form-control col-sm-8" ';               //plain text input
    var tmp05p = '" type="password" class="form-control col-sm-8" ';           //password input
    var tmp06a = 'value="';                                                    //if default value is provided add the value
    var tmp06b = '"';
    var tmp07 = ' style="margin-bottom: 5px;"></div>';
    var fields = [];
    var prov = getProvider(selected);
    var parms = prov.parms;
    var html = tmp00;
    for (var f = 0; f < parms.length; f++) {
        if (typeof parms[f].value !== 'undefined') {
            var flds = parms[f].value.split('{{');
            var defs = [];
            var d = 0;
            if (typeof parms[f].default !== 'undefined') {
                defs = parms[f].default.split(',')
            }
            if (flds.length > 0) {
                for (var g = 0; g < flds.length; g++) {
                    var fn = flds[g];
                    var lp = fn.indexOf('}');
                    if (lp !== -1) {
                        fn = fn.substr(0, lp);
                    }
                    if (fn.length > 0) {
                        fields.push(fn);
                        var inf = tmp01 + fn + tmp02 + fn + tmp03 + tmp04 + fn;
                        var cfn = fn.toUpperCase();
                        if (cfn === 'PASSWORD') {
                            inf = inf + tmp05p;
                        } else {
                            inf = inf + tmp05t;
                        }
                        if (typeof defs[d] !== 'undefined') {
                            inf = inf + tmp06a + defs[d] + tmp06b + tmp07
                            d++;
                        } else {
                            inf = inf + tmp07;
                        }
                        html = html + inf;
                    }
                }
            }
        }
    }
    html = html + bttn;
    inputFlds = fields;
    $("#clusterInfo").html(html);
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

//----------------------------------------------------------
console.log('loaded vpkMain.js');
