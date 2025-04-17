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
// populate drop down options for UI
//----------------------------------------------------------


function populateEventNSList() {
    if (typeof evtNs !== 'undefined' && evtNs !== null) {
        let options = {}
        let keys = Object.keys(evtNs);
        keys.sort();
        let data = {};
        data['all-namespaces'] = 'all-namespaces'
        //data['all-namespaces'] = keys[i]
        for (let i = 0; i < keys.length; i++) {
            data[keys[i]] = keys[i]
        }
        options = bldOptions(data, 'S', 'no');
        let tmpArray = options.split('<option>');
        let newOptions = '';
        for (let i = 1; i < tmpArray.length; i++) {
            if (i === 1) {
                //newOptions = newOptions + '<option>' + tmpArray[i];
                newOptions = newOptions + '<option>all-namespaces</option>';
            } else {
                newOptions = newOptions + '<option>' + tmpArray[i];
            }
        }
        options = newOptions;
        $("#events-ns-filter").empty();
        $("#events-ns-filter").html(options);
    }
}


function populateSchematicList() {
    if (typeof nsResourceInfo !== 'undefined' && nsResourceInfo !== null) {
        let options = {}
        let keys = Object.keys(nsResourceInfo);
        let data = {};
        for (let i = 0; i < keys.length; i++) {
            data[keys[i]] = keys[i]
        }
        options = bldOptions(data, 'S', 'no');
        $("#schematic-ns-filter").empty();
        $("#schematic-ns-filter").html(options);
    }
}

function populateRepositoryList() {
    if (typeof imageRepository !== 'undefined' && imageRepository !== null) {
        let options = {}
        let keys = Object.keys(imageRepository);
        keys.sort();
        let data = {};
        data['  Select Repository  '] = '  selectRepository';
        for (let i = 0; i < keys.length; i++) {
            data[keys[i]] = keys[i]
        }
        options = bldOptions(data, 'S', 'no');
        $("#repository-list").empty();
        $("#repository-list").html(options);
    }
}

function populateORefKinds(oRefKinds) {
    let listArray = [];
    let id = 0;
    oRefKinds.sort();

    for (let i = 0; i < oRefKinds.length; i++) {
        if (i === 0) {
            id++;
            listArray.push({ id: id, text: 'all-kinds' });
        }
        id++;
        listArray.push({ id: id, text: oRefKinds[i] });
    }

    $("#ownerRef-kind-filter").empty();
    $("#ownerRef-kind-filter").select2({
        data: listArray,
        dropdownCssClass: "vpkselect2",
        selectionCssClass: "vpkselect2",
        placeholder: "select kinds(s), default is ALL kinds",
        multiple: false,
        width: 300
    });
}


function populateSelectLists(data) {
    // reset indicator for 3d selection dropdown built process
    foundNSNamesBuilt = false;

    //popCnt++;
    let options;

    // populate only if valid datasource
    if (data.validDir === false) {
        setBaseDir(data.baseDir);
    } else {
        setBaseDir(data.baseDir);
        rootDir = data.baseDir;
        baseDir = data.baseDir;

        // Namespaces
        options = bldOptions(data.namespaces, 'S', 'no');

        $("#ns-filter").empty();
        $("#ns-filter").html(options);

        $("#security-ns-filter").empty();
        $("#security-ns-filter").html(options);

        $("#ownerRef-ns-filter").empty();
        $("#ownerRef-ns-filter").html(options);

        $("#stats-ns-filter").empty();
        $("#stats-ns-filter").html(options);


        // Kinds
        // options = bldOptions(data.kinds, 'K', 'select2');
        options = bldOptions(data.kinds, 'S', 'no');

        $("#kind-filter").empty();
        $("#kind-filter").html(options);

        // Used in stats tab for DirStats report
        $("#stats-kind-filter").empty();
        options = '<option>all-kinds</option>' + options;
        $("#stats-kind-filter").html(options);


        populateExplains(data);

        populateSchematicList();
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


//----------------------------------------------------------
// sort and build the selection list option entries
//----------------------------------------------------------
function bldOptions(options, type, style) {
    var items = [];
    var listitems = '';
    var listArray = [];

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
                listArray.push({ id: id, text: 'all-kinds' });
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
                    listArray.push({ id: id, text: '<cluster-level>' });
                } else {
                    id++;
                    listArray.push({ id: id, text: items[i] });
                }
            }

        } else {
            // drop all user defined kinds
            console.log(`Dropped user defined kind: ${cki}`)
        }
    }
    if (style !== 'select2') {
        return listitems;
    } else {
        return listArray;
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
