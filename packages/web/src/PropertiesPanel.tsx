import { useEffect, useState } from 'react';
import { iconUrlForKind } from './kindIcons';

interface ResourceInfo {
  kind: string;
  name: string;
  namespace: string;
}

const CLUSTER_LEVEL = 'ClusterLevel';

/**
 * Small persistent info popup for the 3D view, matching the legacy app's "Properties" slide-in: real
 * Kubernetes icon + kind + name + namespace, with an "Open Editor" drill to the full definition and (Pods
 * only) a "View Schematic" shortcut — rather than jumping straight to the full editor on every 3D click.
 * Independent of the selection ring: closing this panel does not clear the selection (matches legacy
 * `close3dPropSlideIn`, which never called `hideRing`).
 */
export function PropertiesPanel({
  resourceId,
  onOpenEditor,
  onViewSchematic,
  onClose,
}: {
  resourceId: string | null;
  onOpenEditor: () => void;
  onViewSchematic: () => void;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<ResourceInfo | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    setInfo(null);
    fetch(`/definition?id=${encodeURIComponent(resourceId)}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const obj = raw as { kind?: string; metadata?: { name?: string; namespace?: string } };
        setInfo({ kind: obj.kind ?? 'Resource', name: obj.metadata?.name ?? resourceId, namespace: obj.metadata?.namespace ?? CLUSTER_LEVEL });
      })
      .catch(() => setInfo(null));
  }, [resourceId]);

  if (!resourceId || !info) return null;

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
        <img src={iconUrlForKind(info.kind)} alt={info.kind} className="h-8 w-8" />
        <span className="font-semibold">{info.kind}</span>
      </div>
      <table className="mb-2 w-full">
        <tbody>
          <tr>
            <td className="pr-2 align-top font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
              Name
            </td>
            <td className="break-all">{info.name}</td>
          </tr>
          <tr>
            <td className="pr-2 align-top font-medium" style={{ color: 'var(--vpk-fg-muted)' }}>
              Namespace
            </td>
            <td className="break-all">{info.namespace}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onOpenEditor}
          className="cursor-pointer rounded border px-2 py-1"
          style={{ borderColor: 'var(--vpk-border)' }}
        >
          Open Editor
        </button>
        {info.kind === 'Pod' && (
          <button
            onClick={onViewSchematic}
            className="cursor-pointer rounded border px-2 py-1"
            style={{ borderColor: 'var(--vpk-border)' }}
          >
            View Schematic
          </button>
        )}
      </div>
    </div>
  );
}
