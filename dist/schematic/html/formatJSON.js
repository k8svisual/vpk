export function formatJSON(content) {
    let cData = JSON.stringify(content, null, 2);
    cData = cData.split('\n');
    let nLine = '';
    let rtn = '';
    let pttrn = /^\s*/;
    let spc = 0;
    for (let i = 0; i < cData.length; i++) {
        nLine = '';
        spc = cData[i].match(pttrn)[0].length;
        if (spc > 0) {
            for (let s = 0; s < spc; s++) {
                nLine = nLine + '&nbsp;';
            }
        }
        rtn = rtn + nLine + cData[i].substring(spc) + '<br>';
    }
    return rtn;
}
