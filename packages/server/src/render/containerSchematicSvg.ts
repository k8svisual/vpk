import { iconPathForKind } from '@vpk/core';
import type { SchematicDto } from '../schematic';

type Container = SchematicDto['containers'][number];
type Volume = SchematicDto['volumes'][number];

// var(--vpk-status-*) — inlined into the live DOM (see index.css theming), so it re-themes across all 4 themes.
const STATUS_OK = 'var(--vpk-status-ok, #2e8b57)';
const STATUS_ERROR = 'var(--vpk-status-error, #c0392b)';
const STATUS_NEUTRAL = 'var(--vpk-status-unknown, #9a9a9a)';

/** Transient debug containers (spec.ephemeralContainers) get their own accent — deliberately distinct from the
 *  init (grey) and app (green/red) sections so it reads at a glance that they aren't part of the declared spec.
 *  Matches the Events badge purple already used elsewhere in the schematic family. */
const EPHEMERAL = '#8e44ad';

const MARGIN = 24;
const TITLE_H = 44;
const COL_GAP = 64;
const CONFIG_W = 172;
const SERVICE_W = 160;
const CARD_W = 330;
const POD_PAD = 18;
const SECTION_HEADER_H = 22;
const CARD_GAP = 12;
const SECTION_GAP = 10;
const ROW_H = 18;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The Container schematic (companion to renderSchematicSvg): opens a single Pod up into its three container
 * arrays — initContainers, containers, ephemeralContainers — each drawn as a detail card (image, ports,
 * resources, probes, mounts) inside the Pod boundary, over a shared `volumes` box. Edges attribute config
 * (env/envFrom) to the specific container that consumes it, link container ports to the Service, and link each
 * container's mounts to the volume it uses — a volume mounted by more than one container is drawn with the
 * red "shares volume" edge so sidecar sharing is visible. Ephemeral containers are drawn distinctly and, per
 * the Kubernetes API (which forbids ports/resources/probes on them), show only image + target + mounts.
 */
