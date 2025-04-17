//------------------------------------------------------------------------------
// space calculation for capacity
//------------------------------------------------------------------------------
import { logMessage } from './logging.js';
export function spaceCalc(size) {
    let value = 0;
    let factor = '';
    let power = 0;
    let tmp;
    try {
        if (size.endsWith('i')) {
            value = size.substring(0, size.length - 2);
            tmp = size.length - 2;
            factor = size.substring(tmp);
        }
        else if (size.endsWith('m')) {
            value = size.substring(0, size.length - 1);
            factor = 'm';
        }
        else {
            value = size.substring(0, size.length - 1);
            tmp = size.length - 1;
            factor = size.substring(tmp);
        }
        if (factor === 'E') {
            power = Math.pow(1000, 6);
        }
        else if (factor === 'P') {
            power = Math.pow(1000, 5);
        }
        else if (factor === 'T') {
            power = Math.pow(1000, 4);
        }
        else if (factor === 'G') {
            power = Math.pow(1000, 3);
        }
        else if (factor === 'M') {
            power = Math.pow(1000, 2);
        }
        else if (factor === 'K') {
            power = 1000;
        }
        else if (factor === 'Ei') {
            power = Math.pow(1024, 6);
        }
        else if (factor === 'Pi') {
            power = Math.pow(1024, 5);
        }
        else if (factor === 'Ti') {
            power = Math.pow(1024, 4);
        }
        else if (factor === 'Gi') {
            power = Math.pow(1024, 3);
        }
        else if (factor === 'Mi') {
            power = Math.pow(1024, 2);
        }
        else if (factor === 'Ki') {
            power = 1024;
        }
        else {
            power = 0;
        }
        value = parseInt(value, 10);
        value = value * power;
    }
    catch (err) {
        logMessage(`vpkUT584 - Error calculating space, message: ${err}`);
        value = 0;
    }
    return value;
}
