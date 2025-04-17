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
// Top of screen handling code
//----------------------------------------------------------

let atOpenSettings = '';
let configRedact = false;
let configSaved = false;

//----------------------------------------------------------
function saveConfig(what) {
    //    if (typeof what === 'undefined') {
    let sFlds = document.getElementById('statusFlds').checked;
    let mFlds = document.getElementById('mgmFlds').checked;
    let redactSec = document.getElementById('redactSecrets').checked;
    let reloadAction = document.getElementById('reloadAction').checked;
    let lightTheme = document.getElementById('lightTheme').checked;


    if (typeof mFlds === 'undefined') {
        mFlds = false;
    }
    if (typeof sFlds === 'undefined') {
        sFlds = false;
    }
    if (typeof redactSec === 'undefined') {
        redactSec = false;
    }
    if (typeof reloadAction === 'undefined') {
        reloadAction = false;
    }
    if (typeof lightTheme === 'undefined') {
        lightTheme = true;
    } else {
        if (lightTheme === true) {
            aceTheme = 'chrome'
        } else {
            aceTheme = 'merbivore'
        }
    }


    let tmp = $('#clusterBG').select2('data')
    let back = ''
    if (typeof tmp === 'undefined' || tmp === null) {
        back = 'Grey';
    } else {
        back = tmp[0].text;
    }


    socket.emit('saveConfig', {
        "managedFields": mFlds,
        "statusSection": sFlds,
        "redactSecrets": redactSec,
        "reloadAction": reloadAction,
        "lightTheme": lightTheme,
        "clusterBackground": back
    });
    atOpenSettings = getCurrentSettings();

}
//...
socket.on('saveConfigResult', function (data) {
    if (data.result.status !== 'PASS') {
        showMessage(data.result.message, 'fail')
        configSaved = false;
    } else {
        showMessage('Configuration data saved', 'pass')
        configSaved = true;
    }
});
//==========================================================


//----------------------------------------------------------
function showConfig() {
    socket.emit('getConfig');
}
//...
socket.on('getConfigResult', function (data) {
    // Set screen button and save status at start 
    atOpenSettings = '';
    configRedact = false;
    configSaved = false;

    // Set field buttons on the screen
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

    if (data.config.redactSecrets === true) {
        $('#redactSecrets').bootstrapToggle('on');
        configRedact = true;
    } else {
        $('#redactSecrets').bootstrapToggle('off');
        configRedact = false;
    }

    if (data.config.reloadAction === true) {
        $('#reloadAction').bootstrapToggle('on');
    } else {
        $('#reloadAction').bootstrapToggle('off');
    }

    if (data.config.lightTheme === true) {
        $('#lightTheme').bootstrapToggle('on');
    } else {
        $('#lightTheme').bootstrapToggle('off');
    }

    // Save all the current setting to compare on close
    // to determine if they should be saved
    atOpenSettings = getCurrentSettings();

    $("#configModal").modal('show');
});
//==========================================================

function getCurrentSettings() {
    let sFlds = document.getElementById('statusFlds').checked;
    let mFlds = document.getElementById('mgmFlds').checked;
    let redactSec = document.getElementById('redactSecrets').checked;
    let reloadAction = document.getElementById('reloadAction').checked;
    let lightTheme = document.getElementById('lightTheme').checked;
    let comapreSettings = '';

    if (mFlds === true) {
        comapreSettings = 'T';
    } else {
        comapreSettings = 'F';
    }
    if (sFlds === true) {
        comapreSettings = comapreSettings + 'T';
    } else {
        comapreSettings = comapreSettings + 'F';
    }
    if (redactSec === true) {
        comapreSettings = comapreSettings + 'T';
    } else {
        comapreSettings = comapreSettings + 'F';
    }
    if (reloadAction === true) {
        comapreSettings = comapreSettings + 'T';
    } else {
        comapreSettings = comapreSettings + 'F';
    }
    if (lightTheme === true) {
        comapreSettings = comapreSettings + 'T';
    } else {
        comapreSettings = comapreSettings + 'F';
    }
    comapreSettings = comapreSettings + $('#clusterBG').select2('data');

    return comapreSettings;
}


function closeConfig() {
    let redactSetting = document.getElementById('redactSecrets').checked;
    let redactMsg = '<div class="text-center">Redact settings have changed which requires a complete re-processing of the current '
        + '"Snapshot" before the Redact change will take effect.'
        + '<br><br><span>Continue processing or return to configuration?</span></div>'
    let notSavedMsg = '<div class="text-center">Configuration settings were changed and not saved.'
        + '<br><br><span>Continue processing or return to configuration?</span></div>'

    let currentSettings = getCurrentSettings();
    // Are current setting the same as when Config modal was openned
    if (currentSettings !== atOpenSettings) {
        $('#yesNoMessageBody').html(notSavedMsg);
        $('#yesNoMessageYes').html('Continue');
        $('#yesNoMessageNo').html('Return');
        yesNoWhere = 'Close';
        $("#yesNoModal").modal('show');
        return;
    }

    if (configRedact !== redactSetting) {
        $('#yesNoMessageBody').html(redactMsg);
        $('#yesNoMessageYes').html('Continue');
        $('#yesNoMessageNo').html('Return');
        yesNoWhere = 'Redact';
        $("#yesNoModal").modal('show');
    } else {
        $("#configModal").modal('hide');
    }
}

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
    $('#docsBody').html(content)
    $("#docsModal").modal('show');
});


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
    let html2 = '<div class="text-center vpkblue vpkfont-lg mb-5 mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="100" height="100"></div>'
        + '<div class="text-center mt-2 vpkfont-giant vpkblue">'
        + '<span id="shutdownMsg">VpK shutdown in progress</span></div></div>'
    $("#closeVpKModal").modal('hide')
    $("#banner").html(html1);
    $("#viewarea").html(html2)
    let doit = setTimeout(sendShutdownS1, 1000);
}

function sendShutdownS1() {
    let html2 = '<div class="text-center vpkblue vpkfont-lg mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="200" height="200"></div>'
        + '<div class="text-center mt-5 mb-5 vpkfont-giant vpkblue">'
        + '<span id="shutdownMsg" >VpK shutdown in progress</span></div></div></div>'
    $("#viewarea").html(html2);
    let doit = setTimeout(sendShutdownS2, 1000);
}

function sendShutdownS2() {
    let html2 = '<div class="text-center vpkblue vpkfont-lg mt-5">'
        + '<img class="vpk-vert-mid" src="images/vpk.png" width="300" height="300"></div>'
        + '<div class="text-center mt-5 mb-5 vpkfont-giant vpkblue">'
        + '<span id="shutdownMsg" >VpK shutdown complete</span></div></div></div>'
    $("#viewarea").html(html2);
    socket.emit('shutdownVpK');
}

function openCarousel() {
    // Deselect all tabs
    let tabLinks = document.querySelectorAll('#tabs .nav-link');
    tabLinks.forEach(function (link) {
        link.classList.remove('active');
    });
    // Show Carousel
    setCurrentTab('instructions')
}

//----------------------------------------------------------
console.log('loaded vpkTopScreen.js');
