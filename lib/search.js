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

/*------------------------------------------------------------------------------
Search definitions and types
*/

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
// loop through all types and determine if it should be included in results
//------------------------------------------------------------------------------

let fnumBase;

const search = function (nsFilter, kindFilter, valueFilter) {
    try {
        // Check Namespaces    
        if (nsFilter !== "::all-namespaces::") {
            let what = nsFilter.split('::');
            checkNsOrKind(what, 'NS')
        }
        // Check Kinds
        if (kindFilter !== "::all-kinds::") {
            let what = kindFilter.split('::');
            checkNsOrKind(what, 'KIND')
        }
        // Check searchValue
        if (valueFilter !== "*") {
            parseValueFilter(valueFilter)
        }
    } catch (err) {
        utl.logMsg('vpkSCH005 - Error processing, message: ' + err);
        utl.logMsg('vpkSCH005 - Stack: ' + err.stack)
        return [];
    }
    return buildReturn();
};

const parseValueFilter = function (valueFilter) {
    let filter;
    let key;
    let value;
    let tmp;

    filter = valueFilter.trim();
    key = "";
    value = "";
    if (filter.startsWith("labels:")) {
        if (filter.indexOf("::value::") > -1) {
            tmp = filter.split("::value::");
            key = tmp[0].substring(7);
            key = key.trim();
            value = tmp[1];
            value = value.trim();
        } else {
            key = filter.substring(7);
            key = key.trim();
            value = "";
        }
        checkKeyValue(key, value, "Labels")

    } else if (filter.startsWith("annotations:")) {
        if (filter.indexOf("::value::") > -1) {
            tmp = filter.split("::value::");
            key = tmp[0].substring(12);
            key = key.trim();
            value = tmp[1];
            value = value.trim();
        } else {
            key = filter.substring(12);
            key = key.trim();
            value = ""
        }
        checkKeyValue(key, value, "Annotations")

    } else if (filter.startsWith("name:")) {
        key = filter.substring(5)
        key = key.trim();
        value = ""
        checkKeyValue(key, value, "Name")

    } else {
        // Check the entire resource for the string value
        checkEntireResource(filter)
    }
}


const checkEntireResource = function (what) {
    let keys = Object.keys(fnumBase);
    let key;
    let data;
    let keepFnum = [];
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        key = parseInt(key);
        data = vpk.k8sResc[key];

        // If managedFields are hidden do not search
        if (vpk.dropManagedFields === true) {
            if (typeof data.managedFields !== 'undefined') {
                delete data.managedFields
            }
        }
        // If stats is hidden do not search
        if (vpk.dropStatus === true) {
            if (typeof data.status !== 'undefined') {
                delete data.status
            }
        }

        data = JSON.stringify(data);


        if (data.indexOf(what) > -1) {
            keepFnum.push(keys[i])
        } else {
            delete fnumBase[keys[i]]
        }
    }
    processSelected(keepFnum)
    return;
}

const checkKeyValue = function (key, value, type) {
    let keepFnum = [];
    let data = [];
    let kData = "";
    let vData = "";
    if (key !== "") {
        if (type === "Labels") {
            if (key !== "*" && key !== "") {
                if (typeof vpk.idxLabels[key] !== 'undefined') {
                    kData = vpk.idxLabels[key];
                }
            }
            if (value !== "") {
                if (typeof vpk.idxLabelsValue[value] !== 'undefined') {
                    vData = vpk.idxLabelsValue[value];
                }
            }
        } else if (type === "Annotations") {
            if (typeof vpk.idxAnnotations[key] !== 'undefined') {
                kData = vpk.idxAnnotations[key];
                if (typeof kData === 'undefined') {
                    kData = "";
                }
            }
            if (value !== "") {
                if (typeof vpk.idxAnnotationsValue[value] !== 'undefined') {
                    vData = vpk.idxAnnotationsValue[value];
                }
            }
        } else if (type === "Name") {
            if (typeof vpk.idxName[key] !== 'undefined') {
                kData = vpk.idxName[key];
                vData = "";
            }
        }

        if (key !== "*" && value !== "") {
            if (vData === "" || vData.length === 0) {
                data = [];
            } else {
                data = reduceKV(kData, vData);
            }
        } else if (kData !== "" && vData !== "") {
            data = reduceKV(kData, vData);
        } else if (kData === "" && vData !== "") {
            data = vData;
        } else if (vData === "" && kData !== "") {
            data = kData;
        }

        for (let d = 0; d < data.length; d++) {
            keepFnum.push(data[d]);
        }
    }
    processSelected(keepFnum)
}

const reduceKV = function (keys, values) {
    let rtn = [];
    let key;
    for (key of keys) {
        if (values.includes(key)) {
            rtn.push(key)
        }
    }
    return rtn;
}

const checkNsOrKind = function (what, type) {
    let keepFnum = [];
    let key;
    let data;
    for (let i = 0; i < what.length; i++) {
        key = what[i];
        if (key !== "") {
            if (type === "NS") {
                data = vpk.idxNS[key];
            } else if (type === "KIND") {
                data = vpk.idxKind[key];
            }
            for (let d = 0; d < data.length; d++) {
                keepFnum.push(data[d]);
            }
        }
    }
    processSelected(keepFnum)
}

const processSelected = function (keep) {
    let keys = Object.keys(fnumBase);
    let key;
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        if (keep.includes(key)) {
            continue
        } else {
            delete fnumBase[key]
        }
    }
    return;
}

const buildReturn = function () {
    try {
        let keys = Object.keys(fnumBase);
        let key;
        let rtn = [];
        let item;
        let fn;
        for (let i = 0; i < keys.length; i++) {
            key = keys[i]
            fn = fnumBase[key];
            item = {
                'namespace': fn.ns,
                'kind': fn.kind,
                'name': fn.name,
                'fnum': key
            };
            rtn.push(item);
        }
        return rtn;
    } catch (err) {
        utl.logMsg('vpkSCH005 - Error processing, message: ' + err);
        utl.logMsg('vpkSCH005 - Stack: ' + err.stack)
        return [];
    }
}


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    process: function (data) {
        let nsFilter;
        let kindFilter;
        let searchValue;

        // Obtain new fnum array that will be the base for what is to be 
        // returned
        let tmp = JSON.stringify(vpk.idxFnum);
        fnumBase = JSON.parse(tmp)
        tmp = null;
        // Validate namespace(s)
        if (typeof data.namespaceFilter !== 'undefined') {
            nsFilter = data.namespaceFilter;
        } else {
            nsFilter = '::all-namespaces::'
        }
        // Validate kind(s)
        if (typeof data.kindFilter !== 'undefined') {
            kindFilter = data.kindFilter;
        } else {
            kindFilter = '::all-kinds::'
        }
        // Validate search value
        if (typeof data.searchValue !== 'undefined') {
            searchValue = data.searchValue;
            if (searchValue.length === 0) {
                searchValue = '*';
            }
        } else {
            searchValue = '*';
        }

        return search(nsFilter, kindFilter, searchValue);

    }
};