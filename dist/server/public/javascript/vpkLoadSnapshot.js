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
// Screen handling code for loading or creating Snapshot
//----------------------------------------------------------

let volumeCountsType;
let volumeCountsNode;
let volumeCountsNS;
let volumeCountsPod;
let volumeAttachments;
let storageVolumes;
let evtFirstTime = 0;
let evtLastTime = 0;
let evtStatsFirstTime = 0;
let evtStatsLastTime = 0;
let evtTotalDuration = 0;
let evtMaxMinutes = 0;
let evtMinutes;
let evtNs;
let evtNsSum;
let namespaceFnum;
let timeline3d;
let networkNodes;
let networkServicesToPods;
let imageRepositoryData = '';
let imageRepository = '';
let imageRepositoryFirst = '';
let vpkstats = '';
let helmManaged = '';

//----------------------------------------------------------
// show change directory modal
function changeDir() {
    let data = { which: 0 };
    socket.emit('clusterDir', data);
    $('#validateBtn').show();
    $('#loadStatus').hide();
    $('#chgDirFooter').show();
}

//...
socket.on('clusterDirResult', function (data) {
    //build the drop down of existing directories, hide messages, open modal
    var items = bldClusterDir(data.dirs);
    hideMessage();

    if (data.which === '0' || data.which === 0) {
        $('#dsInstances').html(items);
        $('#chgDirModal').modal('show');
    }
    k8cData = null;
});
//==========================================================

//----------------------------------------------------------
// process cluster info input and pass to server
function dynamic() {
    $('#clusterRunning').show();
    let kinfo = {};
    let k8n;
    kinfo.snapshot_prefix = document.getElementById('snapshot_prefix').value;
    kinfo.command = document.getElementById('get_cmd').value;
    k8n = document.getElementById('k8_namespace').value;
    if (k8n === '<all>') {
        kinfo.namespace = '';
    } else {
        kinfo.namespace = k8n;
    }

    let host_fnd = 0;
    if (document.getElementById('host_ip').value !== '') {
        host_fnd++;
        if (document.getElementById('host_user').value !== '') {
            host_fnd++;
            if (document.getElementById('host_password').value !== '') {
                host_fnd++;
                kinfo.host_ip = document.getElementById('host_ip').value;
                kinfo.host_user = document.getElementById('host_user').value;
                kinfo.host_pswd = document.getElementById('host_password').value;
            }
        }
    }
    if (host_fnd === 0 || host_fnd === 3) {
        // all is fine
    } else {
        // display message modal that all data is not provided
        showMessage('All parameters for SSH command not provided', 'fail');
        return;
    }

    socket.emit('connectK8', kinfo);
    $('#clusterStatus').empty();
    var resp = '<div><span class="vkpfont vpkblue" style="vertical-align: middle;">Request will take several seconds to complete</span></div>';
    $('#clusterStatus').html(resp);
}

//...
socket.on('getKStatus', function (data) {
    //$("#clusterModalFooter").hide();
    $('#clusterStatus').empty();
    $('#clusterStatus').html('');
    let msg = 'Processing request';
    if (typeof data.msg !== 'undefined') {
        msg = data.msg;
    }
    // If the done value is found, show done message
    if (typeof data.done !== 'undefined') {
        msg = "Processing completed. Use 'Close' button' to close window.";
    }
    let resp = '<br><div class="vpkfont vpkblue">' + msg + '</div>';
    $('#clusterStatus').html(resp);
});

//...
socket.on('getsDone', function (data) {
    let msg = "Processing completed. Use 'Close' button' to close window.";
    let resp = '<br><div class="vpkfont vpkblue">' + msg + '</div>';
    $('#clusterStatus').html(resp);
});

socket.on('parseStatus', function (data) {
    let msg;
    if (typeof data.msg !== 'undefined') {
        msg = data.msg;
    } else {
        msg = 'Parsing files';
    }
    let resp = '<br><div class="vpkfont vpkblue">' + msg + '</div>';
    $('#parseStatus').html(resp);
});
//==========================================================

