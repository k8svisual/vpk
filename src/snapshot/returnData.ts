//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { saveK8sData } from './saveK8sData.js';

export function returnData(client: any, dynDir: any) {
    let rdata: any = {};
    if (vpk.rtn === 'FAIL') {
        rdata.status = 'FAIL';
        rdata.message = 'Failed to retrieve data, check log messages';
    } else {
        rdata = saveK8sData(dynDir, client);
    }
}
