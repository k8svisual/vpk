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
// Top of screen handling code
//----------------------------------------------------------


//----------------------------------------------------------
function saveConfig(what) {
    //    if (typeof what === 'undefined') {
    let sFlds = document.getElementById('statusFlds').checked;
    let mFlds = document.getElementById('mgmFlds').checked;

    if (typeof sFlds === 'undefined') {
        sFlds = false;
    }
    if (typeof mFlds === 'undefined') {
        mFlds = false;
    }
    socket.emit('saveConfig', { "managedFields": mFlds, "statusSection": sFlds });

}
//...
socket.on('saveConfigResult', function (data) {
    $("#configModal").modal('hide');
    if (data.result.status !== 'PASS') {
        showMessage(data.result.message, 'fail')
    }
});
//==========================================================


//----------------------------------------------------------
function showConfig() {
    socket.emit('getConfig');
}
//...
socket.on('getConfigResult', function (data) {

    if (data.config.managedFields === true) {
        $('#mgmFlds').bootstrapToggle('on');
    } else {
        $('#mgmFlds').bootstrapToggle('off');
    }

    if (data.config.statusSection === true) {
        $('#statusFlds').bootstrapToggle('on');
    } else {
        $('#statusFlds').bootstrapToggle('off');
    }
    $("#configModal").modal('show');
});
//==========================================================


//----------------------------------------------------------
function getDocumentation(data) {
    let what;
    if (typeof data === 'undefined') {
        if (documentationTabTopic !== '') {
            // question mark in top pressed, select the appropriate topic          
            what = { 'doc': documentationTabTopic };
        }
    } else {
        // inside documentation modal, navigate to desired topic
        what = { 'doc': data };
    }
    socket.emit('getDocumentation', what);
}
//...
socket.on('getDocumentationResult', function (data) {
    let content = data.content;
    console.log(data.content);
    $('#docsBody').html(content)
    $("#docsModal").modal('show');
});
//... using functions
function docNextTopic(link) {
    let next;
    if (typeof link === 'undefined') {
        next = $("#topicNext").attr("link")
    } else {
        next = link;
    }
    getDocumentation(next)
}
function docPrevTopic() {
    let prev = $("#topicBack").attr("link")
    getDocumentation(prev)
}
//==========================================================


//----------------------------------------------------------
function about() {
    socket.emit('getUsage');
    $("#version").empty();
    $("#version").html('');
    $("#version").html('VERSION&nbsp;' + version);
    $("#usageResult").hide();
    $("#aboutModal").modal();
}
//...
socket.on('usageResult', function (data) {
    let content = '';
    if (typeof data.empty !== 'undefined') {
        content = '<div class="text-center align-middle font-weight-bold vpkfont-lg">' + data.message + '</div>';
    } else {
        content = formatUsage(data);
    }
    $("#usageRunning").hide();
    $("#usageResult").empty();
    $("#usageResult").html(content);
    $("#usageResult").show();
});
//==========================================================

//==========================================================

function closeVpK() {
    $("#closeVpKModal").modal('show');
}
function cancelShutdown() {
    $("#closeVpKModal").modal('hide');
}
function shutdownVpK() {
    let html1 = '<div>&nbsp;</div>'
    let html2 = '<div class="text-center vpkcolor vpkfont-lg mb-5 mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="100" height="100"></div>'
        + '<div class="text-center mt-2 vpkfont-giant vpkcolor">'
        + '<span id="shutdownMsg">VpK shutdown in progress</span></div></div>'
    $("#closeVpKModal").modal('hide')
    $("#banner").html(html1);
    $("#viewarea").html(html2)
    let doit = setTimeout(sendShutdownS1, 1000);
}

function sendShutdownS1() {
    let html2 = '<div class="text-center vpkcolor vpkfont-lg mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="200" height="200"></div>'
        + '<div class="text-center mt-5 mb-5 vpkfont-giant vpkcolor">'
        + '<span id="shutdownMsg" >VpK shutdown in progress</span></div></div></div>'
    $("#viewarea").html(html2);
    let doit = setTimeout(sendShutdownS2, 1000);
}

function sendShutdownS2() {
    let html2 = '<div class="text-center vpkcolor vpkfont-lg mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="300" height="300"></div>'
        + '<div class="text-center mt-5 mb-5 vpkfont-giant vpkcolor">'
        + '<span id="shutdownMsg" >VpK shutdown complete</span></div></div></div>'
    $("#viewarea").html(html2);
    socket.emit('shutdownVpK');
}




//----------------------------------------------------------
console.log('loaded vpkTopScreen.js');