//==========================================================

//----------------------------------------------------------
function getSelectLists() {
    socket.emit('getServerData');
}

function closeGetCluster() {
    getSelectLists();
    $('#clusterModal').modal('hide');
}

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
        console.log('VpK runMode: Local');
    } else {
        console.log('VpK runMode: Container');
    }

    if (runMode !== 'C') {
        $('#sourceDropDown').html(
            '<select id="pickDataSource" class="vkpfont-md">' +
                '<option></option>' +
                '<option>Running cluster</option>' +
                '<option>Previous captured snapshot</option>' +
                '</select>',
        );
        $('#sshInfo').hide();
    } else {
        $('#sourceDropDown').html(
            '<select id="pickDataSource" class="vkpfont-md">' +
                '<option></option>' +
                '<option>Running cluster</option>' +
                '<option>Previous captured snapshot</option>' +
                '<option>Run command in container</option>' +
                '</select>',
        );
        $('#sshInfo').show();
    }

    $('#pickDataSource').select2({
        dropdownCssClass: 'vpkselect2',
        selectionCssClass: 'vpkselect2',
        placeholder: 'Select option',
        theme: 'classic',
        multiple: false,
        width: 225,
    });
    $('#pickDataSource').on('select2:select', function (e) {
        var selected = $('#pickDataSource option:selected').val();
        pickData(selected);
        $('#pickDataSource').val(null);
    });

    // set the edit theme for light or dark
    if (data.editTheme === true) {
        aceTheme = 'chrome';
    } else {
        aceTheme = 'merbivore';
    }

    // set the 3d cluster background
    if (typeof data.clusterBackground !== 'undefined') {
        clusterBack = data.clusterBackground;
        setSelectValue('clusterBG', clusterBack);
    } else {
        clusterBack = 'Grey';
    }
});

//==========================================================

//----------------------------------------------------------
// send request to load new directory
function reload() {
    var newDir;
    $('#validateBtn').hide();
    $('#chgDirFooter').hide();
    $('#loadStatus').show();
    newDir = $('#dsInstances').select2('data');
    newDir = newDir[0].text;
    $('#searchResults').hide();
    $('#svgResults').empty();
    $('#svgResults').html('');
    $('#schematicDetail').empty();
    $('#schematicDetail').html('');
    $('#ownerRefLinksDetail').empty();
    $('#ownerRefLinksDetail').html('');
    $('#cluster3DView').hide();

    //This will clear any previously loaded data
    k8cData = null;
    socket.emit('reload', newDir);
}

socket.on('reloadResults', function (data) {
    if (data.validDir === false) {
        setBaseDir(data.baseDir);
        $('#chgDirModal').modal('hide');
        showMessage('Failed to connect to datasource', 'fail');
    } else {
        socket.emit('getServerData');
    }
});

//----------------------------------------------------------

