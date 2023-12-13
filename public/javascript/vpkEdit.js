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
// format server returned resource definition file and display
//----------------------------------------------------------
function editDef(data, which) {
    if (typeof which === 'undefined') {
        which = null;
    }
    //console.log(JSON.stringify(data, null, 4));
    //var part = data.filePart;
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
    }
}

function initAceEditor(rtn) {
    let needle;
    let range;
    let lineNumber = 0;
    let theme = 'ace/theme/' + aceTheme;
    editor = ace.edit("editor");
    editor.setValue(rtn);                           // the data to be edited/shown
    editor.setTheme(theme);         // theme for editing
    editor.getSession().setMode("ace/mode/yaml");   // type of file high lighting
    editor.setOptions(
        {
            cursorStyle: "wide",
            fontSize: 11,
            printMargin: false,
            tabSize: 2,
            scrollPastEnd: 0.10
        }
    );
    if (aceSearchValue !== '') {
        editor.find(aceSearchValue);
        // Open the Find/Replace dialog
        editor.commands.exec("find", editor);
        //editor.focus();
    }


    if (aceSearchValue !== '') {
        // Find a needle in the hay stack
        needle = new RegExp(aceSearchValue, 'g');
        range = editor.find(needle, {
            start: { row: 0, column: 0 },
            preventScroll: false
        });
    } else {
        range = null;
    }

    if (typeof range !== 'undefined' && range !== null) {
        if (typeof range.start !== 'undefined') {
            if (typeof range.start.row !== 'undefined') {
                aceSearchValue = '';
                // Wait for the editor to finish rendering
                editor.renderer.once('afterRender', function () {
                    var lineNumber = range.start.row;
                    editor.scrollToLine(lineNumber, true, true, function () {
                        var editorContainer = document.getElementById("editor");
                        editorContainer.style.display = "block";
                    });
                });
            }
        }
    } else {
        aceSearchValue = '';
        editor.focus();
        editor.gotoLine(1, 0, true);
        editor.renderer.scrollToRow(lineNumber);
    }
}

//----------------------------------------------------------
console.log('loaded vpkEdit.js');
