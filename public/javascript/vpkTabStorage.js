/*
Copyright (c) 2018-2023 k8sVisual

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

//----------------------------------------------------------
// Screen handling code OwnerRef tab
//----------------------------------------------------------


// Toggle the StorageClass in the UI
function toggleStorage(id) {
    id = '#' + id;
    if ($(id).is('.collapse:not(.show)')) {
        // not open, open it
        $(id).collapse("show");
    } else {
        $(id).collapse("hide");
    }
}

function showSC(name, fnum) {
    // Close all StroageClasses
    try {
        let tID;
        let keys = Object.keys(scArray);
        for (let i = 0; i < keys.length; i++) {
            tID = scArray[keys[i]].id;
            // Close all open Open the stroage info
            let id = '#' + tID + 'pv';
            if ($(id).is('.collapse:not(.show)')) {
                // not open, open it
            } else {
                $(id).collapse("hide");
            }
        }

        // Open the selected StorageClass and scroll to that SC
        if (typeof scArray[name] !== 'undefined') {
            let tID = scArray[name].id;
            // Open the stroage info
            let id = '#' + tID + 'pv';
            $(id).collapse("show");
            // Switch to the tab
            $('[href="#storage"]').tab('show');
            // Scroll to the info
            document.getElementById(tID).scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        console.log('View storage from cluster failed, error: ' + e)
    }
}

//==========================================================


//----------------------------------------------------------
console.log('loaded vpkTabStorage.js');