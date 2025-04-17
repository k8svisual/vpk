//-----------------------------------------------------------------------------
// Generic sorting function//-----------------------------------------------------------------------------
'use strict';
export function sortByKey(array, sortKey) {
    return array.sort((a, b) => {
        if (a[sortKey] < b[sortKey]) {
            return -1;
        }
        else if (a[sortKey] > b[sortKey]) {
            return 1;
        }
        else {
            return 0;
        }
    });
}
