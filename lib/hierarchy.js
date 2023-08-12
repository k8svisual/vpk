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
Build hierarchy data structure for d3 grpahs
*/

'use strict';

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
var out = null;

//----------------------------------------------------------
var buildL1 = function (data, p1, key1) {
    var key2 = Object.keys(data);
    for (var i = 0; i < key2.length; i++) {
        out.children[0].children[p1].children.push({ "name": key2[i], "children": [] });
        buildL2(vpk.workData[key1][key2[i]], p1, key1, i, key2[i]);
    }
};

var buildL2 = function (data, p1, key1, p2, key2) {
    var key3 = Object.keys(data);
    for (var i = 0; i < key3.length; i++) {
        out.children[0].children[p1].children[p2].children.push({ "name": key3[i], "children": [] });
        buildL3(vpk.workData[key1][key2][key3[i]], p1, key1, p2, key2, i, key3[i]);
    }
};

var buildL3 = function (data, p1, key1, p2, key2, p3, key3) {
    var key4 = Object.keys(data);
    var i;
    for (i = 0; i < key4.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children.push({ "name": key4[i], "children": [] });
        buildL4(vpk.workData[key1][key2][key3][key4[i]], p1, key1, p2, key2, p3, key3, i, key4[i]);
    }
};

var buildL4 = function (data, p1, key1, p2, key2, p3, key3, p4, key4) {
    var key5 = Object.keys(data);
    for (var i = 0; i < key5.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children.push({ "name": key5[i], "children": [] });
        buildL5(vpk.workData[key1][key2][key3][key4][key5[i]], p1, key1, p2, key2, p3, key3, p4, key4, i, key5[i]);
    }
};

var buildL5 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5) {
    var key6 = Object.keys(data);
    for (var i = 0; i < key6.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children.push({ "name": key6[i], "children": [] });
        buildL6(vpk.workData[key1][key2][key3][key4][key5][key6[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, i, key6[i]);
    }
};

var buildL6 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6) {
    var key7 = Object.keys(data);
    for (var i = 0; i < key7.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children.push({ "name": key7[i], "children": [] });
        buildL7(vpk.workData[key1][key2][key3][key4][key5][key6][key7[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, i, key7[i]);
    }
};

var buildL7 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7) {
    var key8 = Object.keys(data);
    for (var i = 0; i < key8.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children.push({ "name": key8[i], "children": [] });
        buildL8(vpk.workData[key1][key2][key3][key4][key5][key6][key7][key8[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, i, key8[i]);
    }
};

var buildL8 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8) {
    var key9 = Object.keys(data);
    for (var i = 0; i < key9.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children.push({ "name": key9[i], "children": [] });
        buildL9(vpk.workData[key1][key2][key3][key4][key5][key6][key7][key8][key9[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, i, key9[i]);
    }
};

var buildL9 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9) {
    var key10 = Object.keys(data);
    for (var i = 0; i < key10.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children.push({ "name": key10[i], "children": [] });
        buildL10(vpk.workData[key1][key2][key3][key4][key5][key6][key7][key8][key9][key10[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9, i, key10[i]);
    }
};

var buildL10 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9, p10, key10) {
    var key11 = Object.keys(data);
    for (var i = 0; i < key11.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[p10].children.push({ "name": key11[i], "children": [] });
        buildL11(vpk.workData[key1][key2][key3][key4][key5][key6][key7][key8][key9][key10][key11[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9, p10, key10, i, key11[i]);
    }
};

var buildL11 = function (data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9, p10, key10, p11, key11) {
    var key12 = Object.keys(data);
    for (var i = 0; i < key12.length; i++) {
        out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[p10].children[p11].children.push({ "name": key12[i], "children": [] });
        buildL12(vpk.workData[key1][key2][key3][key4][key5][key6][key7][key8][key9][key10][key11][key12[i]], p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9, p10, key10, p11, key11, i, key12[i]);
    }
};

//var buildL12 = function(data, p1, key1, p2, key2, p3, key3, p4, key4, p5, key5, p6, key6, p7, key7, p8, key8, p9, key9, p10, key10, p11, key11, p12, key12) {
var buildL12 = function () {
    utl.logMsg('vpkHIE444 - Hierarchy LEVEL 12 build is not defined or supported');
};

//=============================================================
// reset last child to have attribute value = 1
//=============================================================
var check1 = function () {
    var hl = out.children[0].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[i].children.length === 0) {
            delete out.children[0].children[i].children;
            out.children[0].children[i].value = 1;
        } else {
            check2(out, i);
        }
    }
};


var check2 = function (data, p1) {
    var hl = out.children[0].children[p1].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[i].children;
            out.children[0].children[p1].children[i].value = 1;
        } else {
            check3(out, p1, i);
        }
    }
};


var check3 = function (data, p1, p2) {
    var hl = out.children[0].children[p1].children[p2].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[i].children;
            out.children[0].children[p1].children[p2].children[i].value = 1;
        } else {
            check4(out, p1, p2, i);
        }
    }
};

var check4 = function (data, p1, p2, p3) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[i].value = 1;
        } else {
            check5(out, p1, p2, p3, i);
        }
    }
};

var check5 = function (data, p1, p2, p3, p4) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[i].value = 1;
        } else {
            check6(out, p1, p2, p3, p4, i);
        }
    }
};

var check6 = function (data, p1, p2, p3, p4, p5) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[i].value = 1;
        } else {
            check7(out, p1, p2, p3, p4, p5, i);
        }
    }
};


