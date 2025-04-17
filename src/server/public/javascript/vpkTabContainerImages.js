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
// Container Images / Registries handler
//----------------------------------------------------------

let cY = 0;
let endY = 0;
let id = 0;
let graphRepository = '';

function viewRepositoryLegend() {
    $("#imagesLegendModal").modal('show');
}

function getRepositoryData() {
    let option;
    let repository;
    option = $('#repository-list').select2('data');
    if (typeof option !== 'undefined') {
        repository = option[0].text;
        repository = repository.trim();
        graphRepository = repository;

        if (repository.indexOf('Select Repository') > -1) {
            showMessage('Select a valid repository.', 'fail');
            return;
        } else {
            containerImagesInfo = imageRepositoryData[repository];
            let html = '<div class="vpkfont vpkblue px-2">Viewing repository:<b> ' + repository + '</b></div>'
            $('#selectedRepository').html(html);
            $('#containerImagesReturn').html('')
            loadContainerImagesTable();
            buildContainerImageGraphics(repository);
            $('#containerImageTable').show();
            $('#containerImageGraphic').hide();
        }
    } else {
        console.log(`No data founf for Repository: ${option}`)
    }
}

// Called from Cluster tab
function loadRepositoryData(repository, view, returnTo) {
    graphRepository = repository;   //container-images-select
    setSelectValue('repository-list', repository)
    $('#containerImagesReturn').html(
        '<span class="vpkfont mt-1 mb-2 ml-2 px-2">'
        + '<button type="button" class="mt-1 mb-1 btn btn-sm btn-secondary vpkButtons px-2" '
        + ' style="margin-left: -8px;" onclick="returnToWhereTab(\'' + returnTo + '\',\'containerImagesReturn\')">Return</button>'
        + '<span class="px-1">to</span>' + returnTo + '<span class="px-1">tab</span>'
        + '</span>'
    )

    containerImagesInfo = imageRepositoryData[repository];
    loadContainerImagesTable();
    buildContainerImageGraphics(repository);

    // T = Show Table View button, otherwise show graph view
    if (view === 'T') {
        $('#containerImageTable').show();
        $('#containerImageGraphic').hide();
    } else {
        $('#containerImageTable').hide();
        $('#containerImageGraphic').show();
    }
    // Open the target tab
    $('.nav-tabs a[href="#containerImages"]').tab('show');
}

function graphImageTable() {
    let repo = graphRepository;
    let seletedImageTable = [];
    try {
        for (let i = 0; i < containerImagesInfo.length; i++) {
            if (containerImagesInfo[i].state === true) {
                seletedImageTable.push({
                    'ns': containerImagesInfo[i].ns,
                    'image': containerImagesInfo[i].image,
                    'fnum': containerImagesInfo[i].fnum,
                    'c_name': containerImagesInfo[i].c_name,
                    'kind': containerImagesInfo[i].kind,
                    'c_type': containerImagesInfo[i].c_type,
                    'state': true
                })
            }
        }
        buildContainerImageGraphics(repo, seletedImageTable)
        containerImagesInfo = imageRepositoryData[repo];
        loadContainerImagesTable();
        $('#containerImageTable').hide();
        $('#containerImageGraphic').show();
    } catch (err) {
        console.log(`Failed to process selected Container Images to graph, message: ${err}`)
        console.log(`Error stack: ${err.stack}`)
    }
}


function toggleImagesView() {
    if (document.getElementById("containerImageTable").style.display != "none") {
        $('#containerImageTable').hide();
        $('#containerImageGraphic').show();
    } else {
        $('#containerImageTable').show();
        $('#containerImageGraphic').hide();
    }
}

// Show the table defined in index.ejs id="evtMsgs"
function loadContainerImagesTable() {
    $("#tableContainerImages").bootstrapTable('load', containerImagesInfo)
    $("#tableContainerImages").bootstrapTable('hideColumn', 'c_type');
    $("#tableContainerImages").bootstrapTable('hideColumn', 'c_name');
    $("#tableContainerImages").bootstrapTable('hideColumn', 'fnum');
}

