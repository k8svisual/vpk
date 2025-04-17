//-----------------------------------------------------------------------------
// Get the K8s resource type and emit message after processing
//-----------------------------------------------------------------------------
'use strict';

import { getSnapshot } from '../snapshot/getSnapshot.js';

export async function driver(data: any, kga: any[], client: any, dynDir: any) {
    await getSnapshot(data, kga, client, dynDir);
}
