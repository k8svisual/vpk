//------------------------------------------------------------------------------
// change parameter to append a slash
//------------------------------------------------------------------------------

export function chgP2(data: any) {
    let cp: number = data.lastIndexOf('@');
    if (cp > -1) {
        return `${data.substring(0, cp)}/${data.substring(cp + 1)}`;
    } else {
        return data;
    }
}
