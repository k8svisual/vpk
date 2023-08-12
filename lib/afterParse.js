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
Generic template to parse kubernetes resource type/kind
*/

var vpk = require('../lib/vpk');
var utl = require('../lib/utl');
var security = require('../lib/security');
var volAtt = {};
//------------------------------------------------------------------------------

var sercurityRelatedInfo = function () {
    try {
        utl.logMsg('vpkAFT100 - Sorting Role ApiGroups');
        tmp = utl.sortJSONByKeys(vpk.secApiGroups);
        vpk.secApiGroups = tmp;
        utl.logMsg('vpkAFT101 - Sorting Role Resources');
        tmp = utl.sortJSONByKeys(vpk.secResources);
        vpk.secResources = tmp;
        vpk.secSubjectsHierarchy = security.buildSubjectHierarchy();
        vpk.secResourcesHierarchy = security.buildResourceHierarchy();
    } catch (err) {
        utl.logMsg('vpkAFT001 - Error processing securityRelated, message: ' + err);
        utl.logMsg('vpkAFT001 - Stack: ' + err.stack);
    }
};

var buildVolumeAttachmentInfo = function () {
    volAtt = {};
    try {
        utl.logMsg('vpkAFT200 - Processing VolmueAttachments');
        let keys = Object.keys(vpk.volumeAttachment);
        for (let k = 0; k < keys.length; k++) {
            volAtt[vpk.volumeAttachment[keys[k]][0].nodeName + '::' + vpk.volumeAttachment[keys[k]][0].attacher] =
            {
                'fnum': vpk.volumeAttachment[keys[k]][0].fnum,
                'pvName': vpk.volumeAttachment[keys[k]][0].pvName,
                'name': vpk.volumeAttachment[keys[k]][0].name,
            };
        }
    } catch (err) {
        utl.logMsg('vpkAFT002 - Error processing volumeAttachmentRelated, message: ' + err);
        utl.logMsg('vpkAFT002 - Stack: ' + err.stack);
    }
};


var addVolumeAttachmentToCSI = function () {
    try {
        utl.logMsg('vpkAFT200 - ProcessingVolmueAttachments for CSINodes');
        let csiKeys = Object.keys(vpk.csiNodeFnum);
        let key;
        let k;
        let d;

        // loop through all csiNode data, get associated node name, loop through nodes and update
        for (k = 0; k < csiKeys.length; k++) {
            if (typeof vpk.csiNodeFnum[csiKeys[k]] !== 'undefined') {
                if (typeof vpk.csiNodeFnum[csiKeys[k]][0] !== 'undefined') {
                    if (typeof vpk.csiNodeFnum[csiKeys[k]][0].drivers !== 'undefined') {
                        if (vpk.csiNodeFnum[csiKeys[k]][0].drivers !== null) {
                            for (d = 0; d < vpk.csiNodeFnum[csiKeys[k]][0].drivers.length; d++) {
                                vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].volAtt = [];
                                key = vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].nodeID + '::' + vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].name;
                                if (typeof volAtt[key] !== 'undefined') {
                                    vpk.csiNodeFnum[csiKeys[k]][0].drivers[d].volAtt.push({
                                        'pvName': volAtt[key].pvName,
                                        'fnum': volAtt[key].fnum,
                                        'volAttName': volAtt[key].name
                                    })
                                }
                            }
                        }
                    }
                }
            }

        }
        volAtt = null;
    } catch (err) {
        utl.logMsg('vpkAFT003 - Error processing csiNode, message: ' + err);
        utl.logMsg('vpkAFT003 - Stack: ' + err.stack);
    }
};


var addCSINodeToNode = function () {
    utl.logMsg('vpkAFT200 - ProcessingVolmueAttachments for CSINodes');
    let nodeKeys = Object.keys(vpk.nodesFnum);
    let csiKeys = Object.keys(vpk.csiNodeFnum);
    let nodeName;
    let n;
    let c;
    try {
        for (n = 0; n < nodeKeys.length; n++) {
            nodeName = vpk.nodesFnum[nodeKeys[n]][0].name;
            for (c = 0; c < csiKeys.length; c++) {
                if (vpk.csiNodeFnum[csiKeys[c]][0].name === nodeName) {
                    // add csiNode info to the Node data
                    vpk.nodesFnum[nodeKeys[n]][0].csiNodes.push(vpk.csiNodeFnum[csiKeys[c]][0])
                }

            }
        }
    } catch (err) {
        utl.logMsg('vpkAFT003 - Error processing csiNode, message: ' + err);
        utl.logMsg('vpkAFT003 - Stack: ' + err.stack);
    }
}

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
module.exports = {
    process: function () {
        sercurityRelatedInfo();
        // CSI related 
        buildVolumeAttachmentInfo();
        addVolumeAttachmentToCSI();
        addCSINodeToNode();
    }
};


// ANNUAL SUBSCRIPTION: CANCELED
// KEY: J63DVDKBGRRY2328Y9H8CDP27
// SERIAL NUMBER: KGFXYX4BPMC3


// Example of using async and await with an async routine
// async function getData() {
//     // Fetch data from an API or database here
//     const data = await fetch('https://my-api.com/data');
//     return data;
//   }
  
//   async function main() {
//     // Call the getData() function and wait for the result
//     const data = await getData();
//     // Use the data in your app
//     console.log(data);
//   }
  
//   main();