socket.on('getServerDataResult', function (data) {
    // Process the returned data
    setBaseDir(data.baseDir);
    rootDir = data.baseDir;
    baseDir = data.baseDir;
    k8cData = data.pods;
    schematicKeys = data.keys;
    svgInfo = data.info;
    nsResourceInfo = data.nsRI;
    workloadEventsInfo = data.evts;
    //
    // Research memory leaks
    //
    oRefLinks = data.oRef;
    // Build an Object with all OwnerRef fnums
    buildOwnerRefExists();
    //
    storageData = data.stor;
    helmData = data.helm;

    imageRepository = data.registry;
    imageRepositoryData = data.registryData;
    imageRepositoryFirst = data.registryFirst;

    configMapsFound = data.configMapsFound;
    secretsFound = data.secretsFound;
    eventsInfo = data.events;
    volumeCountsType = data.volumeCountsType;
    volumeCountsNode = data.volumeCountsNode;
    volumeCountsNS = data.volumeCountsNS;
    volumeCountsPod = data.volumeCountsPod;
    storageVolumes = data.storageVolumes;

    // Turned OFF - rewrite event time line logic
    evtFirstTime = data.eventStats.firstTime;
    evtLastTime = data.eventStats.lastTime;
    evtTotalDuration = data.eventStats.totalDuration;

    evtStatsFirstTime = data.eventStats.firstTime;
    evtStatsLastTime = data.eventStats.lastTime;
    evtStatsTotalDuration = data.eventStats.totalDuration;

    evtMaxMinutes = parseInt(evtTotalDuration / 60);
    evtMinutes = data.eventStats.evtMinutes;
    evtNs = data.eventStats.evtNs;
    evtNsSum = data.eventStats.evtNsSum;
    namespaceFnum = data.namespaceFnum;
    timeline3d = data.timeline;
    networkNodes = data.networkNodes;
    networkServicesToPods = data.networkServiceToPods;
    helmManaged = data.helm;
    vpkstats = data.stats;
    volumeAttachments = data.volumeAttachments;

    if (typeof data.filters !== 'undefined') {
        clusterFilters = data.filters;
        setClusterFilters();
    }

    hideMessage();
    populateSelectLists(data);
    populateRepositoryList();
    populateSchematicList();
    buildStorage();
    processimageRepositoryData();
    //populateEventNSList();
    populateTimeLapseNSList();
    $('#evtMinutesRange').html(`(Range 0 to ${evtMaxMinutes})`);
    evtShowStats();
    showClusterTab();
    createClusterSummary();
    // loadNetworkIPS();

    $('#loadStatus').hide();
    $('#chgDirFooter').show();
    $('#chgDirModal').modal('hide');
    if (baseDir !== '-none-') {
        $('#splashVpKModal').modal('hide');
        showMessage('Data snapshot connected', 'pass');
    }

    // clear display areas of old data
    $('#chartInfo').html('');
    $('#statsCharts2').html('');
    $('#schematicDetail').html('');
    $('#oRefWrapper').html('');

    foundNSNamesBuilt = false;
    data = null;
});

function processimageRepositoryData() {
    let keys = Object.keys(imageRepository);
    for (let i = 0; i < keys.length; i++) {
        sortimageRepositoryData(keys[i]);
    }
}

// Sort the idata
function sortimageRepositoryData(repository) {
    let tmp = [];
    let keys = [];
    let key = '';
    let ptr;
    let data = imageRepositoryData[repository];
    for (let i = 0; i < data.length; i++) {
        key =
            data[i].image + '::' + data[i].ns + '::' + data[i].kind + '::' + data[i].fnum + '::' + data[i].c_type + '::' + data[i].c_name + '::' + i;
        keys.push(key);
    }
    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        ptr = keys[i].split('::');
        ptr = ptr[6];
        tmp.push(data[ptr]);
    }
    imageRepositoryData[repository] = tmp;
    data = null;
}

//==========================================================

//----------------------------------------------------------
// get Cluster information
function getCluster() {
    hideMessage();
    $('#clusterInfo').show();
    $('#clusterButton').show();
    $('#clusterModal').modal({
        backdrop: 'static',
        keyboard: false,
    });
    $('#clusterRunning').hide();
    $('#clusterModalFooter').show();
    $('#clusterModal').modal('show');
    $('#clusterStatus').empty();
    $('#clusterStatus').html('');
}

function sendCommand() {
    let command = $('#commandInput').val();
    console.log('send command to host: ' + command);
    socket.emit('runCommand', command);
}

socket.on('commandResult', function (data) {
    let out = data.output;
    let html = '';
    for (let i = 0; i < out.length; i++) {
        html = html + out[i] + '\n';
    }

    $('#commandOutput').html(html);
});

function closeRunCommand() {
    $('#commandModal').modal('hide');
}

function openRunCommand() {
    $('#commandModal').modal('show');
}

function pickData(what) {
    what.trim();
    if (what === 'Running cluster') {
        getCluster();
    } else if (what === 'Previous captured snapshot') {
        changeDir();
    } else if (what === 'Run command in container') {
        openRunCommand();
    }
}

//----------------------------------------------------------
console.log('loaded vpkLoadSnapshot.js');
