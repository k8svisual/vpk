import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { MousePointerClick } from 'lucide-react';
import { ResourceListModal, type ResourceListItem } from './ResourceListModal';
import { SecretDecodeModal } from './SecretDecodeModal';
import { EmptyState } from './EmptyState';

const TOOLTIP_VIEWPORT_MARGIN = 8;
const TOOLTIP_GAP = 6;
const TOOLTIP_SHOW_DELAY_MS = 150;

interface PodOption {
  id: string;
  name: string;
  namespace?: string;
}

/**
 * Renders the server-generated schematic SVG (packages/server/src/render/schematicSvg.ts) — matches the
 * OwnerRef view's pattern: fetch SVG text, inline it, delegate clicks on data-resource-id up to the shared
 * selection bus. Replaces an earlier HTML/React card MVP (DESIGN §6.9 calls for real server-SVG rendering).
 * A multi-item group icon (e.g. "secret (4)") instead carries data-resource-list/data-kind — clicking it
 * opens a "Resources" list modal (own local state, not the shared selection bus) rather than jumping straight
 * to one instance, since the icon stands for the whole aggregate.
 *
 * Every resource icon carries a `data-names` payload (JSON array — one name for a single item, all of them
 * for an aggregate) instead of an always-visible name label under the icon; hovering shows them in a custom
 * tooltip matching the same look as the nav rail / header icon buttons' Tooltip component (that one is
 * children-based and can't wrap arbitrary nodes inside injected raw SVG, so this re-implements the same
 * delayed-show / viewport-clamped positioning logic against whichever `[data-names]` element is hovered).
 */
