export function formatDate(data: any) {
    if (typeof data === 'undefined' || data === null) {
        return 'Unknown date';
    }
    let mydate: any = new Date(data);
    let fDate: string = mydate.toDateString();
    let tPart: any[] = data.split('T');
    if (typeof tPart[1] !== 'undefined') {
        fDate = fDate + ' ' + tPart[1];
        if (fDate.endsWith('Z')) {
            fDate = fDate.substring(0, fDate.length - 1) + ' GMT';
        }
    }
    return fDate;
}
