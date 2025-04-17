//-----------------------------------------------------------------------------
// Get the K8s resource type and emit message after processing
//-----------------------------------------------------------------------------
'use strict';
import { getSnapshot } from '../snapshot/getSnapshot.js';
export async function driver(data, kga, client, dynDir) {
    await getSnapshot(data, kga, client, dynDir);
}