function buildContainerImageGraphics(repository, what) {
    let data;
    if (typeof what === 'undefined' || what === null) {
        data = imageRepositoryData[repository];
    } else {
        data = what;
    }
    let rtn = '';
    let oldImg = '';
    let oldNS = '';
    let oldKind = '';
    let oldContainerName = '';

    let nsYStart = 60;
    let nsYEnd = 0;

    let kindYStart = 90;
    let kindYEnd = 0;

    let containerYStart = 120;
    let containerYEnd = 0;

    let line = '';

    endY = 0;
    cY = 0;        // Current Y position

    let hdr = '';

    // Build root icon for repository
    rtn = svgRepository(repository)
    cY = cY + 30

    for (let i = 0; i < data.length; i++) {
        line = '';
        // Image name has changed
        if (oldImg !== data[i].image) {
            line = line + svgImage(data[i].image, cY)
            oldImg = data[i].image;
            oldNS = '';
            oldKind = '';
            oldContainerName = '';
            cY = cY + 30;
            nsYStart = cY;
        }
        rtn = rtn + line;
        line = '';

        // Check if Namespace has changed
        if (oldNS !== data[i].ns) {
            line = line + svgNamespace(data[i].ns, cY)
            oldNS = data[i].ns;
            oldKind = '';
            oldContainerName = '';
            nsYEnd = cY + 15;
            // Create vertical lines for Namespace
            line = line + '<line x1="55" y1="' + nsYStart + '" x2="55" y2="' + nsYEnd + '" stroke="blue" stroke-width="1.5" stroke-linecap="round"/>'
            nsYStart = nsYEnd;
            cY = cY + 30;
            kindYStart = cY;
        }
        rtn = rtn + line;
        line = '';

        // Check if Kind has changed
        if (oldKind !== data[i].kind + '.' + data[i].fnum) {
            line = line + svgKind(data[i].kind + '.' + data[i].fnum, cY)
            oldKind = data[i].kind + '.' + data[i].fnum;
            oldContainerName = '';
            kindYEnd = cY + 15;
            // Create vertical lines for Kinds
            line = line + '<line x1="95" y1="' + kindYStart + '" x2="95" y2="' + kindYEnd + '" stroke="green" stroke-width="1.5" stroke-linecap="round"/>'
            cY = cY + 30;
            kindYEnd = cY;
            containerYStart = cY;
        }
        rtn = rtn + line;

        line = '';
        if (oldContainerName !== data[i].c_name) {
            line = line + svgContainer(data[i].c_name, data[i].c_type, cY, data[i].fnum, data[i].image)
            oldContainerName = data[i].c_name;
            containerYEnd = cY + 15;;
            // Create vertical lines for Containers
            line = line + '<line x1="135" y1="' + containerYStart + '" x2="135" y2="' + containerYEnd + '" stroke="red" stroke-width="1.5" stroke-linecap="round"/>'
            containerYStart = containerYEnd;
            cY = cY + 30;
            containerYEnd = cY;
        }
        rtn = rtn + line;
    }

    // Create vertical line for Repository
    rtn = rtn + '<line x1="15" y1="30" x2="15" y2="' + endY + '" stroke="gray" stroke-width="2.0" stroke-linecap="round"/>'

    hdr = '<div><hr>' + '<svg id="' + repository + '" width="1200" height="' + cY + '">'
    rtn = hdr + rtn + '</svg></div>';

    $("#containerImageGraphic").html(rtn);
}


function svgRepository(repository) {
    // return rtn = '<div><hr>' + '<svg id="repo-' + repository + '" width="1200" height="950">'
    return '<image x="0" y="0"  width="30" height="30" href="images/3d/3d-repository.png" onclick="getDefFnum(\'noData\')"/>'
        + '<text x="40" y="20" fill="black" class="vpkfont" onclick="getDefFnum(\'noData\')">REPOSITORY: ' + repository + '</text>'
}

