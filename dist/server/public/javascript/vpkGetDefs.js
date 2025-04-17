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
// functions to handle get files from server
//----------------------------------------------------------


// send request to server to get object definition
function getDef(def) {
    selectedDef = def;
    if (selectedDef.indexOf('undefined') > -1) {
        showMessage('Unable to locate source yaml.', 'fail');
    } else {
        editObj();
    }
}

function noDefInfo() {
    showMessage('No resource data available for the selected item.', 'warn');
}

function getDef2(def) {
    let parts = def.split('@');
    let data;
    let type;
    if (parts.length === 2) {
        data = k8cData[parts[1]];
        type = parts[0];
        selectedDef = parts[1];  // fnum
    } else {
        return;
    }

    if (type === 'workload') {
        editObj();
    } else if (type === 'ControllerRevision' || type === 'PersistentVolume' || type === 'StorageClass' || type === 'CRD') {
        editObj();
    } else if (type === 'level1' || type === 'level2') {
        partChain(type, data.creationChain)
    } else if (type === 'EndPoint' || type === 'EndPointSlice' || type === 'Service') {
        partServices(type, data.Services)
    } else if (type === 'Secret') {
        partArray(type, data.Secret)
    } else if (type === 'ConfigMap') {
        partArray(type, data.ConfigMap)
    } else if (type === 'PVC') {
        partPVC(type, data.PersistentVolumeClaim)
    } else if (type === 'ServiceAccount') {
        partArray(type, data.ServiceAccount)
    } else if (type === 'UnKn') {
        // ToDo consider adding a message that informs user about this
        return;
    }
}


function getDefSec(data) {
    let items = data.split('::');
    let nData = []
    let src;
    // Old lookup handler will check for source file 
    if (items.length === 3) {
        console.log(`getDefSec() Using source file: ${items[0]}`)
        if (items[2] === 'file') {
            items[2] = 'Secret';
        }
        nData.push({
            'source': items[0],
            'part': items[1],
            'name': items[2]
        });
        multiList('Secret', nData);
    } else {
        nData.push({
            'fnum': data,
            'name': 'secret'
        });
        multiList('Secret', nData);
    }
}

function getDefFnumAtItem(data, item) {
    aceSearchValue = item;
    if (data === 'noData') {
        noDefInfo();
        return;
    }
    if (data === 'missing') {
        $("#yamlModal").modal('show');
        return;
    }
    selectedDef = data;
    editObj();
}


function getDefFnum(data) {
    if (data === 'noData') {
        noDefInfo();
        return;
    }
    if (data === 'missing') {
        $("#yamlModal").modal('show');
        return;
    }
    selectedDef = data;
    editObj();
}

function partArray(type, data) {
    let fn;
    try {
        if (type === 'Secret') {
            multiList(type, data);
        }
        if (data.length > 1) {
            multiList(type, data);
        } else {
            if (typeof data[0].source !== 'undefined') {
                selectedDef = data[0].source
                if (typeof data[0].part !== 'undefined') {
                    selectedDef = selectedDef + '::' + data[0].part + '::' + data[0].name;
                } else {
                    selectedDef = selectedDef + '::0::name';
                }
            } else {
                if (typeof data[0].fnum !== 'undefined') {
                    selectedDef = data[0].fnum;
                }
            }
            editObj();
        }
    } catch(err) {
        console.log(`partArray() Error processing request, message: ${err}`)
        console.log(`Error stack: ${err.stack}}`);
    }
}

function partPVC(type, data) {
    let fnum;
    // let fn;
    if (data.length > 1) {
        multiList(type, data)
    }
    try {
        fnum = data[0].claimFnum;
        selectedDef = fnum;
        editObj();
    } catch (err) {
        console.log(`partPVC() Error processing request, message: ${err}`)
        console.log(`Error stack: ${err.stack}}`);
    }
}

function partChain(type, data) {
    let fnum;
    let fn;
    try {
        if (type === 'level1') {
            fnum = data.level1Fnum
            if (fnum === 'missing') {
                $("#yamlModal").modal('show');
                return;
            }
            selectedDef = fnum;
            editObj();
        }
        if (type === 'level2') {
            fnum = data.level2Fnum
            if (fnum === 'missing') {
                $("#yamlModal").modal('show');
                return;
            }
            selectedDef = fnum;
            editObj();
        }
    } catch (err) {
        console.log(`partChain() Error processing request, message:  ${err}`)
        console.log(`Error stack: ${err.stack}}`);
    }
}

function partServices(type, data) {
    data = data[0];
    try {
        if (type === 'Service') {
            let fnum = data.fnum;
            selectedDef = fnum;
            editObj();
        }
        if (type === 'EndPoint') {
            let fnum;
            if (data.ep !== '') {
                fnum = data.ep;
            }
            if (data.eps !== '') {
                fnum = data.eps;
            }
            selectedDef = fnum;
            editObj();
        }
        if (type === 'EndPointSlice') {
            let fnum;
            if (data.ep !== '') {
                fnum = data.ep;
            }
            if (data.eps !== '') {
                fnum = data.eps;
            }
            selectedDef = fnum;
            editObj();
        }
    } catch (err) {
        console.log(`partServices() Error processing request, message:  ${err}`)
        console.log(`Error stack: ${err.stack}}`);
    }
}

function multiList(type, data) {
    $("#multiContents").empty();
    $("#multiContents").html('')
    let html = '';
    let ref;
    let use;
    let getDef = 'getDef';
    for (let i = 0; i < data.length; i++) {

        if (typeof data[i].source !== 'undefined') {
            ref = data[i].source + '::' + data[i].part + '::' + data[i].name;
        }

        if (typeof data[i].fnum !== 'undefined') {
            getDef = 'getDefFnum';
            ref = data[i].fnum;
        }

        if (typeof data[i].use !== 'undefined') {
            use = ' (' + data[i].use + ')';
        } else {
            use = '';
        }
        html = html
        + '<div class="multiList">'
        + '<button type="button" class="btn btn-sm btn-outline-primary vpkfont-md ml-1"'
        + 'onclick="' + getDef + '(\'' + ref + '\')">' + type + '</button>';

        if (type === 'Secret') {
            html = html
                + '&nbsp;&nbsp<button type="button" class="btn btn-sm btn-outline-primary vpkfont-md ml-1"'
                + 'onclick="getDefDecode(\'' + ref + '\', \'' + data[i].name + use + '\')">Decode</button>';
        }
        html = html
            + '&nbsp;&nbsp;' + data[i].name + use + '</div>'
    }

    $("#multiContents").html(html)

    $("#multiModal").modal('show');
}


//----------------------------------------------------------
console.log('loaded vpkGetDefs.js');
