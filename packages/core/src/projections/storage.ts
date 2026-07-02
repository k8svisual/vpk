import { parseQuantity } from '../quantity';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

interface ClaimRefRaw {
  namespace?: string;
  name?: string;
  uid?: string;
}

export interface StoragePvEntry {
  pv: Resource;
  capacityBytes?: number;
  phase?: string;
  claimNamespace?: string;
  claimName?: string;
  pvcId?: ResourceId;
}

export interface StorageClassGroup {
  /** StorageClass name, or '' for PVs with no storageClassName (DESIGN §6.10: still shown, not dropped). */
  name: string;
  scId?: ResourceId;
  provisioner?: string;
  totalCapacityBytes: number;
  pvs: StoragePvEntry[];
}

/**
 * Storage mode 1 (DESIGN §6.10): SC → PV → PVC capacity hierarchy. Every StorageClass gets a group even with
 * zero PVs ("None used"); PVs with no storageClassName land in a synthetic '' group rather than being dropped.
 */
export function projectStorageHierarchy(graph: ResourceGraph): StorageClassGroup[] {
  const groups = new Map<string, StorageClassGroup>();
  const pvcByNsName = new Map<string, Resource>();

  for (const r of graph.nodes.values()) {
    if (r.kind === 'StorageClass') {
      groups.set(r.name, {
        name: r.name,
        scId: r.id,
        provisioner: r.raw.provisioner as string | undefined,
        totalCapacityBytes: 0,
        pvs: [],
      });
    } else if (r.kind === 'PersistentVolumeClaim') {
      pvcByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);
    }
  }

  for (const pv of graph.nodes.values()) {
    if (pv.kind !== 'PersistentVolume') continue;
    const spec = pv.raw.spec as
      | { storageClassName?: string; capacity?: { storage?: string }; claimRef?: ClaimRefRaw }
      | undefined;
    const scName = spec?.storageClassName ?? '';
    let group = groups.get(scName);
    if (!group) {
      group = { name: scName, totalCapacityBytes: 0, pvs: [] };
      groups.set(scName, group);
    }

    const capacityBytes = parseQuantity(spec?.capacity?.storage);
    const claimRef = spec?.claimRef;
    const pvc = claimRef?.uid
      ? graph.nodes.get(claimRef.uid)
      : claimRef?.name
        ? pvcByNsName.get(`${claimRef.namespace ?? ''}/${claimRef.name}`)
        : undefined;

    group.pvs.push({
      pv,
      capacityBytes,
      phase: (pv.raw.status as { phase?: string } | undefined)?.phase,
      claimNamespace: claimRef?.namespace,
      claimName: claimRef?.name,
      pvcId: pvc?.id,
    });
    group.totalCapacityBytes += capacityBytes ?? 0;
  }

  for (const g of groups.values()) g.pvs.sort((a, b) => a.pv.name.localeCompare(b.pv.name));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
