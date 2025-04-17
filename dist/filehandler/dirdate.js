//------------------------------------------------------------------------------
// build date and time string
//------------------------------------------------------------------------------
export function dirDate() {
    var dStr = new Date().toISOString();
    var fp;
    fp = dStr.indexOf('T');
    if (fp > -1) {
        dStr = dStr.substring(0, fp) + '-' + dStr.substring(fp + 1);
    }
    fp = dStr.indexOf(':');
    if (fp > -1) {
        dStr = dStr.substring(0, fp) + 'h-' + dStr.substring(fp + 1);
    }
    fp = dStr.indexOf(':');
    if (fp > -1) {
        dStr = dStr.substring(0, fp) + 'm-' + dStr.substring(fp + 1);
    }
    fp = dStr.indexOf('.');
    if (fp > -1) {
        dStr = dStr.substring(0, fp) + 's';
    }
    return dStr;
}
