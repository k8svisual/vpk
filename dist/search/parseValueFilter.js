//------------------------------------------------------------------------------
// loop through all types and determine if it should be included in results
//------------------------------------------------------------------------------
import { checkKeyValue } from './checkKeyValue.js';
import { checkEntireResource } from './checkEntireResource.js';
export function parseValueFilter(valueFilter, fnumBase) {
    let filter;
    let key;
    let value;
    let tmp;
    filter = valueFilter.trim();
    key = '';
    value = '';
    if (filter.startsWith('labels:')) {
        if (filter.indexOf('::value::') > -1) {
            tmp = filter.split('::value::');
            key = tmp[0].substring(7);
            key = key.trim();
            value = tmp[1];
            value = value.trim();
        }
        else {
            key = filter.substring(7);
            key = key.trim();
            value = '';
        }
        checkKeyValue(key, value, 'Labels', fnumBase);
    }
    else if (filter.startsWith('annotations:')) {
        if (filter.indexOf('::value::') > -1) {
            tmp = filter.split('::value::');
            key = tmp[0].substring(12);
            key = key.trim();
            value = tmp[1];
            value = value.trim();
        }
        else {
            key = filter.substring(12);
            key = key.trim();
            value = '';
        }
        checkKeyValue(key, value, 'Annotations', fnumBase);
    }
    else if (filter.startsWith('name:')) {
        key = filter.substring(5);
        key = key.trim();
        value = '';
        checkKeyValue(key, value, 'Name', fnumBase);
    }
    else {
        // Check the entire resource for the string value
        checkEntireResource(filter, fnumBase);
    }
}
