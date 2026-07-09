import { iconForKind, networkIconBg } from '@vpk/core';
import type { ServiceNetworkView, NetworkTopology, NetworkPlane, NetworkEdge, DiagramPod } from '@vpk/core';

/**
 * Server-side SVG renderers for the data-bound Network diagrams (DESIGN §6.10). Same visual grammar as
 * rbacSvg/schematicSvg: real k8s icons carrying `data-resource-id` (click → editor) + `data-names` (hover
 * tooltip), solid arrowed edges, neutral boxes. Facts a snapshot can't carry (overlay type, data-plane
 * mechanism, absent CIDRs) are drawn as explicitly generic/greyed labels, never as if they were real values.
 */

const ICON_R = 18;
const ICON_BASE = '/icons/k8/';
const EDGE = '#4a4a4a';
const MUTED = '#8a8a86';
const BOX_STROKE = '#333';
const PODS_PER_ROW = 5;

// ---- shared helpers -------------------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c);
}
function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
/** An icon drawn on a circular badge whose fill matches the 3D wheel's color for that kind (Worker-node color
 *  for Node, the wheel kind color for wheel-drawn kinds, light grey otherwise) — same identity cue as the
 *  wheel/OwnerRef/Storage badges. */
function icon(kind: string, cx: number, cy: number, r = ICON_R): string {
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="${networkIconBg(kind)}" />` +
    `<image href="${ICON_BASE}${iconForKind(kind)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" />`
  );
}
/** The `data-names` tooltip payload for a resource node: the resource type on the first line, its name on the
 *  second (SvgDiagram joins the array with newlines). */
function tip(kind: string, name: string): string {
  return esc(JSON.stringify([kind, name]));
}
/** A clickable icon+label group (label centered below), wired to the shared select/tooltip delegation. */
function iconNode(kind: string, id: string | undefined, name: string, cx: number, cy: number, r = ICON_R): string {
  const attrs = `${id ? ` data-resource-id="${esc(id)}"` : ''} data-names="${tip(kind, name)}" style="cursor:${id ? 'pointer' : 'default'}"`;
  return `<g${attrs}>${icon(kind, cx, cy, r)}<text class="n-lbl" x="${cx}" y="${cy + r + 13}" text-anchor="middle">${esc(clip(name, 22))}</text></g>`;
}
function box(x: number, y: number, w: number, h: number, opts: { fill?: string; dashed?: boolean; stroke?: string } = {}): string {
  const dash = opts.dashed ? ' stroke-dasharray="4 3"' : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${opts.fill ?? '#fff'}" stroke="${opts.stroke ?? BOX_STROKE}" stroke-width="1.2"${dash} />`;
}
function vArrow(x: number, y1: number, y2: number): string {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${EDGE}" stroke-width="1.4" marker-end="url(#net-arrow)" />`;
}
function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${EDGE}" stroke-width="1.3" />`;
}
function text(cls: string, x: number, y: number, s: string, anchor = 'start'): string {
  return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
}
function frame(w: number, h: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="system-ui, sans-serif">` +
    `<defs><marker id="net-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${EDGE}" /></marker></defs>` +
    `<style>` +
    `.n-title{font-size:13px;font-weight:700;fill:#1f1f1d}` +
    `.n-lbl{font-size:10.5px;fill:#333}` +
    `.n-sub{font-size:10.5px;fill:#555}` +
    `.n-muted{font-size:10.5px;fill:${MUTED};font-style:italic}` +
    `.n-cap{font-size:11px;font-weight:600;fill:#444}` +
    `.n-ip{font-size:10px;fill:#2a5db0;font-family:ui-monospace,monospace}` +
    `</style>` +
    body +
    `</svg>`
  );
}

/** The pod fan-out shared by the Service-flow diagram: a horizontal bus under `busY` dropping to each pod
 *  node, wrapping every PODS_PER_ROW. Returns the drawn markup and the total height it consumed. */
