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

/*------------------------------------------------------------------------------
Search definitions and types
*/

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

// uTypes is here to provide a means to exclude VpK version 2 kinds.  At some point this can be removed
const uTypes = ':Args:ArgsUse:Command:CommandUse:ConfigMapUse:ContainerImage:ContainerImageUse'
    + ':ContainerName:ContainerNameUse;Env:EnvUse'
    + ':Labels:LabelsUse:LabelsSpecSelector:LabelsSpecSelectorUse'
    + ':LivenessProbe:LivenessProbeUse:NodeSelector:NodeSelectorUse:PodLabels:PodLabelsUse'
    + ':ReadinessProbe:ReadinessProbeUse'
    + ':SecretUse:SecretsUse:Selector:SelectorUse:SelectorLabels'
    + ':StorageClassUse'
    + ':VolumeClaimTemplates:VolumeClaimTemplatesUse:VolumeMount:VolumeMountUse'
    + ':Volumes:VolumesUse:MatchLabels:MatchLabelsUse:';


//------------------------------------------------------------------------------
// loop through all types and determine if it should be included in results
//------------------------------------------------------------------------------
// search(kindnameValue, kindFilter, nsFilter, totId, skipU, labelFilter);

//         result = search(nsFilter, kindFilter, kindnameValue, labelFilter, allKinds);


const search = function (nsFilter, kinds, kindnameValue, labelFilter) {
    let data = [];
    let tmp;
    let kind;
    let c
    if (kinds.length > 0) {
        for (c = 0; c < kinds.length; c++) {
            kind = kinds[c];
            kind = kind.trim();
            // always skip any U (user defined) kinds
            if (uTypes.indexOf(':' + kind + ':') > -1) {
                continue;
            }
            if (kind.length > 0) {
                tmp = getData(nsFilter, kind, kindnameValue, labelFilter)
                if (tmp.length > 0) {
                    data = data.concat(tmp)
                }
            }
        }
        c++
        utl.logMsg('vpkSCH010 - ' + c + ' kinds that are to be searched');
    }
    return data;
};


//------------------------------------------------------------------------------
// search the selected type and determine if it should be included in results
//------------------------------------------------------------------------------
const getData = function (nsFilter, kind, kindnameValue, labelFilter) {
    try {
        let data = '';
        if (typeof vpk[kind] !== 'undefined') {
            data = vpk[kind];
            return filterData(nsFilter, kind, kindnameValue, labelFilter, data);
        }
        // return empty array
        return [];
    } catch (err) {
        utl.logMsg('vpkSCH002 - Error processing, message: ' + err);
    }
};


//------------------------------------------------------------------------------
// determine if data should be include in result set
//------------------------------------------------------------------------------
const filterData = function (nsFilter, kind, kindnameValue, labelFilter, data) {
    let cv;
    let selected = [];
    let tmp;
    let item;
    let saveNS;
    let saveValue;
    let saveLabel;

    kindnameValue = kindnameValue.trim();

    try {
        for (item in data) {
            tmp = data[item];
            // some data structure validation checks
            if (typeof tmp[0] === 'undefined') {
                continue;
            } else {
                if (typeof tmp[0].kind === 'undefined') {
                    continue;
                }
            }

            if (typeof tmp[0].fnum === 'undefined') {
                utl.logMsg('vpkSCH703 - No fnum found for kind: ' + kind);
                continue;
            }

            // set flag to not save data
            saveNS = false;
            saveValue = false;
            saveLabel = false;

            // check for namespace match
            if (nsFilter.indexOf('all-namespaces') > -1) {
                saveNS = true;
            } else {
                // check if nsFilter contains this namespace
                let chkNs = tmp[0].namespace;
                if (chkNs !== '') {
                    if (nsFilter.indexOf(':' + tmp[0].namespace + ':') > -1) {
                        saveNS = true
                    } else {
                        continue;
                    }
                } else {
                    if (nsFilter.indexOf(':<cluster-level>:') > -1) {
                        saveNS = true
                    } else {
                        continue;
                    }
                }
            }

            // check for kindnameValue match
            if (kindnameValue === '*') {
                saveValue = true;
            } else {
                cv = tmp[0].objName;
                if (cv.indexOf(kindnameValue) > -1) {
                    saveValue = true;
                }
            }

            // check for label match
            //for label value pasted in check
            //vpk.lable[key: value] to determine if it exists?
            //if yes, then using fnum, check if fnum in the the array?
            //if yes, then save, else skip set save = false

            // check for labels match
            if (labelFilter !== '::') {
                let labelArray = labelFilter.split('::');
                let fnum = tmp[0].fnum;;
                if (typeof labelArray[0] !== 'undefined') {
                    for (let i = 0; i < labelArray.length; i++) {
                        if (saveLabel === true) {
                            break;
                        }
                        let key = labelArray[i];
                        let label = vpk.labelKeys[key];
                        if (typeof label !== 'undefined' && label !== '') {
                            for (let x = 0; x < label.length; x++) {
                                if (label[x] === fnum) {
                                    saveLabel = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            } else {
                saveLabel = true;
            }

            if (saveNS && saveValue && saveLabel) {
                item = {
                    'namespace': tmp[0].namespace,
                    'kind': kind,
                    'name': tmp[0].objName,
                    'fnum': tmp[0].fnum
                };
                selected.push(item);
            }
        }

        // sort array to be returned
        selected.sort(arraySort('key'));

        return selected;

    } catch (err) {
        utl.logMsg('vpkSCH005 - Error processing, message: ' + err);
        utl.logMsg('vpkSCH005 - Stack: ' + err.stack)
    }
};

const arraySort = function (property) {
    let sortOrder = 1;
    if (property[0] === '-') {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a, b) {
        let result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    };
};


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    process: function (data) {
        let nsFilter;
        let kindFilter;
        let labelFilter;
        let kindnameValue;
        let kinds;
        let result;

        if (typeof data.kindnameValue !== 'undefined') {
            kindnameValue = data.kindnameValue;
            if (kindnameValue.length === 0) {
                kindnameValue = '*';
            }
        } else {
            kindnameValue = '*';
        }

        if (typeof data.kindFilter !== 'undefined') {
            kindFilter = data.kindFilter;
        } else {
            kindFilter = '::all-kinds::'
        }
        if (typeof data.namespaceFilter !== 'undefined') {
            nsFilter = data.namespaceFilter;
        } else {
            nsFilter = '::all-namespaces::'
        }
        if (typeof data.labelFilter !== 'undefined') {
            labelFilter = data.labelFilter;
        } else {
            labelFilter = ''
        }

        // Build array of kinds to select
        if (kindFilter.indexOf('all-kinds') === -1) {
            kinds = kindFilter.split('::');
        } else {
            kinds = vpk.kindList;   // global varible with all kinds seperated by '::'
        }

        result = search(nsFilter, kinds, kindnameValue, labelFilter);

        return result;

    }

};