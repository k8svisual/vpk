import { formatJSON } from './formatJSON.js';
export function buildTipContent(data, type, fnum) {
    let cnt = 0;
    let content = '';
    if (typeof data === 'undefined') {
        content = 'No info available';
        content = '<div class="vpkfont-xsm">' + content + '</div>';
        return content;
    }
    if (type === 'Unknown') {
        content = 'No resource type located or failed to properly be created.';
    }
    else if (type === 'Cluster') {
        content = 'Name: ' + data + '<br>';
    }
    else if (type === 'ClusterRole') {
        if (typeof data !== 'undefined') {
            cnt = 0;
            content = content + 'Name: ' + data.roleRefName;
        }
    }
    else if (type === 'ClusterRoleBinding') {
        if (typeof data !== 'undefined') {
            cnt = 0;
            content = content + 'Name: ' + data.crbName;
        }
    }
    else if (type === 'Conditions') {
        if (typeof data.conditions !== 'undefined') {
            if (typeof data.conditions[0] !== 'undefined') {
                cnt = 0;
                for (let k = 0; k < data.conditions.length; k++) {
                    cnt++;
                    content =
                        content +
                            '- &nbsp;&nbsp;<b>Type:</b> ' +
                            data.conditions[k].type +
                            '<br>' +
                            '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Status:</b> ' +
                            data.conditions[k].status +
                            '<br>';
                    if (typeof data.conditions[k].message !== 'undefined') {
                        content = content + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Message:</b> ' + data.conditions[k].message + '<br>';
                    }
                    if (typeof data.conditions[k].reason !== 'undefined') {
                        content = content + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Reason:</b> ' + data.conditions[k].reason + '<br>';
                    }
                    content = content + '<br>';
                }
            }
        }
    }
    else if (type === 'ConfigMap') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = content + '(' + cnt + ') Name: ' + data[k].name + ' (Used by: ' + data[k].use + ')<br>';
            }
        }
        else {
            if (typeof data.name !== 'undefined') {
                content = 'Name: ' + data.name;
            }
        }
    }
    else if (type === 'Container') {
        content = '';
        if (typeof data.containerNames !== 'undefined') {
            for (let k = 0; k < data.containerNames.length; k++) {
                content =
                    content +
                        '- &nbsp;&nbsp;<b>Name:</b> ' +
                        data.containerNames[k].c_name +
                        '<br>' +
                        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Image:</b> ' +
                        data.containerNames[k].c_image +
                        '<br>';
            }
        }
    }
    else if (type === 'ContainerStatus' || type === 'InitContainerStatus') {
        // container status
        if (typeof data !== 'undefined') {
            cnt = 0;
            content = '';
            //content = formatJSON(data) + '<br>'
            content = content + 'Name: ' + data.name + '<br>' + 'Restart Count: ' + data.restartCount + '<br>';
        }
        else {
            content = 'No statuses located';
        }
    }
    else if (type === 'ControllerRevision') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            content = content + 'Name: ' + data[0].name;
        }
    }
    else if (type === 'CRD') {
        //CustomResourceDefinition
        content = 'Name: ' + data;
    }
    else if (type === 'DaemonSet' ||
        type === 'Deployment' ||
        type === 'DeploymentConfig' ||
        type === 'ReplicaSet' ||
        type === 'ReplicationController' ||
        type === 'StatefulSet') {
        content = 'Name: ' + data.name;
    }
    else if (type === 'EndPoint') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            //			for (let k = 0; k < data.length; k++) {
            content = content + 'Name: ' + data[0].name + '<br>';
            //			}
        }
    }
    else if (type === 'EndPointSlice') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].name;
            }
        }
    }
    else if (type === 'Events') {
        if (typeof data[0] !== 'undefined') {
            content = content + 'Count: ' + data;
        }
    }
    else if (type === 'HorizontalPodAutoscaler') {
        content = formatJSON(data);
    }
    else if (type === 'Namespace') {
        content = 'Name: ' + data + '<br>';
    }
    else if (type === 'PersistentVolumeClaim') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].pvcName;
                if (typeof data[k].pcvStorageClass !== 'undefined') {
                    if (data[k].pcvStorageClass !== '') {
                        content = content + 'Storage class: ' + data[k].pcvStorageClass + '<br>';
                    }
                }
                if (typeof data[k].pcvVolumeName !== 'undefined') {
                    if (data[k].pcvVolumeName !== '') {
                        content = content + 'Volume name: ' + data[k].pcvVolumeName + '<br>';
                    }
                }
                if (typeof data[k].pcvSelectorLabel !== 'undefined') {
                    if (data[k].pcvSelectorLabel !== '') {
                        content = content + 'Selector label: ' + data[k].pcvSelectorLabel + '<br>';
                    }
                }
            }
        }
    }
    else if (type === 'PersistentVolume') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].pvName + '<br>';
                if (data[k].pvLocalPath !== '') {
                    content = content + 'Local path: ' + data[k].pvLocalPath + '<br>';
                }
                if (data[k].pvHostPath !== '') {
                    content = content + 'Host path: ' + data[k].pvHostPath + '<br>';
                }
                if (data[k].pvNFSPath !== '') {
                    content = content + 'NFS path: ' + data[k].pvNFSPath + '<br>';
                }
            }
        }
    }
    else if (type === 'Phase') {
        //Pod Phase
        content = 'None located';
        if (typeof data.status !== 'undefined') {
            content = '';
            if (typeof data.status.hostIP !== 'undefined') {
                content = content + 'HostIP: ' + data.status.hostIP + '<br>';
            }
            if (typeof data.status.podIP !== 'undefined') {
                content = content + 'PodIP: ' + data.status.podIP + '<br>';
            }
            if (typeof data.status.podIPs !== 'undefined') {
                if (typeof data.status.podIPs.length !== 'undefined') {
                    if (data.status.podIPs.length > 1) {
                        content = content + 'PodIPs: <br>' + formatJSON(data.status.podIPs) + '<br>';
                    }
                }
            }
        }
    }
    else if (type === 'Pod') {
        content = '';
        if (typeof data.name !== 'undefined') {
            content = content + 'Name: ' + data.name + '<br>';
            if (typeof data.Volume !== 'undefined') {
                content = content + 'Volume(s):' + '<br>';
                cnt = 0;
                for (let k = 0; k < data.Volume.length; k++) {
                    cnt++;
                    content = content + '(' + cnt + ') ' + data.Volume[k].name + '<br>';
                }
            }
        }
    }
    else if (type === 'Node') {
        content = 'Name: ' + data.name + '<br>';
    }
    else if (type === 'Ref') {
        content = '';
        content = content + data;
    }
    else if (type === 'Secret') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = content + '(' + cnt + ') Name:' + data[k].name + ' (Used by:' + data[k].use + ')<br>';
            }
        }
    }
    else if (type === 'Roles') {
        content = '';
    }
    else if (type === 'RoleBinding') {
        content = '';
    }
    else if (type === 'Security') {
        content = '';
    }
    else if (type === 'Service') {
        content = fnum + '<br>';
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = 'Name: ' + data[k].name + '<br>';
            }
        }
    }
    else if (type === 'ServiceAccount') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                cnt++;
                content = content + '(' + cnt + ') Name: ' + data[k].name + '<br>';
            }
        }
    }
    else if (type === 'StorageClass') {
        if (typeof data[0] !== 'undefined') {
            cnt = 0;
            for (let k = 0; k < data.length; k++) {
                content = content + 'Name: ' + data[k].storageClassName;
            }
        }
    }
    else if (type === 'Subject') {
        content = '';
    }
    else {
        content = 'Name: ' + data.name + '<br>' + 'Type: ' + type;
    }
    content = '<div class="vpkfont-xsm">' + content + '</div>';
    return content;
}
