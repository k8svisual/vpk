/*
Copyright (c) 2018-2023 Dave Weilert

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
// Browser usage info on the configuration screen
//----------------------------------------------------------


// how to do
// https://stackoverflow.com/questions/11219582/how-to-detect-my-browser-version-and-operating-system-using-javascript
function browserUsageDetails() {

    var nVer = navigator.appVersion;
    var nAgt = navigator.userAgent;
    var browserName = navigator.appName;
    var fullVersion = '' + parseFloat(navigator.appVersion);
    var majorVersion = parseInt(navigator.appVersion, 10);
    var nameOffset, verOffset, ix;

    // In Opera, the true version is after "Opera" or after "Version"
    if ((verOffset = nAgt.indexOf("Opera")) != -1) {
        browserName = "Opera";
        fullVersion = nAgt.substring(verOffset + 6);
        if ((verOffset = nAgt.indexOf("Version")) != -1)
            fullVersion = nAgt.substring(verOffset + 8);
    }
    // In MSIE, the true version is after "MSIE" in userAgent
    else if ((verOffset = nAgt.indexOf("MSIE")) != -1) {
        browserName = "Microsoft Internet Explorer";
        fullVersion = nAgt.substring(verOffset + 5);
    }
    // In Chrome, the true version is after "Chrome" 
    else if ((verOffset = nAgt.indexOf("Chrome")) != -1) {
        browserName = "Chrome";
        fullVersion = nAgt.substring(verOffset + 7);
    }
    // In Safari, the true version is after "Safari" or after "Version" 
    else if ((verOffset = nAgt.indexOf("Safari")) != -1) {
        browserName = "Safari";
        fullVersion = nAgt.substring(verOffset + 7);
        if ((verOffset = nAgt.indexOf("Version")) != -1)
            fullVersion = nAgt.substring(verOffset + 8);
    }
    // In Firefox, the true version is after "Firefox" 
    else if ((verOffset = nAgt.indexOf("Firefox")) != -1) {
        browserName = "Firefox";
        fullVersion = nAgt.substring(verOffset + 8);
    }
    // In most other browsers, "name/version" is at the end of userAgent 
    else if ((nameOffset = nAgt.lastIndexOf(' ') + 1) <
        (verOffset = nAgt.lastIndexOf('/'))) {
        browserName = nAgt.substring(nameOffset, verOffset);
        fullVersion = nAgt.substring(verOffset + 1);
        if (browserName.toLowerCase() == browserName.toUpperCase()) {
            browserName = navigator.appName;
        }
    }
    // trim the fullVersion string at semicolon/space if present
    if ((ix = fullVersion.indexOf(";")) != -1)
        fullVersion = fullVersion.substring(0, ix);
    if ((ix = fullVersion.indexOf(" ")) != -1)
        fullVersion = fullVersion.substring(0, ix);

    majorVersion = parseInt('' + fullVersion, 10);
    if (isNaN(majorVersion)) {
        fullVersion = '' + parseFloat(navigator.appVersion);
        majorVersion = parseInt(navigator.appVersion, 10);
    }


    usageBrowserName = browserName;
    usageFullVersion = fullVersion;
    usageMajorVersion = majorVersion;
    usageNavigatorAppName = navigator.appName;
    usageNavigatorUserAgent = navigator.userAgent;

    try {
        let memU = window.performance.memory;
        if (typeof memU !== 'undefined') {

            usageJSHeapSizeLimit = memU.jsHeapSizeLimit;
            usageJSHeapTotal = memU.totalJSHeapSize;
            usageJSHeapUsed = memU.usedJSHeapSize;
        }
    } catch (e) {
        console.log(`browserUsageDetails() unable to get browser memeory usage: ${e.message}`)
    }
}


function formatUsage(data) {
    let rtn = '<div class="events ml-2 mr-2 mb-2 vpkblue" ><hr><table style="width:100%">'
    rtn = rtn + usageLine('Architecture', data.header.arch);
    rtn = rtn + usageLine('Machine', data.header.osMachine);
    rtn = rtn + usageLine('OS Name', data.header.osName);
    rtn = rtn + usageLine('OS Release', data.header.osRelease);

    rtn = rtn + usageLine('Processor', data.header.cpus[0].model);
    rtn = rtn + usageLine('CPU count', data.header.cpus.length);
    rtn = rtn + usageLine('User CPU seconds', data.resourceUsage.userCpuSeconds);
    rtn = rtn + usageLine('Kernel CPU seconds', data.resourceUsage.kernelCpuSeconds);

    rtn = rtn + usageLine('Heap total memory', formatBytes(data.javascriptHeap.totalMemory));
    rtn = rtn + usageLine('Heap committed memory', formatBytes(data.javascriptHeap.totalCommittedMemory));
    rtn = rtn + usageLine('Heap used memory', formatBytes(data.javascriptHeap.usedMemory));
    rtn = rtn + usageLine('Heap available memory', formatBytes(data.javascriptHeap.availableMemory));
    rtn = rtn + usageLine('Heap memory limit', formatBytes(data.javascriptHeap.memoryLimit));

    rtn = rtn + usageLine('Network host name', data.header.host);
    let nI = data.header.networkInterfaces
    for (let i = 0; i < nI.length; i++) {
        if (nI[i].internal === false && nI[i].family === 'IPv4') {
            rtn = rtn + usageLine('Network interface name', nI[i].name);
            rtn = rtn + usageLine('Network MAC', nI[i].mac);
            rtn = rtn + usageLine(nI[i].family + ' Address', nI[i].address);
        }
    }
    rtn = rtn + usageLine('Current working directory', data.header.cwd);
    rtn = rtn + usageLine('Node.js version', data.header.nodejsVersion);
    //browser related fields
    browserUsageDetails();
    rtn = rtn + usageLine('Browser name', usageBrowserName);
    rtn = rtn + usageLine('Browser version', usageFullVersion);
    rtn = rtn + usageLine('Browser agent', usageNavigatorUserAgent);
    // at this time only chrome browser provides memory stats
    if (usageJSHeapSizeLimit !== 0) {
        rtn = rtn + usageLine('Browser Heap total memory', formatBytes(usageJSHeapTotal));
        rtn = rtn + usageLine('Browser Heap used memory', formatBytes(usageJSHeapUsed));
        rtn = rtn + usageLine('Browser Heap memory limit', formatBytes(usageJSHeapSizeLimit));
    }
    rtn = rtn + '</table></div>';

    if (typeof data.LICENSE !== 'undefined') {
        let lic = data.LICENSE.split('\n')
        let outLic = '<br>';
        for (let i = 0; i < lic.length; i++) {
            outLic = outLic + lic[i] + '<br>';
        }
        rtn = rtn + '<div class="mt-5 ml-5 mr-5 mb-5 vpkfont-sm"><p>' + outLic + '</p></div>'
    }
    return rtn;
}

function usageLine(v1, v2) {
    let trP1 = '<tr class="vpkblue">';
    let trP2 = '</tr>';
    let tdR = '<td width="40%" style="text-align: right; padding-right: 30px;" >';
    let tdL = '<td width="60%">';
    let tdP2 = '</td>';
    return trP1 + tdR + '<b>' + v1 + ':</b>' + tdP2 + tdL + v2 + tdP2 + trP2;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) {
        return '0 Bytes';
    }
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


//----------------------------------------------------------
console.log('loaded vpkUsage.js');
