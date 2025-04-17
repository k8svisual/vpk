//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------

import vpk from '../../lib/vpk.js';

export function checkEvents(container) {
    let key: string = container.kind + '.' + container.namespace + '.' + container.name;
    let events: any[] = [];
    let hl: number = vpk.eventMessage.length;
    for (let e = 0; e < hl; e++) {
        if (vpk.eventMessage[e].key === key) {
            events.push(vpk.eventMessage[e]);
            vpk.eventMessage[e].used = true;
            continue;
        }
        if (vpk.eventMessage[e].involvedName === container.name) {
            events.push(vpk.eventMessage[e]);
            vpk.eventMessage[e].used = true;
            continue;
        }
    }
    container.Events = events;
}