export function renderContainerSchematicSvg(s: SchematicDto): string {
  const allSections: { kind: 'init' | 'app' | 'ephemeral'; label: string; items: Container[] }[] = [
    { kind: 'init', label: 'initContainers', items: s.initContainers },
    { kind: 'app', label: 'containers', items: s.containers },
    { kind: 'ephemeral', label: 'ephemeralContainers', items: s.ephemeralContainers },
  ];
  const sections = allSections.filter((sec) => sec.items.length > 0);

  const hasConfig = s.config.configMaps.length > 0 || s.config.secrets.length > 0;
  const hasService = s.network.services.length > 0;
  const hasVolumes = s.volumes.length > 0;

  const podX = MARGIN + (hasConfig ? CONFIG_W + COL_GAP : 0);
  const podInnerX = podX + POD_PAD;
  const boundaryTop = MARGIN + TITLE_H;

  // How many containers mount each volume — a volume used by >1 container is drawn with the "shares" edge.
  const mountCount = new Map<string, number>();
  for (const sec of sections) for (const c of sec.items) for (const m of c.mounts) mountCount.set(m.volumeName, (mountCount.get(m.volumeName) ?? 0) + 1);

  const body: string[] = [];
  const cardByName = new Map<string, Rect>();
  const cards: { c: Container; rect: Rect }[] = [];

  let cursorY = boundaryTop + POD_PAD;
  for (const sec of sections) {
    body.push(`<text class="cs-section" x="${podInnerX}" y="${cursorY + 14}" ${sec.kind === 'ephemeral' ? `fill="${EPHEMERAL}"` : ''}>${esc(sec.label)}</text>`);
    cursorY += SECTION_HEADER_H;
    for (let i = 0; i < sec.items.length; i++) {
      const c = sec.items[i]!;
      const h = cardHeight(c);
      const rect: Rect = { x: podInnerX, y: cursorY, w: CARD_W, h };
      body.push(containerCard(s.podId, c, i, rect));
      cardByName.set(c.name, rect);
      cards.push({ c, rect });
      cursorY += h + CARD_GAP;
    }
    cursorY += SECTION_GAP;
  }

  // ---- shared volumes box (inside the Pod boundary, below every container section) ----
  const volRectByName = new Map<string, Rect>();
  let volBox: Rect | null = null;
  if (hasVolumes) {
    const perRow = 4;
    const rows = Math.ceil(s.volumes.length / perRow);
    const volBoxH = 26 + rows * 52 + 22;
    volBox = { x: podInnerX, y: cursorY, w: CARD_W, h: volBoxH };
    body.push(dashedBox('#fbe3c2', '#c9974f', volBox, 'volumes'));
    s.volumes.forEach((v, idx) => {
      const col = idx % perRow;
      const row = Math.floor(idx / perRow);
      const vw = 74;
      const vx = volBox!.x + 12 + col * (vw + 6);
      const vy = volBox!.y + 26 + row * 52;
      const vr: Rect = { x: vx, y: vy, w: vw, h: 42 };
      body.push(volumeChip(v, vr));
      volRectByName.set(v.name, vr);
    });
    cursorY += volBoxH;
  }

  const boundaryBottom = cursorY + POD_PAD;
  const podW = CARD_W + 2 * POD_PAD;
  const boundaryRect: Rect = { x: podX, y: boundaryTop, w: podW, h: boundaryBottom - boundaryTop };

  // ---- Configuration box (left) + Service box (right) ----
  const sideBoxTop = boundaryTop + 30;
  let configBox: Rect | null = null;
  const configIconById = new Map<string, { x: number; y: number }>();
  if (hasConfig) {
    const iconCount = (s.config.configMaps.length > 0 ? 1 : 0) + (s.config.secrets.length > 0 ? 1 : 0);
    configBox = { x: MARGIN, y: sideBoxTop, w: CONFIG_W, h: 96 };
    body.push(dashedBox('#fdf6d3', '#c9b258', configBox, 'Configuration'));
    let ix = MARGIN + 30;
    const iconY = sideBoxTop + 56;
    if (s.config.configMaps.length > 0) {
      body.push(aggregateIcon(s.config.configMaps, 'ConfigMap', ix, iconY));
      configIconById.set('configMaps', { x: ix, y: iconY });
      ix += (CONFIG_W - 60) / Math.max(1, iconCount);
    }
    if (s.config.secrets.length > 0) {
      body.push(aggregateIcon(s.config.secrets, 'Secret', ix, iconY));
      configIconById.set('secrets', { x: ix, y: iconY });
    }
  }

  let serviceBox: Rect | null = null;
  const serviceX = podX + podW + COL_GAP;
  if (hasService) {
    serviceBox = { x: serviceX, y: sideBoxTop, w: SERVICE_W, h: 80 };
    body.push(dashedBox('#dbeefa', '#7aa9c9', serviceBox, 'Network'));
    body.push(aggregateIcon(s.network.services, 'Service', serviceX + SERVICE_W / 2, sideBoxTop + 52));
  }

  // ---- edges (drawn under the cards would be ideal, but appended after reads fine at this opacity) ----
  const edges: string[] = [];
  for (const { c, rect } of cards) {
    // config attribution: one edge from the Configuration box to any container that consumes config via env.
    if (configBox && (c.configRefs.configMaps.length > 0 || c.configRefs.secrets.length > 0)) {
      edges.push(solidEdge(configBox.x + configBox.w, rect.y + 22, rect.x, rect.y + 22, 0.85));
    }
    // ports -> Service
    if (serviceBox && c.ports.length > 0) {
      edges.push(solidEdge(rect.x + rect.w, rect.y + rect.h / 2, serviceBox.x, serviceBox.y + serviceBox.h / 2, 0.85));
    }
    // mounts -> volume (red-dashed when the volume is shared across containers)
    for (const m of c.mounts) {
      const vr = volRectByName.get(m.volumeName);
      if (!vr) continue;
      const shared = (mountCount.get(m.volumeName) ?? 0) > 1;
      const x1 = rect.x + rect.w / 2;
      const y1 = rect.y + rect.h;
      const x2 = vr.x + vr.w / 2;
      const y2 = vr.y;
      edges.push(shared ? sharesEdge(x1, y1, x2, y2) : solidEdge(x1, y1, x2, y2, 0.55));
    }
    // ephemeral debug container -> the container it targets
    if (c.kind === 'ephemeral' && c.targetContainerName) {
      const target = cardByName.get(c.targetContainerName);
      if (target) edges.push(targetsEdge(rect.x + rect.w / 2, rect.y, target.x + target.w / 2, target.y + target.h));
    }
  }

  const canvasW = serviceX + (hasService ? SERVICE_W : 0) + MARGIN;
  const canvasH = boundaryBottom + MARGIN;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" font-family="system-ui, sans-serif">` +
    defs() +
    styleBlock() +
    legend(s.podName) +
    `<rect x="${boundaryRect.x}" y="${boundaryRect.y}" width="${boundaryRect.w}" height="${boundaryRect.h}" rx="6" fill="var(--vpk-surface, #f6f6f4)" stroke="var(--vpk-border, #888)" stroke-width="1.4" />` +
    edges.join('') +
    body.join('') +
    `</svg>`
  );
}

