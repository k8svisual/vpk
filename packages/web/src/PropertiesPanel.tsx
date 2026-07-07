import { useEffect, useState } from 'react';
import { iconUrlForKind } from './kindIcons';

interface ResourceInfo {
  kind: string;
  name: string;
  namespace: string;
  /** True when `metadata.ownerReferences` is non-empty — drives whether "View OwnerRef" shows at all, since
   *  focusing the OwnerRef graph on a resource with no owner links of its own would just show that one
   *  isolated node. */
  hasOwnerRefs: boolean;
}

/** Mirrors @vpk/core's controlPlane.ts WheelInfoItem — the fields this popup actually reads from it. Scene3D
 *  resolves the full item (or builds the synthetic Control-Plane-ring card) and passes it down directly, so
 *  none of these need a `/definition` fetch to describe themselves the way a real resource selection does. */
export interface WheelInfoItem {
  popupKind: 'kubelet' | 'kube-proxy' | 'kubectl' | 'control-plane-ring' | 'control-plane-component' | 'kind-summary' | 'image-registry';
  title: string;
  description?: string;
  resourceId?: string;
  kind?: string;
  count?: number;
}

const CLUSTER_LEVEL = 'ClusterLevel';

/** Marks a selection id as "this Node's local/ephemeral-storage cylinder" rather than the Node itself — the
 *  two share the same underlying Node id (WheelLocalStorage isn't a distinct K8s object, so it has no id of
 *  its own), so this is how the popup tells them apart and shows the dedicated "Node storage" card below
 *  instead of the generic Node definition. */
const LOCAL_STORAGE_SUFFIX = '::local-storage';

export function localStorageSelectionId(nodeId: string): string {
  return `${nodeId}${LOCAL_STORAGE_SUFFIX}`;
}

function parseLocalStorageSelectionId(resourceId: string): string | null {
  return resourceId.endsWith(LOCAL_STORAGE_SUFFIX) ? resourceId.slice(0, -LOCAL_STORAGE_SUFFIX.length) : null;
}

/** Small grey cylinder graphic — a simplified stand-in for the 3D local-storage mesh, not a real K8s kind icon
 *  (there isn't one: node-local storage isn't a distinct API object). */
function LocalStorageIcon() {
  return (
    <svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true">
      <path d="M2 10 L2 42 A18 9 0 0 0 38 42 L38 10" fill="#bcbcbc" stroke="#9a9a9a" />
      <ellipse cx="20" cy="42" rx="18" ry="9" fill="#9a9a9a" stroke="#8a8a8a" />
      <ellipse cx="20" cy="10" rx="18" ry="9" fill="#f0f0f0" stroke="#a8a8a8" />
    </svg>
  );
}

/** A purely decorative popup (Kubelet/Kube-Proxy/kubectl/Control-Plane ring) — no editor, no search, just the
 *  legacy app's static description text (which showed `<none>` for Name on these exact four). */
function DecorativeInfoPopup({ info, onClose }: { info: WheelInfoItem; onClose: () => void }) {
  return (
    <div
      className="absolute top-2 right-2 z-10 w-72 rounded border p-3 text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">{info.title}</span>
        <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
          Close
        </button>
      </div>
      {info.description && <p>{info.description}</p>}
    </div>
  );
}

/** API Server/Scheduler/Controller Manager/etcd — description always shown; Name + "View source" only appear
 *  when a real ComponentStatus object backs this one (see @vpk/core's controlPlane.ts — API Server never has
 *  one, the other three do whenever the cluster's ComponentStatus API is populated). */
