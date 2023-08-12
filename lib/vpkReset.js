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

/*

Global VPK reset object.

*/

let vpk = require('../lib/vpk');

const clearAll = function () {
   var totId = vpk.kindList.split('::');
   if (totId.length > 0) {
      for (var c = 0; c < totId.length; c++) {
         var cId = totId[c];
         cId = cId.trim();
         if (cId.length > 0) {
            if (typeof vpk[cId] !== 'undefined') {
               delete vpk[cId];

               cId = cId + 'Cnt'
               if (typeof vpk[cId] !== 'undefined') {
                  delete vpk[cId];
               }

            }
         }
      }
      vpk.kindList = '::';
   }

   //-- Start: Github Issue: #6    
   // remove any previously defined xref entries
   // along with the following, also added variable:
   // vpk.xrefDefined = '#$@',
   var xrefId = vpk.xrefDefined.split('#$@');
   if (xrefId.length > 0) {
      for (var c = 0; c < xrefId.length; c++) {
         var xId = xrefId[c];
         xId = xId.trim();
         if (xId.length > 0) {
            if (typeof vpk[xId] !== 'undefined') {
               delete vpk[xId];
            }
         }
      }
      vpk.xrefDefined = '#$@';
   }
   //-- End: Github Issue: #6    

   //vpk.defaultSettings: {},   //DO NOT RESET
   //vpk.explains = {};
   vpk.imageRegistry = {};
   vpk.containerImages = {};
   vpk.viewSecHierarchy = [];
   vpk.viewSecSubject = [];
   vpk.viewSecBinding = [];
   vpk.viewSecRole = [];
   vpk.viewSecNS = [];
   vpk.viewSecRules = [];
   vpk.secVerbSetList = {};
   vpk.secApiGroupsList = {};
   vpk.secResourcesList = {};
   vpk.secArray = [];
   vpk.secApiGroups = {};
   vpk.secResources = {};
   vpk.secSubjects = {};
   vpk.secSubjectsHierarchy = {};
   vpk.secResourcesHierarchy = {};
   vpk.secRoles = {};
   vpk.ownerLinks = {};
   vpk.ownerRefs = [];
   vpk.childRefs = [];
   vpk.svcspec = [];
   vpk.daemonSetPods = [];
   vpk.nodesFnum = [];
   vpk.validDir = true;
   vpk.resetReq = false;
   vpk.csiDriverName = {};
   vpk.csiNodeFnum = {};
   vpk.volumeAttachment = {};
   vpk.pvCsi = [];
   vpk.spaceReqSC = {};
   vpk.spaceReqPVC = [];
   vpk.volumeTypes = {};
   vpk.volumeInfo = [];
   vpk.storageInfo = {};
   vpk.ownerChains = {};
   vpk.roleRefRole = {};
   vpk.subjectMissingCnt = 0;
   vpk.namespaceCnt = {};
   vpk.fileCnt = {};
   vpk.crds = {};
   vpk.subjects = {};
   vpk.roleFnum = {};
   vpk.clusterRoleFnum = {};
   vpk.controllerRevision = {};
   vpk.schematicBuilt = false;
   vpk.allKeys = [];
   vpk.serviceAccounts = {};
   vpk.podList = {};
   vpk.hpaLinks = {};
   vpk.apis = {};
   vpk.owners = {};
   vpk.allUids = {};
   vpk.apiFnum = [];
   vpk.secretFnum = {};
   vpk.roleBindingFnum = {};
   vpk.clusterRoleBindingFnum = {};
   vpk.fnumUsed = [];
   vpk.eventMessage = [];
   vpk.svgMsg = [];
   vpk.storageClassName = {};
   //   vpk.storageClassLinks = {};
   vpk.pvFnum = {};
   vpk.pvLabels = {};
   vpk.pvcFnum = {};
   vpk.pvcLinks = {};
   vpk.pvcNames = {};
   vpk.ownerNumber = 100000;
   vpk.ownerUids = {};
   vpk.endpointSliceService = {};
   vpk.endpointSliceLinks = {};
   vpk.endpointsLinks = {};
   vpk.servicePorts = {};
   vpk.serviceFnum = {};
   vpk.serviceLabels = {};
   vpk.serviceName = {};
   vpk.serviceNoSelector = {};
   vpk.pods = {};

   // validation failure counts
   vpk.vCnt = 0;
   vpk.tCnt = 0;
   vpk.rCnt = 0;
   vpk.pCnt = 0;
   vpk.repCnt = 0;

   //global work vars for files and directories
   vpk.baseFS = '';
   vpk.filesFS = [];
   vpk.dirFS = [];
   vpk.dirPtr = -1;
   vpk.dirname = '';

   //starting directory name
   vpk.startDir = '-none-';

   //process flag
   vpk.loop = true;

   //run stats
   vpk.dCnt = 0;
   vpk.fCnt = 0;
   vpk.yCnt = 0;
   vpk.xCnt = 0;
   vpk.dupCnt =

      vpk.yaml = '';
   vpk.yBASE = 0;

   vpk.k_cont = new Object();

   vpk.file_sources = [];
   vpk.file_id = 0;

   vpk.genericType = ':';

   vpk.kinds = {};
   vpk.kindStats = {};

   vpk.definedNamespaces = {
      'all-namespaces': 'all-namespaces'
   };

   vpk.generic = {};
   vpk.genericCnt = 0;

   //vpk.vpkLogMsg = [];

   //vpk.cmdHist = [],

   vpk.apitypes = [],

      vpk.counts = [],

      vpk.kindList = '',

      vpk.rtn = {},

      //vpk.relations= {},

      vpk.dropManagedFields = true;

   vpk.dropStatus = true;

   vpk.hierarchy = {};

   vpk.hierarchyFile = {};

   vpk.fileNames = [];

   vpk.fileContent = {};

   vpk.fileContentCnt = 0;

   vpk.labelKeys = [];

   vpk.uid = {};

   //-- Start: Github Issue: #6    
   vpk.xrefDefined = '#$@',
      //-- End: Github Issue: #6    

      vpk.k8apis = {
         "v1": [
            "v1",
            "ComponentStatus",
            "ConfigMap",
            "EndPoints",
            "Event",
            "Namespace",
            "Node",
            "PersistentVolumeClaim",
            "PersistentVolume",
            "Pod",
            "ReplicationController",
            "Secret",
            "ServiceAccount",
            "Service"
         ],
         "admissionregistration.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "apiextensions.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "apiregistration.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "apps": [
            "v1"
         ],
         "authentication.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "authorization.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "autoscaling": [
            "v1",
            "v2beta2",
            "v2beta1"
         ],
         "batch": [
            "v1",
            "v1beta1",
            "v2alpha1"
         ],
         "certificates.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "coordination.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "core": [
            "v1"
         ],
         "discovery.k8s.io": [
            "v1beta1"
         ],
         "events.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "extensions": [
            "v1beta1"
         ],
         "flowcontrol.apiserver.k8s.io": [
            "v1alpha1"
         ],
         "networking.k8s.io": [
            "v1",
            "v1beta1"
         ],
         "node.k8s.io": [
            "v1beta1",
            "v1alpha1"
         ],
         "policy": [
            "v1beta1"
         ],
         "rbac.authorization.k8s.io": [
            "v1",
            "v1beta1",
            "v1alpha1"
         ],
         "scheduling.k8s.io": [
            "v1",
            "v1beta1",
            "v1alpha1"
         ],
         "settings.k8s.io": [
            "v1alpha1"
         ],
         "storage.k8s.io": [
            "v1",
            "v1beta1",
            "v1alpha1"
         ]
      };

   //last var/holder
   vpk.do_not_delete = 'do not delete';
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {

   //------------------------------------------------------------------------------
   // reset all variable in vpk
   //------------------------------------------------------------------------------
   resetAll: function () {
      clearAll();
   }
};