function cardHeight(c: Container): number {
  let rows = 0;
  if (c.image) rows++;
  if (c.kind === 'app' && c.ports.length > 0) rows++;
  if (c.resources) rows++;
  if (c.kind === 'app' && (c.probes.liveness || c.probes.readiness || c.probes.startup)) rows++;
  if (c.mounts.length > 0) rows++;
  if (c.kind === 'ephemeral' && c.targetContainerName) rows++;
  return 30 + rows * ROW_H + 8;
}

function barColor(c: Container): string {
  if (c.kind === 'init') return STATUS_NEUTRAL;
  if (c.kind === 'ephemeral') return EPHEMERAL;
  return c.ready || c.stateLabel === 'Completed' ? STATUS_OK : STATUS_ERROR;
}

function statusPill(c: Container, x: number, y: number): string {
  const completed = c.stateLabel === 'Completed';
  const running = c.stateLabel === 'Running' || c.ready;
  const fill = c.kind === 'ephemeral' ? EPHEMERAL : completed ? '#c9c9c9' : running ? STATUS_OK : STATUS_ERROR;
  const textColor = completed && c.kind !== 'ephemeral' ? '#333' : '#fff';
  const restarts = (c.restartCount ?? 0) > 0 ? ` ↺${c.restartCount}` : '';
  const label = `${c.stateLabel ?? (c.ready ? 'Running' : 'NotReady')}${restarts}`;
  return (
    `<rect x="${x}" y="${y - 12}" width="104" height="17" rx="3" fill="${fill}" />` +
    `<text x="${x + 52}" y="${y}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${textColor}">${esc(clip(label, 15))}</text>`
  );
}

