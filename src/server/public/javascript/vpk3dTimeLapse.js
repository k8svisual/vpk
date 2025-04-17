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
// common variables for 3d cluster
//----------------------------------------------------------

let timeLapseInterval;
let timeLapseKeys;
let timeLapseKeysHL = 0;
let timeLapseI;
let timeLapseGo;
let timeLapseCurrentFunction;
let timeLapseLoop;
let timeLapseFilterS;
let timeLapseFilterN;
let timeLapseFilterNS = [];
let timeLapseData;
let timeLapseSpeed = 1;
let timeLapseGap = 100;
let timeLapseCompleted = false;
let timeLapseCSIWallInterval = '';
let timeLapseKubectlInterval = '';

function populateTimeLapseNSList() {
    let keys = Object.keys(timeline3d);
    let foundNSNames = [];
    let subData;
    let data;
    try {
        for (let i = 0; i < keys.length; i++) {
            subData = timeline3d[keys[i]]
            for (let m = 0; m < subData.length; m++) {
                if (!foundNSNames.includes(subData[m].ns)) {
                    foundNSNames.push(subData[m].ns);
                }
            }
        }
        foundNSNames.sort();
        // namespace drop downs
        data = bldOptions(foundNSNames, 'S', 'no');
        $("#timeLapse-ns-filter").empty();
        $("#timeLapse-ns-filter").html(data);
    } catch (err) {
        console.log(`Failed to build timeLapse NS list: ${err.message}`)
        console.log(`Error stack: ${err.stack}`)
    }
}

function filterTimeLapseView() {
    filterTimeLapseData();
    timeLapseSetUi();
}


function filterTimeLapseData() {
    let keys;
    let subData;
    let data = {};
    let cnt = 0;
    let skipN = 0
    let skipS = 0
    let skipNS = 0;
    let totalRec = 0;
    let keep;
    timeLapseCompleted = false;

    // Determine if Storage is shown or hidden
    if ($('#timeLapseFilterStorage').prop('checked')) {
        timeLapseFilterS = true;
    } else {
        timeLapseFilterS = false;
    }
    // Determine if Network is shown or hidden
    if ($('#timeLapseFilterNetwork').prop('checked')) {
        timeLapseFilterN = true;
    } else {
        timeLapseFilterN = false;
    }

    // Get namespace filters if defined
    timeLapseFilterNS = [];
    let options = $('#timeLapse-ns-filter').select2('data');
    if (typeof options !== 'undefined') {
        //timeLapseFilterNS.push('cluster-level');
        for (let i = 0; i < options.length; i++) {
            if (typeof options[i].text !== 'undefined') {
                timeLapseFilterNS.push(options[i].text)
            }
        }
    } else {
        timeLapseFilterNS.push('all-namespaces');
    }

    if (timeLapseFilterNS.length === 0) {
        timeLapseFilterNS.push('all-namespaces');
    }

    // Check if all data is kept
    if (timeLapseFilterN === true &&
        timeLapseFilterS === true &&
        timeLapseFilterNS[0] === 'all-namespaces') {
        timeLapseData = new Object(timeline3d)
        return;
    }

    keys = Object.keys(timeline3d);
    for (let i = 0; i < keys.length; i++) {
        subData = timeline3d[keys[i]]
        for (let s = 0; s < subData.length; s++) {
            totalRec++;
            keep = true;
            // Namespace checking
            if (timeLapseFilterNS[0] !== 'all-namespaces') {
                if (!timeLapseFilterNS.includes(subData[s].ns)) {
                    // Skip to next record this does not contain selected Namespace
                    skipNS++;
                    keep = false;
                }
            }
            // Network check
            if (timeLapseFilterN === false) {
                // Skip to next record if this record is any of the following
                if (subData[s].kind === 'Service' || subData[s].kind === 'Endpoints' || subData[s].kind === 'EndpointSlice' ||
                    subData[s].kind === 'Ingress' || subData[s].kind === 'IngressControl') {
                    skipN++;
                    keep = false;
                }
            }
            // Network check
            if (timeLapseFilterS === false) {
                // Skip to next record if this record is any of the following
                if (subData[s].kind === 'PersistentVolume' || subData[s].kind === 'PersistentVolumeClaim' ||
                    subData[s].kind === 'StorageClass') {
                    skipS++;
                    keep = false;
                }
            }
            if (keep === true) {
                if (typeof data[keys[i]] === 'undefined') {
                    data[keys[i]] = [];
                }
                data[keys[i]].push(subData[s]);
            }
        }
        cnt++;
    }

    timeLapseData = data;
    console.log(`${totalRec} Total records`)
    console.log(`${skipN} Network records skipped`)
    console.log(`${skipS} Storage records skipped`)
    console.log(`${skipNS} Namespace records skipped`)
    console.log(`${cnt} records kept`)
}


