//------------------------------------------------------------------------------
// output message to console appending date and time
//------------------------------------------------------------------------------
export function logMessage(msg: string) {
    console.log(`${new Date().toLocaleString()} :: ${msg}`);
}
