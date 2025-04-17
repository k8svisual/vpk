//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import { logMessage } from '../../utils/logging.js';
import { showTimeDiff } from '../../utils/showtimedif.js';
import { getPTime } from '../../utils/getptime.js';
import { parseSchematic } from './parseSchematic.js';

export function schematicParse() {
    let startT: any = getPTime();
    logMessage('SCM001 - svgSchematic invoked');
    parseSchematic();
    let stopT: any = getPTime();
    showTimeDiff(startT, stopT, 'svgSchematic.parseSchematic()');
    return;
}
