//------------------------------------------------------------------------------
// output message to console appending date and time
//------------------------------------------------------------------------------
export function logMessage(msg) {
    console.log(`${new Date().toLocaleString()} :: ${msg}`);
}
