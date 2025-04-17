//------------------------------------------------------------------------------
// show object properties
//------------------------------------------------------------------------------
export function showProps(obj, objName) {
    let result = ``;
    for (var i in obj) {
        // obj.hasOwnProperty() is used to filter out
        // properties from the object's prototype chain
        if (obj.hasOwnProperty(i)) {
            result += `${objName}.${i} = ${obj[i]}\n`;
        }
    }
    return result;
}
