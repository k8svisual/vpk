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
Container parse routines
*/
'user strict';

import vpk from '../../lib/vpk.js';

import { logMessage } from '../../utils/logging.js';
import { checkType } from '../../utils/checktype.js';
import { containerLink } from '../../utils/containerlink.js';

//------------------------------------------------------------------------------
// parse the container
//------------------------------------------------------------------------------
export function parseContainer(ns: string, kind: string, name: string, obj: any, ctype: string, fnum: any) {
    let doit: boolean = true;
    let e: number = -1;
    let c_name: string = '';
    let c_image: string = '';
    let cmapRef;
    let secRef;
    let fldRef;
    let volMount;
    let pStep = 'init';
    let tmpi;
    let memory;
    let cpu;
    let item: any;

    try {
        while (doit) {
            pStep = 'Outter_Loop';
            c_name = '';
            c_image = '';
            cmapRef = [];
            secRef = [];
            fldRef = [];
            volMount = [];

            e++;
            if (typeof obj[e] !== 'undefined') {
                // parse container definition
                c_name = obj[e].name;
                c_image = obj[e].image;

                vpk.containers[fnum].containerNames.push({ c_name: c_name, c_image: c_image });
                if (ctype === 'I') {
                    vpk.containers[fnum].typeIcnt = vpk.containers[fnum].typeIcnt + 1;
                } else {
                    vpk.containers[fnum].typeCcnt = vpk.containers[fnum].typeCcnt + 1;
                }

                // Get memory and CPU resources
                if (typeof obj[e].resources !== 'undefined') {
                    if (typeof obj[e].resources.requests !== 'undefined') {
                        cpu = 0;
                        memory = 0;
                        if (typeof obj[e].resources.requests.cpu !== 'undefined') {
                            cpu = obj[e].resources.requests.cpu;
                        }
                        if (typeof obj[e].resources.requests.memory !== 'undefined') {
                            memory = obj[e].resources.requests.memory;
                        }
                        vpk.containers[fnum].resourceRequest.push({ cpu: cpu, memory: memory });

                        if (kind === 'Pod') {
                            if (memory > 0) {
                                vpk.hogsMEM.push({ podName: name, podFnum: fnum, req: memory });
                            }
                            if (cpu > 0) {
                                vpk.hogsCPU.push({ podName: name, podFnum: fnum, req: cpu });
                            }
                        }
                    }

                    if (typeof obj[e].resources.limits !== 'undefined') {
                        cpu = 0;
                        memory = 0;
                        if (typeof obj[e].resources.limits.cpu !== 'undefined') {
                            cpu = obj[e].resources.limits.cpu;
                        }
                        if (typeof obj[e].resources.limits.memory !== 'undefined') {
                            memory = obj[e].resources.limits.memory;
                        }
                        vpk.containers[fnum].resourceLimit.push({ cpu: cpu, memory: memory });

                        if (kind === 'Pod') {
                            if (memory > 0) {
                                vpk.hogsMEM.push({ podName: name, podFnum: fnum, limit: memory });
                            }
                            if (cpu > 0) {
                                vpk.hogsCPU.push({ podName: name, podFnum: fnum, limit: cpu });
                            }
                        }
                    }
                }

                // build entries if ports exists
                if (typeof obj[e].ports !== 'undefined') {
                    for (let p = 0; p < obj[e].ports.length; p++) {
                        if (typeof obj[e].ports[p].containerPort !== 'undefined') {
                            containerLink(fnum, 'Ports', obj[e].ports[p].containerPort, 'Port', '');
                        }
                    }
                }

                // build entries if configMapKeyRef exists
                if (typeof obj[e].env !== 'undefined') {
                    let cfloop: boolean = true;
                    let c: number = 0;
                    if (typeof obj[e].env[c] === 'undefined') {
                        cfloop = false;
                    }

                    // build  configMap, secret, and fieldRef entries if they exist
                    while (cfloop) {
                        pStep = 'CF_Loop';
                        if (typeof obj[e].env[c].valueFrom !== 'undefined') {
                            // let vkey = '';
                            let vdata: any = {};
                            vdata = {
                                namespace: ns,
                                kind: kind,
                                objName: name,
                            };
                            if (typeof obj[e].env[c].valueFrom.secretKeyRef !== 'undefined') {
                                pStep = 'Secret';
                                vdata.type = 'secret';
                                vdata.vname = obj[e].env[c].valueFrom.secretKeyRef.name;
                                vdata.vkey = obj[e].env[c].valueFrom.secretKeyRef.key;
                                secRef.push(vdata);
                                containerLink(fnum, 'Secret', obj[e].env[c].valueFrom.secretKeyRef.name, 'Env', '');
                            }

                            if (typeof obj[e].env[c].valueFrom.configMapKeyRef !== 'undefined') {
                                pStep = 'ConfigMap';
                                vdata.type = 'configMap';
                                vdata.vname = obj[e].env[c].valueFrom.configMapKeyRef.name;
                                vdata.vkey = obj[e].env[c].valueFrom.configMapKeyRef.key;
                                cmapRef.push(vdata);
                                containerLink(fnum, 'ConfigMap', obj[e].env[c].valueFrom.configMapKeyRef.name, 'Env', '');
                            }

                            if (typeof obj[e].env[c].valueFrom.fieldRef !== 'undefined') {
                                vdata.type = 'fieldRef';
                                vdata.vname = obj[e].env[c].valueFrom.fieldRef.fieldPath;
                                fldRef.push(vdata);
                            }
                        }
                        c++;
                        if (typeof obj[e].env[c] === 'undefined') {
                            cfloop = false;
                        }
                    }
                }

                // check for volumeMounts
                if (typeof obj[e].volumeMounts !== 'undefined') {
                    pStep = 'VolumeMounts';
                    let vloop = true;
                    let v = 0;

                    if (typeof obj[e].volumeMounts[v] === 'undefined') {
                        vloop = false;
                    }

                    // build  configMap, secret, and fieldRef entries if they exist
                    while (vloop) {
                        pStep = 'VolumeMounts_Loop';
                        let voldata = {};
                        let mountPath = '';
                        let mountName = '';
                        voldata = {
                            namespace: ns,
                            kind: kind,
                            objName: name,
                        };
                        if (typeof obj[e].volumeMounts[v].name !== 'undefined') {
                            mountName = obj[e].volumeMounts[v].name;
                            if (typeof obj[e].volumeMounts[v].name !== 'undefined') {
                                mountPath = obj[e].volumeMounts[v].mountPath;
                            }
                        }
                        volMount.mountName = mountName;
                        volMount.mountPath = mountPath;
                        volMount.push(voldata);

                        // create / update volumeMounts
                        pStep = 'VolumeMount';
                        let vmkey = ns + '.' + 'VolumeMount' + '.' + mountName;
                        checkType('VolumeMount', vmkey);
                        let tmpm = vpk['VolumeMount'][vmkey];
                        let item: any = {
                            namespace: ns,
                            kind: 'VolumeMount',
                            objName: mountName,
                            mountPath: mountPath,
                            mountName: mountName,
                            fnum: fnum,
                        };
                        tmpm.push(item);
                        vpk['VolumeMount'][vmkey] = tmpm;
                        containerLink(fnum, 'VolumeMounts', mountName, 'VolMnt', '');
                        v++;
                        if (typeof obj[e].volumeMounts[v] === 'undefined') {
                            vloop = false;
                        }
                    }
                }

                // build array with the container name
                pStep = 'ContainerName';
                let ckey = ns + '.' + c_name;
                checkType('ContainerName', ckey);
                let tmpc = vpk['ContainerName'][ckey];
                item = {
                    namespace: ns,
                    kind: kind,
                    objName: name,
                    containerRefName: c_name,
                    image: c_image,
                    fnum: fnum,
                };
                tmpc.push(item);
                vpk['ContainerName'][ckey] = tmpc;

                // build array with the docker container image name
                pStep = 'ContainerImage';
                let cikey = ns + '.' + c_image;
                checkType('ContainerImage', cikey);
                tmpi = vpk['ContainerImage'][cikey];
                item = {
                    namespace: ns,
                    kind: kind,
                    objName: name,
                    containerRefName: c_name,
                    image: c_image,
                    fnum: fnum,
                };
                tmpi.push(item);
                vpk['ContainerImage'][cikey] = tmpi;
            } else {
                doit = false;
            }

            // safety stop
            if (e > 100) {
                doit = false;
            }
        }
    } catch (err) {
        logMessage('CNT001 - Error processing file fnum: ' + fnum + ' container entry: ' + c_name + ' message: ' + err + ' InRoutine: ' + pStep);
        logMessage('CNT001 - Stack: ' + err.stack);
    }
}
