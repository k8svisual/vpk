//------------------------------------------------------------------------------
// show object properties
//------------------------------------------------------------------------------

export function showProps(obj: any, objName: string) {
    let result: string = ``;
    for (var i in obj) {
        // obj.hasOwnProperty() is used to filter out
        // properties from the object's prototype chain
        if (obj.hasOwnProperty(i)) {
            result += `${objName}.${i} = ${obj[i]}\n`;
        }
    }
    return result;
}
