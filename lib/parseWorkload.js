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

/*------------------------------------------------------------------------------
Container parse routines
*/

var vpk = require('./vpk');
var utl = require('./utl');
var hierarchy = require('./hierarchy');
var nodeSelectorParse = require('./parseNodeSelector');
var volumeClaimTemplatesParse = require('./parseVolumeClaimTemplate');
var volumeParse = require('./parseVolume');

var allVolMounts = [];
var allVolumes = {};


var parseWorkload = function (ns, kind, name, yaml, fnum, node) {
    allVolMounts = [];
    allVolumes = {};
    if (typeof yaml.spec !== 'undefined') {

        // Pod workload kind
        if (kind === 'Pod') {
            if (typeof yaml.spec.nodeName !== 'undefined') {
                vpk.pods[fnum].node = yaml.spec.nodeName;
            }
            if (typeof yaml.spec.containers !== 'undefined') {
                parseWorkloadContainers(ns, kind, name, yaml.spec.containers, 'C', fnum);
            }
            if (typeof yaml.spec.volumes !== 'undefined') {
                volumeParse.parse(ns, kind, name, yaml.spec.volumes, fnum, node)
                getVolumes(yaml.spec.volumes);
            }
            if (typeof yaml.spec.volumeClaimTemplates !== 'undefined') {
                volumeClaimTemplatesParse.parse(ns, 'VolumeClaimTemplates', name, yaml.spec.volumeClaimTemplates, kind, fnum);
            }
            if (typeof yaml.spec.nodeSelector !== 'undefined') {
                //nodeSelectorParse.parse(ns, 'NodeSelector', name, yaml.spec.nodeSelector, kind, fnum);
            }
            if (typeof yaml.spec.serviceAccount !== 'undefined') {
                utl.containerLink(fnum, 'ServiceAccount', yaml.spec.serviceAccount)
            }
            if (typeof yaml.spec.imagePullSecrets !== 'undefined') {
                for (let p = 0; p < yaml.spec.imagePullSecrets.length; p++) {
                    utl.containerLink(fnum, 'Secret', yaml.spec.imagePullSecrets[p].name, 'ImagePull')
                }
            }
            return;
        }

        // Cronjob workload kind
        if (kind === 'CronJob') {
            if (typeof yaml.spec.jobTemplate !== 'undefined') {
                if (typeof yaml.spec.jobTemplate.spec !== 'undefined') {
                    if (typeof yaml.spec.jobTemplate.spec.template !== 'undefined') {
                        if (typeof yaml.spec.jobTemplate.spec.template.spec !== 'undefined') {
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.nodeName !== 'undefined') {
                                vpk.pods[fnum].node = yaml.spec.jobTemplate.spec.template.spec.nodeName
                            }
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.containers !== 'undefined') {
                                parseWorkloadContainers(ns, kind, name, yaml.spec.jobTemplate.spec.template.spec.containers, 'C', fnum);
                            }
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.volumes !== 'undefined') {
                                volumeParse.parse(ns, kind, name, yaml.spec.jobTemplate.spec.template.spec.volumes, fnum, node)
                                getVolumes(yaml.spec.jobTemplate.spec.template.spec.volumes);
                            }
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.volumeClaimTemplates !== 'undefined') {
                                volumeClaimTemplatesParse.parse(ns, 'VolumeClaimTemplates', name, yaml.spec.jobTemplate.spec.template.spec.volumeClaimTemplates, kind, fnum);
                            }
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.nodeSelector !== 'undefined') {
                                //nodeSelectorParse.parse(ns, 'NodeSelector', name, yaml.spec.nodeSelector, kind, fnum);
                            }
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.serviceAccount !== 'undefined') {
                                utl.containerLink(fnum, 'ServiceAccount', yaml.spec.jobTemplate.spec.template.spec.serviceAccount)
                            }
                            if (typeof yaml.spec.jobTemplate.spec.template.spec.imagePullSecrets !== 'undefined') {
                                for (let p = 0; p < yaml.spec.jobTemplate.spec.template.spec.imagePullSecrets.length; p++) {
                                    utl.containerLink(fnum, 'Secret', yaml.spec.jobTemplate.spec.template.spec.imagePullSecrets[p].name, 'ImagePull')
                                }
                            }
                        }
                    }
                }
            }
            return;
        }

        // All other workload kinds except Cronjob, and Pod
        if (typeof yaml.spec.template !== 'undefined') {
            if (typeof yaml.spec.template.spec !== 'undefined') {
                if (typeof yaml.spec.template.spec.nodeName !== 'undefined') {
                    vpk.pods[fnum].node = yaml.spec.template.spec.nodeName
                }
                if (typeof yaml.spec.template.spec.nodeSelector !== 'undefined') {
                    //nodeSelectorParse.parse(ns, 'NodeSelector', name, yaml.spec.template.spec.nodeSelector, kind, fnum);
                }
                if (typeof yaml.spec.template.spec.volumes !== 'undefined') {
                    volumeParse.parse(ns, kind, name, yaml.spec.template.spec.volumes, fnum, node)
                    getVolumes(yaml.spec.template.spec.volumes)
                }
                if (typeof yaml.spec.volumeClaimTemplates !== 'undefined') {
                    volumeClaimTemplatesParse.parse(ns, 'VolumeClaimTemplates', name, yaml.spec.volumeClaimTemplates, kind, fnum);
                }
                if (typeof yaml.spec.template.spec.serviceAccount !== 'undefined') {
                    utl.containerLink(fnum, 'ServiceAccount', yaml.spec.template.spec.serviceAccount)
                }
                if (typeof yaml.spec.template.spec.imagePullSecrets !== 'undefined') {
                    for (let p = 0; p < yaml.spec.template.spec.imagePullSecrets.length; p++) {
                        utl.containerLink(fnum, 'Secret', yaml.spec.template.spec.imagePullSecrets[p].name, 'ImagePull')
                    }
                }
                if (typeof yaml.spec.template.spec.containers !== 'undefined') {
                    parseWorkloadContainers(ns, kind, name, yaml.spec.template.spec.containers, 'C', fnum);
                }
                if (typeof yaml.spec.template.spec.initContainers !== 'undefined') {
                    parseWorkloadContainers(ns, kind, name, yaml.spec.template.spec.initContainers, 'I', fnum);
                }

                return;
            }
        }
    }
}

