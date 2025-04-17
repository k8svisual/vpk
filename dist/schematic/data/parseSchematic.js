//-----------------------------------------------------------------------------
//
//-----------------------------------------------------------------------------
import vpk from '../../lib/vpk.js';
import { populateBaseContainer } from './populateBaseContainer.js';
import { populateServices } from './populateServices.js';
import { populateServiceAccountSecrets } from './populateServiceAccountSecrets.js';
import { populateControllerRevision } from './populateControllerRevision.js';
import { populateNetwork } from './populateNetwork.js';
import { populateOwnerChain } from './populateOwnerChain.js';
import { populateStorage } from './populateStorage.js';
import { populateHPA } from './populateHPA.js';
import { populateDaemonSetPods } from './populateDaemonSetPods.js';
import { populatePodsToShow } from './populatePodsToShow.js';
export function parseSchematic() {
    let data = '';
    let podNS = [];
    data = vpk.allKeys;
    // sort by namespace & kind
    data.sort((a, b) => (a.namespace > b.namespace ? 1 : a.namespace === b.namespace ? (a.kind > b.kind ? 1 : -1) : -1));
    populateBaseContainer(data);
    populateServices();
    populateServiceAccountSecrets();
    populateControllerRevision();
    populateNetwork();
    populateOwnerChain(podNS);
    populateStorage();
    populateHPA();
    populateDaemonSetPods();
    populatePodsToShow(podNS);
    // Add storage class to pods
    vpk.pods['0000-@storageClass@'] = vpk.storageClassName;
    return;
}
