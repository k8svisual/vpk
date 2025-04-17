import vpk from '../../lib/vpk.js';
import { logMessage } from '../../utils/logging.js';
export function containerImages(c_image, c_name, fnum, ns, kind, name, c_type) {
    let repository;
    let regW;
    let img;
    if (c_image !== 'undefined') {
        if (typeof vpk.containerImages[c_image] === 'undefined') {
            vpk.containerImages[c_image] = [];
            vpk.containerImages[c_image].push(fnum);
        }
        else {
            vpk.containerImages[c_image].push(fnum);
        }
        regW = c_image.lastIndexOf('/');
        repository = c_image.substring(0, regW);
        img = c_image.substring(regW + 1);
        if (repository.length === 0) {
            logMessage('CON899 - Image is using default repository: ' + c_image);
        }
        if (typeof vpk.imageRepository[repository] === 'undefined') {
            vpk.imageRepository[repository] = 1;
            vpk.imageRepositoryData[repository] = [];
        }
        else {
            vpk.imageRepository[repository] = vpk.imageRepository[repository] + 1;
        }
        vpk.imageRepositoryData[repository].push({
            ns: ns,
            image: img,
            fnum: fnum,
            c_name: c_name,
            kind: kind,
            c_type: c_type,
            state: false,
        });
        if (kind === 'Pod') {
            if (typeof vpk.imageRepositoryFirst[repository] === 'undefined') {
                // Save the fnum of the first pod to use the repository
                vpk.imageRepositoryFirst[repository] = fnum;
            }
        }
    }
}