var containerImages = function (c_image, c_name, fnum, ns) {
    var registry;
    var regW;
    if (c_image !== 'undefined') {
        if (typeof vpk.containerImages[c_image] === 'undefined') {
            vpk.containerImages[c_image] = [];
            vpk.containerImages[c_image].push(fnum);
        } else {
            vpk.containerImages[c_image].push(fnum);
        }

        regW = c_image.lastIndexOf('/');
        registry = c_image.substring(0, regW);
        if (registry.length === 0) {
            utl.logMsg('vpkCNT899 - Image is using default repository: ' + c_image);
        }
        if (typeof vpk.imageRegistry[registry] === 'undefined') {

            vpk.imageRegistry[registry] = 1;
        } else {
            vpk.imageRegistry[registry] = vpk.imageRegistry[registry] + 1;
        }
    }

    //========= DEAD CODE ????
    // // build array with the container name
    // var ckey = ns + '.' + c_name;
    // utl.checkType('ContainerName', ckey);
    // var tmpc = vpk['ContainerName'][ckey];
    // item = {
    //     'namespace': ns,
    //     'kind': kind,
    //     'objName': name,
    //     'containerRefName': c_name,
    //     'image': c_image,
    //     'fnum': fnum
    // };
    // tmpc.push(item);
    // vpk['ContainerName'][ckey] = tmpc;

    // // build array with the docker container image name
    // var cikey = ns + '.' + c_image;
    // utl.checkType('ContainerImage', cikey);
    // tmpi = vpk['ContainerImage'][cikey];
    // item = {
    //     'namespace': ns,
    //     'kind': kind,
    //     'objName': name,
    //     'containerRefName': c_name,
    //     'image': c_image,
    //     'fnum': fnum
    // };
    // tmpi.push(item);
    // vpk['ContainerImage'][cikey] = tmpi;


}

