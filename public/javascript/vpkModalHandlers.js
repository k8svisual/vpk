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
// functions used from modals
//----------------------------------------------------------

// used by chgDirModal
function closeChgDir() {
    $("#chgDirModal").modal('hide')
}

function compareShowFiles() {
    editDef(compFile1, '1')
    editDef(compFile2, '2')
    $("#compareFilesModal").modal('show')
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
    $("#schemHeader").html('<span class="vpkcolor vpkfont">Events for workload</span>');
    if (typeof workloadEventsInfo[key] !== 'undefined') {
        $("#schemBody").html(workloadEventsInfo[key]);
    } else {
        $("#schemBody").html('No events located of workload');
    }
    $("#schemModal").modal('show');
}

//===============================================
//-----------------------------------------------
// xref edit screen handling
//-----------------------------------------------
function xrefEditModalDialog() {
    hideMessage();
    $("#xrefSelect").show();
    $("#xrefNewXref").hide();
    $("#xrefShowSelected").hide();
    $("#xrefEditName").hide();
    $("#xrefTable").html('');
    $("#xrefEditQuestion").hide();
    $("#xrefEditRule").hide();
    $("#xrefShowRuleName").hide();
    $("#xrefNewPathRule").hide();
    $("#xrefFirstRule").hide();
    $("#xrefPathRules").hide();
    $("#xrefEditModal").modal('show')
}

// show xref info that was selected to process
function xrefHhandleSelection() {
    // hiding dropdown
    $("#xrefSelect").hide();
    // populate what will be shown
    setXrefLevel();
    bldXrefRulesTable();
    if (xrefRuleCountFound === 0) {
        $("#xrefShowSelected").show();
        $("#xrefPathRules").hide();
        $("#xrefFirstRule").show();
    } else {
        $("#xrefShowSelected").show();
        $("#xrefPathRules").show();
    }
}

// populate screen display and input fields
function setXrefLevel() {
    $("#xrefShowName").html(xrefData.picked);
    $("#xrefShowDesc").html(xrefData.names[xrefData.picked].desc);
    $("#xrefDesc").val(xrefData.names[xrefData.picked].desc);     // edit field
}

function xrefDeleteXref() {
    let drop = xrefData.picked;
    let keys = Object.keys(xrefData.rules);
    let hl;
    let pathRules;
    let newRules;
    for (let i = 0; i < keys.length; i++) {
        newRules = [];
        pathRules = xrefData.rules[keys[i]];
        hl = pathRules.length;
        for (let c = 0; c < hl; c++) {
            if (pathRules[c].xrk === drop) {
                continue;
            } else {
                newRules.push(pathRules[c]);
            }
        }
        xrefData.rules[keys[i]] = newRules;
    }

    delete xrefData.names[drop]

    let data = { 'xRefs': xrefData.names }
    populateXrefLists(data)
    // save to disk
    saveConfig('xref');
    showDirtyXrefMsg();
    $("#xrefSelect").show();
    $("#xrefEditDescBtn").show();
    $("#xrefShowSelected").hide();
    $("#xrefPathRules").hide()

}

// show the edit xref name section
function xrefEditName() {
    setXrefLevel();
    $("#xrefShowSelected").hide();
    $("#xrefPathRules").hide();
    $("#xrefEditName").show()
}

// xref name editing cancel button was pressed
function xrefNameCancel() {
    // let desc = $("#xrefDesc").val();
    $("#xrefEditName").hide()
    $("#xrefPathRules").show();
    $("#xrefShowSelected").show();
}

// xref name editing save button was pressed
function xrefNameSave() {
    let onOff = $("#xrefLevelOnOff").is(':checked');
    let desc = $("#xrefDesc").val();
    xrefData.names[xrefData.picked].desc = desc;
    xrefData.names[xrefData.picked].xon = onOff;
    setXrefLevel();
    saveConfig('xref');
    showDirtyXrefMsg();

    let data = { 'xRefs': xrefData.names }
    //update the drop down lists
    populateXrefLists(data);
    $("#xrefEditName").hide();
    $("#xrefPathRules").show();
    $("#xrefShowSelected").show();
}

// xref show table cancel button pressed  
function xrefCancel() {
    $("#xrefShowSelected").hide();
    $("#xrefPathRules").hide();
    $("#xrefSelect").show()
}

// xref show table rule selected, invoked when rule in table is clicked
function xrefEditPathRule(key) {
    // save in global var the selected xref path rule key
    xrefSelectedRuleKey = key;
    let parts = key.split(':');
    let ptr = parseInt(parts[1], 10);
    let rule = xrefData.rules[parts[0]][ptr];
    // save in global var the selected xref path rule
    xrefSelectedRule = rule;
    $("#xrefRule").val(rule.xrw);
    $("#xrefRuleText").html(rule.xrw);
    $("#xrefRuleKind").html(parts[0]);
    $("#xrefRuleKind2").html(parts[0]);
    setXrefRuleEnabledBox(rule);

    $("#xrefEditDescBtn").hide();
    $("#xrefPathRules").hide();
    $("#xrefShowRuleName").show();
    $("#xrefEditQuestion").show();

}

// populate checkBox and text for rule  
function setXrefRuleEnabledBox() {
    let onOff = xrefSelectedRule.xon;
    if (onOff === true) {
        $("#xrefRuleOnOff").prop('checked', true)
        $("#xrefRuleEnabled").html('true');
    } else {
        $("#xreRuleOnOff").prop('checked', false)
        $("#xrefRuleEnabled").html('false');
    }
}

function xrefEditRuleOpen() {
    $("#xrefShowRuleName").hide();
    $("#xrefEditQuestion").hide();
    $("#xrefEditRule").show();
}

