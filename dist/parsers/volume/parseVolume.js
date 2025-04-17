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
Parse the volumes object
*/
import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
import { containerLink } from '../../utils/containerlink.js';
//------------------------------------------------------------------------------
export function volumeParse(ns, kind, name, obj, fnum) {
    let v_name = '';
    //let item: any;
    let podPVCClaimName = '';
    let configMapName = '';
    let secretName = '';
    //let chkVol: boolean;
    try {
        for (let e = 0; e < obj.length; e++) {
            v_name = '';
            //chkVol = true;
            if (typeof obj[e] !== 'undefined') {
                v_name = obj[e].name;
                podPVCClaimName = '';
                configMapName = '';
                secretName = '';
                // check for pvc ref
                if (typeof obj[e].persistentVolumeClaim !== 'undefined') {
                    // checking the Pod to determine if there are PVC references
                    if (typeof obj[e].persistentVolumeClaim.claimName !== 'undefined') {
                        podPVCClaimName = obj[e].persistentVolumeClaim.claimName;
                    }
                }
                // check for configMap reference
                if (typeof obj[e].configMap !== 'undefined') {
                    if (typeof obj[e].configMap.name !== 'undefined') {
                        configMapName = obj[e].configMap.name;
                        //chkVol = false; // ignore configMap and secrets when building volume structure
                    }
                }
                // check for secret reference
                if (typeof obj[e].secret !== 'undefined') {
                    if (typeof obj[e].secret.secretName !== 'undefined') {
                        secretName = obj[e].secret.secretName;
                        //chkVol = false; // ignore configMap and secrets when building volume structure
                    }
                }
                containerLink(fnum, 'Volume', v_name, '', '');
                // updata container with related information
                if (podPVCClaimName !== '') {
                    if (typeof vpk.pods[fnum]['PersistentVolumeClaim'] === 'undefined') {
                        vpk.pods[fnum]['PersistentVolumeClaim'] = [];
                    }
                    // add the pvcRef to the container
                    vpk.pods[fnum]['PersistentVolumeClaim'].push({
                        name: obj[e].name,
                        podPVCClaimName: podPVCClaimName,
                        configMapName: configMapName,
                        secretName: secretName,
                    });
                }
                // update container ConfigMap
                if (configMapName !== '') {
                    if (typeof vpk.pods[fnum]['ConfigMap'] === 'undefined') {
                        vpk.pods[fnum]['ConfigMap'] = [];
                    }
                    // add the pvcRef to the container
                    vpk.pods[fnum]['ConfigMap'].push({
                        name: configMapName,
                        use: 'Volume',
                    });
                }
                // update container Secret
                if (secretName !== '') {
                    if (typeof vpk.pods[fnum]['Secret'] === 'undefined') {
                        vpk.pods[fnum]['Secret'] = [];
                    }
                    // add the pvcRef to the container
                    vpk.pods[fnum]['Secret'].push({
                        name: secretName,
                        use: 'Volume',
                    });
                }
            }
        }
    }
    catch (err) {
        logMessage('VLP001 - Error processing file fnum: ' + fnum + '  message: ' + err);
        logMessage('VLP001 - Stack: ' + err.stack);
    }
}
