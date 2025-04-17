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
Parse RoleBinding and ClusterRoleBinding
*/

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';

//------------------------------------------------------------------------------
export function roleBindingParse(ns: string, kind: string, name: string, obj: any, fnum: any) {
    let userNames: string = '';
    let clusterLevel: boolean = false;
    let roleKind: string = '';
    let roleName: string = '';
    let buildMissing: boolean;

    try {
        if (kind.startsWith('Cluster')) {
            clusterLevel = true;
        }

        if (typeof obj.userNames !== 'undefined') {
            userNames = obj.userNames;
        }
        if (userNames === 'null') {
            userNames = '';
        }

        if (clusterLevel === true) {
            if (typeof vpk.clusterRoleBindingFnum[fnum] === 'undefined') {
                vpk.clusterRoleBindingFnum[fnum] = [];
            }
            vpk.clusterRoleBindingFnum[fnum].push({
                name: name,
                namespace: ns,
                fnum: fnum,
                subjects: obj.subjects,
                roleRef: obj.roleRef,
                userNames: userNames,
                api: obj.apiVersion,
            });
        } else {
            if (typeof vpk.roleBindingFnum[fnum] === 'undefined') {
                vpk.roleBindingFnum[fnum] = [];
            }
            vpk.roleBindingFnum[fnum].push({
                name: name,
                namespace: ns,
                fnum: fnum,
                subjects: obj.subjects,
                roleRef: obj.roleRef,
                userNames: userNames,
                api: obj.apiVersion,
            });
        }

        if (typeof obj.subjects !== 'undefined') {
            let subjectName: string;
            let subjectKind: string;
            let roleName: string;
            let roleKind: string;
            let tmp: any;
            let key: string;
            for (let i = 0; i < obj.subjects.length; i++) {
                key = obj.subjects[i].kind + ':@:' + obj.subjects[i].name;
                if (typeof vpk.subjects[key] === 'undefined') {
                    vpk.subjects[key] = [];
                }
                vpk.subjects[key].push({
                    fnum: fnum,
                    namespace: ns,
                    kind: obj.subjects[i].kind,
                    name: obj.subjects[i].name,
                    roleKind: obj.roleRef.kind,
                    roleName: obj.roleRef.name,
                    roleApiGroup: obj.roleRef.apiGroup,
                    userNames: userNames,
                    clusterLevel: clusterLevel,
                });

                subjectName = obj.subjects[i].name;
                subjectKind = obj.subjects[i].kind;
                roleName = obj.roleRef.name;
                roleKind = obj.roleRef.kind;

                if (typeof vpk.secSubjects[subjectKind] === 'undefined') {
                    vpk.secSubjects[subjectKind] = {};
                }
                if (typeof vpk.secSubjects[subjectKind][subjectName] === 'undefined') {
                    vpk.secSubjects[subjectKind][subjectName] = {};
                }
                if (typeof vpk.secSubjects[subjectKind][subjectName][fnum] === 'undefined') {
                    tmp = {
                        bindRoleKind: roleKind,
                        bindRoleName: roleName,
                        namespace: ns,
                    };
                    vpk.secSubjects[subjectKind][subjectName][fnum] = tmp;
                }
            }
        }

        // what role is being bound in the roleRef sections
        if (typeof obj.roleRef !== 'undefined') {
            if (typeof obj.roleRef.name !== 'undefined') {
                roleName = obj.roleRef.name;
                if (typeof obj.roleRef.kind !== 'undefined') {
                    roleKind = obj.roleRef.kind;
                } else {
                    roleKind = 'unknown';
                }
                let item = {
                    fnum: fnum,
                    kind: kind,
                    roleRefName: roleName,
                    roleRefKind: roleKind,
                };
                if (typeof vpk.roleRefRole[fnum] === 'undefined') {
                    vpk.roleRefRole[fnum] = [];
                }
                vpk.roleRefRole[fnum].push(item);
            }
        }

        buildMissing = false;

        if (typeof obj.subjects !== 'undefined') {
            if (obj.subjects.length > 0) {
                for (var i = 0; i < obj.subjects.length; i++) {
                    vpk.viewSecBinding.push({
                        name: name,
                        kind: kind,
                        ns: ns,
                        fnum: fnum,
                        roleName: roleName,
                        roleKind: roleKind,
                        rules: '??',
                        subjectName: obj.subjects[i].name,
                        subjectKind: obj.subjects[i].kind,
                        subjectNS: obj.subjects[i].namespace,
                    });
                }
            } else {
                buildMissing = true;
            }
        } else {
            buildMissing = true;
        }

        if (buildMissing) {
            vpk.viewSecBinding.push({
                name: name,
                kind: kind,
                ns: ns,
                fnum: fnum,
                roleName: roleName,
                roleKind: roleKind,
                rules: '??',
                subjectName: 'Missing',
                subjectKind: 'Missing',
                subjectNS: 'Missing',
            });
        }
    } catch (err) {
        logMessage('BND001 - Error processing file fnum: ' + fnum + ' kind: ' + kind + ' message: ' + err);
        logMessage('BND001 - Stack: ' + err.stack);
    }
}
