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
// format server returned resource definition file and display
//----------------------------------------------------------
function editDef(data, which) {
    if (typeof which === 'undefined') {
        which = null;
    }
    //console.log(JSON.stringify(data, null, 4));
    var part = data.filePart;
    var defkey = data.defkey;
    var rtn = data.lines;
    data = null;
    // create array of file lines
    var newData = rtn.split('\n');
    var hl = newData.length;
    var outData = [];
    var line = '';
    var image = 'k8.svg';
    var kind = '';
    var api = '';
    var fp;
    var fnum;
    for (var d = 0; d < hl; d++) {
        line = newData[d]
        outData.push(line + '\n');
        //line = line.trim();
        if (line.startsWith('kind: ')) {
            kind = line.substring(5);
            kind = kind.trim();
        }
        if (line.startsWith('apiVersion: ')) {
            api = line;
            api = api.trim();
        }
        image = checkImage(kind, api);
    }
    newData = null;
    rtn = outData.join('');
    if (defkey.indexOf('config') > -1) {
        fp = defkey.indexOf('config');
        fnum = defkey.substring(fp + 6, defkey.length - 5) + '.0';
        if (fnum.indexOf('.yaml') > -1) {
            fp = fnum.indexOf('.yaml');
            fnum = fnum.substring(0, fp)
        }
    } else {
        fnum = defkey;
    }

    if (defkey.endsWith('/ndf')) {
        fnum = 'No matching file';
    }

    var editImage = '<img style="vertical-align:middle;" src="images/' + image + '" width="30" height="30" '
        + ' onclick="getExplain(\'' + kind + '\',\'' + api + '\')"></img>'
        + '<div style="vertical-align:middle; display:inline;" class="vpkcolor vpkfont pl-2">'
        + kind + '  (' + fnum + ')';

    if (which === null || which === '') {
        $("#editTitle").html(editImage + '</div>');
        initAceEditor(rtn);
        $('#editorModal').modal('show');
    } else if (which === '1') {
        $("#snapTitle1").html('<b>Snapshot 1:</b>&nbsp;' + compareSnap1Selected)
        $("#compareTitle1").html(editImage + '<hr></div>');
        compareFile1Editor1(rtn);
    } else if (which === '2') {
        $("#snapTitle2").html('<b>Snapshot 2:</b>&nbsp;' + compareSnap2Selected)
        $("#compareTitle2").html(editImage + '<hr></div>');
        compareFile2Editor1(rtn);
    }
}


function initAceEditor(rtn) {
    editor = ace.edit("editor");
    editor.setValue(rtn);
    editor.setTheme("ace/theme/sqlserver");         // theme for editing
    editor.getSession().setMode("ace/mode/yaml");   // type of file high lighting
    editor.setOptions(
        {
            cursorStyle: "wide",
            fontSize: 11,
            printMargin: false,
            tabSize: 2,
            scrollPastEnd: 0.10,
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true
        }
    );
    editor.focus();
    editor.gotoLine(1, 0, true);
    editor.renderer.scrollToRow(1);
}

function compareFile1Editor1(rtn) {
    editorC1 = ace.edit("editorC1");
    editorC1.setValue(rtn);
    editorC1.setTheme("ace/theme/sqlserver");         // theme for editing
    editorC1.getSession().setMode("ace/mode/yaml");   // type of file high lighting
    editorC1.setOptions(
        {
            cursorStyle: "wide",
            fontSize: 11,
            printMargin: false,
            tabSize: 2,
            scrollPastEnd: 0.10,
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true
        }
    );
    editorC1.focus();
    editorC1.gotoLine(1, 0, true);
    editorC1.renderer.scrollToRow(1);
}

function compareFile2Editor1(rtn) {
    editorC2 = ace.edit("editorC2");
    editorC2.setValue(rtn);
    editorC2.setTheme("ace/theme/sqlserver");         // theme for editing
    editorC2.getSession().setMode("ace/mode/yaml");   // type of file high lighting
    editorC2.setOptions(
        {
            cursorStyle: "wide",
            fontSize: 11,
            printMargin: false,
            tabSize: 2,
            scrollPastEnd: 0.10,
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true
        }
    );
    editorC2.focus();
    editorC2.gotoLine(1, 0, true);
    editorC2.renderer.scrollToRow(1);
}


//----------------------------------------------------------
console.log('loaded vpkEdit.js');
