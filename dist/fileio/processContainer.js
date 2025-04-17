// workload processing logic
//------------------------------------------------------------------------------
// create index entries in the global vpk
//------------------------------------------------------------------------------
'use strict';
import vpk from '../lib/vpk.js';
import { workloadParser } from '../parsers/workloads/parse.js';
export function processContainer(y_ns, y_kind, y_name, fn, part, y_node, fnum, oRef, cStatus, statusPhase) {
    workloadParser(y_ns, y_kind, y_name, vpk.yaml, fnum, y_node, fn, oRef, cStatus, statusPhase);
}
