//-----------------------------------------------------------------------------
// ??
//-----------------------------------------------------------------------------

import vpk from '../lib/vpk.js';
import { reduceKV } from './reduceKV.js';
import { processSelected } from './processSelected.js';

export function checkKeyValue(key: string, value: string, type: string, fnumBase: any) {
    let keepFnum: any = [];
    let data: any = [];
    let kData: string = '';
    let vData: string = '';
    if (key !== '') {
        if (type === 'Labels') {
            if (key !== '*' && key !== '') {
                if (typeof vpk.idxLabels[key] !== 'undefined') {
                    kData = vpk.idxLabels[key];
                }
            }
            if (value !== '') {
                if (typeof vpk.idxLabelsValue[value] !== 'undefined') {
                    vData = vpk.idxLabelsValue[value];
                }
            }
        } else if (type === 'Annotations') {
            if (typeof vpk.idxAnnotations[key] !== 'undefined') {
                kData = vpk.idxAnnotations[key];
                if (typeof kData === 'undefined') {
                    kData = '';
                }
            }
            if (value !== '') {
                if (typeof vpk.idxAnnotationsValue[value] !== 'undefined') {
                    vData = vpk.idxAnnotationsValue[value];
                }
            }
        } else if (type === 'Name') {
            if (typeof vpk.idxName[key] !== 'undefined') {
                kData = vpk.idxName[key];
                vData = '';
            }
        }

        if (key !== '*' && value !== '') {
            if (vData === '' || vData.length === 0) {
                data = [];
            } else {
                data = reduceKV(kData, vData);
            }
        } else if (kData !== '' && vData !== '') {
            data = reduceKV(kData, vData);
        } else if (kData === '' && vData !== '') {
            data = vData;
        } else if (vData === '' && kData !== '') {
            data = kData;
        }

        for (let d = 0; d < data.length; d++) {
            keepFnum.push(data[d]);
        }
    }
    processSelected(keepFnum, fnumBase);
}
