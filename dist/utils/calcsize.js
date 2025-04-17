//------------------------------------------------------------------------------
// calculate the size of a value that ends with text identifier
//------------------------------------------------------------------------------
import { logMessage } from '../utils/logging.js';
export function calcSize(val) {
    try {
        if (typeof val === 'undefined') {
            logMessage(`UTL278 - Unable to converting ${val} to number`);
            return 0;
        }
        let nV = val.toUpperCase();
        let pow = 0;
        let base = 1024;
        let num = 0;
        if (nV.endsWith('KI')) {
            pow = 1;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('K')) {
            pow = 1;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('MI')) {
            pow = 2;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('M')) {
            pow = 2;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('GI')) {
            pow = 3;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('G')) {
            pow = 3;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('TI')) {
            pow = 4;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('T')) {
            pow = 4;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('PI')) {
            pow = 5;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('P')) {
            pow = 5;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('EI')) {
            pow = 6;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('E')) {
            pow = 6;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('ZI')) {
            pow = 7;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('Z')) {
            pow = 7;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        else if (nV.endsWith('YI')) {
            pow = 8;
            num = nV.substring(0, nV.length - 2);
        }
        else if (nV.endsWith('Y')) {
            pow = 8;
            base = 1000;
            num = nV.substring(0, nV.length - 1);
        }
        let rtn = num * Math.pow(base, pow);
        return rtn;
    }
    catch (err) {
        logMessage(`UTL277 - Error converting ${val} to number: ' ${err}`);
    }
}
