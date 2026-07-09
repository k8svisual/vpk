import { readFileSync, writeFileSync } from 'node:fs';
import type { NetworkCatalogOverride, MeshCatalogOverride } from '@vpk/core';

export interface NetworkCatalogOverrides {
  network: NetworkCatalogOverride[];
  mesh: MeshCatalogOverride[];
}

const EMPTY: NetworkCatalogOverrides = { network: [], mesh: [] };

/** Loads the persisted network-identification overrides (Settings > Network Identification) from `path`.
 *  Never throws — an absent or corrupt file degrades to no overrides (the built-in catalogs alone), same
 *  convention as settings.ts's loadSettings / vendorIconStore.ts's loadVendorIconOverrides. */
export function loadNetworkCatalogOverrides(path: string): NetworkCatalogOverrides {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<NetworkCatalogOverrides>;
    return {
      network: Array.isArray(raw.network) ? raw.network : [],
      mesh: Array.isArray(raw.mesh) ? raw.mesh : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveNetworkCatalogOverrides(path: string, overrides: NetworkCatalogOverrides): void {
  writeFileSync(path, JSON.stringify(overrides, null, 2));
}
