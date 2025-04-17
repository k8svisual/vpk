//------------------------------------------------------------------------------
// check network related data that is in resource definition
//------------------------------------------------------------------------------
'use strict';

import vpk from '../lib/vpk.js';

export function checkNetInfo(y_kind: string, fnum: any) {
    let netKey: any;
    let netInfo: any;
    // Save Ingress fnum and yaml
    if (y_kind === 'Ingress') {
        vpk.ingress.push({ fnum: fnum, def: vpk.yaml });
        // Network related info saved
        netKey = y_kind + ':cluster-level:' + vpk.yaml.metadata.name;
        netInfo = {
            fnum: fnum,
            obj: vpk.yaml,
        };

        if (typeof vpk.netInfo[netKey] === 'undefined') {
            vpk.netInfo[netKey] = netInfo;
        }
    }

    // Save IngressClass fnum and yaml
    if (y_kind === 'IngressClass') {
        vpk.ingressClass.push({ fnum: fnum, def: vpk.yaml });
        // Network related info saved
        netKey = y_kind + ':cluster-level:' + vpk.yaml.metadata.name;
        netInfo = {
            fnum: fnum,
            obj: vpk.yaml,
        };

        if (typeof vpk.netInfo[netKey] === 'undefined') {
            vpk.netInfo[netKey] = netInfo;
        }
    }

    // Save IngressController fnum and yaml
    if (y_kind === 'IngressController') {
        vpk.ingressController.push({ fnum: fnum, def: vpk.yaml });
        // Network related info saved
        netKey = y_kind + ':cluster-level:' + vpk.yaml.metadata.name;
        netInfo = {
            fnum: fnum,
            obj: vpk.yaml,
        };

        if (typeof vpk.netInfo[netKey] === 'undefined') {
            vpk.netInfo[netKey] = netInfo;
        }
    }
}