var saveResources = function (obj, e, fnum) {
    if (typeof obj[e].resources === 'undefined') {
        return;
    }

    var memory;
    var cpu;
    // Set requests
    if (typeof obj[e].resources.requests !== 'undefined') {
        cpu = 0;
        memory = 0;
        if (typeof obj[e].resources.requests.cpu !== 'undefined') {
            cpu = obj[e].resources.requests.cpu;
        }
        if (typeof obj[e].resources.requests.memory !== 'undefined') {
            memory = obj[e].resources.requests.memory;
        }
        vpk.pods[fnum].resourceRequest.push({ 'cpu': cpu, 'memory': memory })
    }
    // Set limits
    if (typeof obj[e].resources.limits !== 'undefined') {
        cpu = 0;
        memory = 0;
        if (typeof obj[e].resources.limits.cpu !== 'undefined') {
            cpu = obj[e].resources.limits.cpu;
        }
        if (typeof obj[e].resources.limits.memory !== 'undefined') {
            memory = obj[e].resources.limits.memory;
        }
        vpk.pods[fnum].resourceLimit.push({ 'cpu': cpu, 'memory': memory })
    }
}

var savePorts = function (obj, e, fnum) {
    if (typeof obj[e].ports === 'undefined') {
        return;
    }

    for (let p = 0; p < obj[e].ports.length; p++) {
        if (typeof obj[e].ports[p].containerPort !== 'undefined') {
            utl.containerLink(fnum, 'Ports', obj[e].ports[p].containerPort, '', obj[e].ports[p])
            vpk.pods[fnum].ports.push(obj[e].ports[p].containerPort);
        }
    }
}

var saveEnv = function (obj, e, fnum, name, ns, kind, hval, c_name) {
    if (typeof obj[e].env === 'undefined') {
        return;
    }
    var vdata;
    var secRef = [];
    var cmapRef = [];

    for (var c = 0; c < obj[e].env.length; c++) {
        if (typeof obj[e].env[c].valueFrom !== 'undefined') {
            vdata = {
                'namespace': ns,
                'kind': kind,
                'objName': name
            };

            if (typeof obj[e].env[c].valueFrom.secretKeyRef !== 'undefined') {
                vdata.type = 'secret';
                vdata.vname = obj[e].env[c].valueFrom.secretKeyRef.name;
                vdata.vkey = obj[e].env[c].valueFrom.secretKeyRef.key;
                secRef.push(vdata);
                // add the Secret to cluster hierarchy
                hierarchy.addEntry(ns, kind, name, fnum, hval, c_name, 'Env', 'Secret', vdata.vname)
                utl.containerLink(fnum, 'Secret', obj[e].env[c].valueFrom.secretKeyRef.name, 'Env')
                vpk.pods[fnum].secRefs.push(vdata);

            }

            if (typeof obj[e].env[c].valueFrom.configMapKeyRef !== 'undefined') {
                vdata.type = 'configMap';
                vdata.vname = obj[e].env[c].valueFrom.configMapKeyRef.name;
                vdata.vkey = obj[e].env[c].valueFrom.configMapKeyRef.key;
                cmapRef.push(vdata);
                // add the information to cluster hierarchy
                hierarchy.addEntry(ns, kind, name, fnum, hval, c_name, 'Env', 'ConfigMap', obj[e].env[c].valueFrom.configMapKeyRef.name)
                utl.containerLink(fnum, 'ConfigMap', obj[e].env[c].valueFrom.configMapKeyRef.name, 'Env')
                vpk.pods[fnum].cmapRefs.push(vdata);
            }
        }
    }
}

var saveImageInfo = function (c_name, c_image, ctype, fnum) {
    // save image data
    vpk.pods[fnum].containerNames.push({ 'c_name': c_name, 'c_image': c_image })

    // Update container type counts
    if (ctype === 'I') {
        vpk.pods[fnum].typeIcnt = vpk.pods[fnum].typeIcnt + 1;
    } else {
        vpk.pods[fnum].typeCcnt = vpk.pods[fnum].typeCcnt + 1;
    }
}

var getVolumes = function (obj) {
    for (let p = 0; p < obj.length; p++) {
        allVolumes[obj[p].name] = obj[p]
    }
}

