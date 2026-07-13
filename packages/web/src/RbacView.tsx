import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { MousePointerClick } from 'lucide-react';
import { EmptyState } from './EmptyState';

const TOOLTIP_VIEWPORT_MARGIN = 8;
const TOOLTIP_GAP = 6;
const TOOLTIP_SHOW_DELAY_MS = 150;

interface SubjectOption {
  kind: string;
  name: string;
  namespace?: string;
}

/** `kind|namespace|name` — the dropdown's value AND the /rbac.svg query identity, kept as one string. */
function subjectKey(s: SubjectOption): string {
  return `${s.kind}|${s.namespace ?? ''}|${s.name}`;
}

/**
 * Standalone RBAC view: pick any subject the snapshot's bindings grant to (or arrive pre-scoped to a Pod's
 * ServiceAccount via the Schematic's "RBAC ▸" pill), and render the server-generated per-subject RBAC
 * schematic (packages/server/src/render/rbacSvg.ts). Same server-SVG delegation pattern as SchematicView:
 * fetch SVG text, inline it, route data-resource-id/data-focus-path clicks to the editor, and show the
 * data-names hover tooltip.
 */
export function RbacView({
  initialSaId,
  initialSubject,
  onSelect,
  onReturn,
  returnLabel,
  courseData = false,
}: {
  /** A ServiceAccount resource id to open with — set when entered via the Schematic's "RBAC ▸" pill. */
  initialSaId?: string;
  /** A subject identity to open with — set when entered via the Security view's "diagram" pill. Identity,
   *  not a resource id, because User/Group subjects have no backing resource in the snapshot at all. */
  initialSubject?: SubjectOption;
  onSelect: (id: string, focusPath?: (string | number)[]) => void;
  /** Shown as a "Return" pill when set — present only when entered FROM another view. */
  onReturn?: () => void;
  returnLabel?: string;
  /** Render the ISOLATED course capture instead of the global snapshot — fetches the /course/graphic/* twins
   *  of /security, /definition and /rbac.svg. Set only by the course cluster-view pop-out (ClusterViewPopout),
   *  reached via the Schematic pop-out's own "RBAC ▸" pill; the main app leaves it false. */
  courseData?: boolean;
}) {
  const securityUrl = courseData ? '/course/graphic/security' : '/security';
  const definitionUrl = courseData ? '/course/graphic/definition' : '/definition';
  const rbacSvgUrl = courseData ? '/course/graphic/rbac.svg' : '/rbac.svg';
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selected, setSelected] = useState('');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState<{ el: Element; names: string[] } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(securityUrl)
      .then((r) => r.json() as Promise<SubjectOption[]>)
      .then((list) => setSubjects(list.map((s) => ({ kind: s.kind, name: s.name, namespace: s.namespace }))))
      .catch(() => setSubjects([]));
  }, [securityUrl]);

  // Arriving from the Security view: the subject identity is already known — select it directly.
  useEffect(() => {
    if (initialSubject) setSelected(subjectKey(initialSubject));
  }, [initialSubject]);

  // Arriving from the Schematic: resolve the SA id to a subject identity so the dropdown reflects it too.
  useEffect(() => {
    if (!initialSaId) return;
    // Guards against a slower response for a PREVIOUS initialSaId landing after a newer one has already
    // started (e.g. a fast round-trip through Schematic's "RBAC ▸" pill for two different Pods).
    let cancelled = false;
    fetch(`${definitionUrl}?id=${encodeURIComponent(initialSaId)}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        if (cancelled) return;
        const obj = raw as { kind?: string; metadata?: { name?: string; namespace?: string } };
        if (obj.metadata?.name) {
          setSelected(subjectKey({ kind: obj.kind ?? 'ServiceAccount', name: obj.metadata.name, namespace: obj.metadata.namespace }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialSaId, definitionUrl]);

  useEffect(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    setHovered(null);
    if (!selected) {
      setSvg('');
      setError('');
      return;
    }
    const [kind, ns, name] = selected.split('|') as [string, string, string];
    // Guards against a slower response for a PREVIOUSLY-selected subject landing after a newer one has
    // already started — without this a fast switch through the subject dropdown can leave the diagram
    // showing the wrong subject's RBAC graph once the stale response finally lands.
    let cancelled = false;
    fetch(`${rbacSvgUrl}?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}&ns=${encodeURIComponent(ns)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('no RBAC bindings found for this subject in this snapshot');
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setSvg(text);
        setError('');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSvg('');
        setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selected, rbacSvgUrl]);

  useLayoutEffect(() => {
    if (!hovered || !tipRef.current) {
      setTooltipPos(null);
      return;
    }
    const anchor = hovered.el.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    let top = anchor.bottom + TOOLTIP_GAP;
    if (top + tip.height > window.innerHeight - TOOLTIP_VIEWPORT_MARGIN) top = anchor.top - tip.height - TOOLTIP_GAP;
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
    const related = e.relatedTarget as Node | null;
    const el = (e.target as Element).closest('[data-names]');
    if (el && related && el.contains(related)) return;
    if (showTimer.current) clearTimeout(showTimer.current);
    setHovered(null);
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const node = (e.target as Element).closest('[data-resource-id]');
    const id = node?.getAttribute('data-resource-id');
    if (!id) return;
    const focusPathAttr = node?.getAttribute('data-focus-path');
    onSelect(id, focusPathAttr ? (JSON.parse(focusPathAttr) as (string | number)[]) : undefined);
  }

  const byKind = new Map<string, SubjectOption[]>();
  for (const s of subjects) {
    const list = byKind.get(s.kind) ?? [];
    list.push(s);
    byKind.set(s.kind, list);
  }

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

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        {onReturn && (
          <button
            onClick={onReturn}
            style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #999', cursor: 'pointer', background: '#fff', fontSize: 13 }}
          >
            {returnLabel ?? '← Return'}
          </button>
        )}
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ fontSize: 12, maxWidth: 420 }}>
          <option value="">Select a subject ({subjects.length})</option>
          {[...byKind.entries()].map(([kind, list]) => (
            <optgroup key={kind} label={kind}>
              {list.map((s) => (
                <option key={subjectKey(s)} value={subjectKey(s)}>
                  {s.namespace ? `${s.namespace}/` : ''}
                  {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {!selected && <EmptyState icon={MousePointerClick}>Select a subject to view who granted it access and what it can do.</EmptyState>}
      {error && (
        <p className="text-sm" style={{ color: 'var(--vpk-status-error)' }}>
          {error}
        </p>
      )}
      {svg && <div onClick={onClick} onMouseOver={onMouseOver} onMouseOut={onMouseOut} dangerouslySetInnerHTML={{ __html: svg }} />}
      {tooltip}
    </div>
  );
}
