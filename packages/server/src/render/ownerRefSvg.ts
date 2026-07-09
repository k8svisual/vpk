import { cssKindVar, type OwnerRefView } from '@vpk/core';

/** Bright, high-contrast color for the focus-node halo — deliberately NOT a color any `colorForKind` fill
 *  uses (those are all pastel/muted), so it reads clearly as "this is the one you clicked" regardless of
 *  the focus resource's own Kind color. */
const FOCUS_COLOR = '#ff3b30';

/**
 * Render an ownerRef view to SVG, server-side (DESIGN §6.3). Layered top-down layout (owners on top),
 * each node tagged with `data-resource-id` for the thin-client click→drill. Fills use CSS variables
 * (`--vpk-kind-*`) with hex fallbacks so the client can re-theme without a server round-trip (§6.7).
 *
 * `focusId` — set when this view was opened for one specific resource (e.g. the 3D Properties popup's
 * "View OwnerRef" button, or a Pod's schematic) rather than browsing a whole namespace — that resource's
 * node gets a bold halo so it's unmistakable among the rest of its owner chain.
 */
export function renderOwnerRefSvg(view: OwnerRefView, focusId?: string): string {
  const W = 180;
  const H = 46;
  const HGAP = 26;
  const VGAP = 58;

  const ids = new Set(view.nodes.map((n) => n.id));
  const edges = view.edges.filter((e) => ids.has(e.from) && ids.has(e.to));

  const incoming = new Map<string, string[]>();
  for (const e of edges) push(incoming, e.to, e.from);

  const level = computeLevels(
    view.nodes.map((n) => n.id),
    incoming,
  );

  const byLevel = new Map<number, string[]>();
  for (const n of view.nodes) push(byLevel, level.get(n.id) ?? 0, n.id);

  const maxLevel = Math.max(0, ...byLevel.keys());
  const maxCols = Math.max(1, ...[...byLevel.values()].map((a) => a.length));

  const pos = new Map<string, { x: number; y: number }>();
  for (const [lvl, arr] of byLevel) {
    arr.forEach((id, i) => pos.set(id, { x: i * (W + HGAP) + HGAP, y: lvl * (H + VGAP) + VGAP }));
  }

  const svgW = maxCols * (W + HGAP) + HGAP;
  const svgH = (maxLevel + 1) * (H + VGAP) + VGAP;

  const edgeSvg = edges
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return '';
      return `<line class="orf-edge" x1="${a.x + W / 2}" y1="${a.y + H}" x2="${b.x + W / 2}" y2="${b.y}" />`;
    })
    .join('');

  const nodeSvg = view.nodes
    .map((n) => {
      const p = pos.get(n.id);
      if (!p) return '';
      const kind = n.kind || '?';
      const name = n.placeholder && !n.name ? '<not defined>' : n.name || '<unnamed>';
      const dash = n.placeholder ? ' stroke-dasharray="4 3"' : '';
      const isFocus = focusId !== undefined && n.id === focusId;
      // The halo is a second, larger rect drawn BEHIND the node's own rect (same rounded corners, no fill)
      // — a thicker stroke on the node's own rect alone reads as just "a slightly bolder box" next to its
      // neighbors; an outer ring at a clearly different radius is what actually reads as "singled out" at
      // a glance, independent of the node's own Kind color.
      const halo = isFocus
        ? `<rect x="-6" y="-6" width="${W + 12}" height="${H + 12}" rx="10" fill="none" stroke="${FOCUS_COLOR}" stroke-width="4" />`
        : '';
      const stroke = isFocus ? `stroke="${FOCUS_COLOR}" stroke-width="3"` : 'stroke="#00000033"';
      return (
        `<g class="orf-node" data-resource-id="${esc(n.id)}" data-kind="${esc(kind)}" transform="translate(${p.x},${p.y})">` +
        halo +
        `<rect width="${W}" height="${H}" rx="6" style="fill:${cssKindVar(kind)}" ${stroke}${dash} />` +
        `<text class="orf-name" x="10" y="20">${esc(clip(name, 26))}</text>` +
        `<text class="orf-kind" x="10" y="37">(${esc(kind)})</text>` +
        `</g>`
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" font-family="system-ui, sans-serif">` +
    `<style>.orf-edge{stroke:var(--vpk-edge,#8a8a8a);stroke-width:1.2}.orf-name{fill:#fff;font-size:12px}.orf-kind{fill:#ffffffcc;font-size:10px}</style>` +
    edgeSvg +
    nodeSvg +
    `</svg>`
  );
}

/** Longest-path level from roots (nodes with no incoming edge); cycle-safe. */
function computeLevels(ids: readonly string[], incoming: Map<string, string[]>): Map<string, number> {
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const dfs = (id: string): number => {
    const cached = level.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // break cycle
    visiting.add(id);
    let lv = 0;
    for (const p of incoming.get(id) ?? []) lv = Math.max(lv, dfs(p) + 1);
    visiting.delete(id);
    level.set(id, lv);
    return lv;
  };
  for (const id of ids) dfs(id);
  return level;
}

function push<T>(map: Map<T, string[]>, key: T, value: string): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