function containerCard(podId: string, c: Container, index: number, r: Rect): string {
  const arrayKey = c.kind === 'init' ? 'initContainers' : c.kind === 'ephemeral' ? 'ephemeralContainers' : 'containers';
  const focusPath = esc(JSON.stringify(['spec', arrayKey, index]));
  const ephemeral = c.kind === 'ephemeral';
  const parts: string[] = [];
  parts.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="5" fill="${ephemeral ? '#faf4fd' : '#fff'}" stroke="${ephemeral ? EPHEMERAL : '#b9b9b9'}"${ephemeral ? ' stroke-dasharray="4 3"' : ''} />`,
  );
  parts.push(`<rect x="${r.x}" y="${r.y}" width="6" height="${r.h}" fill="${barColor(c)}" />`);
  parts.push(`<text class="cs-name" x="${r.x + 16}" y="${r.y + 20}">${esc(clip(c.name, 26))}</text>`);
  parts.push(statusPill(c, r.x + r.w - 114, r.y + 20));

  let ry = r.y + 38;
  if (c.image) {
    parts.push(`<text class="cs-row" x="${r.x + 16}" y="${ry}">image: ${esc(clip(c.image, 42))}</text>`);
    ry += ROW_H;
  }
  if (c.kind === 'app' && c.ports.length > 0) {
    parts.push(`<text class="cs-row" x="${r.x + 16}" y="${ry}">ports</text>`);
    let px = r.x + 58;
    for (const p of c.ports.slice(0, 4)) {
      const label = `${p.containerPort}/${p.protocol ?? 'TCP'}`;
      parts.push(chip(label, px, ry - 11, '#dbeefa', '#7aa9c9', '#245'));
      px += label.length * 6 + 18;
    }
    ry += ROW_H;
  }
  if (c.resources) {
    const cpu = c.resources.cpuRequest || c.resources.cpuLimit ? `cpu ${c.resources.cpuRequest ?? '—'} / ${c.resources.cpuLimit ?? '—'}` : '';
    const mem = c.resources.memRequest || c.resources.memLimit ? `mem ${c.resources.memRequest ?? '—'} / ${c.resources.memLimit ?? '—'}` : '';
    parts.push(`<text class="cs-row" x="${r.x + 16}" y="${ry}">${esc([cpu, mem].filter(Boolean).join(' · '))}</text>`);
    ry += ROW_H;
  }
  if (c.kind === 'app' && (c.probes.liveness || c.probes.readiness || c.probes.startup)) {
    parts.push(`<text class="cs-row" x="${r.x + 16}" y="${ry}">probes</text>`);
    let px = r.x + 62;
    for (const [on, label] of [[c.probes.liveness, 'live'], [c.probes.readiness, 'ready'], [c.probes.startup, 'startup']] as [boolean, string][]) {
      if (!on) continue;
      parts.push(chip(label, px, ry - 11, '#ddf3e4', '#5fb37e', '#255'));
      px += label.length * 6 + 20;
    }
    ry += ROW_H;
  }
  if (c.mounts.length > 0) {
    const names = c.mounts.map((m) => `${m.volumeName}${m.readOnly ? ' (ro)' : ''}`).join(', ');
    parts.push(`<text class="cs-row cs-muted" x="${r.x + 16}" y="${ry}">mounts: ${esc(clip(names, 42))}</text>`);
    ry += ROW_H;
  }
  if (ephemeral && c.targetContainerName) {
    parts.push(`<text class="cs-row" x="${r.x + 16}" y="${ry}" fill="${EPHEMERAL}" font-style="italic">target: ${esc(clip(c.targetContainerName, 20))} · no ports/probes/resources</text>`);
    ry += ROW_H;
  }

  // Clicking the card opens the editor scrolled to this container's YAML (same data-focus-path delegation the
  // Pod schematic's container rows use); data-names drives the shared hover tooltip.
  return `<g data-resource-id="${esc(podId)}" data-focus-path="${focusPath}" data-names="${esc(JSON.stringify([c.name]))}" style="cursor:pointer">${parts.join('')}</g>`;
}

function volumeChip(v: Volume, r: Rect): string {
  const caption = v.backingRef ? `${v.backingRef.kind === 'PersistentVolumeClaim' ? 'PVC ▸' : v.type}` : v.type;
  const inner =
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="5" fill="#fff" stroke="#c9974f" />` +
    `<text x="${r.x + r.w / 2}" y="${r.y + 18}" text-anchor="middle" font-size="10" font-weight="700" fill="#333">${esc(clip(v.name, 11))}</text>` +
    `<text x="${r.x + r.w / 2}" y="${r.y + 32}" text-anchor="middle" font-size="8.5" fill="#666">${esc(clip(caption, 12))}</text>`;
  // Backing PVC/ConfigMap/Secret is clickable; a plain emptyDir/hostPath volume just shows (no drill target).
  return v.backingRef
    ? `<g data-resource-id="${esc(v.backingRef.id)}" data-names="${esc(JSON.stringify([v.backingRef.name]))}" style="cursor:pointer">${inner}</g>`
    : `<g data-names="${esc(JSON.stringify([v.name]))}">${inner}</g>`;
}

function chip(label: string, x: number, y: number, fill: string, stroke: string, text: string): string {
  const w = label.length * 6 + 12;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="16" rx="8" fill="${fill}" stroke="${stroke}" />` +
    `<text x="${x + w / 2}" y="${y + 12}" text-anchor="middle" font-size="9" fill="${text}">${esc(label)}</text>`
  );
}

function dashedBox(fill: string, stroke: string, r: Rect, title: string): string {
  return (
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="${stroke}" stroke-dasharray="3 2" />` +
    `<text class="cs-boxtitle" x="${r.x + 8}" y="${r.y + 16}">${esc(title)}</text>`
  );
}