function podFan(pods: DiagramPod[], centerX: number, busY: number, cap: number): { svg: string; height: number } {
  const shown = pods.slice(0, cap);
  const overflow = pods.length - shown.length;
  const colW = 150;
  const rowH = 82;
  const parts: string[] = [];
  const rows = Math.ceil(shown.length / PODS_PER_ROW) || 1;

  shown.forEach((p, i) => {
    const row = Math.floor(i / PODS_PER_ROW);
    const inRow = Math.min(PODS_PER_ROW, shown.length - row * PODS_PER_ROW);
    const startX = centerX - ((inRow - 1) * colW) / 2;
    const col = i % PODS_PER_ROW;
    const x = startX + col * colW;
    const y = busY + 34 + row * rowH;
    parts.push(line(x, busY, x, y - ICON_R));
    parts.push(iconNode('Pod', p.id, p.name, x, y));
    parts.push(text('n-ip', x, y + ICON_R + 27, p.podIp ?? '—', 'middle'));
    if (!p.ready) parts.push(text('n-muted', x, y + ICON_R + 39, 'not ready', 'middle'));
  });
  // one horizontal bus spanning the first row's spread
  const firstRowCount = Math.min(PODS_PER_ROW, shown.length) || 1;
  const busHalf = ((firstRowCount - 1) * colW) / 2;
  parts.unshift(line(centerX - busHalf, busY, centerX + busHalf, busY));
  let height = 34 + rows * rowH;
  if (overflow > 0) {
    parts.push(text('n-muted', centerX, busY + height, `+${overflow} more pods`, 'middle'));
    height += 18;
  }
  return { svg: parts.join(''), height };
}

// ---- Diagram 1: Client → Service → Pods -----------------------------------------------------------------

export function renderServiceFlowSvg(v: ServiceNetworkView): string {
  const W = Math.max(760, v.pods.slice(0, 15).length >= PODS_PER_ROW ? PODS_PER_ROW * 150 + 60 : 760);
  const cx = W / 2;
  const selector = Object.entries(v.selector).map(([k, val]) => `${k}=${val}`).join(', ') || '(none)';
  const parts: string[] = [];

  // Client
  parts.push(box(cx - 60, 16, 120, 30, { fill: '#f2f2f0' }));
  parts.push(text('n-title', cx, 36, 'Client', 'middle'));
  parts.push(vArrow(cx, 46, 70));

  // Service box
  const svcY = 74;
  const svcW = 360;
  const svcH = 96;
  parts.push(
    `<g data-resource-id="${esc(v.service.id)}" data-names="${tip('Service', v.service.name)}" style="cursor:pointer">` +
      box(cx - svcW / 2, svcY, svcW, svcH, { fill: '#eef3fb' }) +
      icon('Service', cx - svcW / 2 + 28, svcY + svcH / 2, 20) +
      text('n-title', cx - svcW / 2 + 56, svcY + 26, `Service: ${clip(v.service.name, 30)}`) +
      text('n-sub', cx - svcW / 2 + 56, svcY + 44, `ClusterIP: ${v.service.clusterIp ?? '—'}   ·   ${v.service.type}`) +
      text('n-sub', cx - svcW / 2 + 56, svcY + 62, `Selector: ${clip(selector, 40)}`) +
      text('n-sub', cx - svcW / 2 + 56, svcY + 80, `Ports: ${v.service.ports.map((p) => `${p.port}${p.protocol && p.protocol !== 'TCP' ? '/' + p.protocol : ''}`).join(', ') || '—'}`) +
      `</g>`,
  );

  const busY = svcY + svcH + 26;
  parts.push(vArrow(cx, svcY + svcH, busY - 2));
  if (v.pods.length === 0) {
    parts.push(text('n-muted', cx, busY + 20, 'no backing pods (Endpoints empty)', 'middle'));
    return frame(W, busY + 40, parts.join(''));
  }
  const fan = podFan(v.pods, cx, busY, 15);
  parts.push(fan.svg);
  return frame(W, busY + fan.height + 16, parts.join(''));
}

// ---- Diagram 2: External User → LB/Ingress → Service → EndpointSlice → Pods ------------------------------

