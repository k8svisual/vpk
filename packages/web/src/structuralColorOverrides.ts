/** Color overrides for the 3D Wheel's "structural" elements — things the wheel draws that aren't backed by a
 *  real Kubernetes API object, so they don't fit KIND_COLOR (kindColorOverrides.ts) or the API-group panes
 *  (apiGroupColorOverrides.ts). The Control Plane ring/kubelets/kube-proxies/components/kubectl/image-registry
 *  stack are all synthetic scene decoration (a real cluster has no "Control Plane" resource to `kubectl get`);
 *  same for the CSI ring (a visual bus tying CSINode/CSIDriver together, not itself a resource — CSINode and
 *  CSIDriver's own dots already use their real Kind color via kindColorOverrides.ts, untouched here). */
export type StructuralColorKey =
  | 'controlPlaneRing'
  | 'kubeletKubeProxy'
  | 'apiServer'
  | 'scheduler'
  | 'controllerManager'
  | 'etcd'
  | 'kubectl'
  | 'imageRegistries'
  | 'csiRing';

/** One source of truth for label + default color, so Scene3D.tsx's render sites and SettingsModal.tsx's
 *  picker both pull from here instead of each keeping their own copy of the same hex (mirrors FilterPanel.tsx's
 *  CONTROL_PLANE_COLOR/etc, which these defaults match exactly — kept in sync manually, same as every other
 *  "duplicated per the thin-client convention" constant in this package). */
export const STRUCTURAL_COLORS: { key: StructuralColorKey; label: string; defaultColor: string }[] = [
  { key: 'controlPlaneRing', label: 'Control Plane Ring', defaultColor: '#8b7ab8' },
  { key: 'kubeletKubeProxy', label: 'Kubelet & Kube-Proxy', defaultColor: '#6f5aa3' },
  { key: 'apiServer', label: 'API Server', defaultColor: '#4e3d75' },
  { key: 'scheduler', label: 'Scheduler', defaultColor: '#4e3d75' },
  { key: 'controllerManager', label: 'Controller Manager', defaultColor: '#4e3d75' },
  { key: 'etcd', label: 'etcd', defaultColor: '#4e3d75' },
  { key: 'kubectl', label: 'kubectl', defaultColor: '#b39ddb' },
  { key: 'imageRegistries', label: 'Image Registries', defaultColor: '#7e57a3' },
  { key: 'csiRing', label: 'CSI Ring', defaultColor: '#e0908c' },
];

export function defaultStructuralColor(key: StructuralColorKey): string {
  return STRUCTURAL_COLORS.find((s) => s.key === key)?.defaultColor ?? '#999999';
}

const STORAGE_KEY = 'vpk-structural-color-overrides';

export function getStoredStructuralColorOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {}; // localStorage/JSON can throw in locked-down contexts or on corrupt data
  }
}

export function setStoredStructuralColorOverrides(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // best-effort — a failed write just means the choice won't survive a reload, not worth surfacing
  }
}

/** `fallback` is normally the caller's own already-known default (the same client-side constants FilterPanel's
 *  legend swatches use, e.g. CONTROL_PLANE_COLOR) — same pattern as resolveKindColor/resolveApiGroupColor. */
export function resolveStructuralColor(key: StructuralColorKey, fallback: string): string {
  const overrides = getStoredStructuralColorOverrides();
  return overrides[key] || fallback;
}
