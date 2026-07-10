import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { NetworkCatalogOverride, MeshCatalogOverride } from '@vpk/core';
import { pushLog } from './logBuffer';

export interface NetworkCatalogOverrides {
  network: NetworkCatalogOverride[];
  mesh: MeshCatalogOverride[];
}

const EMPTY: NetworkCatalogOverrides = { network: [], mesh: [] };

/** Loads the persisted network-identification overrides (Settings > Network Identification) from `path`.
 *  Never throws — an absent or corrupt file degrades to no overrides (the built-in catalogs alone), same
 *  convention as settings.ts's loadSettings / vendorIconStore.ts's loadVendorIconOverrides. An absent file is
 *  the normal first-run case and stays silent; a file that EXISTS but fails to parse is worth a trace. */
export function loadNetworkCatalogOverrides(path: string): NetworkCatalogOverrides {
  if (!existsSync(path)) return EMPTY;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<NetworkCatalogOverrides>;
    return {
      network: Array.isArray(raw.network) ? raw.network : [],
      mesh: Array.isArray(raw.mesh) ? raw.mesh : [],
    };
  } catch (e) {
    pushLog('warn', `Ignoring unreadable network-catalog overrides at ${path}: ${String(e)}`);
    return EMPTY;
  }
}

export function saveNetworkCatalogOverrides(path: string, overrides: NetworkCatalogOverrides): void {
  writeFileSync(path, JSON.stringify(overrides, null, 2));
}