function timeLapseOpen() {
    if ($("#timeLapse_filter").is(":visible")) {
        timeLapseClose();
    } else {
        $('#clusterReportView').hide();
        $('#cluster3DView').show();
        $('#cluster').show();
        $('#slideIn_box').hide();
        filterTimeLapseView();
        timeLapse()
    }

}
function timeLapseClose() {
    clearInterval(timeLapseLoop);
    timeLapseLoop = null;
    timeLapseFilterClose();
    $('#timeLapse_filter').hide();
    const clusterSlideUpContainer = document.getElementById('clusterSlideUpContainer');
    clusterSlideUpContainer.classList.remove('clusterShow');
    // Reopen original 3D view 
    filter3DView();
}

function timeLapseFilterOpen() {
    $('#timeLapseSlideIn').addClass('open');
}

function timeLapseFilterClose() {
    $('#timeLapseSlideIn').removeClass('open');
}

function timeLapse() {
    close3dPropSlideIn();
    closeClusterFilter();
    clearAll3dItems();
    let lastTime;
    timeLapseGo = true;
    timeLapseKeys = Object.keys(timeLapseData);
    timeLapseKeysHL = timeLapseKeys.length;
    if (timeLapseKeysHL === 0) {
        showMessage('No snapshot or running cluster has been connected.', 'fail');
        return;
    }
    timeLapseKeys.sort();
    lastTime = timeLapseKeys[timeLapseKeys.length - 1];

    // Set first and last intervals
    $('#timeLapseStart').html(`First occurance: ${timeLapseKeys[0].substring(0, 10)}  ${timeLapseKeys[0].substring(11, 20)}`)
    $('#timeLapseEnd').html(`Last occurance: ${lastTime.substring(0, 10)}  ${lastTime.substring(11, 20)}`)
    // Set initial start time
    setTimeLapseClock(timeLapseKeys[0], 0, timeLapseKeysHL)

    // Show the slide up
    timeLapseCurrentFunction = 'pause';
    $('#timeLapsePause').hide();
    $('#timeLapsePlay').show();
    $('#timeLapseReset').hide();
    $('#timeLapseForward').show();
    $('#timeLapseBack').show();
    $('#timeLapse_filter').show();
    timeLapseCSIWallInterval = '';
    const clusterSlideUpContainer = document.getElementById('clusterSlideUpContainer');
    clusterSlideUpContainer.classList.add('clusterShow');

    // Set initial interval 
    timeLapseI = -1;

}

