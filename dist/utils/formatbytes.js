//-----------------------------------------------------------------------------
// Format byte amount appending alpha category
//-----------------------------------------------------------------------------
export const formatBytes = (bytesI, decimals = 2) => {
    if (bytesI === 0) {
        return '0 Bytes';
    }
    const k = 1024;
    const dm = Math.max(0, decimals); // Use `Math.max` for clarity
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytesI) / Math.log(k));
    return `${sizes[i]} ${parseFloat((bytesI / Math.pow(k, i)).toFixed(dm))}`;
};