var getMounts = function (obj, e, fnum, kind, name, hval, c_name, ns) {
    if (typeof obj[e].volumeMounts === 'undefined') {
        return
    }
    for (var v = 0; v < obj[e].volumeMounts.length; v++) {
        var mountPath = '';
        var mountName = '';
        // get the name that will map to the volume with the same name
        if (typeof obj[e].volumeMounts[v].name !== 'undefined') {
            mountName = obj[e].volumeMounts[v].name;
        }
        if (typeof obj[e].volumeMounts[v].mountPath !== 'undefined') {
            mountPath = obj[e].volumeMounts[v].mountPath;
        }
        if (typeof allVolumes[mountName] !== 'undefined') {
            vpk.pods[fnum].mountLinks.push({ 'volumeMountName': mountName, 'volumeMountPath': mountPath, 'volumes': allVolumes[mountName] })
        }

        // add the container volumeMount to cluster hierarchy
        hierarchy.addEntry(ns, kind, name, fnum, hval, c_name, 'VolumeMounts', mountName)
        utl.containerLink(fnum, 'VolumeMounts', mountName)

    }

}

//------------------------------------------------------------------------------
// parse the container array
//------------------------------------------------------------------------------
var parseWorkloadContainers = function (ns, kind, name, obj, ctype, fnum) {
    var e = -1;
    var c_name = '';
    var c_image = '';
    var volMount;


    var hval;          //Hierarchy value 
    if (ctype === 'C') {
        hval = "Container";
    } else if (ctype === 'I') {
        hval = "InitContainer"
    }

    // loop through the defined containers
    try {
        for (var e = 0; e < obj.length; e++) {
            c_name = '';
            c_image = '';
            cmapRef = [];
            secRef = [];
            volMount = [];

            if (typeof obj[e] !== 'undefined') {
                // parse container definition
                c_name = obj[e].name;
                c_image = obj[e].image;

                // if not a continer image skip data
                if (typeof c_image !== 'string') {
                    continue;
                }

                // Save name and image info
                saveImageInfo(c_name, c_image, ctype, fnum);

                // create a object will all container images that are used
                containerImages(c_image, c_name, fnum, ns)

                // Save memory and CPU resource request and limits
                saveResources(obj, e, fnum);

                // build entries if ports exists
                savePorts(obj, e, fnum);

                // build entries if configMapKeyRef or secretKeyRef exists
                saveEnv(obj, e, fnum, name, ns, kind, hval, c_name);

                // check for volumeMounts
                getMounts(obj, e, fnum, kind, name, hval, c_name, ns)

            }
            // add the container to cluster hierarchy
            hierarchy.addEntry(ns, kind, name, fnum, hval, c_name)
        }

    } catch (err) {
        utl.logMsg('vpkCNT001 - Error processing file fnum: ' + fnum + ' container entry: ' + c_name + ' message: ' + err);
        utl.logMsg('vpkCNT001 - Stack: ' + err.stack);
    }
};


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

    parse: function (ns, kind, name, yaml, fnum, oRef, cStatus, statusPhase, fn, part) {
        if (typeof fnum === 'undefined' || fnum === '' || fnum === 0 || fnum === ':') {
            utl.logMsg('vpkCNT999 - Error processing, invalid fnum: fnum for file');
            return;
        }


        // Create the vpk.pods[fnum] entry and populate with initial data
        if (typeof vpk.pods[fnum] === 'undefined') {
            vpk.pods[fnum] = {
                'src': fn,
                'part': part,
                'fnum': fnum,
                'uid': yaml.metadata.uid,
                'api': yaml.apiVersion,
                'kind': kind,
                'name': name,
                'namespace': ns,
                'containerNames': [],
                'typeCcnt': 0,
                'typeIcnt': 0,
                'node': '',
                'oRef': oRef,
                'status': cStatus,
                'phase': statusPhase,
                'resourceLimit': [],
                'resourceRequest': [],
                'ports': [],
                'cmapRefs': [],
                'secRefs': [],
                'mountLinks': []
            };
        }

        parseWorkload(ns, kind, name, yaml, fnum);
    }
};