function xrefEditRuleDelete() {
    let parts = xrefSelectedRuleKey.split(':');
    // update in memory values
    //delete xrefData.rules[ parts[0] ][ parts[1]]; 
    let drop = parts[1];
    drop = parseInt(drop, 10);
    let paths = xrefData.rules[parts[0]];
    let newPaths = [];
    for (let i = 0; i < paths.length; i++) {
        if (i !== drop) {
            newPaths.push(paths[i]);
        } else {
            console.log('deleted xref entry for : ' + parts[0] + ' path: ' + paths[i].xrw);
        }
    }
    xrefData.rules[parts[0]] = newPaths;
    // update table 
    bldXrefRulesTable();
    // save to disk
    saveConfig('xref');
    showDirtyXrefMsg();
    // show/hide screen portions
    $("#xrefShowRuleName").hide();
    $("#xrefEditQuestion").hide();
    $("#xrefEditRule").hide();
    $("#xrefEditDescBtn").show();
    $("#xrefPathRules").show();
}

function xrefEditRuleCancel() {
    $("#xrefEditRule").hide();
    $("#xrefEditQuestion").hide();
    $("#xrefShowRuleName").hide();
    $("#xrefEditDescBtn").show();
    $("#xrefPathRules").show();
}

function xrefSaveEditedRule() {
    let onOff = $("#xrefRuleOnOff").is(':checked');
    let ruleDef = $("#xrefRule").val();
    let parts = xrefSelectedRuleKey.split(':');
    // update in memory values
    xrefData.rules[parts[0]][parts[1]].xrw = ruleDef;
    xrefData.rules[parts[0]][parts[1]].xon = onOff;
    // update UI values
    $("#xrefRuleText").html(ruleDef);
    // update xrefSelectedRule
    xrefSelectedRule.xrw = ruleDef;
    xrefSelectedRule.xon = onOff;
    // update UI table values
    setXrefRuleEnabledBox();
    // save the update to disk
    saveConfig('xref');
    showDirtyXrefMsg();
    // update table 
    bldXrefRulesTable();
    // hide edit and editShow, show table
    // show/hide screen portions
    $("#xrefEditRule").hide();
    $("#xrefEditQuestion").hide();
    $("#xrefShowRuleName").hide();
    $("#xrefEditDescBtn").show();
    $("#xrefPathRules").show();
}

function xrefCancelEditRule() {
    $("#xrefEditRule").hide();
    $("#xrefEditQuestion").hide();
    $("#xrefShowRuleName").hide();
    $("#xrefEditDescBtn").show();
    $("#xrefPathRules").show();
}

// add new xref 
function xrefNewXref() {
    alert('create code to add new xref');


    let data = { 'xRefs': xrefData.names }
    //update the drop down lists
    populateXrefLists(data);
}

function xrefNewPathRule() {
    $("#xrefNewPathKind").val('');
    $("#xrefNewPathRuleData").val('');
    $("#xreNewOnOff").prop('checked', false)
    $("#xrefEditDescBtn").hide();
    $("#xrefPathRules").hide();
    $("#xrefNewPathRule").show()
}

function xrefCancelNewPathRule() {
    $("#xrefEditDescBtn").show();
    $("#xrefPathRules").show();
    $("#xrefNewPathRule").hide()
}

function xrefSaveNewPathRule() {
    let kind = $("#xrefNewPathKind").val();
    let pathRule = $("#xrefNewPathRuleData").val();
    let onOff = $("#xrefNewOnOff").is(':checked');

    if (typeof xrefData.rules[kind] === 'undefined') {
        xrefData.rules[kind] = [];
    }
    let newRule = {
        "xon": onOff,
        "xrk": xrefData.picked,
        "xrw": pathRule
    }
    xrefData.rules[kind].push(newRule);
    bldXrefRulesTable();
    // save to disk
    saveConfig('xref');
    showDirtyXrefMsg();
    $("#xrefEditDescBtn").show();
    $("#xrefPathRules").show();
    $("#xrefNewPathRule").hide()
}


function xrefOpenNewXref() {
    $("#xrefEditDescBtn").hide();
    $("#xrefPathRules").hide();
    $("#xrefSelect").hide();
    $("#xrefNewXref").show()
}

function xrefSaveNewXref() {
    let name = $("#xrefNewXrefName").val();
    let desc = $("#xrefNewXrefDesc").val();
    if (typeof xrefData.names[name] === 'undefined') {
        xrefData.names[name] = { 'desc': desc };
        let data = { 'xRefs': xrefData.names }
        populateXrefLists(data)
        // save to disk
        saveConfig('xref');
        showDirtyXrefMsg();
        $("#xrefSelect").show();
        $("#xrefEditDescBtn").show();
        $("#xrefNewXref").hide()
    } else {
        alert('Xref name already exists')
    }
}

function xrefCancelNewXref() {
    $("#xrefSelect").show();
    $("#xrefEditDescBtn").show();
    $("#xrefNewXref").hide()
}

function xrefOpenFirstRule() {
    $("#xrefFirstRule").hide();
    $("#xrefNewPathKind").val('');
    $("#xrefNewPathRuleData").val('');
    $("#xreNewOnOff").prop('checked', false)
    $("#xrefEditDescBtn").hide();
    $("#xrefNewPathRule").show()
}

function xrefCloseFirstRule() {
    $("#xrefFirstRule").hide();
    $("#xrefShowSelected").hide();
    $("#xrefSelect").show();
}

//----------------------------------------------------------
console.log('loaded vpkModalHandlers.js');