var check7 = function (data, p1, p2, p3, p4, p5, p6) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[i].value = 1;
        } else {
            check8(out, p1, p2, p3, p4, p5, p6, i);
        }
    }
};


var check8 = function (data, p1, p2, p3, p4, p5, p6, p7) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[i].value = 1;
        } else {
            check9(out, p1, p2, p3, p4, p5, p6, p7, i);
        }
    }
};

var check9 = function (data, p1, p2, p3, p4, p5, p6, p7, p8) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[i].value = 1;
        } else {
            check10(out, p1, p2, p3, p4, p5, p6, p7, p8, i);
        }
    }
};


var check10 = function (data, p1, p2, p3, p4, p5, p6, p7, p8, p9) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[i].value = 1;
        } else {
            check11(out, p1, p2, p3, p4, p5, p6, p7, p8, p9, i);
        }
    }
};


var check11 = function (data, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) {
    var hl = out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[p10].children.length;
    for (var i = 0; i < hl; i++) {
        if (out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[p10].children[i].children.length === 0) {
            delete out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[p10].children[i].children;
            out.children[0].children[p1].children[p2].children[p3].children[p4].children[p5].children[p6].children[p7].children[p8].children[p9].children[p10].children[i].value = 1;
        } else {
            utl.logMsg('vpkHIE555 - Hierarchy LEVEL 12 clear is not defined or supported');
        }
    }
};



//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------

module.exports = {

    bldHier: function (data) {
        var keysL0 = Object.keys(data);
        vpk.workData = data;
        if (out !== null) {
            if (typeof out.children[0] !== 'undefined') {
                delete out.children[0];
            } else {
                out = null;
            }
        }
        out = { "name": "cluster", "children": [{ "name": "Namespaces", "children": [] }] };
        for (var i = 0; i < keysL0.length; i++) {
            var cName;
            // Provide name for cluster level.  No namespace defined.
            if (keysL0[i] === '') {
                cName = '<< ClusterLevel >>';
            } else {
                cName = keysL0[i];
            }
            out.children[0].children.push({ "name": cName, "children": [] });
            buildL1(data[keysL0[i]], i, keysL0[i]);
        }

        // Check for last child and add value attribute
        check1(out);

        vpk.relMap = out;
        return out;
    },


    filterHierarchy: function (data) {
        var ns = data.namespaceFilter;
        var uData;
        var rtn;
        var newHier;
        var keys;

        var save = new Object();
        save = JSON.stringify(vpk.hierarchy);

        // if all namespaces wanted, do nothing
        if (ns.indexOf('all-namespaces') > -1) {
            utl.logMsg('vpkHIE508 - all namespaces are requested in hierarchy')
            uData = new Object();
            uData.data = vpk.hierarchy;
            rtn = this.bldHier(uData.data);
            return rtn;
        } else {
            utl.logMsg('vpkHIE509 - filtered namespaces: ' + ns)
            newHier = new Object();
            newHier.data = vpk.hierarchy;
            keys = Object.keys(newHier.data);
            for (var i = 0; i < keys.length; i++) {
                if (ns.indexOf(':' + keys[i] + ':') === -1) {
                    delete newHier.data[keys[i]];
                }
                if (keys[i] === '') {
                    if (typeof newHier.data[keys[i]] !== 'undefined') {
                        delete newHier.data[keys[i]];
                        utl.logMsg('vpkHIE558 - Dropped blank namespace, equal to ClusterLevel')
                    }
                }
            }
            rtn = this.bldHier(newHier.data);
            vpk.selected = newHier.data;
            vpk.hierarchy = JSON.parse(save);
            return rtn;
        }
    },


    //------------------------------------------------------------------------------
    // build hierarchy entry
    //------------------------------------------------------------------------------
    addEntry: function (ns, kind, name, fnum, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) {

        // parse and build hierarchy of cluster
        if (typeof vpk.hierarchy[ns] === 'undefined') {
            vpk.hierarchy[ns] = {};
            vpk.hierarchyFile[ns] = { fnum };
        }
        if (typeof vpk.hierarchy[ns][kind] === 'undefined') {
            vpk.hierarchy[ns][kind] = {};
            vpk.hierarchyFile[ns][kind] = { fnum };
        }
        if (typeof vpk.hierarchy[ns][kind][name] === 'undefined') {
            vpk.hierarchy[ns][kind][name] = {};
            vpk.hierarchyFile[ns][kind][name] = { fnum };
        }
        if (typeof p1 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1] = {};
                vpk.hierarchyFile[ns][kind][name][p1] = { fnum };
            }
        }
        if (typeof p2 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2] = { fnum };
            }
        }
        if (typeof p3 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3] = { fnum };
            }
        }
        if (typeof p4 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4] = { fnum };
            }
        }
        if (typeof p5 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4][p5] = { fnum };
            }
        }
        if (typeof p6 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4][p5][p6] = { fnum };
            }
        }
        if (typeof p7 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4][p5][p6][p7] = { fnum };
            }
        }
        if (typeof p8 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8] = { fnum };
            }
        }
        if (typeof p9 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8][p9] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8][p9] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8][p9] = { fnum };
            }
        }
        if (typeof p10 !== 'undefined') {
            if (typeof vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8][p9][p10] === 'undefined') {
                vpk.hierarchy[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8][p9][p10] = {};
                vpk.hierarchyFile[ns][kind][name][p1][p2][p3][p4][p5][p6][p7][p8][p9][p10] = { fnum };
            }
        }
    }

    //end of export    
};