//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
export function processSelected(keep, fnumBase) {
    let keys = Object.keys(fnumBase);
    let key;
    for (let i = 0; i < keys.length; i++) {
        key = keys[i];
        if (keep.includes(key)) {
            continue;
        }
        else {
            delete fnumBase[key];
        }
    }
    return;
}
