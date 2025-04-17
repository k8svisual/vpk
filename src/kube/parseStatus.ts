//-----------------------------------------------------------------------------
// Parse the cluster dump data and save the required data
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';

export function parseStatus(result: string): void {
    try {
        const data = result.split('\n');
        const components: any[] = [];

        data.forEach((line) => {
            if (line.startsWith('==== START')) {
                const [, container] = line.split('container ');
                if (container) {
                    components.push(container);
                    logMessage(`KUB030 - Located component: ${container}`);
                }
            }
        });

        logMessage(`KUB031 - ${data.length} entries located for K8s cluster status`);
        vpk.kubeSystemComponents = { components };
    } catch (e) {
        logMessage(`KUB032 - Error parsing status information, message: ${e}`);
        vpk.kubeSystemComponents = { components: [] };
    }
}