function ControlPlaneComponentPopup({
  info,
  onOpenEditor,
  onClose,
}: {
  info: WheelInfoItem;
  onOpenEditor: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(null);
    if (!info.resourceId) return;
    fetch(`/definition?id=${encodeURIComponent(info.resourceId)}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const obj = raw as { metadata?: { name?: string } };
        setName(obj.metadata?.name ?? info.resourceId ?? null);
      })
      .catch(() => setName(null));
  }, [info.resourceId]);

  return (
    <div
      className="absolute top-2 right-2 z-10 w-72 rounded border p-3 text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">{info.title}</span>
        <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
          Close
        </button>
      </div>
      {info.description && <p className="mb-2">{info.description}</p>}
      {info.resourceId ? (
        name && (
          <>
            <p className="mb-2">
              <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
                Name:{' '}
              </span>
              {name}
            </p>
            <button onClick={onOpenEditor} className="cursor-pointer rounded border px-2 py-1" style={{ borderColor: 'var(--vpk-border)' }}>
              View source
            </button>
          </>
        )
      ) : (
        <p className="italic" style={{ color: 'var(--vpk-fg-muted)' }}>
          No backing resource on this cluster to open.
        </p>
      )}
    </div>
  );
}

/** A resource-pane sphere — one per Kind, not per instance, so there's no single object to open. Shows the
 *  real instance count and a Search button scoped to that Kind (there's no "definition" to view directly). */
function KindSummaryPopup({ info, onSearchKind, onClose }: { info: WheelInfoItem; onSearchKind: (kind: string) => void; onClose: () => void }) {
  return (
    <div
      className="absolute top-2 right-2 z-10 w-72 rounded border p-3 text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Kind: {info.title}</span>
        <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
          Close
        </button>
      </div>
      <p className="mb-3">
        <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
          Count:{' '}
        </span>
        {info.count ?? 0}
      </p>
      <button
        onClick={() => onSearchKind(info.kind ?? info.title)}
        className="w-full cursor-pointer rounded px-2 py-1.5 font-medium text-white"
        style={{ background: 'var(--vpk-rail-active-bg)' }}
      >
        Search
      </button>
    </div>
  );
}

/** The green image-registry stack — shows the registry hostname and how many container references use it. */
function ImageRegistryPopup({
  info,
  onViewRepository,
  onClose,
}: {
  info: WheelInfoItem;
  onViewRepository: (registry: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-2 right-2 z-10 w-72 rounded border p-3 text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Registry</span>
        <button onClick={onClose} className="cursor-pointer rounded border px-1.5 py-0.5" style={{ borderColor: 'var(--vpk-border)' }}>
          Close
        </button>
      </div>
      <p className="mb-1">
        <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
          Name:{' '}
        </span>
        {info.title}
      </p>
      <p className="mb-3">
        <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
          Use count:{' '}
        </span>
        {info.count ?? 0}
      </p>
      <button
        onClick={() => onViewRepository(info.kind ?? info.title)}
        className="w-full cursor-pointer rounded px-2 py-1.5 font-medium text-white"
        style={{ background: 'var(--vpk-rail-active-bg)' }}
      >
        View Repository
      </button>
    </div>
  );
}

/**
 * Small persistent info popup for the 3D view, matching the legacy app's "Properties" slide-in: real
 * Kubernetes icon + kind + name + namespace, with a "View source" drill to the full definition and (Pods
 * only) a "View Schematic" shortcut — rather than jumping straight to the full editor on every 3D click.
 * Independent of the selection ring: closing this panel does not clear the selection (matches legacy
 * `close3dPropSlideIn`, which never called `hideRing`).
 */
export function PropertiesPanel({
  resourceId,
  info,
  onOpenEditor,
  onViewSchematic,
  onViewOwnerRef,
  onSearchKind,
  onViewRepository,
  onClose,
}: {
  resourceId: string | null;
  /** Set when `resourceId` is one of the Control Plane / resource-pane items Scene3D resolves directly from
   *  the wheel payload — takes priority over the generic `/definition` fetch below when present. */
  info?: WheelInfoItem | null;
  onOpenEditor: () => void;
  onViewSchematic: () => void;
  /** Jumps to the OwnerRef view focused on this specific resource (not the whole namespace) — only offered
   *  when the resource actually has owner links (see ResourceInfo.hasOwnerRefs). */
  onViewOwnerRef: (id: string) => void;
  onSearchKind: (kind: string) => void;
  /** The green image-registry stack's Properties popup routes "view its repositories" through the Container
   *  Images page, scoped to this registry hostname — there's no single instance to open, same idea as
   *  onSearchKind. */
  onViewRepository: (registry: string) => void;
  onClose: () => void;
}) {
  const localStorageNodeId = resourceId ? parseLocalStorageSelectionId(resourceId) : null;
  const [genericInfo, setGenericInfo] = useState<ResourceInfo | null>(null);
  const [nodeName, setNodeName] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId || info) return; // `info`-backed selections render straight from it, no fetch needed
    setGenericInfo(null);
    setNodeName(null);
    const lookupId = localStorageNodeId ?? resourceId;
    fetch(`/definition?id=${encodeURIComponent(lookupId)}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const obj = raw as { kind?: string; metadata?: { name?: string; namespace?: string; ownerReferences?: unknown[] } };
        if (localStorageNodeId) {
          setNodeName(obj.metadata?.name ?? localStorageNodeId);
        } else {
          setGenericInfo({
            kind: obj.kind ?? 'Resource',
            name: obj.metadata?.name ?? resourceId,
            namespace: obj.metadata?.namespace ?? CLUSTER_LEVEL,
            hasOwnerRefs: (obj.metadata?.ownerReferences?.length ?? 0) > 0,
          });
        }
      })
      .catch(() => {
        setGenericInfo(null);
        setNodeName(null);
      });
  }, [resourceId, info, localStorageNodeId]);

  if (!resourceId) return null;

  if (info) {
    switch (info.popupKind) {
      case 'kubelet':
      case 'kube-proxy':
      case 'kubectl':
      case 'control-plane-ring':
        return <DecorativeInfoPopup info={info} onClose={onClose} />;
      case 'control-plane-component':
        return <ControlPlaneComponentPopup info={info} onOpenEditor={onOpenEditor} onClose={onClose} />;
      case 'kind-summary':
        return <KindSummaryPopup info={info} onSearchKind={onSearchKind} onClose={onClose} />;
      case 'image-registry':
        return <ImageRegistryPopup info={info} onViewRepository={onViewRepository} onClose={onClose} />;
    }
  }

  if (localStorageNodeId) {
    if (!nodeName) return null;
    return (
      <div
        className="absolute top-2 right-2 z-10 w-72 rounded border p-3 text-xs shadow-lg"
        style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <LocalStorageIcon />
            <span
              className="italic"
              style={{ color: 'var(--vpk-fg-muted)' }}
              title="The Storage tab doesn't model node-local storage (configMap/emptyDir/secret/hostPath volumes) yet"
            >
              (Storage tab view not available yet)
            </span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded border px-1.5 py-0.5"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            Close
          </button>
        </div>
        <div className="mb-2 border-b pb-1 font-semibold" style={{ borderColor: 'var(--vpk-border)' }}>
          Node storage
        </div>
        <p className="mb-3">Storage defined at node i.e. configMap, emptyDir, secret, hostPath, etc.</p>
        <p className="mb-3">
          <span className="font-semibold">Node name:</span> {nodeName}
        </p>
        <button
          disabled
          title="Storage tab view doesn't cover node-local storage yet — nothing to open"
          className="w-full cursor-not-allowed rounded px-2 py-1.5 font-medium text-white opacity-45"
          style={{ background: 'var(--vpk-rail-active-bg)' }}
        >
          Storage
        </button>
      </div>
    );
  }

  if (!genericInfo) return null;

  return (
    <div
      className="absolute top-2 right-2 z-10 w-64 rounded border p-3 text-xs shadow-lg"
      style={{ background: 'var(--vpk-surface)', borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
          Properties
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer rounded border px-1.5 py-0.5"
          style={{ borderColor: 'var(--vpk-border)' }}
        >
          Close
        </button>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <img src={iconUrlForKind(genericInfo.kind)} alt={genericInfo.kind} className="h-8 w-8" />
        <span className="font-semibold">{genericInfo.kind}</span>
      </div>
      <table className="mb-2 w-full">
        <tbody>
          <tr>
            <td className="pr-2 align-top font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
              Name
            </td>
            <td className="break-all">{genericInfo.name}</td>
          </tr>
          <tr>
            <td className="pr-2 align-top font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
              Namespace
            </td>
            <td className="break-all">{genericInfo.namespace}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onOpenEditor}
          className="cursor-pointer rounded border px-2 py-1"
          style={{ borderColor: 'var(--vpk-border)' }}
        >
          View source
        </button>
        {genericInfo.kind === 'Pod' && (
          <button
            onClick={onViewSchematic}
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            View Schematic
          </button>
        )}
        {genericInfo.hasOwnerRefs && (
          <button
            onClick={() => onViewOwnerRef(resourceId)}
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            View OwnerRef
          </button>
        )}
      </div>
    </div>
  );
}
