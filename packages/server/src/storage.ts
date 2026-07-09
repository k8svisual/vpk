import { projectStorageHierarchy, type ResourceGraph } from '@vpk/core';

/** Lean DTO for the Storage (SC -> CSIDriver, PV -> PVC -> Pod, PV -> VolumeAttachment -> CSIDriver) view — no
 *  raw payloads over the wire. */
export interface StorageGroupDto {
  name: string;
  scId?: string;
  provisioner?: string;
  csiDriverId?: string;
  csiDriverName?: string;
  totalCapacityBytes: number;
  pvs: {
    id: string;
    name: string;
    capacityBytes?: number;
    phase?: string;
    claimNamespace?: string;
    claimName?: string;
    pvcId?: string;
    pods: { id: string; name: string; namespace?: string }[];
    volumeAttachmentId?: string;
    volumeAttachmentName?: string;
    volumeAttachmentCsiDriverId?: string;
    volumeAttachmentCsiDriverName?: string;
  }[];
}

export function listStorageGroups(graph: ResourceGraph): StorageGroupDto[] {
  return projectStorageHierarchy(graph).map((g) => ({
    name: g.name,
    scId: g.scId,
    provisioner: g.provisioner,
    csiDriverId: g.csiDriverId,
    csiDriverName: g.csiDriverName,
    totalCapacityBytes: g.totalCapacityBytes,
    pvs: g.pvs.map((p) => ({
      id: p.pv.id,
      name: p.pv.name,
      capacityBytes: p.capacityBytes,
      phase: p.phase,
      claimNamespace: p.claimNamespace,
      claimName: p.claimName,
      pvcId: p.pvcId,
      pods: p.pods,
      volumeAttachmentId: p.volumeAttachmentId,
      volumeAttachmentName: p.volumeAttachmentName,
      volumeAttachmentCsiDriverId: p.volumeAttachmentCsiDriverId,
      volumeAttachmentCsiDriverName: p.volumeAttachmentCsiDriverName,
    })),
  }));
}