export function SchematicView({
  podId,
  onSelect,
  onViewRbac,
  onViewEvents,
  onReturn,
  manualNamespace,
  onManualNamespaceChange,
  manualPodId,
  onManualPodIdChange,
}: {
  podId: string | null;
  /** The optional second argument is a YAML path (e.g. ['spec', 'containers', 2] or ['status', 'conditions'])
   *  — set only for the Pod card's per-container rows and its Phase/Conditions area (see schematicSvg.ts's
   *  data-focus-path), so the editor opens scrolled straight to the field the user actually clicked instead of
   *  always landing on the Pod's generic default field. */
  onSelect: (id: string, focusPath?: (string | number)[]) => void;
  /** The Security box's "RBAC ▸" pill (schematicSvg's data-rbac-sa) routes here with the Pod's
   *  ServiceAccount id — opens the RBAC view scoped to that subject instead of an editor. */
  onViewRbac?: (saId: string) => void;
  /** The small purple "has Events" corner badge (schematicSvg's data-pod-events) routes here — opens the
   *  Events view pre-filtered to this exact Pod (by id, not just namespace/name — see EventsView's
   *  initialPodId doc comment for why the id matters) instead of an editor. */
  onViewEvents?: (namespace: string, podName: string, podId: string) => void;
  /** Shown as a "Return" pill when set — present only when Schematic was entered via the 3D view's "View
   *  Schematic" button, matching SearchView's onReturn (see App.tsx's searchScope/schematicFrom3D). */
  onReturn?: () => void;
  /** The manual Namespace→Pod picker's own selection (see the picker's doc comment) — owned by App.tsx, not
   *  local state here, so it SURVIVES this component unmounting when the user navigates away (e.g. via the
   *  RBAC "▸" pill or the Events badge) and remounting on Return. Local state here was lost on every such
   *  round-trip, leaving the picker blank and the schematic gone even though the user never asked to change
   *  Pods — this is the fix for that. */
  manualNamespace: string;
  onManualNamespaceChange: (namespace: string) => void;
  manualPodId: string;
  onManualPodIdChange: (podId: string) => void;
}) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  // Which of the two diagrams for this Pod is showing: the default "pod" (its place in the namespace/cluster —
  // owner chain, config/network/storage/security) or "containers" (the Pod opened up into its init/app/
  // ephemeral container detail cards + shared volumes). Reset to "pod" whenever the Pod itself changes.
  const [diagram, setDiagram] = useState<'pod' | 'containers'>('pod');
  // Container schematic interactive selection: which container's edges to draw (radio) and which volume's
  // storage-implementation sub-diagram to show (volume click). Both are re-sent as query params so the server
  // re-renders; cleared whenever the Pod or diagram changes.
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);
  const [resourceList, setResourceList] = useState<{ kind: string; items: ResourceListItem[] } | null>(null);
  const [decodeSecretId, setDecodeSecretId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ el: Element; names: string[] } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  // Manual Namespace → Pod picker, for the "arrived directly at this page" case (no onReturn — see onReturn's
  // own doc comment). Not used at all when entered from the 3D view: there, `podId` already names the exact
  // Pod that flow means to show, and the picker would just be a redundant, confusing second way to change it.
  // The selection itself (manualNamespace/manualPodId) is a controlled prop now — see its own doc comment.
  const [pods, setPods] = useState<PodOption[]>([]);

  // Depends on nothing but mount: whether `onReturn` is set at all is fixed for this component's whole
  // lifetime (App.tsx remounts SchematicView on every view change, so it never flips mid-mount).
  useEffect(() => {
    if (onReturn) return; // 3D-linked mode never needs the picker's data
    fetch('/resources')
      .then((r) => r.json() as Promise<{ id: string; kind: string; name: string; namespace?: string }[]>)
      .then((rows) => setPods(rows.filter((r) => r.kind === 'Pod').map((r) => ({ id: r.id, name: r.name, namespace: r.namespace }))))
      .catch(() => setPods([]));
  }, []);

  const namespaces = useMemo(
    () => [...new Set(pods.map((p) => p.namespace).filter((n): n is string => !!n))].sort(),
    [pods],
  );
  const podsInNamespace = useMemo(
    () => pods.filter((p) => p.namespace === manualNamespace).sort((a, b) => a.name.localeCompare(b.name)),
    [pods, manualNamespace],
  );

  // The Pod actually shown: the caller's `podId` when linked from 3D, otherwise whatever the picker has
  // selected — the incoming `podId` prop is ignored entirely in that mode (see the picker's own comment).
  const effectivePodId = onReturn ? podId : manualPodId || null;

  // Switching to a different Pod resets to the default "pod" diagram — the container view is a drill-in on a
  // specific Pod, not a mode the user means to keep as they pick different Pods. Also clears any container/
  // volume selection so a fresh Pod (or a return to the Pod diagram) starts with no edges/storage detail shown.
  useEffect(() => {
    setDiagram('pod');
    setSelectedContainer(null);
    setSelectedVolume(null);
  }, [effectivePodId]);
  useEffect(() => {
    setSelectedContainer(null);
    setSelectedVolume(null);
  }, [diagram]);

  useEffect(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    setHovered(null);
    if (!effectivePodId) {
      setSvg('');
      setError('');
      return;
    }
    let url: string;
    if (diagram === 'containers') {
      const params = new URLSearchParams({ id: effectivePodId });
      if (selectedContainer) params.set('container', selectedContainer);
      if (selectedVolume) params.set('volume', selectedVolume);
      url = `/container-schematic.svg?${params.toString()}`;
    } else {
      url = `/schematic.svg?id=${encodeURIComponent(effectivePodId)}`;
    }
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error('not found (not a Pod id in this snapshot)');
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
  }, [effectivePodId, diagram, selectedContainer, selectedVolume]);

  // Same placement algorithm as Tooltip.tsx: prefer below-and-centered on the anchor, flip above if that
  // would overflow the viewport's bottom, then clamp both axes so it's always fully on-screen.
  useLayoutEffect(() => {
    if (!hovered || !tipRef.current) {
      setTooltipPos(null);
      return;
    }
    const anchor = hovered.el.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();

    let top = anchor.bottom + TOOLTIP_GAP;
    if (top + tip.height > window.innerHeight - TOOLTIP_VIEWPORT_MARGIN) {
      top = anchor.top - tip.height - TOOLTIP_GAP;
    }
    top = Math.max(TOOLTIP_VIEWPORT_MARGIN, Math.min(top, window.innerHeight - tip.height - TOOLTIP_VIEWPORT_MARGIN));

    let left = anchor.left + anchor.width / 2 - tip.width / 2;
    left = Math.max(TOOLTIP_VIEWPORT_MARGIN, Math.min(left, window.innerWidth - tip.width - TOOLTIP_VIEWPORT_MARGIN));

    setTooltipPos({ top, left });
  }, [hovered]);

  function onMouseOver(e: MouseEvent<HTMLDivElement>) {
    const el = (e.target as Element).closest('[data-names]');
    if (!el || el === hovered?.el) return;
    if (showTimer.current) clearTimeout(showTimer.current);
    const namesAttr = el.getAttribute('data-names');
    if (!namesAttr) return;
    let names: string[];
    try {
      names = JSON.parse(namesAttr) as string[];
    } catch {
      return;
    }
    showTimer.current = setTimeout(() => setHovered({ el, names }), TOOLTIP_SHOW_DELAY_MS);
  }

  function onMouseOut(e: MouseEvent<HTMLDivElement>) {
    // Moving between an icon's own children (e.g. its <image>) fires mouseout/mouseover with the SAME
    // ancestor [data-names] element on both sides — only actually hide when truly leaving that element.
    const related = e.relatedTarget as Node | null;
    const el = (e.target as Element).closest('[data-names]');
    if (el && related && el.contains(related)) return;
    if (showTimer.current) clearTimeout(showTimer.current);
    setHovered(null);
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    // "View Container Schematic ▸" pill on the Pod card — switches this view to the container diagram (checked
    // before data-resource-id since the pill lives inside the Pod card's clickable group).
    const showContainers = (e.target as Element).closest('[data-show-containers]');
    if (showContainers) {
      setDiagram('containers');
      return;
    }
    // Container schematic selection — checked before data-resource-id (the radio/volume live inside cards that
    // also carry it) so a select never also opens the editor. Clicking the same one again toggles it off.
    const selContainer = (e.target as Element).closest('[data-select-container]');
    if (selContainer) {
      const name = selContainer.getAttribute('data-select-container');
      setSelectedContainer((prev) => (prev === name ? null : name));
      return;
    }
    const selVolume = (e.target as Element).closest('[data-select-volume]');
    if (selVolume) {
      const name = selVolume.getAttribute('data-select-volume');
      setSelectedVolume((prev) => (prev === name ? null : name));
      return;
    }
    const rbacNode = (e.target as Element).closest('[data-rbac-sa]');
    if (rbacNode) {
      const saId = rbacNode.getAttribute('data-rbac-sa');
      if (saId && onViewRbac) onViewRbac(saId);
      return;
    }
    const eventsNode = (e.target as Element).closest('[data-pod-events]');
    if (eventsNode) {
      const payloadAttr = eventsNode.getAttribute('data-pod-events');
      if (payloadAttr && onViewEvents) {
        const payload = JSON.parse(payloadAttr) as { id: string; namespace: string; podName: string };
        onViewEvents(payload.namespace, payload.podName, payload.id);
      }
      return;
    }
    const listNode = (e.target as Element).closest('[data-resource-list]');
    if (listNode) {
      const items = JSON.parse(listNode.getAttribute('data-resource-list') ?? '[]') as ResourceListItem[];
      const kind = listNode.getAttribute('data-kind') ?? '';
      setResourceList({ kind, items });
      return;
    }
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (!id) return;
    const focusPathAttr = node?.getAttribute('data-focus-path');
    onSelect(id, focusPathAttr ? (JSON.parse(focusPathAttr) as (string | number)[]) : undefined);
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
            onManualNamespaceChange(e.target.value);
            onManualPodIdChange(''); // the previously picked Pod almost certainly isn't in the new namespace
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
        pod
        <select
          value={manualPodId}
          onChange={(e) => onManualPodIdChange(e.target.value)}
          disabled={!manualNamespace}
          style={{ padding: '4px 8px', minWidth: 220 }}
        >
          <option value="">{manualNamespace ? 'Select…' : 'Select a namespace first'}</option>
          {podsInNamespace.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  // Two-diagram toggle (Pod ⇄ Containers) for the selected Pod — the app's established segmented-control
  // pattern (3D Field/Wheel, Container Images tree/table). Only meaningful once a Pod is actually selected.
  const diagramToggle = effectivePodId && (
    <div style={{ display: 'inline-flex', marginBottom: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--vpk-border)' }}>
      {(['pod', 'containers'] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDiagram(d)}
          style={{
            padding: '4px 12px',
            fontSize: 13,
            cursor: 'pointer',
            border: 'none',
            background: diagram === d ? 'var(--vpk-rail-active-bg)' : 'var(--vpk-surface)',
            color: diagram === d ? '#fff' : 'var(--vpk-fg)',
          }}
          title={d === 'pod' ? 'The Pod in its namespace/cluster' : 'Inside the Pod — init, app and ephemeral containers'}
        >
          {d === 'pod' ? 'Pod' : 'Containers'}
        </button>
      ))}
    </div>
  );

  const tooltip = hovered && (
    <div
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none fixed z-[200] max-w-[280px] whitespace-pre-line rounded px-2 py-1 text-xs shadow-lg"
      style={{
        top: tooltipPos?.top ?? -9999,
        left: tooltipPos?.left ?? -9999,
        visibility: tooltipPos ? 'visible' : 'hidden',
        background: 'var(--vpk-rail-bg)',
        color: 'var(--vpk-rail-fg-active)',
      }}
    >
      {hovered.names.join('\n')}
    </div>
  );

  if (!effectivePodId) {
    return (
      <>
        {returnPill}
        {picker}
        <EmptyState icon={MousePointerClick}>
          {onReturn ? 'Select a Pod (e.g. from Search) to view its schematic.' : 'Select a namespace, then a Pod, to view its schematic.'}
        </EmptyState>
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
        <div>{diagramToggle}</div>
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
      <div>{diagramToggle}</div>
      <div onClick={onClick} onMouseOver={onMouseOver} onMouseOut={onMouseOut} dangerouslySetInnerHTML={{ __html: svg }} />
      {tooltip}
      {resourceList && (
        <ResourceListModal
          kind={resourceList.kind}
          items={resourceList.items}
          onOpenDefinition={onSelect}
          onDecodeSecret={resourceList.kind === 'Secret' ? setDecodeSecretId : undefined}
          onClose={() => setResourceList(null)}
        />
      )}
      <SecretDecodeModal resourceId={decodeSecretId} onClose={() => setDecodeSecretId(null)} />
    </>
  );
}
