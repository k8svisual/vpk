// src/documentation/buildDocs.ts
import vpk from '../lib/vpk.js';
import { logMessage } from '../utils/logging.js';
import { processFiles } from './fileProcessor.js';
//import * as fs from 'fs';
import fs from 'node:fs';
const cwd = process.cwd();
let docPath;
/**
 * Initiates the documentation build process.
 */
export function buildDocumentation() {
    vpk.documentation = {};
    const files = readDocsDirectory();
    if (files !== '') {
        processFiles(files);
    }
}
/**
 * Reads the documentation directory and returns a list of files.
 */
function readDocsDirectory() {
    try {
        docPath = `${cwd}/dist/server/public/docs`;
        return fs.readdirSync(docPath);
    }
    catch (err) {
        logMessage(`DOC011 - Error getting file names in the documentation directory ${docPath}, message: ${err}`);
        return [];
    }
}
export { docPath };