function svgImage(image, y) {
    let yLine = y + 15;
    let yText = y + 15
    endY = yLine;
    return '<image x="40" y="' + y + '"  width="30" height="30" href="images/3d/3d-docker-image.png" onclick="getDefFnum(\'noData\')"/>'
        + '<text x="80" y="' + yText + '" fill="black" class="vpkfont" onclick="getDefFnum(\'noData\')">IMAGE: ' + image + '</text>'
        + '<line x1="15" y1="' + yLine + '" x2="37" y2="' + yLine + '" stroke="gray" stroke-width="2.0" stroke-linecap="round"/>'
}

function svgNamespace(ns, y) {
    let yLine = y + 15;
    let yText = y + 15
    let yIcon = y - 5;
    let nsFnum;
    // Check for namespace Fnum
    if (typeof namespaceFnum[ns] !== 'undefined') {
        nsFnum = namespaceFnum[ns];
    } else {
        nsFnum = 'noData';
    }
    return '<image x="80" y="' + yIcon + '"  width="30" height="30" href="images/k8/ns.svg"  onclick="getDefFnum(\'' + nsFnum + '\')"/>'
        + '<text x="120" y="' + yText + '" fill="black" class="vpkfont" onclick="getDefFnum(\'' + nsFnum + '\')">NAMESPACE: ' + ns + '</text>'
        + '<line x1="55" x2="78" y1="' + yLine + '" x2="78" y2="' + yLine + '" stroke="blue" stroke-width="1.5" stroke-linecap="round"/>'
}

function svgKind(kindFnum, y) {
    let yLine = y + 15;
    let yText = y + 15
    let yIcon = y - 5;
    let parts = kindFnum.split('.');
    let kind = parts[0];
    let fnum = parts[1];
    let kindIcon = 'pod.svg';

    if (kind === 'Deployment') {
        kindIcon = 'deploy.svg';
    } else if (kind === 'ReplicaSet') {
        kindIcon = 'rs.svg';
    } else if (kind === 'CronJob') {
        kindIcon = 'cronjob.svg';
    } else if (kind === 'Job') {
        kindIcon = 'job.svg';
    } else if (kind === 'StatefulSet') {
        kindIcon = 'sts.svg';
    } else if (kind === 'DaemonSet') {
        kindIcon = 'ds.svg';
    } else if (kind === 'Pod') {
        kindIcon = 'pod.svg';
    } else {
        console.log(`======== Icon type not defined for this kind: ${kind}`)
    }

    return '<image x="120" y="' + yIcon + '"  width="30" height="30" href="images/k8/' + kindIcon + '" onclick="getDefFnum(\'' + fnum + '\')"/>'
        + '<text x="160" y="' + yText + '" fill="black" class="vpkfont" onclick="getDefFnum(\'' + fnum + '\')">KIND: ' + kind + '</text>'
        + '<line x1="95" y1="' + yLine + '" x2="118" y2="' + yLine + '" stroke="green" stroke-width="1.5" stroke-linecap="round"/>'
}

function svgContainer(name, type, y, fnum, image) {
    let yLine = y + 15;
    let yText = y + 15
    let yIcon = y - 5;

    let cIcon = '';
    let cType = '';

    if (type === 'C') {
        cIcon = '3d-docker-container.png';
        cType = 'CONTAINER'
    } else {
        cIcon = '3d-docker-container-init.png';
        cType = 'INIT CONTAINER'
    }

    return '<image x="160" y="' + yIcon + '"  width="30" height="30" href="images/3d/' + cIcon + '"  onclick="getDefFnumAtItem(\'' + fnum + '\',\'' + image + '\')"/>'
        + '<text x="200" y="' + yText + '" fill="black" class="vpkfont" onclick="getDefFnumAtItem(\'' + fnum + '\',\'' + image + '\')">' + cType + ': ' + name + '</text>'
        + '<line x1="135" y1="' + yLine + '" x2="156" y2="' + yLine + '" stroke="red" stroke-width="1.5" stroke-linecap="round"/>'
}


//----------------------------------------------------------
console.log('loaded vpkTabContainerImages.js');
