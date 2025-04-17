//-----------------------------------------------------------------------------
// Get the K8s resource type and emit message after processing
//-----------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { showTimeDiff } from '../utils/showtimedif.js';
import { getPTime } from '../utils/getptime.js';
import { getKubeInfo } from '../kube/getKubeInfo.js';
import { returnData } from './returnData.js';
export async function getSnapshot(data, kga, client, dynDir) {
    let startT = getPTime();
    logMessage('SNP001 - snapshot getK invoked');
    vpk.rtn = { items: [] }; // Reset global storage
    kga.sort(); // Sort items
    for (let k = 0; k < kga.length; k++) {
        await getKubeInfo(data, kga[k], client);
        const tmp = kga[k];
        const kind = tmp.substring(0, tmp.length - 2);
        const processCount = k + 1;
        const msg = `Processed count ${processCount} of ${kga.length} - Resource kind: <span class="vpkblue">${kind}</span>`;
        const rtn = { msg, current: processCount, max: kga.length };
        client.emit('getKStatus', rtn); // Emit status after each kind
    }
    // client.emit('getsDone', { msg: '<span class="vpkblue">Processing completed, close dialog window.</span>' });
    client.emit('getKStatus', { done: true });
    returnData(client, dynDir);
    let stopT = getPTime();
    showTimeDiff(startT, stopT, 'snapshot.getK()');
    logMessage('SNP001 - snapshot processing completed');
}
