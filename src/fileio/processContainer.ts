// workload processing logic
//------------------------------------------------------------------------------
// create index entries in the global vpk
//------------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';
import { workloadParser } from '../parsers/workloads/parse.js';

export function processContainer(
    y_ns: string,
    y_kind: string,
    y_name: string,
    fn: any,
    part: any,
    y_node: any,
    fnum: any,
    oRef: any,
    cStatus: any,
    statusPhase: string,
) {
    workloadParser(y_ns, y_kind, y_name, vpk.yaml, fnum, y_node, fn, oRef, cStatus, statusPhase);
}