function timeLapseSetUi() {

    timeLapseKeys = Object.keys(timeLapseData);
    timeLapseKeysHL = timeLapseKeys.length;
    if (timeLapseKeysHL === 0) {
        showMessage('No snapshot or running cluster has been connected.', 'fail');
        return;
    }
    timeLapseKeys.sort();
    lastTime = timeLapseKeys[timeLapseKeys.length - 1];

    // Set first and last intervals
    $('#timeLapseStart').html(`First occurance: ${timeLapseKeys[0].substring(0, 10)}  ${timeLapseKeys[0].substring(11, 20)}`)
    $('#timeLapseEnd').html(`Last occurance: ${lastTime.substring(0, 10)}  ${lastTime.substring(11, 20)}`)
    // Set initial start time
    setTimeLapseClock(timeLapseKeys[0], 0, timeLapseKeysHL)

    // Show the slide up
    timeLapseCurrentFunction = 'pause';
    $('#timeLapsePause').hide();
    $('#timeLapsePlay').show();
    $('#timeLapseReset').show();
    $('#timeLapseForward').show();
    $('#timeLapseBack').show();
    $('#timeLapse_filter').show();
    const clusterSlideUpContainer = document.getElementById('clusterSlideUpContainer');
    clusterSlideUpContainer.classList.add('clusterShow');

    // Set initial interval 
    timeLapseI = -1;

}


function setTimeLapseClock(when, interval, max) {
    $('#timeLapseDate').html(when.substring(0, 10))
    $('#timeLapseTime').html(when.substring(11, 20))
    $('#timeLapseInt').html(`${interval} of ${max}`)
}

function timeLapseEvent() {
    timeLapseCheckStop();
    timeLapseI++;
    if (timeLapseI < timeLapseKeys.length) {
        setTimeLapseClock(timeLapseKeys[timeLapseI], timeLapseI + 1, timeLapseKeysHL);
        timeLapseWorker(timeLapseKeys[timeLapseI], 'F')
    } else {
        timeLapseStop()
    }
}

function timeLapseCheckStop() {
    if (timeLapseGo !== true) {
        clearInterval(timeLapseLoop);
        timeLapseLoop = null;
    }
}

function timeLapseStop() {
    timeLapseDone();
    clearInterval(timeLapseLoop);
    timeLapseLoop = null;
    timeLapseCompleted = true;
}

function timeLapseBack() {
    $('#timeLapseBack').prop('disabled', true);
    timeLapseWorker(timeLapseKeys[timeLapseI], 'B')
    if ((timeLapseI - 1) > -1) {
        timeLapseI--;
        setTimeLapseClock(timeLapseKeys[timeLapseI], timeLapseI + 1, timeLapseKeysHL);
    } else {
        showMessage('Start of range reached')
    }
    $('#timeLapseBack').prop('disabled', false);
}

function timeLapseForward() {
    $('#timeLapseForward').prop('disabled', true);
    if ((timeLapseI + 1) < timeLapseKeysHL) {
        timeLapseI++;
        setTimeLapseClock(timeLapseKeys[timeLapseI], timeLapseI + 1, timeLapseKeysHL);
        timeLapseWorker(timeLapseKeys[timeLapseI], 'F')
    } else {
        showMessage('End of range reached')
        timeLapseCompleted = true;
    }
    $('#timeLapseForward').prop('disabled', false);
}

function timeLapsePause() {
    $('#timeLapsePause').hide();
    $('#timeLapsePlay').show();
    $('#timeLapseReset').show();
    clearInterval(timeLapseLoop);
}

function timeLapsePlay() {
    $('#timeLapsePause').show();
    $('#timeLapsePlay').hide();
    $('#timeLapseReset').hide();
    if (timeLapseCompleted === true) {
        // close3dPropSlideIn();
        // closeClusterFilter();
        clearAll3dItems();
        timeLapseCompleted === false;
    }
    timeLapseLoop = setInterval(timeLapseEvent, timeLapseGap)
}

function timeLapseReset() {
    $('#timeLapsePause').hide();
    $('#timeLapsePlay').show();
    $('#timeLapseReset').show();
    $('#timeLapseForward').show();
    $('#timeLapseBack').show();
    timeLapseCSIWallInterval = '';
    //Reset the UI to the start
    timeLapse();
}

function timeLapseDone() {
    $('#timeLapsePause').hide();
    $('#timeLapsePlay').hide();
    $('#timeLapseReset').show();
    $('#timeLapseForward').hide();
    $('#timeLapseBack').hide();
    $('#timeLapse_filter').hide();
}

