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

//------------------------------------------------------------------------------
// parse the container
//------------------------------------------------------------------------------
var parseContainer = function (ns, kind, name, obj, ctype, fnum) {
	var doit = true;
	var e = -1;
	var c_name = '';
	var c_image = '';
	var cmapRef;
	var secRef;
	var fldRef;
	var volMount;
	var pStep = 'init';
	var hval;
	var tmpi;
	var memory;
	var cpu;
	if (ctype === 'C') {
		hval = "Container";
	} else if (ctype === 'I') {
		hval = "InitContainer"
	}

	try {
		while (doit) {
			pStep = 'Outter_Loop'
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

				vpk.containers[fnum].containerNames.push({ 'c_name': c_name, 'c_image': c_image })
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
							cpu = obj[e].resources.requests.cpu
						}
						if (typeof obj[e].resources.requests.memory !== 'undefined') {
							memory = obj[e].resources.requests.memory
						}
						vpk.containers[fnum].resourceRequest.push({ 'cpu': cpu, 'memory': memory })
						// utl.logMsg('vpkCNT071 - Resource Requests: cpu = ' + cpu + '  memory = ' + memory);
					}

					if (typeof obj[e].resources.limits !== 'undefined') {
						cpu = 0;
						memory = 0;
						if (typeof obj[e].resources.limits.cpu !== 'undefined') {
							cpu = obj[e].resources.limits.cpu
						}
						if (typeof obj[e].resources.limits.memory !== 'undefined') {
							memory = obj[e].resources.limits.memory
						}
						vpk.containers[fnum].resourceLimit.push({ 'cpu': cpu, 'memory': memory })
						//utl.logMsg('vpkCNT072 - Resource Limits: cpu = ' + cpu + '  memory = ' + memory);
					}
				}

				// build entries if ports exists
				if (typeof obj[e].ports !== 'undefined') {
					for (let p = 0; p < obj[e].ports.length; p++) {
						if (typeof obj[e].ports[p].containerPort !== 'undefined') {
							utl.containerLink(fnum, 'Ports', obj[e].ports[p].containerPort)
						}
					}
				}

				// build entries if configMapKeyRef exists
				if (typeof obj[e].env !== 'undefined') {
					var cfloop = true;
					var c = 0;
					if (typeof obj[e].env[c] == 'undefined') {
						cfloop = false;
					}

					// build  configMap, secret, and fieldRef entries if they exist
					while (cfloop) {
						pStep = 'CF_Loop'
						if (typeof obj[e].env[c].valueFrom !== 'undefined') {
							// var vkey = '';
							var vdata = {};
							vdata = {
								'namespace': ns,
								'kind': kind,
								'objName': name
							};
							if (typeof obj[e].env[c].valueFrom.secretKeyRef !== 'undefined') {
								pStep = 'Secret';
								vdata.type = 'secret';
								vdata.vname = obj[e].env[c].valueFrom.secretKeyRef.name;
								vdata.vkey = obj[e].env[c].valueFrom.secretKeyRef.key;
								secRef.push(vdata);

								// add the container volumeMount to cluster hierarchy
								hierarchy.addEntry(ns, kind, name, fnum, hval, c_name, 'Env', 'Secret', vdata.vname)
								utl.containerLink(fnum, 'Secret', obj[e].env[c].valueFrom.secretKeyRef.name, 'Env')

							}

							if (typeof obj[e].env[c].valueFrom.configMapKeyRef !== 'undefined') {
								pStep = 'ConfigMap';
								vdata.type = 'configMap';
								vdata.vname = obj[e].env[c].valueFrom.configMapKeyRef.name;
								vdata.vkey = obj[e].env[c].valueFrom.configMapKeyRef.key;
								cmapRef.push(vdata);
								// add the information to cluster hierarchy
								hierarchy.addEntry(ns, kind, name, fnum, hval, c_name, 'Env', 'ConfigMap', obj[e].env[c].valueFrom.configMapKeyRef.name)
								utl.containerLink(fnum, 'ConfigMap', obj[e].env[c].valueFrom.configMapKeyRef.name, 'Env')
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
					var vloop = true;
					var v = 0;

					if (typeof obj[e].volumeMounts[v] == 'undefined') {
						vloop = false;
					}

					// build  configMap, secret, and fieldRef entries if they exist
					while (vloop) {
						pStep = 'VolumeMounts_Loop';
						var voldata = {};
						var mountPath = '';
						var mountName = '';
						voldata = {
							'namespace': ns,
							'kind': kind,
							'objName': name
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
						var vmkey = ns + '.' + 'VolumeMount' + '.' + mountName;
						utl.checkType('VolumeMount', vmkey);
						var tmpm = vpk['VolumeMount'][vmkey];
						var item = {
							'namespace': ns,
							'kind': 'VolumeMount',
							'objName': mountName,
							'mountPath': mountPath,
							'mountName': mountName,
							'fnum': fnum
						};
						tmpm.push(item);
						vpk['VolumeMount'][vmkey] = tmpm;

						// add the container volumeMount to cluster hierarchy
						hierarchy.addEntry(ns, kind, name, fnum, hval, c_name, 'VolumeMounts', mountName)
						utl.containerLink(fnum, 'VolumeMounts', mountName)
						v++;
						if (typeof obj[e].volumeMounts[v] === 'undefined') {
							vloop = false;
						}
					}
				}

				// add the container to cluster hierarchy
				hierarchy.addEntry(ns, kind, name, fnum, hval, c_name)

				// build array with the container name
				pStep = 'ContainerName';
				var ckey = ns + '.' + c_name;
				utl.checkType('ContainerName', ckey);
				var tmpc = vpk['ContainerName'][ckey];
				item = {
					'namespace': ns,
					'kind': kind,
					'objName': name,
					'containerRefName': c_name,
					'image': c_image,
					'fnum': fnum
				};
				tmpc.push(item);
				vpk['ContainerName'][ckey] = tmpc;

				// build array with the docker container image name
				pStep = 'ContainerImage';
				var cikey = ns + '.' + c_image;
				utl.checkType('ContainerImage', cikey);
				tmpi = vpk['ContainerImage'][cikey];
				item = {
					'namespace': ns,
					'kind': kind,
					'objName': name,
					'containerRefName': c_name,
					'image': c_image,
					'fnum': fnum
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
		utl.logMsg('vpkCNT001 - Error processing file fnum: ' + fnum + ' container entry: ' + c_name + ' message: ' + err + ' InRoutine: ' + pStep);
		utl.logMsg('vpkCNT001 - Stack: ' + err.stack);
	}
};


//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

	parse: function (ns, kind, name, obj, containerType, fnum) {
		if (typeof fnum === 'undefined' || fnum === '' || fnum === 0 || fnum === ':') {
			utl.logMsg('vpkCNT999 - Error processing, invalid fnum: fnum for file');
			return;
		}
		parseContainer(ns, kind, name, obj, containerType, fnum);
	}
};