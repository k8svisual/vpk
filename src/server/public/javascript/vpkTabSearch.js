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
// Screen handling code for Search tab
//----------------------------------------------------------

// Open the Search modal
function searchValues() {
    $("#searchModal").modal('show');
}

//----------------------------------------------------------
// send request to server to search for data
function searchObj() {
    hideMessage();
    var namespaces = '::';
    var kinds = '::';
    // var labels = '::';
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

    searchValue = $("#search-value-field").val();
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
    socket.emit('searchK8Data', data);
}
//...
socket.on('searchResult', function (data) {
    $("#searchResults").show();
    buildSearchResults(data);
});
//...


function buildSearchResults(data) {
    var tmp;
    var a, b, c, d;
    let newData = [];
    id = 0;

    //Parse data and build JSON object for display table
    for (item in data) {
        tmp = data[item]
        a = tmp.namespace;
        b = tmp.kind;
        c = tmp.name;
        if (typeof tmp.fnum === 'undefined') {
            console.log(`buildSearchResults() has missing fnum for namespace: ${a} kind: ${b} name: ${c}`)
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
    $("#tableSearch").bootstrapTable('load', newData)
    $("#tableSearch").bootstrapTable('hideColumn', 'src');
}

//==========================================================


//----------------------------------------------------------
console.log('loaded vpkTabSearch.js');