// src/documentation/helpers.ts
import vpk from '../lib/vpk.js';
let docCnt = 1000;
/**
 * Formats the image path line to ensure it points to the correct directory.
 * @param line The markdown line containing an image.
 */
export function formatImagePath(line) {
    // Add your specific image path formatting logic here
    return line;
}
/**
 * Formats the topic key line and generates a unique topic key.
 * @param line The line containing the topic key.
 */
export function formatTopicKey(line) {
    let rtn = '';
    const parts = line.split(' ');
    if (parts.length > 1 && parts[1] !== null && parts[1] !== 'undefined') {
        rtn = parts[1].substring(0, parts[1].length - 2);
        if (typeof vpk.documentation[rtn] !== 'undefined') {
            docCnt++;
            rtn = `${rtn}:${docCnt}`;
        }
    }
    else {
        docCnt++;
        rtn = `topic:${docCnt}`;
    }
    return rtn;
}
