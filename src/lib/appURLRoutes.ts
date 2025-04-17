//------------------------------------------------------------------------------
// define dump memory http routes
//------------------------------------------------------------------------------
'use strict';

import vpk from './vpk.js';

import { logMessage } from '../utils/logging.js';
import { showProps } from '../utils/showprops.js';
import { chgP2 } from '../utils/chgp2.js';

export function appURLRoutes(app) {
    app.get('/display', function (req: any, res: any) {
        let data =
            '<div style="font: 20px Arial, sans-serif;"><span style="font-size: 100%;"><b>display</b> URL Options</span>' +
            '<div style="margin-top: 10px; font-size: 90%;">VpK memory variable can be displayed using the following urls:</div>' +
            '<hr>' +
            '<div style="font-size: 80%; padding-left: 25px; margin-top: 25px; display: grid; grid-template-columns: 10% 45% 45%; grid-gap: 6px; word-break: break-word; background: #ccc;">' +
            '<div>hier</div><div>display hierarchy data structure</div><div>Example:&nbsp;http://localhost:4200/hier</div>' +
            '<div>ping</div><div>check status of server</div><div>Example:&nbsp;http://localhost:4200/ping</div>' +
            '<div>dumpkeys</div><div>display keys for global vpk object</div><div>Example:&nbsp;http://localhost:4200/dumpkeys</div>' +
            '<div>dumpcore</div><div>display entire vpk object</div><div>Example:&nbsp;http://localhost:4200/dumpcore</div>' +
            '<div>dump/{what}</div><div>display an variable from the vpk object. Replace {what} with vpk key value </div><div>Example:&nbsp;http://localhost:4200/dump/</div>' +
            '<div>dumpobj/{what}</div><div>display an object from the vpk object. Replace {what} with vpk key value </div><div>Example:&nbsp;http://localhost:4200/dumpobj/nodesFnum</div>' +
            '</div></div>';

        res.end(data);
    });

    app.get('/hier', function (req: any, res: any) {
        let data = vpk.hierarchy;
        res.end(JSON.stringify(data, null, 4));
        logMessage('APP787 - GET hier event received');
    });

    app.get('/ping', function (req: any, res: any) {
        res.writeHead(200, {
            'Content-Type': 'text/plain',
        });
        logMessage('APP788 - Pinged');
        res.end('VpK server is OK\n');
    });

    app.get('/dumpkeys', function (req: any, res: any) {
        let rtn: any[] = [];
        let isA: any;
        let keys: any[] = Object.keys(vpk);
        let type: any;
        let aKeys: any;
        let aLength: any;
        let objKeys: any;
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
                aKeys = [];
                aLength = 0;
            }

            if (type === 'object') {
                objKeys = Object.keys(vpk[keys[k]]);
            } else {
                objKeys = [];
            }
            objKeys = JSON.stringify(objKeys, null, 4);
            rtn.push({ type: type, key: keys[k], objKeys: objKeys, aLength: aLength, arrayKeys: aKeys });
        }

        res.end(JSON.stringify(rtn, null, 2));
        logMessage('APP791 - GET dumpkeys event received');
    });

    app.get('/dumpcore', function (req: any, res: any) {
        let data: any = vpk;
        res.end(JSON.stringify(data, null, 2));
        logMessage('APP787 - GET dumpcore event received');
    });

    // dump something from vpk
    app.get('/dump/:what', function (req: any, res: any) {
        let data: any = req.params.what;

        if (typeof vpk[data] !== 'undefined') {
            if (Array.isArray(vpk[data])) {
                res.end('Type: ' + data + ' is an Array, use dumpobj to view');
            } else {
                res.end(JSON.stringify(vpk[data], null, 2));
            }
        } else {
            res.end('Type: ' + data + ' does not exist in vpk');
        }

        logMessage('APP787 - GET dump/<what> event received ');
    });

    // dump something from vpk
    app.get('/dumpobj/:p1', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let obj: any = vpk[p1];
        let objName: string = 'vpk.' + p1;
        let result: any = showProps(obj, objName);
        res.end(result);
        logMessage('APP792 - GET dumpobj/<name> event received');
    });

    app.get('/dumpobj/:p1/:p2', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let obj: any = vpk[p1][p2];
        let objName: string = 'vpk.' + p1 + '/' + p2;
        let result: any = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let obj = vpk[p1][p2][p3];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let obj = vpk[p1][p2][p3][p4];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let obj = vpk[p1][p2][p3][p4][p5];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let obj = vpk[p1][p2][p3][p4][p5][p6];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let obj = vpk[p1][p2][p3][p4][p5][p6][p7];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let p9: any = req.params.p9;
        let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let p9: any = req.params.p9;
        let p10: any = req.params.p10;
        let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10;
        let result = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let p9: any = req.params.p9;
        let p10: any = req.params.p10;
        let p11: any = req.params.p11;
        let obj: any = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11];
        let objName = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/' + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11;
        let result: any = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11/:p12', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let p9: any = req.params.p9;
        let p10: any = req.params.p10;
        let p11: any = req.params.p11;
        let p12: any = req.params.p12;
        let obj = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11][p12];
        let objName: string = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/';
        objName = objName + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11 + '/' + p12;

        let result: any = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11/:p12/:p13', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let p9: any = req.params.p9;
        let p10: any = req.params.p10;
        let p11: any = req.params.p11;
        let p12: any = req.params.p12;
        let p13: any = req.params.p13;
        let obj: any = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11][p12][p13];
        let objName: string = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/';
        objName = objName + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11 + '/' + p12 + '/' + p13;
        let result: any = showProps(obj, objName);
        res.end(result);
    });

    app.get('/dumpobj/:p1/:p2/:p3/:p4/:p5/:p6/:p7/:p8/:p9/:p10/:p11/:p12/:p13/:p14', function (req: any, res: any) {
        let p1: any = req.params.p1;
        let p2: any = req.params.p2;
        p2 = chgP2(p2);
        p2.replace('@', '/');
        let p3: any = req.params.p3;
        let p4: any = req.params.p4;
        let p5: any = req.params.p5;
        let p6: any = req.params.p6;
        let p7: any = req.params.p7;
        let p8: any = req.params.p8;
        let p9: any = req.params.p9;
        let p10: any = req.params.p10;
        let p11: any = req.params.p11;
        let p12: any = req.params.p12;
        let p13: any = req.params.p13;
        let p14: any = req.params.p14;
        let obj: any = vpk[p1][p2][p3][p4][p5][p6][p7][p8][p9][p10][p11][p12][p13][p14];
        let objName: string = 'vpk.' + p1 + '/' + p2 + '/' + p3 + '/' + p4 + '/' + p5 + '/' + p6 + '/';
        objName = objName + p7 + '/' + p8 + '/' + p9 + '/' + p10 + '/' + p11 + '/' + p12 + '/' + p13 + '/' + p14;
        let result: any = showProps(obj, objName);
        res.end(result);
    });
}
