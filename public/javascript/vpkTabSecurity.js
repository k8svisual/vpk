/*
Copyright (c) 2018-2023 k8sVisual

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
// Screen handling code for Security tab
//----------------------------------------------------------

// snnn 

//----------------------------------------------------------
// send request to server to get security data for a specific
// namespace
function getSecurityViewData(namespace) {
    hideMessage();
    let ns;
    let option
    if (typeof namespace === 'undefined' || namespace === null) {
        option = $('#security-ns-filter').select2('data');
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
    buildSecGraph(data);      // vpkSecGraph.js
});
//==========================================================

// Open and close the legend on the Security tab
function viewSecurityLegend() {
    $("#securityLegendModal").modal('show');
}


//----------------------------------------------------------
console.log('loaded vpkTabSecurity.js');