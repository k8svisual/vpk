//-----------------------------------------------------------------------------
// common routines
//-----------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

import { calcSize } from '../utils/calcsize.js';

export function hogsReport() {
    // Hogs: create a list of the highest defined requests and limit for
    // CPU, Memory, and Disk
    let nV: number = 0;
    vpk.hogs = {};
    vpk.hogs.cpuR = [];
    vpk.hogs.cpuL = [];
    vpk.hogs.memR = [];
    vpk.hogs.memL = [];
    vpk.hogs.diskR = [];
    vpk.hogs.diskL = [];

    // CPU
    vpk.hogsCPUReq.sort((a: any, b: any) => b.req - a.req);
    for (let i: number = 0; i < 11; i++) {
        if (typeof vpk.hogsCPUReq[i] !== 'undefined') {
            vpk.hogsCPUReq[i].value = vpk.hogsCPUReq[i].req;
            vpk.hogs.cpuR.push(vpk.hogsCPUReq[i]);
        }
    }
    vpk.hogsCPULimit.sort((a: any, b: any) => b.limit - a.limit);
    for (let i: number = 0; i < 11; i++) {
        if (typeof vpk.hogsCPULimit[i] !== 'undefined') {
            vpk.hogsCPULimit[i].value = vpk.hogsCPULimit[i].limit;
            vpk.hogs.cpuL.push(vpk.hogsCPULimit[i]);
        }
    }

    // MEMORY
    for (let i: number = 0; i < vpk.hogsMEMReq.length; i++) {
        nV = calcSize(vpk.hogsMEMReq[i].req);
        vpk.hogsMEMReq[i].value = nV;
    }
    vpk.hogsMEMReq.sort((a, b) => b.value - a.value);
    for (let i: number = 0; i < 11; i++) {
        if (typeof vpk.hogsMEMReq[i] !== 'undefined') {
            vpk.hogs.memR.push(vpk.hogsMEMReq[i]);
        }
    }
    for (let i: number = 0; i < vpk.hogsMEMLimit.length; i++) {
        nV = calcSize(vpk.hogsMEMLimit[i].limit);
        vpk.hogsMEMLimit[i].value = nV;
    }
    vpk.hogsMEMLimit.sort((a, b) => b.value - a.value);
    for (let i: number = 0; i < 11; i++) {
        if (typeof vpk.hogsMEMLimit[i] !== 'undefined') {
            vpk.hogs.memL.push(vpk.hogsMEMLimit[i]);
        }
    }

    // DISK
    for (let i: number = 0; i < vpk.hogsDISKReq.length; i++) {
        nV = calcSize(vpk.hogsDISKReq[i].req);
        vpk.hogsDISKReq[i].value = nV;
    }
    vpk.hogsDISKReq.sort((a, b) => b.value - a.value);
    for (let i: number = 0; i < 11; i++) {
        if (typeof vpk.hogsDISKReq[i] !== 'undefined') {
            vpk.hogs.diskR.push(vpk.hogsDISKReq[i]);
        }
    }
    for (let i: number = 0; i < vpk.hogsDISKLimit.length; i++) {
        nV = calcSize(vpk.hogsDISKLimit[i].limit);
        vpk.hogsDISKLimit[i].value = nV;
    }
    vpk.hogsDISKLimit.sort((a, b) => b.value - a.value);
    for (let i: number = 0; i < 11; i++) {
        if (typeof vpk.hogsDISKLimit[i] !== 'undefined') {
            vpk.hogs.diskL.push(vpk.hogsDISKLimit[i]);
        }
    }
}
