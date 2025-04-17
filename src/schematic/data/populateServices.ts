//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
import { readResourceFile } from '../../filehandler/readresource.js';

export function populateServices() {
    let keys: any[] = Object.keys(vpk.serviceFnum);
    let key: string = '';
    let fnum: string = '';
    let labelFnums: any;
    let firstLabel: string;
    let fn: string;

    let myLbls: any;
    let lblString: string;

    let labels: any;
    let chkLbl: string;
    let lblKeys: any;
    let keepFnums: any;
    let fileContent: any;
    try {
        for (let k = 0; k < keys.length; k++) {
            key = keys[k]; // the service spec.selector.label
            if (typeof vpk.serviceFnum[key][0].Labels !== 'undefined') {
                if (typeof vpk.serviceFnum[key][0].Labels[0] !== 'undefined') {
                    firstLabel = vpk.serviceFnum[key][0].Labels[0].label;
                    labels = vpk.serviceFnum[key][0].Labels;
                    lblString = '';
                    for (let y = 0; y < labels.length; y++) {
                        lblString = lblString + ':' + labels[y].label;
                    }
                    lblString = lblString + ':';
                    if (typeof vpk.labelKeys[firstLabel] !== 'undefined') {
                        labelFnums = vpk.labelKeys[firstLabel];
                        // check each item that has this label
                        keepFnums = [];
                        for (let c = 0; c < labelFnums.length; c++) {
                            fn = labelFnums[c];

                            // read file and get labels
                            fileContent = readResourceFile(fn);
                            if (typeof fileContent.metadata.labels !== 'undefined') {
                                myLbls = fileContent.metadata.labels;
                            } else {
                                myLbls = {};
                            }
                            lblKeys = Object.keys(myLbls);
                            for (let u = 0; u < lblKeys.length; u++) {
                                //chkLbl = myLbl[u] + ': ' +
                                chkLbl = ':' + lblKeys[u] + ': ' + myLbls[lblKeys[u]] + ':';
                                if (lblString.indexOf(chkLbl) > -1) {
                                    if (chkLbl !== key) {
                                        keepFnums.push(labelFnums[c]);
                                    }
                                }
                            }
                            if (keepFnums.length > 0) {
                                for (let k: number = 0; k < keepFnums.length; k++) {
                                    if (typeof vpk.pods[keepFnums[k]] !== 'undefined') {
                                        // check if target is a Pod
                                        if (vpk.pods[keepFnums[k]].kind === 'Pod') {
                                            //
                                            if (typeof vpk.pods[keepFnums[k]].Services === 'undefined') {
                                                vpk.pods[keepFnums[k]].Services = [];
                                            }
                                            // check if already saved as a Service
                                            let saveIt = true;
                                            for (let c: number = 0; c < vpk.pods[keepFnums[k]].Services.length; c++) {
                                                if (vpk.pods[keepFnums[k]].Services[c].fnum === key) {
                                                    saveIt = false;
                                                    break;
                                                }
                                            }
                                            // save the service in the Pod
                                            if (saveIt === true) {
                                                vpk.pods[keepFnums[k]].Services.push({
                                                    fnum: key,
                                                    name: vpk.serviceFnum[key][0].name,
                                                    namespace: vpk.serviceFnum[key][0].namespace,
                                                    ep: '',
                                                    eps: '',
                                                    type: 'unk',
                                                });
                                            }
                                        }
                                    } else {
                                        //logMessage('SCM034 -  Did not locate container for fnum: ' + keepFnums[k]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        logMessage('SCM034 -  Error populating service for key: ' + key + ' fnum: ' + fnum);
        logMessage('SCM134 -  Error: ' + err.stack);
        console.log(err.stack);
    }
}
