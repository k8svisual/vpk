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
Build and populate storage array
*/

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';

//------------------------------------------------------------------------------
const processBuild = function () {
    vpk.storageInfo = {};
    try {
        vpk.storageInfo.StorageClass = vpk.storageClassName;
        vpk.storageInfo.PVinfo = vpk.pvFnum;
        vpk.storageInfo.PVCinfo = vpk.pvcFnum;
        vpk.storageInfo.CSIDriver = vpk.csiDriverName;
        vpk.storageInfo.CSINode = vpk.csiNodeFnum;
        vpk.storageInfo.SpaceReqSC = vpk.spaceReqSC;
        vpk.storageInfo.SpaceReqPVC = vpk.spaceReqPVC;
        return;
    } catch (err) {
        utl.logMsg('vpkSTO001 - Error building storageInfo, message: ' + err);
        utl.logMsg('vpkSTO001 - Stack: ' + err.stack);
        return '';
    }
};

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    //------------------------------------------------------------------------------
    buildStorage: function () {
        processBuild()
    }
};