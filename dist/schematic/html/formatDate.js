export function formatDate(data) {
    if (typeof data === 'undefined' || data === null) {
        return 'Unknown date';
    }
    let mydate = new Date(data);
    let fDate = mydate.toDateString();
    let tPart = data.split('T');
    if (typeof tPart[1] !== 'undefined') {
        fDate = fDate + ' ' + tPart[1];
        if (fDate.endsWith('Z')) {
            fDate = fDate.substring(0, fDate.length - 1) + ' GMT';
        }
    }
    return fDate;
}