function iconImage(kind: string, cx: number, cy: number): string {
  const R = 18;
  return `<image href="${iconPathForKind(kind)}" x="${cx - R}" y="${cy - R}" width="${R * 2}" height="${R * 2}" />`;
}

/** One icon for every item of a kind, "(N)" when more than one — single item is directly clickable, multiple
 *  carry data-resource-list for the "Resources" list modal (same delegation as the Pod schematic). */
function aggregateIcon(items: { id: string; name: string }[], kind: string, cx: number, cy: number): string {
  const namesAttr = esc(JSON.stringify(items.map((i) => i.name)));
  if (items.length === 1) {
    return `<g data-resource-id="${esc(items[0]!.id)}" data-names="${namesAttr}" style="cursor:pointer">${iconImage(kind, cx, cy)}</g>`;
  }
  const listPayload = esc(JSON.stringify(items.map((i) => ({ id: i.id, name: i.name }))));
  return (
    `<g data-resource-list="${listPayload}" data-kind="${esc(kind)}" data-names="${namesAttr}" style="cursor:pointer">` +
    iconImage(kind, cx, cy) +
    `<text class="cs-count" x="${cx + 22}" y="${cy + 4}">(${items.length})</text>` +
    `</g>`
  );
}

function defs(): string {
  return (
    `<defs>` +
    `<marker id="cs-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--vpk-fg, #444)" /></marker>` +
    `<marker id="cs-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${STATUS_ERROR}" /></marker>` +
    `<marker id="cs-pur" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${EPHEMERAL}" /></marker>` +
    `</defs>`
  );
}

function styleBlock(): string {
  return (
    `<style>` +
    `.cs-title{font-size:13px;font-weight:700;fill:var(--vpk-fg,#222)}` +
    `.cs-legend{font-size:11px;fill:var(--vpk-fg-muted,#555)}` +
    `.cs-section{font-size:12px;font-weight:700;fill:var(--vpk-fg,#333)}` +
    `.cs-name{font-size:12px;font-weight:700;fill:#222}` +
    `.cs-row{font-size:10px;fill:#444}` +
    `.cs-muted{fill:#888}` +
    `.cs-boxtitle{font-size:11px;font-weight:600;fill:#444}` +
    `.cs-count{font-size:10px;fill:#333;font-weight:600}` +
    `</style>`
  );
}

function legend(podName: string): string {
  return (
    `<text class="cs-title" x="${MARGIN}" y="26">Pod: ${esc(clip(podName, 40))} · Container schematic</text>` +
    `<line x1="${MARGIN + 470}" y1="21" x2="${MARGIN + 498}" y2="21" stroke="var(--vpk-fg,#444)" stroke-width="1.4" marker-end="url(#cs-solid)" />` +
    `<text class="cs-legend" x="${MARGIN + 504}" y="25">mount / env</text>` +
    `<line x1="${MARGIN + 600}" y1="21" x2="${MARGIN + 628}" y2="21" stroke="${STATUS_ERROR}" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#cs-red)" />` +
    `<text class="cs-legend" x="${MARGIN + 634}" y="25">shares volume</text>` +
    `<line x1="${MARGIN + 744}" y1="21" x2="${MARGIN + 772}" y2="21" stroke="${EPHEMERAL}" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#cs-pur)" />` +
    `<text class="cs-legend" x="${MARGIN + 778}" y="25">debug targets</text>`
  );
}

function solidEdge(x1: number, y1: number, x2: number, y2: number, opacity = 1): string {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="var(--vpk-fg, #444)" stroke-width="1.2" opacity="${opacity}" marker-end="url(#cs-solid)" />`;
}
function sharesEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${STATUS_ERROR}" stroke-width="1.2" stroke-dasharray="5 4" marker-end="url(#cs-red)" />`;
}
function targetsEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${EPHEMERAL}" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#cs-pur)" />`;
}

function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
function esc(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