export function renderIngressPathSvg(v: ServiceNetworkView, edge?: NetworkEdge): string {
  const W = 520;
  const cx = W / 2;
  const parts: string[] = [];
  let y = 16;

  // External user
  parts.push(box(cx - 70, y, 140, 30, { fill: '#f2f2f0' }));
  parts.push(text('n-title', cx, y + 20, 'External User', 'middle'));
  y += 30;
  // Inferred edge context on the External-User → LB hop: which LoadBalancer implementation fronts the cluster.
  if (edge?.loadBalancer.value) {
    const lbAttr = edge.loadBalancer.evidence ? ` data-names="${esc(JSON.stringify(['inferred from: ' + edge.loadBalancer.evidence]))}"` : '';
    parts.push(`<g${lbAttr}>${text('n-muted', cx + 12, y + 15, `LB: ${clip(edge.loadBalancer.value, 34)}`)}</g>`);
  }
  parts.push(vArrow(cx, y, y + 22));
  y += 22;

  // LoadBalancer / Ingress — real Ingress/Route if any, else generic greyed
  const ing = v.ingresses[0];
  const boxW = 300;
  if (ing) {
    parts.push(
      `<g data-resource-id="${esc(ing.id)}" data-names="${tip(ing.kind, ing.name)}" style="cursor:pointer">` +
        box(cx - boxW / 2, y, boxW, 52, { fill: '#fff' }) +
        icon(ing.kind, cx - boxW / 2 + 26, y + 26, 16) +
        text('n-lbl', cx - boxW / 2 + 48, y + 22, `${ing.kind}: ${clip(ing.name, 26)}`) +
        text('n-sub', cx - boxW / 2 + 48, y + 40, ing.host ? clip(ing.host, 36) : 'LoadBalancer / Ingress') +
        `</g>`,
    );
    if (v.ingresses.length > 1) parts.push(text('n-muted', cx + boxW / 2 - 8, y + 40, `+${v.ingresses.length - 1}`, 'end'));
  } else {
    parts.push(box(cx - boxW / 2, y, boxW, 52, { dashed: true }));
    parts.push(text('n-muted', cx, y + 24, 'LoadBalancer / Ingress', 'middle'));
    parts.push(text('n-muted', cx, y + 40, 'none found — direct ClusterIP access', 'middle'));
  }
  y += 52;
  // Inferred controller serving this ingress path (cluster-wide), shown as a caption beneath the node.
  if (edge?.ingress.value) {
    const inAttr = edge.ingress.evidence ? ` data-names="${esc(JSON.stringify(['inferred from: ' + edge.ingress.evidence]))}"` : '';
    parts.push(`<g${inAttr}>${text('n-muted', cx, y + 12, `served by: ${clip(edge.ingress.value, 40)}`, 'middle')}</g>`);
    y += 16;
  }
  parts.push(vArrow(cx, y, y + 22));
  y += 22;

  // Service
  const svcW = 320;
  parts.push(
    `<g data-resource-id="${esc(v.service.id)}" data-names="${tip('Service', v.service.name)}" style="cursor:pointer">` +
      box(cx - svcW / 2, y, svcW, 46, { fill: '#eef3fb' }) +
      icon('Service', cx - svcW / 2 + 26, y + 23, 16) +
      text('n-lbl', cx - svcW / 2 + 48, y + 19, `Service: ${clip(v.service.name, 26)}`) +
      text('n-sub', cx - svcW / 2 + 48, y + 37, `ClusterIP: ${v.service.clusterIp ?? '—'}`) +
      `</g>`,
  );
  y += 46;
  parts.push(vArrow(cx, y, y + 22));
  y += 22;

  // EndpointSlice — a category summary (no single backing resource id to link to), but still gets a hover
  // tooltip naming its type, same as every other icon in this diagram. The background box lives INSIDE the
  // same `<g data-names>` (not as a separate sibling rect) so hovering anywhere on the card — not just the
  // exact icon/text pixels — shows the tooltip.
  // EndpointSlice — usually exactly one real object, but Kubernetes splits into several when the endpoint
  // count exceeds a slice's own cap or per address family for dual-stack Services. When there's more than
  // one, the card becomes clickable (`data-eps-modal`) to open a modal listing every slice; SvgDiagram passes
  // the Service's id/name through since there's no single EndpointSlice id to point at.
  const epsBoxH = 44; // taller than the icon badge's own diameter (34) so it reads with real padding, not edge-to-edge
  const epsCount = v.endpointSlices.length;
  const epsLabel =
    epsCount === 1
      ? `EndpointSlice: ${clip(v.endpointSlices[0]!.name, 22)}`
      : epsCount > 1
        ? `EndpointSlice ×${epsCount} · ${v.pods.length} endpoint${v.pods.length === 1 ? '' : 's'}`
        : `EndpointSlice · ${v.pods.length} endpoint${v.pods.length === 1 ? '' : 's'}`;
  const epsAttrs =
    epsCount > 1
      ? ` data-resource-id="${esc(v.service.id)}" data-eps-modal="1" data-eps-name="${esc(v.service.name)}" style="cursor:pointer"`
      : '';
  parts.push(
    `<g data-names="${esc(JSON.stringify(['EndpointSlice']))}"${epsAttrs}>` +
      box(cx - 130, y, 260, epsBoxH, { fill: '#fff' }) +
      icon('EndpointSlice', cx - 108, y + epsBoxH / 2, 14) +
      text('n-lbl', cx - 88, y + epsBoxH / 2 + 4, epsLabel) +
      `</g>`,
  );
  y += epsBoxH;

  // Pods list — a single bordered card (not a floating icon+label pair) with a divider between rows, so each
  // pod reads as a distinct item and its name column has room to breathe before the right-aligned IP column
  // (previously the two could visually collide on longer pod names).
  const shown = v.pods.slice(0, 8);
  const overflow = v.pods.length - shown.length;
  const rowH = 34; // taller than the icon badge's own diameter (26) so each row has real padding around it
  const listW = 300;
  const listX0 = cx - listW / 2;
  const bodyH = 8 + shown.length * rowH + (overflow > 0 ? 20 : 0) + 6;
  parts.push(line(cx, y, cx, y + 12));
  y += 12;
  if (shown.length > 0) parts.push(box(listX0, y, listW, bodyH, { fill: '#fff' }));
  const rowsTop = y + 8;
  shown.forEach((p, i) => {
    const ry = rowsTop + i * rowH;
    if (i > 0) parts.push(`<line x1="${listX0 + 10}" y1="${ry}" x2="${listX0 + listW - 10}" y2="${ry}" stroke="#e4e4e0" stroke-width="1" />`);
    const rcy = ry + rowH / 2;
    parts.push(
      `<g data-resource-id="${esc(p.id)}" data-names="${tip('Pod', p.name)}" style="cursor:pointer">` +
        icon('Pod', listX0 + 22, rcy - 3, 10) +
        text('n-lbl', listX0 + 40, rcy + 3, clip(p.name, 18)) +
        text('n-ip', listX0 + listW - 14, rcy + 3, p.podIp ?? '—', 'end') +
        `</g>`,
    );
  });
  y = rowsTop + shown.length * rowH;
  if (overflow > 0) {
    parts.push(text('n-muted', listX0 + 40, y + 12, `+${overflow} more pods`));
    y += 20;
  }
  y += 6;
  return frame(W, y + 16, parts.join(''));
}

