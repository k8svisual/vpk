//-----------------------------------------------------------------------------
// Issue command to get the resource kind information
//-----------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
import { exec } from 'child_process';
export function kubeget(ns, kind, glbGet, glbSSH) {
    return new Promise((resolve, reject) => {
        let cmd = '';
        if (ns === 'all-namespaces') {
            cmd = `${glbGet} get ${kind} --all-namespaces -o json`;
        }
        else if (ns === '') {
            cmd = `${glbGet} get ${kind} -o json`;
        }
        else {
            cmd = `${glbGet} get ${kind} -n ${ns} -o json`;
        }
        if (glbSSH !== '') {
            cmd = glbSSH + "'" + cmd + "'";
        }
        exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout) => {
            if (error) {
                logMessage('KUB081 - Error getting information for kind: ' + kind + ', Message: ' + error.message);
                reject(error.message);
            }
            else {
                resolve(stdout.toString());
            }
        });
    });
}
// export function kubeget(ns: string, kind: string, glbGet: string, glbSSH: string) {
//     return new Promise((resolve, reject) => {
//         let cmd = '';
//         if (ns === 'all-namespaces') {
//             cmd = `${glbGet} get ${kind} --all-namespaces -o json`;
//         } else if (ns === '') {
//             cmd = `${glbGet} get ${kind} -o json`;
//         } else {
//             cmd = `${glbGet} get ${kind} -n ${ns} -o json`;
//         }
//         if (glbSSH !== '') {
//             cmd = glbSSH + "'" + cmd + "'";
//         }
//         exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout) => {
//             if (error) {
//                 logMessage('KUB081 - Error getting information for kind: ' + kind + ', Message: ' + error.message);
//                 resolve('{ items: [] }'); // Return an empty result on error
//             } else {
//                 resolve(stdout.toString());
//             }
//         });
//     });
// }
// //-----------------------------------------------------------------------------
// // Issue command to get the resource kind information
// //-----------------------------------------------------------------------------
// 'use strict';
// import vpk from '../lib/vpk.js';
// import { execSync } from 'child_process';
// import { logMessage } from '../utils/logging.js';
// export function kubeget(ns: string, kind: string, glbGet: string, glbSSH: string) {
//     try {
//         let cmd = '';
//         if (ns === 'all-namespaces') {
//             cmd = `${glbGet} get ${kind} --all-namespaces -o json`;
//         } else if (ns === '') {
//             cmd = `${glbGet} get ${kind} -o json`;
//         } else {
//             cmd = `${glbGet} get ${kind} -n ${ns} -o json`;
//         }
//         if (glbSSH !== '') {
//             cmd = glbSSH + "'" + cmd + "'";
//         }
//         const out = execSync(cmd, { maxBuffer: 50 * 1024 * 1024 }).toString();
//         try {
//             const explainCmd = glbSSH ? `${glbSSH} ${glbGet} explain ${kind}` : `${glbGet} explain ${kind}`;
//             let expOut = execSync(explainCmd).toString();
//             expOut = expOut.split('FIELDS:')[0];
//             vpk.explains[kind] = expOut;
//         } catch (e) {
//             logMessage('KUB083 - Warning, did not find explain information for kind: ' + kind + ' msg: ' + e.message);
//         }
//         return out;
//     } catch (err) {
//         logMessage('KUB081 - Error getting information for kind: ' + kind + ',  Message: ' + err);
//         return '{ items: [] }';
//     }
// }
