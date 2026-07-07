import { useEffect, useMemo, useState, type MouseEvent } from 'react';

interface ResourceOption {
  id: string;
  kind: string;
  name: string;
  namespace?: string;
}

/**
 * Renders the server-generated OwnerRef SVG (packages/server/src/render/ownerRefSvg.ts): fetch SVG text,
 * inline it, delegate clicks on data-resource-id up to the shared selection bus — same pattern as
 * SchematicView. Unlike Schematic (always exactly one Pod), OwnerRef's manual entry point is a two-step
 * Namespace → Resource picker (any resource that HAS owner refs, not just Pods), since "the whole namespace's
 * ownership graph" is often an enormous, illegible tangle for a real cluster — better to make the user name
 * one starting point and show its connected subgraph, same as the focused view 3D already uses.
 */
export function OwnerRefView({
  focusId,
  onSelect,
  onReturn,
  snapshotKey,
}: {
  /** A specific resource id to focus on — set when entered via the 3D view's "View OwnerRef" button. */
  focusId?: string | null;
  onSelect: (id: string) => void;
  /** Shown as a "Return" pill when set — present only when entered FROM the 3D view (mirrors focusId). */
  onReturn?: () => void;
  /** Resets the manual picker when the loaded snapshot changes — a previously chosen resource id is almost
   *  certainly stale (may not even exist) in a different snapshot. */
  snapshotKey: string;
}) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  // Manual Namespace → Resource picker, for the "arrived directly at this page" case (no onReturn — see its
  // own doc comment). Not used at all when entered from the 3D view: there, `focusId` already names the exact
  // resource that flow means to show.
  const [ownedResources, setOwnedResources] = useState<ResourceOption[]>([]);
  const [manualNamespace, setManualNamespace] = useState('');
  const [manualResourceId, setManualResourceId] = useState('');

  useEffect(() => {
    if (onReturn) return; // 3D-linked mode never needs the picker's data
    fetch('/resources')
      .then((r) => r.json() as Promise<{ id: string; kind: string; name: string; namespace?: string; hasOwnerRefs: boolean }[]>)
      .then((rows) =>
        setOwnedResources(rows.filter((r) => r.hasOwnerRefs).map((r) => ({ id: r.id, kind: r.kind, name: r.name, namespace: r.namespace }))),
      )
      .catch(() => setOwnedResources([]));
  }, []);

  // A different snapshot's resource ids are unrelated to this one's — start the picker over rather than
  // pointing at (or silently 404-ing on) a stale selection.
  useEffect(() => {
    setManualNamespace('');
    setManualResourceId('');
  }, [snapshotKey]);

  const namespaces = useMemo(
    () => [...new Set(ownedResources.map((r) => r.namespace).filter((n): n is string => !!n))].sort(),
    [ownedResources],
  );
  const resourcesInNamespace = useMemo(
    () =>
      ownedResources
        .filter((r) => r.namespace === manualNamespace)
        .sort((a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind)),
    [ownedResources, manualNamespace],
  );

  // The resource actually shown: the caller's `focusId` when linked from 3D, otherwise whatever the picker
  // has selected — matching SchematicView's effectivePodId pattern exactly.
  const effectiveFocusId = onReturn ? focusId : manualResourceId || null;

  useEffect(() => {
    if (!effectiveFocusId) {
      setSvg('');
      setError('');
      return;
    }
    fetch(`/ownerref?id=${encodeURIComponent(effectiveFocusId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not found in this snapshot');
        return r.text();
      })
      .then((text) => {
        setSvg(text);
        setError('');
      })
      .catch((e: unknown) => {
        setSvg('');
        setError(String(e));
      });
  }, [effectiveFocusId]);

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (id) onSelect(id);
  }

  const returnPill = onReturn && (
    <button
      onClick={onReturn}
      style={{
        marginBottom: 10,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid #999',
        cursor: 'pointer',
        background: '#fff',
        fontSize: 13,
      }}
    >
      ← Return to 3D view
    </button>
  );

  const picker = !onReturn && (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--vpk-fg-muted)' }}>
        namespace
        <select
          value={manualNamespace}
          onChange={(e) => {
            setManualNamespace(e.target.value);
            setManualResourceId(''); // the previously picked resource almost certainly isn't in the new namespace
          }}
          style={{ padding: '4px 8px' }}
        >
          <option value="">Select…</option>
          {namespaces.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--vpk-fg-muted)' }}>
        resource
        <select
          value={manualResourceId}
          onChange={(e) => setManualResourceId(e.target.value)}
          disabled={!manualNamespace}
          style={{ padding: '4px 8px', minWidth: 260 }}
        >
          <option value="">{manualNamespace ? 'Select…' : 'Select a namespace first'}</option>
          {resourcesInNamespace.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.kind})
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  if (!effectiveFocusId) {
    return (
      <>
        {returnPill}
        {picker}
        <p className="text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>
          {onReturn
            ? 'Select a resource (e.g. from Search) to view its ownership graph.'
            : 'Select a namespace, then a resource, to view its ownership graph.'}
        </p>
      </>
    );
  }
  if (error) {
    return (
      <>
        {returnPill}
        {picker}
        <p className="text-sm" style={{ color: 'var(--vpk-status-error)' }}>
          {error}
        </p>
      </>
    );
  }
  if (!svg) {
    return (
      <>
        {returnPill}
        {picker}
        <p className="text-sm" style={{ color: 'var(--vpk-fg-muted)' }}>
          loading…
        </p>
      </>
    );
  }

  return (
    <>
      {returnPill}
      {picker}
      <div onClick={onClick} dangerouslySetInnerHTML={{ __html: svg }} />
    </>
  );
}
