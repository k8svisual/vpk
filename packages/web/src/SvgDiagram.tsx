import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';

const TOOLTIP_VIEWPORT_MARGIN = 8;
const TOOLTIP_GAP = 6;
const TOOLTIP_SHOW_DELAY_MS = 150;

/**
 * Renders a server-generated SVG string inline and wires the shared delegation contract every server-SVG view
 * uses: `data-resource-id` clicks → `onSelect` (with optional `data-focus-path`), `data-names` hover → a
 * clamped tooltip. Extracted from RbacView so Network diagrams (and future SVG views) don't re-implement it.
 */
export function SvgDiagram({
  svg,
  onSelect,
  onNodeClick,
  onEndpointSlicesClick,
}: {
  svg: string;
  onSelect: (id: string, focusPath?: (string | number)[]) => void;
  /** When set, a click on an element carrying `data-node-pods` calls this (with its id + `data-names[0]`)
   *  instead of `onSelect` — used by the topology diagram to open a Node's full pod-list modal. */
  onNodeClick?: (id: string, name: string) => void;
  /** When set, a click on an element carrying `data-eps-modal` calls this (with the Service's id + name, since
   *  there's no single EndpointSlice id to point at) instead of `onSelect` — used by the Ingress Path diagram
   *  to open a modal listing every EndpointSlice backing that Service, when there's more than one. */
  onEndpointSlicesClick?: (serviceId: string, serviceName: string) => void;
}) {
  const [hovered, setHovered] = useState<{ el: Element; names: string[] } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

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
    if (onNodeClick && node?.getAttribute('data-node-pods')) {
      // `data-node-name` carries the bare name (data-names now leads with the resource type for the tooltip).
      const name = node.getAttribute('data-node-name') ?? id;
      onNodeClick(id, name);
      return;
    }
    if (onEndpointSlicesClick && node?.getAttribute('data-eps-modal')) {
      const name = node.getAttribute('data-eps-name') ?? id;
      onEndpointSlicesClick(id, name);
      return;
    }
    const focusPathAttr = node?.getAttribute('data-focus-path');
    onSelect(id, focusPathAttr ? (JSON.parse(focusPathAttr) as (string | number)[]) : undefined);
  }

  return (
    <>
      <div onClick={onClick} onMouseOver={onMouseOver} onMouseOut={onMouseOut} dangerouslySetInnerHTML={{ __html: svg }} />
      {hovered && (
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
      )}
    </>
  );
}
