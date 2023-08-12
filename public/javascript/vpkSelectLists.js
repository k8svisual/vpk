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
// populate drop down options for UI
//----------------------------------------------------------


function populateSelectLists(data) {
    // reset indicator for 3d selection dropdown built process
    foundNSNamesBuilt = false;

    popCnt++;
    var options;

    // populate providers always
    options = bldProviders(data.providers, 'P', 'no');
    $("#clusterType").html(options);

    // populate only if valid datasource
    if (data.validDir === false) {
        setBaseDir(data.baseDir);
    } else {
        setBaseDir(data.baseDir);
        rootDir = data.baseDir;
        baseDir = data.baseDir;

        // filter bar1 (namespaces) and grapcis and cluster drop downs
        options = bldOptions(data.namespaces, 'N', 'select2');
        options.sort();

        $("#ns-filter").empty();
        $("#ns-filter").select2({
            data: options,
            dropdownCssClass: "vpkfont-md",
            containerCssClass: "vpkfont-md"
        });

        $("#graphic-ns-filter").empty();
        $("#graphic-ns-filter").select2({
            data: options,
            dropdownCssClass: "vpkfont-md",
            containerCssClass: "vpkfont-md"
        });

        let secTemp = [];
        options.sort();
        for (let i = 0; i < options.length; i++) {
            if (i === 0) {
                secTemp.push({ 'id': 0, 'text': ' ' });
                secTemp.push({ 'id': 0, 'text': '<cluster-level>' });
            }
            if (options[i].text === 'all-namespaces' || options[i].text === 'cluster-level') {
                //console.log('skipped');
            } else {
                secTemp.push(options[i])

            }
        }

        options = bldOptions(data.namespaces, 'S', 'no');

        $("#security-ns-filter").empty();
        $("#security-ns-filter").html(options);

        // filter bar2 (resource kinds)
        options = bldOptions(data.kinds, 'K', 'select2');
        $("#kind-filter").empty();
        $("#kind-filter").select2({
            data: options,
            dropdownCssClass: "vpkfont-md",
            containerCssClass: "vpkfont-md"
        });

        // filter bar3 (resource kinds)
        if (typeof data.labels !== 'undefined') {
            options = bldOptions(data.labels, 'L', 'select2');
            $("#label-filter").empty();
            $("#label-filter").select2({
                data: options,
                dropdownCssClass: "vpkfont-md",
                containerCssClass: "vpkfont-md"
            });
        }

        populateXrefLists(data);

        populateExplains(data);
    }
}

function populateExplains(data) {
    if (typeof data.explains !== 'undefined') {
        let item;
        let html = '';
        let tmp;
        let desc;
        let version;
        let kind;
        let str;
        let keys = Object.keys(data.explains);
        for (let i = 0; i < keys.length; i++) {
            item = data.explains[keys[i]];
            tmp = item.split('DESCRIPTION:')
            if (typeof tmp[1] !== 'undefined') {
                desc = tmp[1];
            } else {
                desc = 'Description not located'
            }
            desc = desc.trim();

            tmp = tmp[0];
            tmp = tmp.trim();
            tmp = tmp.split('VERSION:')

            if (typeof tmp[1] !== 'undefined') {
                version = tmp[1];
            } else {
                version = 'Version not located'
            }
            version = version.trim();

            tmp = tmp[0];
            tmp = tmp.trim();
            tmp = tmp.split('KIND:')
            if (typeof tmp[1] !== 'undefined') {
                kind = tmp[1];
            } else {
                kind = 'Version not located';
            }
            kind = kind.trim();

            explainInfo[kind] = {
                'kind': kind,
                'version': version,
                'desc': desc
            }
        }
    }
}


function populateXrefLists(data) {
    // xref-type dropdown
    if (typeof data.xRefs !== 'undefined') {
        options = buildXrefType(data.xRefs);

        $("#xref-type").empty();
        $("#xref-type").select2({
            data: options,
            dropdownCssClass: "vpkfont-md",
            containerCssClass: "vpkfont-md"
        });

        // Populate xrefEdit-type with the same content as xref-type
        $("#xrefEdit-type").empty();
        $("#xrefEdit-type").select2({
            data: options,
            dropdownCssClass: "vpkfont-md",
            containerCssClass: "vpkfont-md"
        });
    }
}


function buildXrefType(data) {
    // "secrets" : {"desc": "Secrets defined in the environment"},
    let listitem = '';
    let keys = Object.keys(data);
    let listArray = [];
    listArray.push(listitem);
    keys.sort();
    for (let i = 0; i < keys.length; i++) {
        listitem = { 'id': keys[i], 'text': keys[i] + ' : ' + data[keys[i]].desc };
        listArray.push(listitem);
    }
    return listArray;
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

//----------------------------------------------------------
// sort and build the selection list option entries
//----------------------------------------------------------
function bldOptions(options, type, style) {
    var items = [];
    var listitems = '';
    var listArrary = [];

    if (Array.isArray(options)) {
        items = options;
    } else {
        for (option in options) {
            items.push(option)
        };
    }

    items.sort();
    var cnt = 0;
    var id = 0;
    for (var i = 0; i < items.length; i++) {
        cnt++;
        if (i === 0 && type === 'K') {
            if (style !== 'select2') {
                listitems = '<option>all-kinds</option>'
            } else {
                id++;
                listArrary.push({ id: id, text: 'all-kinds' });
            }
        }

        var cki = items[i];
        if (!cki.endsWith(' (U)')) {
            if (style !== 'select2') {
                if (cki === ": " || cki === "") {
                    listitems += '<option>&lt;cluster-level&gt;</option>';
                } else {
                    if (type === 'S') {
                        if (items[i] === 'all-namespaces') {
                            listitems += '<option>   </option>';
                        } else {
                            listitems += '<option>' + items[i] + '</option>';
                        }
                    } else {
                        listitems += '<option>' + items[i] + '</option>';
                    }
                }
            } else {
                if (cki === ": " || cki === "") {
                    id++;
                    listArrary.push({ id: id, text: '<cluster-level>' });
                } else {
                    id++;
                    listArrary.push({ id: id, text: items[i] });
                }
            }

        } else {
            console.log('Dropped kind: ' + cki)
            // drop all user defined kinds
        }
    }
    if (style !== 'select2') {
        return listitems;
    } else {
        return listArrary;
    }
}


//----------------------------------------------------------
// sort and build the selection list option entries
//----------------------------------------------------------
function bldProviders(options) {
    if (options === null) {
        return;
    }

    // sort by the dropdown value
    options.sort((a, b) => (a.dropdown > b.dropdown) ? 1 : ((b.dropdown > a.dropdown) ? -1 : 0));
    var listitems = '<option value="none">select cluster type</option>';


    for (var i = 0; i < options.length; i++) {
        listitems += '<option value="' + options[i].name + '">' + options[i].dropdown + '</option>';
    }
    return listitems;
}

//----------------------------------------------------------
// sort and build the selection list option entries
//----------------------------------------------------------
function bldClusterDir(dirs) {
    var listitems = '<option></option>';
    if (dirs === null) {
        listitems = '<option value="none">no previous instances exist</option>';
        return;
    }
    for (var i = 0; i < dirs.length; i++) {
        listitems += '<option value="' + dirs[i] + '">' + dirs[i] + '</option>';
    }
    return listitems;
}

//----------------------------------------------------------
console.log('loaded vpkSelectLists.js');
