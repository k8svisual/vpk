import { parseQuantity } from '../quantity';
import type { ResourceGraph } from '../graph';
import type { ResourceId } from '../identity';
import type { Resource } from '../types';

interface ClaimRefRaw {
  namespace?: string;
  name?: string;
  uid?: string;
}

export interface StoragePodEntry {
  id: ResourceId;
  name: string;
  namespace?: string;
}

export interface StoragePvEntry {
  pv: Resource;
  capacityBytes?: number;
  phase?: string;
  claimNamespace?: string;
  claimName?: string;
  pvcId?: ResourceId;
  /** Pods mounting the resolved PVC (via pod.spec.volumes[].persistentVolumeClaim.claimName), the last hop of
   *  the CSIDriver<-VolumeAttachment<-PV<-PVC<-Pod / StorageClass<-CSIDriver<-PV chain the user asked to see. */
  pods: StoragePodEntry[];
  /** The VolumeAttachment that CSI-attaches this PV to a Node, via spec.source.persistentVolumeName — a
   *  sibling branch off the PV, not chained through StorageClass (mirrors wheel.ts's pvToVolumeAttachmentId). */
  volumeAttachmentId?: ResourceId;
  volumeAttachmentName?: string;
  /** The VolumeAttachment's own CSIDriver, via spec.attacher — resolved independently of the StorageClass's
   *  CSIDriver (mirrors wheel.ts's volumeAttachmentToCsiDriverId; the common case is the same driver). */
  volumeAttachmentCsiDriverId?: ResourceId;
  volumeAttachmentCsiDriverName?: string;
}

export interface StorageClassGroup {
  /** StorageClass name, or '' for PVs with no storageClassName (DESIGN §6.10: still shown, not dropped). */
  name: string;
  scId?: ResourceId;
  provisioner?: string;
  /** The StorageClass's CSIDriver, via provisioner matched against a CSIDriver's name (CSI spec convention —
   *  mirrors wheel.ts's storageClassToCsiDriverId). Built-in non-CSI provisioners resolve to none. */
  csiDriverId?: ResourceId;
  csiDriverName?: string;
  totalCapacityBytes: number;
  pvs: StoragePvEntry[];
}

/**
 * Storage mode 1 (DESIGN §6.10): SC → CSIDriver, PV → PVC → Pod, PV → VolumeAttachment → CSIDriver capacity
 * hierarchy. Every StorageClass gets a group even with zero PVs ("None used"); PVs with no storageClassName
 * land in a synthetic '' group rather than being dropped.
 */
export function projectStorageHierarchy(graph: ResourceGraph): StorageClassGroup[] {
  const groups = new Map<string, StorageClassGroup>();
  const pvcByNsName = new Map<string, Resource>();
  const csiDriverByName = new Map<string, Resource>();
  const volumeAttachmentByPvName = new Map<string, Resource>();
  const podsByPvcNsName = new Map<string, StoragePodEntry[]>();

  for (const r of graph.nodes.values()) {
    if (r.kind === 'CSIDriver') {
      csiDriverByName.set(r.name, r);
    } else if (r.kind === 'VolumeAttachment') {
      const pvName = (r.raw.spec as { source?: { persistentVolumeName?: string } } | undefined)?.source
        ?.persistentVolumeName;
      if (pvName) volumeAttachmentByPvName.set(pvName, r);
    } else if (r.kind === 'PersistentVolumeClaim') {
      pvcByNsName.set(`${r.namespace ?? ''}/${r.name}`, r);
    } else if (r.kind === 'Pod') {
      const volumes = (r.raw.spec as { volumes?: { persistentVolumeClaim?: { claimName?: string } }[] } | undefined)
        ?.volumes;
      for (const v of volumes ?? []) {
        const claimName = v.persistentVolumeClaim?.claimName;
        if (!claimName) continue;
        const key = `${r.namespace ?? ''}/${claimName}`;
        const pods = podsByPvcNsName.get(key) ?? [];
        pods.push({ id: r.id, name: r.name, namespace: r.namespace });
        podsByPvcNsName.set(key, pods);
      }
    }
  }

  for (const r of graph.nodes.values()) {
    if (r.kind !== 'StorageClass') continue;
    const provisioner = r.raw.provisioner as string | undefined;
    const csiDriver = provisioner ? csiDriverByName.get(provisioner) : undefined;
    groups.set(r.name, {
      name: r.name,
      scId: r.id,
      provisioner,
      csiDriverId: csiDriver?.id,
      csiDriverName: csiDriver?.name,
      totalCapacityBytes: 0,
      pvs: [],
    });
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
    const pods = pvc ? (podsByPvcNsName.get(`${pvc.namespace ?? ''}/${pvc.name}`) ?? []) : [];

    const volumeAttachment = volumeAttachmentByPvName.get(pv.name);
    const vaAttacher = (volumeAttachment?.raw.spec as { attacher?: string } | undefined)?.attacher;
    const vaCsiDriver = vaAttacher ? csiDriverByName.get(vaAttacher) : undefined;

    group.pvs.push({
      pv,
      capacityBytes,
      phase: (pv.raw.status as { phase?: string } | undefined)?.phase,
      claimNamespace: claimRef?.namespace,
      claimName: claimRef?.name,
      pvcId: pvc?.id,
      pods,
      volumeAttachmentId: volumeAttachment?.id,
      volumeAttachmentName: volumeAttachment?.name,
      volumeAttachmentCsiDriverId: vaCsiDriver?.id,
      volumeAttachmentCsiDriverName: vaCsiDriver?.name,
    });
    group.totalCapacityBytes += capacityBytes ?? 0;
  }

  for (const g of groups.values()) g.pvs.sort((a, b) => a.pv.name.localeCompare(b.pv.name));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
