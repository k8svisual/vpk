import vpk from '../../lib/vpk.js';

export function saveResources(obj: any, e: any, fnum: any, kind: string, name: string, ns: string) {
    //TODO: add logic for resources.requests.ephemeral
    // If resources located process, else return
    if (typeof obj[e].resources === 'undefined') {
        return;
    }
    let memory: any;
    let cpu: any;
    let disk: any;
    // Set requests
    if (typeof obj[e].resources.requests !== 'undefined') {
        cpu = 0;
        memory = '';
        disk = '';
        if (typeof obj[e].resources.requests.cpu !== 'undefined') {
            cpu = obj[e].resources.requests.cpu;
        }
        if (typeof obj[e].resources.requests.memory !== 'undefined') {
            memory = obj[e].resources.requests.memory;
        }
        if (typeof obj[e].resources.requests['ephemeral-storage'] !== 'undefined') {
            disk = obj[e].resources.requests['ephemeral-storage'];
        }
        vpk.pods[fnum].resourceRequest.push({
            cpu: cpu,
            memory: memory,
        });

        if (kind === 'Pod' || kind === 'CronJob' || kind === 'Job') {
            if (memory !== '') {
                vpk.hogsMEMReq.push({
                    podName: name,
                    podFnum: fnum,
                    ns: ns,
                    req: memory,
                });
            }
            if (cpu > 0) {
                vpk.hogsCPUReq.push({
                    podName: name,
                    podFnum: fnum,
                    ns: ns,
                    req: cpu,
                });
            }
            if (disk !== '') {
                vpk.hogsDISKReq.push({
                    podName: name,
                    podFnum: fnum,
                    ns: ns,
                    req: disk,
                });
            }
        }
    }
    // Set limits
    if (typeof obj[e].resources.limits !== 'undefined') {
        cpu = 0;
        memory = '';
        disk = '';
        if (typeof obj[e].resources.limits.cpu !== 'undefined') {
            cpu = obj[e].resources.limits.cpu;
        }
        if (typeof obj[e].resources.limits.memory !== 'undefined') {
            memory = obj[e].resources.limits.memory;
        }
        if (typeof obj[e].resources.limits['ephemeral-storage'] !== 'undefined') {
            disk = obj[e].resources.limits['ephemeral-storage'];
        }

        vpk.pods[fnum].resourceLimit.push({
            cpu: cpu,
            memory: memory,
        });
        if (kind === 'Pod' || kind === 'CronJob' || kind === 'Job') {
            if (memory !== '') {
                vpk.hogsMEMLimit.push({
                    podName: name,
                    podFnum: fnum,
                    ns: ns,
                    limit: memory,
                });
            }
            if (cpu > 0) {
                vpk.hogsCPULimit.push({
                    podName: name,
                    podFnum: fnum,
                    ns: ns,
                    limit: cpu,
                });
            }
            if (disk !== '') {
                vpk.hogsDISKLimit.push({
                    podName: name,
                    podFnum: fnum,
                    ns: ns,
                    limit: disk,
                });
            }
        }
    }
}
