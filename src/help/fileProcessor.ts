// src/documentation/fileProcessor.ts

//import * as fs from 'fs';
import fs from 'node:fs';
import mdFactory from 'markdown-it';
import { logMessage } from '../utils/logging.js';
import vpk from '../lib/vpk.js';
import { formatImagePath, formatTopicKey } from './helpers.js';
import { docPath } from './buildDocs.js';

const md = mdFactory({ html: true });
//let docCnt: number = 1000;

/**
 * Processes the list of documentation files.
 * @param files List of documentation files to process.
 */
export function processFiles(files: string[]): void {
    //let topicKey: string;
    let topicBack = 'toc';
    let topicNext = 'arch';

    files.forEach((file) => {
        const fn = `${docPath}/${file}`;
        try {
            if (fs.statSync(fn).isFile() && file.match(/\.md$/i)) {
                let buff = fs.readFileSync(fn, { encoding: 'utf8' });

                // Preprocess markdown file
                const { processedContent, topicKey } = preprocessMarkdown(buff);

                // Convert markdown to HTML
                const result = convertMarkdownToHtml(processedContent);

                // Store the processed content
                vpk.documentation[topicKey] = {
                    back: topicBack,
                    next: topicNext,
                    content: result,
                };
            }
        } catch (err) {
            logMessage(`DOC030 - Error processing help file: ${fn} error message: ${err}`);
            logMessage(`DOC030 - Stack: ${err.stack}`);
        }
    });

    logMessage(`DOC010 - Documentation files processed: ${files.length}`);
}

/**
 * Preprocesses the markdown file to extract a topic key and format image paths.
 * @param content The content of the markdown file.
 */
function preprocessMarkdown(content: string): { processedContent: string; topicKey: string } {
    const lines = content.split('\n');
    const newArray: string[] = [];
    let topicKey = '';

    lines.forEach((line) => {
        if (line.includes('<topicKey')) {
            topicKey = formatTopicKey(line);
        } else {
            if (line.includes('<img ')) {
                line = formatImagePath(line);
            }
            newArray.push(line + '\n');
        }
    });

    return { processedContent: newArray.join(''), topicKey };
}

/**
 * Converts the markdown content to HTML.
 * @param content The preprocessed markdown content.
 */
function convertMarkdownToHtml(content: string): string {
    let result = md.render(content);
    let loop = true;
    while (loop) {
        const fp = result.indexOf('<table>');
        if (fp > -1) {
            result = `${result.substring(0, fp)}<table class="docsTable">${result.substring(fp + 7)}`;
        } else {
            loop = false;
        }
    }
    return result;
}
