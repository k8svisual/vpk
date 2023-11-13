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
// Screen handling code for the Graphic View tab
//----------------------------------------------------------


//----------------------------------------------------------
// send request to server to get graphic hierarchy and circle 
// pack data

let processingRequest = '<div class="row">'
    + '<div class="col mt-1 ml-4">'
    + '  <img style="float:left" src="images/loading.gif" width="30" height="30"/>'
    + '  <div class="vpkfont-md vpkcolor mt-2"><span>&nbsp;&nbsp;Processing request</span>'
    + '  </div>'
    + '</div>';

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
socket.on('getHierarchyResult', function (data) {
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
console.log('loaded vpkTabGraphics.js');