//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

export function clusterSummary() {
    vpk.clusterSummary = {};
    vpk.clusterSummary['hogs'] = vpk.hogs;
    vpk.clusterSummary['nodes'] = vpk.nodesFnum;
    vpk.clusterSummary['stats'] = vpk.stats;
    vpk.clusterSummary['csiNode'] = vpk.csiNodeFnum;
    vpk.clusterSummary['csiDriver'] = vpk.csiDriverName;
}
