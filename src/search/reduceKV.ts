//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------

export function reduceKV(keys: any, values: any) {
    let rtn: any = [];
    let key: any;
    for (key of keys) {
        if (values.includes(key)) {
            rtn.push(key);
        }
    }
    return rtn;
}
