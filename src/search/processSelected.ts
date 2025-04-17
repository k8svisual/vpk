//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------

export function processSelected(keep: any, fnumBase: string) {
    let keys: any[] = Object.keys(fnumBase);
    let key: string;
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        if (keep.includes(key)) {
            continue;
        } else {
            delete fnumBase[key];
        }
    }
    return;
}
