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
Dump memory http server routes 
*/
'use strict';

var vpk = require('./vpk');
var utl = require('./utl');

module.exports = {

    //------------------------------------------------------------------------------
    // define dump memory http routes
    //------------------------------------------------------------------------------

    init: function (app) {

        app.get('/display', function (req, res) {
            let data = '<div style="font: 20px Arial, sans-serif;"><span style="font-size: 100%;"><b>display</b> URL Options</span>'
                + '<div style="margin-top: 10px; font-size: 90%;">VpK memory variable can be displayed using the following urls:</div>'
                + '<hr>'
                + '<div style="font-size: 80%; padding-left: 25px; margin-top: 25px; display: grid; grid-template-columns: 10% 45% 45%; grid-gap: 6px; word-break: break-word; background: #ccc;">'
                + '<div>hier</div><div>display hierarchy data structure</div><div>Example:&nbsp;http://localhost:4200/hier</div>'
                + '<div>ping</div><div>check status of server</div><div>Example:&nbsp;http://localhost:4200/ping</div>'
                + '<div>dumpkeys</div><div>display keys for global vpk object</div><div>Example:&nbsp;http://localhost:4200/dumpkeys</div>'
                + '<div>dumpcore</div><div>display entire vpk object</div><div>Example:&nbsp;http://localhost:4200/dumpcore</div>'
                + '<div>dump/{what}</div><div>display an variable from the vpk object. Replace {what} with vpk key value </div><div>Example:&nbsp;http://localhost:4200/dump/</div>'
                + '<div>dumpobj/{what}</div><div>display an object from the vpk object. Replace {what} with vpk key value </div><div>Example:&nbsp;http://localhost:4200/dumpobj/nodesFnum</div>'
                + '</div></div>'

            res.end(data);
        });

        app.get('/hier', function (req, res) {
            let data = vpk.hierarchy;
            res.end(JSON.stringify(data, null, 4));
            utl.logMsg('vpkAPP787 - GET hier event received');
        });

        app.get('/ping', function (req, res) {
            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });
            utl.logMsg('vpkAPP788 - Pinged');
            res.end('VpK server is OK\n');
        });


        app.get('/dumpkeys', function (req, res) {
            let rtn = [];
            let isA;
            let keys = Object.keys(vpk);
            let type;
            let aKeys;
            let aLength;
            let objKeys;
            keys.sort();
            for (let k = 0; k < keys.length; k++) {
                isA = Array.isArray(vpk[keys[k]]);
                if (isA !== true) {
                    type = typeof vpk[keys[k]];
                } else {
                    type = 'Array';
                }
                if (type === 'Array') {
                    aKeys = Object.keys(vpk[keys[k]]);
                    aLength = vpk[keys[k]].length;
                } else {
                    aKeys = []
                    aLength = 0;
                }

                if (type === 'object') {
                    objKeys = Object.keys(vpk[keys[k]]);
                } else {
                    objKeys = []
                }
                objKeys = JSON.stringify(objKeys, null, 4);
                rtn.push({ 'type': type, 'key': keys[k], 'objKeys': objKeys, 'aLength': aLength, 'arrayKeys': aKeys })
            }


            res.end(JSON.stringify(rtn, null, 2));
            utl.logMsg('vpkAPP791 - GET dumpkeys event received');
        });

        app.get('/dumpcore', function (req, res) {
            let data = vpk;
            res.end(JSON.stringify(data, null, 2));
            utl.logMsg('vpkAPP787 - GET dumpcore event received');
        });

        // dump something from vpk 
        app.get('/dump/:what', function (req, res) {
            let data = req.params.what;

            if (typeof vpk[data] !== 'undefined') {
                if (Array.isArray(vpk[data])) {
                    res.end('Type: ' + data + ' is an Array, use dumpobj to view');
                } else {
                    res.end(JSON.stringify(vpk[data], null, 2));
                }
            } else {
                res.end('Type: ' + data + ' does not exist in vpk');
            }


            utl.logMsg('vpkAPP787 - GET dump/<what> event received ');
        });

        // dump something from vpk 
        app.get('/dumpobj/:p1', function (req, res) {
            let p1 = req.params.p1;
            let obj = vpk[p1];
            let objName = 'vpk.' + p1;
            let result = utl.showProps(obj, objName)
            res.end(result);
            utl.logMsg('vpkAPP792 - GET dumpobj/<name> event received');
        });

        app.get('/dumpobj/:p1/:p2', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let obj = vpk[p1][p2];
            let objName = 'vpk.' + p1 + '/' + p2;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let obj = vpk[p1][p2][p3];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let obj = vpk[p1][p2][p3][p4];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let obj = vpk[p1][p2][p3][p4][p5];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let obj = vpk[p1][p2][p3][p4][p5][p6];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let p9 = req.params.p9;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let p9 = req.params.p9;
            let p10 = req.params.p10;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let p9 = req.params.p9;
            let p10 = req.params.p10;
            let p11 = req.params.p11;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11/:p12', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let p9 = req.params.p9;
            let p10 = req.params.p10;
            let p11 = req.params.p11;
            let p12 = req.params.p12;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11][p12];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11 + '/' + p12;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11/:p12/:p13', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let p9 = req.params.p9;
            let p10 = req.params.p10;
            let p11 = req.params.p11;
            let p12 = req.params.p12;
            let p13 = req.params.p13;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11][p12][p13];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11 + '/' + p12 + '/' + p13;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

        app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11/:p12/:p13/:p14', function (req, res) {
            let p1 = req.params.p1;
            let p2 = req.params.p2;
            p2 = utl.chgP2(p2);
            p2.replace("@", "/")
            let p3 = req.params.p3;
            let p4 = req.params.p4;
            let p5 = req.params.p5;
            let p6 = req.params.p6;
            let p7 = req.params.p7;
            let p8 = req.params.p8;
            let p9 = req.params.p9;
            let p10 = req.params.p10;
            let p11 = req.params.p11;
            let p12 = req.params.p12;
            let p13 = req.params.p13;
            let p14 = req.params.p14;
            let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11][p12][p13][p14];
            let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11 + '/' + p12 + '/' + p13 + '/' + p14;
            let result = utl.showProps(obj, objName)
            res.end(result);
        });

    }
}
