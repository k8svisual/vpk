//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import { checkEvents } from './checkEvents.js';
import { checkType } from './checkType.js';

export function populateContainer(container: any, fnum: any) {
    container = checkType(container, 'Secret', fnum);
    container = checkType(container, 'ConfigMap', fnum);
    container = checkType(container, 'PersistentVolumeClaim', fnum);
    container = checkType(container, 'ServiceAccount', fnum);
    container = checkEvents(container);
}
