export function formatJSON(content: any) {
    let cData: any = JSON.stringify(content, null, 2);
    cData = cData.split('\n');
    let nLine: string = '';
    let rtn: string = '';
    let pttrn: any = /^\s*/;
    let spc: number = 0;
    for (let i: number = 0; i < cData.length; i++) {
        nLine = '';
        spc = cData[i].match(pttrn)[0].length;
        if (spc > 0) {
            for (let s: number = 0; s < spc; s++) {
                nLine = nLine + '&nbsp;';
            }
        }
        rtn = rtn + nLine + cData[i].substring(spc) + '<br>';
    }
    return rtn;
}
