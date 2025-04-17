//-----------------------------------------------------------------------------
// Generic sorting function//-----------------------------------------------------------------------------
'use strict';

export function sortByKey(array: any, sortKey: any) {
    return array.sort((a: any, b: any) => {
        if (a[sortKey] < b[sortKey]) {
            return -1;
        } else if (a[sortKey] > b[sortKey]) {
            return 1;
        } else {
            return 0;
        }
    });
}