function timeLapseWorker(key, direction) {
    let data = timeLapseData[key];
    let shown = false;
    if (typeof data === 'undefined') {
        console.log(`${key} found no data`);
        return;
    }

    try {
        for (let i = 0; i < data.length; i++) {
            shown = false;
            for (let m = 0; m < meshArray.length; m++) {

                // Handle Nodes
                if (meshArray[m].type === 'Node' && data[i].kind === 'Node') {
                    if (meshArray[m].obj.name === data[i].name) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                            for (let n = 0; n < meshArray.length; n++) {
                                if (meshArray[n].type === 'Node' && meshArray[n].obj.name === '4444.' + data[i].fnum) {
                                    meshArray[n].obj.setEnabled(true);
                                }
                            }
                        } else {
                            meshArray[m].obj.setEnabled(false);
                            for (let n = 0; n < meshArray.length; n++) {
                                if (meshArray[n].type === 'Node' && meshArray[n].obj.name === '4444.' + data[i].fnum) {
                                    meshArray[n].obj.setEnabled(false);
                                }
                            }
                        }
                    }
                    shown = true;
                    continue;
                }
                // Handle Pods
                if (meshArray[m].type === 'Pod' && data[i].kind === 'Pod') {
                    if (meshArray[m].fnum === data[i].fnum) {
                        if (data[i].act === 'create' || data[i].act === 'start') {
                            if (direction === 'F') {
                                meshArray[m].obj.setEnabled(true);
                                if (typeof imageRepositoryFirst[data[i].fnum] !== 'undefined') {
                                    for (let ir = 0; ir < imageRepositoryFirst[data[i].fnum].length; ir++) {
                                        let repoName = imageRepositoryFirst[data[i].fnum][ir];
                                        for (let re = 0; re < meshArray.length; re++) {
                                            if (meshArray[re].obj.name === repoName) {
                                                meshArray[re].obj.setEnabled(true);
                                            }
                                        }
                                    }
                                }
                                if (sharedEndpoint.includes(data[i].fnum)) {
                                    for (let sep = 0; sep < meshArray.length; sep++) {
                                        if (meshArray[sep].type === 'EndpointLine' && meshArray[sep].fnum === data[i].fnum) {
                                            meshArray[sep].obj.setEnabled(true);
                                        }
                                    }
                                }
                            } else {
                                meshArray[m].obj.setEnabled(false);
                                if (typeof imageRepositoryFirst[data[i].fnum] !== 'undefined') {
                                    for (let ir = 0; ir < imageRepositoryFirst[data[i].fnum].length; ir++) {
                                        let repoName = imageRepositoryFirst[data[i].fnum][ir];
                                        for (let re = 0; re < meshArray.length; re++) {
                                            if (meshArray[re].obj.name === repoName) {
                                                meshArray[re].obj.setEnabled(false);
                                            }
                                        }
                                    }
                                }
                                if (sharedEndpoint.includes(data[i].fnum)) {
                                    for (let sep = 0; sep < meshArray.length; sep++) {
                                        if (meshArray[sep].type === 'EndpointLine' && meshArray[sep].fnum === data[i].fnum) {
                                            meshArray[sep].obj.setEnabled(false);
                                        }
                                    }
                                }

                            }
                        } else if (data[i].act === 'finish') {
                            if (direction === 'F') {
                                meshArray[m].obj.setEnabled(false);
                            } else {
                                meshArray[m].obj.setEnabled(true);
                            }
                        }
                    }

                    if (typeof epToPodLinks[data[i].fnum] !== 'undefined') {
                        let links = epToPodLinks[data[i].fnum];
                        let baseLink;
                        for (let epl = 0; epl < links.length; epl++) {
                            baseLink = links[epl];
                            for (let y = 0; y < meshArray.length; y++) {
                                if (meshArray[y].type === 'EndpointLine') {
                                    // meshArray[y].obj.name is the FNUM of the associated Endpoint
                                    if (meshArray[y].obj.name === baseLink.baseLink) {
                                        if (direction === 'F') {
                                            meshArray[y].obj.setEnabled(true);
                                        } else {
                                            meshArray[y].obj.setEnabled(false);
                                        }
                                    }
                                }
                            }
                        }
                        // Network related lines
                        // if (meshArray[m].type === 'EndpointLine' && data[i].kind === 'Endpoints') {
                        //     if (meshArray[m].obj.name === data[i].fnum) {
                        //         if (direction === 'F') {
                        //             meshArray[m].obj.setEnabled(true);
                        //         } else {
                        //             meshArray[m].obj.setEnabled(false);
                        //         }
                        //     }
                        //     shown = true;
                        //     continue;
                        // }
                        // if (meshArray[m].type === 'EndpointLine' && data[i].kind === 'EndpointSlice') {
                        //     if (meshArray[m].obj.name === data[i].fnum) {
                        //         if (direction === 'F') {
                        //             meshArray[m].obj.setEnabled(true);
                        //         } else {
                        //             meshArray[m].obj.setEnabled(false);
                        //         }
                        //     }
                        //     shown = true;
                        //     continue;
                        // }
                    }
                    shown = true;
                    continue;
                }

                if (meshArray[m].type === 'PVC' && data[i].kind === 'PersistentVolumeClaim') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                }
                if (meshArray[m].type === 'PVCLine' && data[i].kind === 'PersistentVolumeClaim') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                    continue;
                }

                if (meshArray[m].type === 'PV' && data[i].kind === 'PersistentVolume') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                }
                if (meshArray[m].type === 'PVLine' && data[i].kind === 'PersistentVolume') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                            if (typeof scToPVLink[meshArray[m].obj.name] !== 'undefined') {
                                let pvLinkName = scToPVLink[meshArray[m].obj.name]
                                for (let pv = 0; pv < meshArray.length; pv++) {
                                    if (meshArray[pv].obj.name === pvLinkName) {
                                        meshArray[pv].obj.setEnabled(true);
                                    }
                                }
                            }

                        } else {
                            meshArray[m].obj.setEnabled(false);
                            if (typeof scToPVLink[meshArray[m].obj.name] !== 'undefined') {
                                let pvLinkName = scToPVLink[meshArray[m].obj.name]
                                for (let pv = 0; pv < meshArray.length; pv++) {
                                    if (meshArray[pv].obj.name === pvLinkName) {
                                        meshArray[pv].obj.setEnabled(false);
                                    }
                                }
                            }
                        }
                    }
                    shown = true;
                    continue
                }

                if (meshArray[m].type === 'StorageClass' && data[i].kind === 'StorageClass') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                            for (let s = 0; s < meshArray.length; s++) {
                                if (meshArray[s].type === 'csiStorageLine') {
                                    if (meshArray[s].obj.name === data[i].fnum) {
                                        meshArray[s].obj.setEnabled(true);
                                    }
                                }
                            }
                        } else {
                            meshArray[m].obj.setEnabled(false);
                            for (let s = 0; s < meshArray.length; s++) {
                                if (meshArray[s].type === 'csiStorageLine') {
                                    if (meshArray[s].obj.name === data[i].fnum) {
                                        meshArray[s].obj.setEnabled(false);
                                    }
                                }
                            }
                        }
                    }
                    shown = true;
                }

                // Add storage class lines

                if (meshArray[m].type === 'Service' && data[i].kind === 'Service') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                }
                if (meshArray[m].type === 'ServiceLine' && data[i].kind === 'Service') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                    continue;
                }
                if (meshArray[m].type === 'CSINode' && data[i].kind === 'CSINode') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                            for (let c = 0; c < meshArray.length; c++) {
                                if (meshArray[c].type === 'CSILine') {
                                    if (meshArray[c].obj.name === data[i].fnum) {
                                        meshArray[c].obj.setEnabled(true);
                                    }
                                    if (timeLapseCSIWallInterval === '') {
                                        timeLapseCSIWallInterval = data[i].fnum;
                                        for (let w = 0; w < meshArray.length; w++) {
                                            if (meshArray[w].type === 'CSIWall') {
                                                meshArray[w].obj.setEnabled(true);
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            meshArray[m].obj.setEnabled(false);
                            for (let c = 0; c < meshArray.length; c++) {
                                if (meshArray[c].type === 'CSILine') {
                                    if (meshArray[c].obj.name === data[i].fnum) {
                                        meshArray[c].obj.setEnabled(false);
                                    }
                                    if (timeLapseCSIWallInterval === data[i].fnum) {
                                        timeLapseCSIWallInterval = '';
                                        for (let w = 0; w < meshArray.length; w++) {
                                            if (meshArray[w].type === 'CSIWall') {
                                                meshArray[w].obj.setEnabled(false);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    shown = true;
                    continue;
                }
                if (meshArray[m].type === 'Endpoints' && data[i].kind === 'Endpoints') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                }
                // if (meshArray[m].type === 'EndpointLine' && data[i].kind === 'Endpoints') {
                //     if (meshArray[m].obj.name === data[i].fnum) {
                //         if (direction === 'F') {
                //             meshArray[m].obj.setEnabled(true);
                //         } else {
                //             meshArray[m].obj.setEnabled(false);
                //         }
                //     }
                //     shown = true;
                //     continue;
                // }

                if (meshArray[m].type === 'Endpoints' && data[i].kind === 'EndpointSlice') {
                    if (meshArray[m].obj.name === data[i].fnum) {
                        if (direction === 'F') {
                            meshArray[m].obj.setEnabled(true);
                        } else {
                            meshArray[m].obj.setEnabled(false);
                        }
                    }
                    shown = true;
                }
            }
            if (shown === false) {
                console.log(`TimeLapse did not handle: ${JSON.stringify(data[i], null, 4)}`)
            }

        }
    } catch (err) {
        console.log(`Error occured: key: ${key}  direction: ${direction}  error: ${err.message}`)
        console.log(`Error stack: ${err.stack}`);
    }
}

function timeLapseSpeedLess() {
    timeLapseSpeed--;
    if (timeLapseSpeed < 1) {
        timeLapseSpeed = 1;
    }
    $('#timeLapseSpeed').html(timeLapseSpeed)
    timeLapseGap = timeLapseSpeed * 100;
}

function timeLapseSpeedMore() {
    timeLapseSpeed++;
    if (timeLapseSpeed > 30) {
        timeLapseSpeed = 30;
    }
    $('#timeLapseSpeed').html(timeLapseSpeed)
    timeLapseGap = timeLapseSpeed * 100;
}

function timeLapseIntervalDetail() {
    let key = timeLapseKeys[timeLapseI];
    let data = timeLapseData[key];
    if (typeof data !== 'undefined') {
        data.sort();
        if (typeof data !== 'undefined') {
            let detail = '<div class="mt-1 mb-3 vpkblue vpkfont-lg"><b>'
                + key.substring(0, 10) + ' ' + key.substring(11, 20)
                + '</b></div>'
                + '<table><tr><th>Action</th><th>Kind</th><th>Namespace</th><th>Name</th></tr>';
            for (let i = 0; i < data.length; i++) {
                detail = detail + '<tr>'
                    + '<td>' + data[i].act + '</td>'
                    + '<td>' + data[i].kind + '</td>'
                    + '<td>' + data[i].ns + '</td>'
                    + '<td>' + data[i].name + '</td></tr>'
            }
            detail = detail + '</table>'
            $('#timeLapseBody').html(detail);
            $("#timeLapseModal").modal('show');
        } else {
            showMessage('No data to display for this time interval.')
        }
    } else {
        showMessage('No data to display for this time interval.')
    }
}


//----------------------------------------------------------
console.log('loaded vpk3dTimeLapse.js');

