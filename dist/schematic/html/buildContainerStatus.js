export function buildContainerStatus(data) {
    let statusMsg = '';
    let statusFill = '';
    if (typeof data.state !== 'undefined') {
        if (typeof data.state.waiting !== 'undefined') {
            if (typeof data.state.waiting.reason !== 'undefined') {
                let reason = data.state.waiting.reason;
                if (reason === 'CrashLoopBackOff') {
                    statusFill = '#fa7373';
                    statusMsg = statusMsg + 'CrashLoopBackOff';
                }
                else if (reason === 'ImagePullBackOff') {
                    statusFill = '#fa7373';
                    statusMsg = statusMsg + 'ImagePullBackOff';
                }
                else if (reason === 'ContainerCreating') {
                    statusFill = '#fa7373';
                    statusMsg = statusMsg + 'ContainerCreating';
                }
                else {
                    statusFill = 'grey';
                    statusMsg = statusMsg + data.state.waiting.reason;
                    //logMessage('data.state.waiting.reason: ' + data.state.waiting.reason)
                }
            }
        }
        else if (typeof data.state.terminated !== 'undefined') {
            if (typeof data.state.terminated.reason !== 'undefined') {
                statusFill = 'lightgrey';
                statusMsg = data.state.terminated.reason;
            }
            else {
                statusFill = 'lightgrey';
                statusMsg = 'Unknown';
                //logMessage('UnProcessed terminated status: ' + JSON.stringify(data.state.terminated, null, 2))
            }
        }
        else if (typeof data.state.running !== 'undefined') {
            //statusFill = '#66ed8a';
            statusFill = '#00ff00';
            statusMsg = 'Running';
        }
    }
    return { msg: statusMsg, fill: statusFill };
}
