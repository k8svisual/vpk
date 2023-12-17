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
// functions used from modals
//----------------------------------------------------------

// used by chgDirModal
function closeChgDir() {
    $("#chgDirModal").modal('hide')
}


function getNsTable(ns) {
    $("#schemHeader").html('Resources for namespace: <span class="font-weight-bold">' + ns + '</span>');
    if (typeof nsResourceInfo[ns] !== 'undefined') {
        $("#schemBody").html(nsResourceInfo[ns]);
    } else {
        $("#schemBody").html('No namespace resource information located');
    }
    $("#schemModal").modal('show');
}

function getEvtsTable(key) {
    $("#schemHeader").html('<span class="vpkblue vpkfont">Events for workload</span>');
    if (typeof workloadEventsInfo[key] !== 'undefined') {
        $("#schemBody").html(workloadEventsInfo[key]);
    } else {
        $("#schemBody").html('No events located of workload');
    }
    $("#schemModal").modal('show');
}

//----------------------------------------------------------
console.log('loaded vpkModalHandlers.js');
