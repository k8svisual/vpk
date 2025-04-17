//------------------------------------------------------------------------------
// format byte amount appending alpha category
//------------------------------------------------------------------------------
export function formatDir(dir) {
    let os = process.platform;
    let nd = '';
    let c = '';
    if (os.startsWith('win')) {
        for (let i = 0; i < dir.length; i++) {
            c = dir.substring(i, i);
            if (c === '/') {
                nd = nd + '\\';
            }
            else {
                nd = nd + c;
            }
        }
    }
    else {
        for (let i = 0; i < dir.length; i++) {
            c = dir.substring(i, i + 1);
            if (c === '\\') {
                nd = nd + '/';
            }
            else {
                nd = nd + c;
            }
        }
    }
    return nd;
}