// ---- Diagram 4: Service → Nodes → Pods ------------------------------------------------------------------

export function renderServiceNodesSvg(v: ServiceNetworkView, plane?: NetworkPlane): string {
  const dataPlaneLabel = plane?.dataPlane.value ?? 'kube-proxy / IPVS / eBPF';
  const nodeW = 240;
  const gap = 30;
  const cols = Math.max(v.nodes.length, 1);
  const W = Math.max(560, cols * nodeW + (cols - 1) * gap + 40);
  const cx = W / 2;
  const parts: string[] = [];

  // Service header
  const svcW = 360;
  parts.push(
    `<g data-resource-id="${esc(v.service.id)}" data-names="${tip('Service', v.service.name)}" style="cursor:pointer">` +
      box(cx - svcW / 2, 16, svcW, 46, { fill: '#eef3fb' }) +
      icon('Service', cx - svcW / 2 + 26, 39, 16) +
      text('n-lbl', cx - svcW / 2 + 48, 35, `Service: ${clip(v.service.name, 28)}`) +
      text('n-sub', cx - svcW / 2 + 48, 53, `ClusterIP: ${v.service.clusterIp ?? '—'}   ·   Selector: ${clip(Object.entries(v.selector).map(([k, x]) => `${k}=${x}`).join(',') || '(none)', 24)}`) +
      `</g>`,
  );

  if (v.nodes.length === 0) {
    parts.push(text('n-muted', cx, 100, 'no scheduled backing pods', 'middle'));
    return frame(W, 120, parts.join(''));
  }

  const busY = 84;
  parts.push(vArrow(cx, 62, busY));
  const totalW = cols * nodeW + (cols - 1) * gap;
  const startX = cx - totalW / 2;
  const nodeTop = busY + 20;
  const rowH = 24;
  let maxH = 0;
  const nodeCentersX: number[] = [];

  // Node header height (icon + name + IP only) — pods live in their own card below, NOT nested inside the
  // Node's box, so a Node's border doesn't visually absorb its pods into "one item".
  const headerH = 46;
  const cardGap = 10;

  v.nodes.forEach((node, i) => {
    const x = startX + i * (nodeW + gap);
    const ncx = x + nodeW / 2;
    nodeCentersX.push(ncx);
    const shown = node.pods.slice(0, 8);
    const overflow = node.pods.length - shown.length;
    const podsBodyH = shown.length > 0 ? 8 + shown.length * rowH + (overflow > 0 ? 20 : 0) + 6 : 0;
    const totalH = headerH + (shown.length > 0 ? cardGap + podsBodyH : 20) + 20; // + data-plane footer
    maxH = Math.max(maxH, totalH);

    // Node header — its own box, holding only the Node's icon/name/IP.
    parts.push(
      `<g data-resource-id="${esc(node.id ?? '')}" data-names="${tip('Node', node.name)}" style="cursor:${node.id ? 'pointer' : 'default'}">` +
        box(x, nodeTop, nodeW, headerH) +
        icon('Node', x + 22, nodeTop + 22, 14) +
        text('n-lbl', x + 40, nodeTop + 19, clip(node.name, 22)) +
        text('n-ip', x + 40, nodeTop + 35, node.ip ?? '—') +
        `</g>`,
    );

    let podsBottom = nodeTop + headerH;
    if (shown.length > 0) {
      const podsTop = nodeTop + headerH + cardGap;
      parts.push(vArrow(ncx, nodeTop + headerH, podsTop));
      parts.push(box(x, podsTop, nodeW, podsBodyH, { fill: '#fff' }));
      const rowsTop = podsTop + 8;
      shown.forEach((p, j) => {
        const ry = rowsTop + j * rowH;
        if (j > 0) parts.push(`<line x1="${x + 10}" y1="${ry}" x2="${x + nodeW - 10}" y2="${ry}" stroke="#e4e4e0" stroke-width="1" />`);
        const rcy = ry + rowH / 2;
        parts.push(
          `<g data-resource-id="${esc(p.id)}" data-names="${tip('Pod', p.name)}" style="cursor:pointer">` +
            icon('Pod', x + 22, rcy - 2, 9) +
            text('n-lbl', x + 36, rcy + 3, clip(p.name, 18)) +
            text('n-ip', x + nodeW - 12, rcy + 3, p.podIp ?? '—', 'end') +
            `</g>`,
        );
      });
      let footY = rowsTop + shown.length * rowH;
      if (overflow > 0) {
        parts.push(text('n-muted', x + 36, footY + 12, `+${overflow} more`));
        footY += 20;
      }
      podsBottom = podsTop + podsBodyH;
    } else {
      parts.push(text('n-muted', x + 12, nodeTop + headerH + 16, 'no pods scheduled here'));
      podsBottom = nodeTop + headerH + 20;
    }

    // data-plane footer — the inferred mechanism when detectable (evidence in the tooltip), else generic.
    const dpAttr = plane?.dataPlane.evidence ? ` data-names="${esc(JSON.stringify(['inferred from: ' + plane.dataPlane.evidence]))}"` : '';
    parts.push(`<g${dpAttr}>${text('n-muted', x + 12, podsBottom + 14, clip(dataPlaneLabel, 30))}</g>`);
  });

  // bus from service down to each node top
  const busLeft = Math.min(...nodeCentersX);
  const busRight = Math.max(...nodeCentersX);
  parts.push(line(busLeft, busY, busRight, busY));
  nodeCentersX.forEach((ncx) => parts.push(vArrow(ncx, busY, nodeTop)));

  return frame(W, nodeTop + maxH + 16, parts.join(''));
}

