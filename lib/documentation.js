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

/*----------------------------------------------------------
 Read and parse documentation markdown and create html 
*/

'use strict';

//let Marked = require('marked');
const md = require('markdown-it')({ 'html': true });
//import { marked } from 'marked'
let fs = require('fs');
let utl = require('../lib/utl');
let vpk = require('../lib/vpk');
const { constants } = require('fs/promises');
let cwd = process.cwd();
let docPath;
let docCnt = 1000;

//----------------------------------------------------------
function buildDocs() {
    vpk.documentation = {};
    let files = readDocsDirectory();
    if (files !== '') {
        processFiles(files);
    }
}

function readDocsDirectory() {
    try {
        docPath = cwd + '/public/docs'
        let files = fs.readdirSync(docPath);
        return files;
    } catch (err) {
        utl.logMsg('vpkDOC011 - Error getting file names in the documentation directory, message: ' + err);
        return '';
    }
}

function processFiles(files) {
    let topicKey;
    let topicBack;
    let topicNext;
    let validFile;
    let fn;
    let docCnt = 0;
    files.forEach(function (file) {
        docCnt++;
        fn = docPath + '/' + file;
        topicBack = 'toc';
        topicNext = 'arch';
        try {
            // is this a file or a directory
            validFile = fs.statSync(fn).isFile();
            if (validFile === true) {
                if (file.endsWith('.md') || file.endsWith('.MD') || file.endsWith('.Md') || file.endsWith('.mD')) {
                    // read MarkDown file into a string
                    let buff = fs.readFileSync(fn, { "encoding": "utf8" })

                    // ---- PREPROCESS the markdown get <topicKey> and ensure images point to proper directory  ----
                    let chkArray = buff.split('\n');
                    let newArray = [];
                    let hl = chkArray.length;
                    let line;
                    for (let c = 0; c < hl; c++) {
                        line = chkArray[c];
                        if (line.indexOf('<topicKey') > -1) {
                            topicKey = formatTopicKey(line);
                        } else {
                            if (line.indexOf('<img ') > -1) {
                                line = formatImagePath(line);
                            }
                            newArray.push(line + '\n');
                        }
                    }

                    // rebuild the buff
                    if (newArray.length > 0) {
                        buff = newArray.join("");
                        newArray = null;
                    }

                    // ---- Convert the markdown to HTML ----
                    // convert string to html
                    //let result = Marked(buff);

                    let result = md.render(buff);
                    let loop = true;
                    let fp;
                    while (loop) {
                        fp = result.indexOf('<table>');
                        if (fp > -1) {
                            result = result.substring(0, fp) + '<table class="docsTable">' + result.substring(fp + 7);
                        } else {
                            loop = false;
                        }
                    }

                    //let html = result.split('\n');
                    vpk.documentation[topicKey] = {
                        'back': topicBack,
                        'next': topicNext,
                        'content': result
                    }
                }
            }
        } catch (err) {
            utl.logMsg('vpkDOC030 - Error processing help file: ' + fn + ' error message: ' + err);
            utl.logMsg('vpkDOC030 - Stack: ' + err.stack);
        }
    });
    utl.logMsg('vpkDOC010 - ' + docCnt + ' Documentaion files processed');
}

function formatImagePath(line) {
    return line;
}

function formatTopicKey(line) {
    let rtn = '';
    line = line.split(' ');
    if (line.length > 1) {
        if (line[1] !== null || line[1] !== 'undefined') {
            rtn = line[1];
            rtn = rtn.substring(0, rtn.length - 2);
            if (typeof vpk.documentation[rtn] !== 'undefined') {
                docCnt++;
                rtn = rtn + ':' + docCnt;
            }
        } else {
            docCnt++;
            rtn = 'topic:' + docCnt;
        }
    }
    else {
        docCnt++;
        rtn = 'topic:' + docCnt;
    }

    return rtn;
}

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

    buildDocumentation: function () {
        buildDocs();
    }
};