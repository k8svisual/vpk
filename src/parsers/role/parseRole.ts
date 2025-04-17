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
Parse Role and ClusterRole
*/
'use strict';

import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';

//------------------------------------------------------------------------------
export function roleParse(ns: string, kind: string, name: string, obj: any, fnum: any) {
    try {
        //if (ns === 'cluster-level' || ns === '') {
        if (kind === 'ClusterRole') {
            if (typeof vpk.clusterRoleFnum[fnum] === 'undefined') {
                vpk.clusterRoleFnum[fnum] = [];
            }
            vpk.clusterRoleFnum[fnum].push({
                name: name,
                namespace: ns,
                fnum: fnum,
                roleKind: kind,
                rules: obj.rules,
                api: obj.apiVersion,
            });
        } else {
            if (typeof vpk.roleFnum[fnum] === 'undefined') {
                vpk.roleFnum[fnum] = [];
            }
            vpk.roleFnum[fnum].push({
                name: name,
                namespace: ns,
                fnum: fnum,
                roleKind: kind,
                rules: obj.rules,
                api: obj.apiVersion,
            });
        }

        loadAPI(obj.rules, kind, ns, fnum, name);

        loadArray(obj.rules, kind, ns, fnum, name);

        vpk.viewSecRole.push({
            name: name,
            kind: kind,
            ns: ns,
            rules: obj.rules,
            fnum: fnum,
        });
    } catch (err) {
        logMessage('ROL001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('ROL001 - Stack: ' + err.stack);
    }
}

// load Role apiGroup info
let loadAPI = function (rules: any, kind: string, ns: string, fnum: any, name: string) {
    if (rules === null) {
        return;
    }
    let grp: any;
    //let rsc: any;
    let g: number;
    let i: number;
    let item: any;
    let tmp: any;
    try {
        for (i = 0; i < rules.length; i++) {
            if (typeof rules[i].apiGroups !== 'undefined') {
                grp = rules[i].apiGroups;
                for (g = 0; g < grp.length; g++) {
                    if (typeof grp[g] !== 'undefined') {
                        if (grp[g].length > 0) {
                            item = grp[g];

                            if (typeof vpk.secApiGroups[item] === 'undefined') {
                                vpk.secApiGroups[item] = { Role: {}, ClusterRole: {} };
                            }
                            if (kind === 'Role') {
                                if (typeof vpk.secApiGroups[item].Role[ns] === 'undefined') {
                                    vpk.secApiGroups[item].Role[ns] = {};
                                }
                                if (typeof vpk.secApiGroups[item].Role[ns][name] === 'undefined') {
                                    vpk.secApiGroups[item].Role[ns][name] = {};
                                }
                                if (typeof vpk.secApiGroups[item].Role[ns][name][fnum] === 'undefined') {
                                    vpk.secApiGroups[item].Role[ns][name][fnum] = 1;
                                }
                            } else {
                                // ClusterRole
                                if (typeof vpk.secApiGroups[item].ClusterRole[name] === 'undefined') {
                                    vpk.secApiGroups[item].ClusterRole[name] = {};
                                }
                                if (typeof vpk.secApiGroups[item].ClusterRole[name][fnum] === 'undefined') {
                                    vpk.secApiGroups[item].ClusterRole[name][fnum] = 1;
                                } else {
                                    tmp = vpk.secApiGroups[item].ClusterRole[name][fnum];
                                    vpk.secApiGroups[item].ClusterRole[name][fnum] = tmp + 1;
                                }
                            }
                        }
                    }
                }
            }

            //Load RESOURCES here!!
            if (typeof rules[i].resources !== 'undefined') {
                grp = rules[i].resources;
                for (g = 0; g < grp.length; g++) {
                    if (typeof grp[g] !== 'undefined') {
                        if (grp[g].length > 0) {
                            item = grp[g];

                            if (typeof vpk.secResources[item] === 'undefined') {
                                vpk.secResources[item] = { Role: {}, ClusterRole: {} };
                            }
                            if (kind === 'Role') {
                                if (typeof vpk.secResources[item].Role[ns] === 'undefined') {
                                    vpk.secResources[item].Role[ns] = {};
                                }
                                if (typeof vpk.secResources[item].Role[ns][name] === 'undefined') {
                                    vpk.secResources[item].Role[ns][name] = {};
                                }
                                if (typeof vpk.secResources[item].Role[ns][name][fnum] === 'undefined') {
                                    vpk.secResources[item].Role[ns][name][fnum] = 1;
                                }
                            } else {
                                // ClusterRole
                                if (typeof vpk.secResources[item].ClusterRole[name] === 'undefined') {
                                    vpk.secResources[item].ClusterRole[name] = {};
                                }
                                if (typeof vpk.secResources[item].ClusterRole[name][fnum] === 'undefined') {
                                    vpk.secResources[item].ClusterRole[name][fnum] = 1;
                                } else {
                                    tmp = vpk.secResources[item].ClusterRole[name][fnum];
                                    vpk.secResources[item].ClusterRole[name][fnum] = tmp + 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        logMessage('ROL001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('ROL001 - Stack: ' + err.stack);
    }
};

let loadArray = function (data: any, kind: string, ns: string, fnum: any, name: string) {
    if (data === null) {
        return;
    }
    let verbSet: any;
    let apiGroups: any;
    let verbs: any;
    let resources: any;
    let tmp: any;
    for (var a = 0; a < data.length; a++) {
        apiGroups = [];
        verbs = [];
        resources = [];
        if (typeof data[a].apiGroups !== 'undefined') {
            apiGroups = data[a].apiGroups;
        }
        if (typeof data[a].verbs !== 'undefined') {
            verbs = data[a].verbs;
            verbSet = '';
            for (let v: number = 0; v < verbs.length; v++) {
                verbs.sort();
                if (v === 0) {
                    verbSet = verbs[v];
                } else {
                    verbSet = verbSet + '.' + verbs[v];
                }
            }
            addVerbSet(verbSet);
        }
        if (typeof data[a].resources !== 'undefined') {
            resources = data[a].resources;
        }
        for (var r = 0; r < resources.length; r++) {
            addResources(resources[r]);
            for (var ag = 0; ag < apiGroups.length; ag++) {
                tmp = apiGroups[ag];
                vpk.secArray.push({
                    vset: verbSet,
                    rsc: resources[r],
                    apiG: tmp,
                    kind: kind,
                    name: name,
                    ns: ns,
                    fnum: fnum,
                });
                addApiGroups(tmp);
            }
        }
    }
};

let addVerbSet = function (data) {
    if (typeof vpk.secVerbSetList[data] === 'undefined') {
        vpk.secVerbSetList[data] = {};
    }
};

let addApiGroups = function (data) {
    if (typeof vpk.secApiGroupsList[data] === 'undefined') {
        vpk.secApiGroupsList[data] = {};
    }
};

let addResources = function (data) {
    if (typeof vpk.secResourcesList[data] === 'undefined') {
        vpk.secResourcesList[data] = {};
    }
};
