//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------
export function reduceKV(keys, values) {
    let rtn = [];
    let key;
    for (key of keys) {
        if (values.includes(key)) {
            rtn.push(key);
        }
    }
    return rtn;
}
