import { projectStorageHierarchy, type ResourceGraph } from '@vpk/core';

/** Lean DTO for the Storage (SC -> PV -> PVC) view — no raw payloads over the wire. */
export interface StorageGroupDto {
  name: string;
  scId?: string;
  provisioner?: string;
  totalCapacityBytes: number;
  pvs: {
    id: string;
    name: string;
    capacityBytes?: number;
    phase?: string;
    claimNamespace?: string;
    claimName?: string;
    pvcId?: string;
  }[];
}

export function listStorageGroups(graph: ResourceGraph): StorageGroupDto[] {
  return projectStorageHierarchy(graph).map((g) => ({
    name: g.name,
    scId: g.scId,
    provisioner: g.provisioner,
    totalCapacityBytes: g.totalCapacityBytes,
    pvs: g.pvs.map((p) => ({
      id: p.pv.id,
      name: p.pv.name,
      capacityBytes: p.capacityBytes,
      phase: p.phase,
      claimNamespace: p.claimNamespace,
      claimName: p.claimName,
      pvcId: p.pvcId,
    })),
  }));
}
