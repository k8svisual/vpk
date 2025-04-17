//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
import vpk from '../lib/vpk.js';
import { search } from './search.js';
export function processSearch(data) {
    let nsFilter;
    let kindFilter;
    let searchValue;
    let fnumBase;
    // Obtain new fnum array that will be the base for what is to be
    // returned
    let tmp = JSON.stringify(vpk.idxFnum);
    fnumBase = JSON.parse(tmp);
    tmp = null;
    // Validate namespace(s)
    if (typeof data.namespaceFilter !== 'undefined') {
        nsFilter = data.namespaceFilter;
    }
    else {
        nsFilter = '::all-namespaces::';
    }
    // Validate kind(s)
    if (typeof data.kindFilter !== 'undefined') {
        kindFilter = data.kindFilter;
    }
    else {
        kindFilter = '::all-kinds::';
    }
    // Validate search value
    if (typeof data.searchValue !== 'undefined') {
        searchValue = data.searchValue;
        if (searchValue.length === 0) {
            searchValue = '*';
        }
    }
    else {
        searchValue = '*';
    }
    return search(nsFilter, kindFilter, searchValue, fnumBase);
}