// ---- Diagram 5: Cluster Topology (Node CIDR / overlay) --------------------------------------------------

const NODES_PER_ROW = 4;

export function renderTopologySvg(t: NetworkTopology, plane?: NetworkPlane): string {
  const nodeW = 240;
  const colGap = 24;
  const rowGap = 40;
  const barH = 22;
  const arrowGap = 18;
  const rowH = 22;
  // A left margin reserved for the overlay-tunnel spine + its rotated label; node columns start right of it.
  const spineX = 46;
  const nodeStartX = spineX + 34;
  const parts: string[] = [];

  const fullRowW = NODES_PER_ROW * nodeW + (NODES_PER_ROW - 1) * colGap;
  const W = Math.max(600, nodeStartX + fullRowW + 24);

  if (t.nodes.length === 0) {
    return frame(W, 80, text('n-muted', W / 2, 44, 'no nodes in this snapshot', 'middle'));
  }

  // Inferred network-plane summary header — each detected fact shown WITH its evidence (tooltip carries the
  // full basis); rows the snapshot gives no fingerprint for are simply omitted rather than guessed.
  const summary: { label: string; value?: string; evidence?: string }[] = [
    { label: 'CNI', ...plane?.cni },
    { label: 'Overlay', ...plane?.overlay },
    { label: 'Data plane', ...plane?.dataPlane },
    { label: 'Cluster Pod CIDR', ...plane?.clusterPodCidr },
  ].filter((r) => r.value);
  const headerH = summary.length ? 8 + summary.length * 16 + 8 : 0;
  const gridTop = 16 + headerH + (headerH ? 14 : 0);
  if (summary.length) {
    parts.push(box(16, 16, W - 32, headerH, { fill: '#f7f7f5' }));
    summary.forEach((r, i) => {
      const yy = 16 + 20 + i * 16;
      const gAttr = r.evidence ? ` data-names="${esc(JSON.stringify(['inferred from: ' + r.evidence]))}" style="cursor:help"` : '';
      parts.push(
        `<g${gAttr}>` +
          text('n-cap', 28, yy, `${r.label}:`) +
          text('n-lbl', 148, yy, clip(r.value ?? '', 40)) +
          (r.evidence ? text('n-muted', 380, yy, `inferred · ${clip(r.evidence, 46)}`) : '') +
          `</g>`,
      );
    });
  }

  const overlayLabel = plane?.overlay.value ? `Overlay / Tunnel: ${plane.overlay.value}` : t.overlayLabel;

  // One node's box height (drives per-row alignment), computed the same way it's drawn below.
  const nodeLayout = (node: (typeof t.nodes)[number]) => {
    const cidrLines = node.podCidr
      ? [`Pod CIDR: ${node.podCidr}`]
      : node.derivedRanges.length
        ? node.derivedRanges.slice(0, 2).map((r, idx) => (idx === 0 ? `Pod range: ${r} (derived)` : r))
        : ['Pod CIDR: — (not in snapshot)'];
    const headH = 40 + cidrLines.length * 14;
    const overflow = node.podCount - node.pods.length;
    const bodyH = headH + 6 + node.pods.length * rowH + (overflow > 0 ? 18 : 0) + 24;
    return { cidrLines, headH, overflow, bodyH };
  };

  // Nodes stacked in rows of NODES_PER_ROW; each row gets a horizontal overlay bar beneath it, and every
  // node drops into that bar. All row bars are tied together by a vertical "overlay tunnel" spine on the left.
  let y = gridTop;
  const barYs: number[] = [];
  for (let r = 0; r < t.nodes.length; r += NODES_PER_ROW) {
    const rowNodes = t.nodes.slice(r, r + NODES_PER_ROW);
    const layouts = rowNodes.map(nodeLayout);
    const rowMaxH = Math.max(...layouts.map((l) => l.bodyH));

    rowNodes.forEach((node, col) => {
      const x = nodeStartX + col * (nodeW + colGap);
      const { cidrLines, headH, overflow, bodyH } = layouts[col]!;
      // `data-node-pods` marks this as a Node whose click opens the full pod-list modal (rather than jumping
      // straight to the node's YAML) — the topology only shows the first few pods per node inline. The card's
      // background box lives INSIDE this same `<g>` (not as a separate sibling rect) so hovering/clicking
      // anywhere on the card — not just the exact header icon/text pixels — targets this Node. Per-pod `<g>`s
      // nested inside still take priority on their own rows since `closest()` finds the nearer ancestor.
      parts.push(
        `<g data-resource-id="${esc(node.id)}" data-node-pods="1" data-node-name="${esc(node.name)}" data-names="${tip('Node', node.name)}" style="cursor:pointer">` +
          box(x, y, nodeW, bodyH, { fill: '#fafafa' }) +
          icon('Node', x + 24, y + 24, 15) +
          text('n-lbl', x + 44, y + 20, clip(node.name, 22)) +
          text('n-ip', x + 44, y + 36, `Node IP: ${node.ip ?? '—'}`),
      );
      cidrLines.forEach((l, idx) => parts.push(text(node.podCidr ? 'n-sub' : 'n-muted', x + 14, y + 52 + idx * 14, l)));
      let py = y + headH + 6;
      node.pods.forEach((p) => {
        parts.push(
          `<g data-resource-id="${esc(p.id)}" data-names="${tip('Pod', p.name)}" style="cursor:pointer">` +
            icon('Pod', x + 22, py + 9, 9) +
            text('n-lbl', x + 36, py + 13, clip(p.name, 18)) +
            text('n-ip', x + nodeW - 10, py + 13, p.podIp ?? '—', 'end') +
            `</g>`,
        );
        py += rowH;
      });
      if (overflow > 0) parts.push(text('n-muted', x + 36, py + 12, `+${overflow} more pods`));
      parts.push(text('n-muted', x + 12, y + bodyH - 8, 'CNI bridge / veth'));
      parts.push('</g>'); // closes the outer Node <g> opened above
    });

    // row overlay bar: spans from the spine (left) to the right edge of this row's nodes
    const barY = y + rowMaxH + arrowGap;
    barYs.push(barY);
    const rowRight = nodeStartX + rowNodes.length * nodeW + (rowNodes.length - 1) * colGap;
    parts.push(box(spineX, barY, rowRight - spineX, barH, { dashed: true, fill: '#f4f0ea' }));
    parts.push(text('n-muted', (spineX + rowRight) / 2, barY + 15, clip(overlayLabel, 70), 'middle'));
    rowNodes.forEach((_, col) => {
      const cx = nodeStartX + col * (nodeW + colGap) + nodeW / 2;
      parts.push(vArrow(cx, y + rowMaxH, barY));
    });
    y = barY + barH + rowGap;
  }

  // Left overlay-tunnel spine linking every row bar into one fabric, with a rotated label running down it.
  const spineTop = barYs[0]!;
  const spineBot = barYs[barYs.length - 1]! + barH;
  parts.push(`<line x1="${spineX}" y1="${spineTop}" x2="${spineX}" y2="${spineBot}" stroke="${EDGE}" stroke-width="1.8" />`);
  const midY = (spineTop + spineBot) / 2;
  const spineAttr = plane?.overlay.evidence ? ` data-names="${esc(JSON.stringify(['inferred from: ' + plane.overlay.evidence]))}"` : '';
  parts.push(`<g${spineAttr}><text class="n-muted" transform="rotate(-90 18 ${midY})" x="18" y="${midY}" text-anchor="middle">${esc(clip(overlayLabel, 40))}</text></g>`);

  return frame(W, y - rowGap + 16, parts.join(''));
}
