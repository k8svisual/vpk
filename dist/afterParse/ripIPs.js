//-----------------------------------------------------------------------------
// ???
//-----------------------------------------------------------------------------
'use strict';
export function ripIPS(data) {
    let ipArray = {};
    let base;
    for (let i = 0; i < data.length; i++) {
        base = data[i].substring(0, data[i].lastIndexOf('.'));
        if (typeof ipArray[base] === 'undefined') {
            ipArray[base] = 1;
        }
        else {
            ipArray[base] = ipArray[base] + 1;
        }
    }
    return ipArray;
}
