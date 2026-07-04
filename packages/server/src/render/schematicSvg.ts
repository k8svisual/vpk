import { iconForKind } from '@vpk/core';
import type { SchematicDto } from '../schematic';

interface Ref {
  id: string;
  name: string;
}

const ICON_R = 20;
const GROUP_W = 210;
const STORAGE_W = 300;
const GROUP_H = 112;
const COL_GAP = 60;
const ROW_GAP = 20;
const POD_W = 260;
const MARGIN = 24;
const CONTAINER_ROW_H = 20;

/** Served statically by @vpk/web (ported from the legacy app's images/k8/*.svg) — resolves against whatever
 *  origin the browser loaded this inlined SVG from, so no absolute host is needed here. */
const ICON_BASE = '/icons/k8/';

const STATUS_OK = '#2e8b57';
const STATUS_WARN = '#d4a017';
const STATUS_ERROR = '#c0392b';
const STATUS_NEUTRAL = '#9a9a9a';

const CATEGORY_STYLE: Record<string, { fill: string; stroke: string }> = {
  config: { fill: '#fdf6d3', stroke: '#c9b258' },
  owner: { fill: '#fbdcdc', stroke: '#c97a7a' },
  network: { fill: '#dbeefa', stroke: '#7aa9c9' },
  security: { fill: '#ddf3e4', stroke: '#5fb37e' },
  storage: { fill: '#fbe3c2', stroke: '#c9974f' },
};

/**
 * Render a Pod schematic as SVG, matching the reference mockups (redesign/reference-images/schematic-*):
 * dotted pale-colored category boxes in a cross layout around a plain central Pod card, heptagon kind icons,
 * solid black arrows (References) vs dashed red arrows (Creates), aggregate icon+count per group rather than
 * one node per item. DESIGN §6.9.
 */
export function renderSchematicSvg(s: SchematicDto): string {
  const podHeaderH = 40; // icon + gap
  const infoH = 54; // Phase + Conditions
  const containerRows = s.initContainers.length + s.containers.length;
  const containerSectionH = containerRows > 0 ? 22 + containerRows * CONTAINER_ROW_H : 0;
  const podH = podHeaderH + infoH + containerSectionH + 16;

  const hasConfig = s.config.configMaps.length > 0 || s.config.secrets.length > 0;
  const hasOwner = s.ownerChain.length > 0;
  const hasNetwork = s.network.services.length > 0;
  const hasSecurity = !!s.security.serviceAccount;
  const hasStorage = s.storage.pvcs.length > 0;

  const ownerW = hasOwner ? Math.max(GROUP_W, 70 * (s.ownerChain.length + (s.generatorLabel ? 1 : 0)) + 40) : 0;
  const leftColW = Math.max(hasOwner ? ownerW : 0, hasNetwork ? GROUP_W : 0);
  const rightColW = Math.max(hasSecurity ? GROUP_W : 0, hasStorage ? STORAGE_W : 0);

  const configW = hasConfig ? Math.max(GROUP_W, 90 * ((s.config.configMaps.length > 0 ? 1 : 0) + (s.config.secrets.length > 0 ? 1 : 0)) + 40) : 0;
  const configH = hasConfig ? GROUP_H : 0;

  const podX = MARGIN + (leftColW > 0 ? leftColW + COL_GAP : 0);
  const podY = MARGIN + (hasConfig ? configH + ROW_GAP : 0);

  const canvasW = MARGIN + leftColW + (leftColW > 0 ? COL_GAP : 0) + POD_W + (rightColW > 0 ? COL_GAP : 0) + rightColW + MARGIN;
  const contentH = Math.max(
    podH,
    hasOwner && hasNetwork ? GROUP_H * 2 + ROW_GAP : hasOwner || hasNetwork ? GROUP_H : 0,
    hasSecurity && hasStorage ? GROUP_H * 2 + ROW_GAP : hasSecurity || hasStorage ? GROUP_H : 0,
  );
  const canvasH = podY + contentH + MARGIN;

  const parts: string[] = [];

  // ---- Configuration (above Pod) ----
  if (hasConfig) {
    const cx = podX + POD_W / 2 - configW / 2;
    const cy = MARGIN;
    parts.push(categoryBox('config', 'Configuration', cx, cy, configW, configH));
    const icons: string[] = [];
    let ix = cx + 30;
    if (s.config.configMaps.length > 0) {
      icons.push(aggregateIcon(s.config.configMaps, 'ConfigMap', ix, cy + 60));
      parts.push(solidEdge(podX + POD_W / 2 - 20, podY, ix, cy + configH - 14));
      ix += 90;
    }
    if (s.config.secrets.length > 0) {
      icons.push(aggregateIcon(s.config.secrets, 'Secret', ix, cy + 60));
      parts.push(solidEdge(podX + POD_W / 2 + 20, podY, ix, cy + configH - 14));
    }
    parts.push(...icons);
  }

  // ---- Generator OwnerRefs + Network (left column) ----
  let leftY = podY;
  if (hasOwner) {
    parts.push(categoryBox('owner', 'Generator OwnerRefs', MARGIN, leftY, ownerW, GROUP_H));
    let x = MARGIN + 30;
    const iconY = leftY + 56;
    if (s.generatorLabel) {
      parts.push(generatorBadge(s.generatorLabel, x, iconY));
      parts.push(dashedEdge(x + 55, iconY, x + 70, iconY));
      x += 70;
    }
    for (let i = 0; i < s.ownerChain.length; i++) {
      const owner = s.ownerChain[i] as { id: string; kind: string; name: string };
      parts.push(kindIcon(owner.id, owner.kind, owner.name, x, iconY));
      const nextX = x + 70;
      if (i < s.ownerChain.length - 1) parts.push(dashedEdge(x + ICON_R, iconY, nextX - ICON_R, iconY));
      x = nextX;
    }
    parts.push(dashedEdge(x - 70 + ICON_R, iconY, podX, podY + podHeaderH / 2));
    leftY += GROUP_H + ROW_GAP;
  }
  if (hasNetwork) {
    parts.push(categoryBox('network', 'Network', MARGIN, leftY, GROUP_W, GROUP_H));
    const iconY = leftY + 56;
    parts.push(aggregateIcon(s.network.services, 'Service', MARGIN + 30, iconY));
    parts.push(solidEdge(MARGIN + 30 + ICON_R, iconY, podX, podY + podHeaderH / 2 + 14));
  }

  // ---- Security + Storage (right column) ----
  const rightX = podX + POD_W + COL_GAP;
  let rightY = podY;
  if (hasSecurity) {
    parts.push(categoryBox('security', 'Security', rightX, rightY, GROUP_W, GROUP_H));
    const iconY = rightY + 56;
    const sa = s.security.serviceAccount as Ref;
    parts.push(kindIcon(sa.id, 'ServiceAccount', sa.name, rightX + 30, iconY));
    parts.push(solidEdge(podX + POD_W, podY + podHeaderH / 2, rightX + 30 - ICON_R, iconY));
    rightY += GROUP_H + ROW_GAP;
  }
  if (hasStorage) {
    parts.push(categoryBox('storage', 'Storage', rightX, rightY, STORAGE_W, GROUP_H));
    const iconY = rightY + 56;
    let x = rightX + 30;
    parts.push(aggregateIcon(s.storage.pvcs, 'PersistentVolumeClaim', x, iconY));
    parts.push(solidEdge(podX + POD_W, podY + podHeaderH / 2 + (hasSecurity ? 0 : 14), x - ICON_R, iconY));
    if (s.storage.pvs.length > 0) {
      const pvX = x + 90;
      parts.push(solidEdge(x + ICON_R, iconY, pvX - ICON_R, iconY));
      parts.push(aggregateIcon(s.storage.pvs, 'PersistentVolume', pvX, iconY));
      x = pvX;
      if (s.storage.storageClasses.length > 0) {
        const scX = x + 90;
        parts.push(dashedEdge(scX - ICON_R, iconY, x + ICON_R, iconY));
        parts.push(aggregateIcon(s.storage.storageClasses, 'StorageClass', scX, iconY));
      }
    }
  }

  // ---- Pod card ----
  parts.push(podCard(s, podX, podY, POD_W, podH));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" font-family="system-ui, sans-serif">` +
    defs() +
    `<style>` +
    `.sch-title{font-size:11px;font-weight:600;fill:#444}` +
    `.sch-icon-name{font-size:9px;fill:#333;text-anchor:middle;cursor:pointer}` +
    `.sch-count{font-size:10px;fill:#333;font-weight:600}` +
    `.sch-pod-name{font-size:13px;font-weight:600;fill:#222;text-anchor:middle}` +
    `.sch-pod-label{font-size:10.5px;fill:#555}` +
    `.sch-pod-row{font-size:10.5px;fill:#333}` +
    `</style>` +
    parts.join('') +
    `</svg>`
  );
}

function defs(): string {
  return (
    `<defs>` +
    `<marker id="sch-arrow-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#333" /></marker>` +
    `<marker id="sch-arrow-dashed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${STATUS_ERROR}" /></marker>` +
    `</defs>`
  );
}

function categoryBox(kind: keyof typeof CATEGORY_STYLE, title: string, x: number, y: number, w: number, h: number): string {
  const style = CATEGORY_STYLE[kind] as { fill: string; stroke: string };
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${style.fill}" stroke="${style.stroke}" stroke-dasharray="3 2" />` +
    `<text class="sch-title" x="${x + 8}" y="${y + 16}">${esc(title)}</text>`
  );
}

/** The real Kubernetes icon image for `kind`, centered at (cx, cy) — matches the reference mockups exactly
 *  (every kind's icon is the same Kubernetes blue; differentiation comes from the category box + label, not
 *  per-kind tinting — that's `colorForKind`'s job elsewhere, e.g. the 3D wheel). */
function iconImage(kind: string, cx: number, cy: number): string {
  return `<image href="${ICON_BASE}${iconForKind(kind)}" x="${cx - ICON_R}" y="${cy - ICON_R}" width="${ICON_R * 2}" height="${ICON_R * 2}" />`;
}

function kindIcon(id: string, kind: string, name: string, cx: number, cy: number): string {
  return (
    `<g data-resource-id="${esc(id)}" style="cursor:pointer">` +
    iconImage(kind, cx, cy) +
    `<text class="sch-icon-name" x="${cx}" y="${cy + ICON_R + 13}">${esc(clip(name, 16))}</text>` +
    `</g>`
  );
}

/** One icon representing every item of a kind, with a "(N)" count when there's more than one (matches the
 *  reference mockups' `cm (7)` / `secret (5)` pattern) — clickable only when it resolves to exactly one item. */
function aggregateIcon(items: Ref[], kind: string, cx: number, cy: number): string {
  const clickable = items.length === 1;
  const openTag = clickable ? `<g data-resource-id="${esc(items[0]!.id)}" style="cursor:pointer">` : `<g>`;
  const label = clickable ? clip(items[0]!.name, 16) : kind;
  return (
    openTag +
    iconImage(kind, cx, cy) +
    `<text class="sch-icon-name" x="${cx}" y="${cy + ICON_R + 13}">${esc(label)}</text>` +
    (items.length > 1 ? `<text class="sch-count" x="${cx + ICON_R + 4}" y="${cy + 4}">(${items.length})</text>` : '') +
    `</g>`
  );
}

function generatorBadge(label: string, cx: number, cy: number): string {
  const w = 70;
  return (
    `<g>` +
    `<circle cx="${cx - w / 2 + 8}" cy="${cy - 18}" r="8" fill="#000" />` +
    `<text x="${cx - w / 2 + 8}" y="${cy - 15}" text-anchor="middle" font-size="10" fill="#fff">a</text>` +
    `<rect x="${cx - w / 2}" y="${cy - 10}" width="${w}" height="20" fill="#fff" stroke="#999" />` +
    `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#333">${esc(clip(label, 10))}</text>` +
    `</g>`
  );
}

function podCard(s: SchematicDto, x: number, y: number, w: number, h: number): string {
  const iconY = y + 30;
  let rowY = y + 40 + 54 + 16;
  const rows: string[] = [];
  for (const c of s.initContainers) {
    rows.push(containerRow(x, rowY, `InitContainer[${s.initContainers.indexOf(c)}]`, c));
    rowY += CONTAINER_ROW_H;
  }
  s.containers.forEach((c, i) => {
    rows.push(containerRow(x, rowY, `Container[${i}]`, c));
    rowY += CONTAINER_ROW_H;
  });

  const phaseColor = STATUS_FILL(phaseHealth(s.phase));
  const dots = s.conditions
    .map((c, i) => `<circle cx="${x + 24 + i * 20}" cy="${y + 40 + 40}" r="7" fill="${c.status === 'True' ? STATUS_OK : STATUS_NEUTRAL}" />`)
    .join('');

  return (
    `<g data-resource-id="${esc(s.podId)}" style="cursor:pointer">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f2f2f0" stroke="#666" stroke-width="1.4" />` +
    iconImage('Pod', x + w / 2, iconY) +
    `<line x1="${x}" y1="${y + 40 + 8}" x2="${x + w}" y2="${y + 40 + 8}" stroke="#ccc" />` +
    `<text class="sch-pod-label" x="${x + 12}" y="${y + 40 + 22}">Phase</text>` +
    `<rect x="${x + 60}" y="${y + 40 + 12}" width="70" height="16" rx="3" fill="${phaseColor}" />` +
    `<text x="${x + 95}" y="${y + 40 + 24}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${esc(s.phase ?? '')}</text>` +
    `<text class="sch-pod-label" x="${x + 12}" y="${y + 40 + 44}">Conditions</text>` +
    dots +
    `<line x1="${x}" y1="${y + 40 + 54 + 6}" x2="${x + w}" y2="${y + 40 + 54 + 6}" stroke="#ccc" />` +
    rows.join('') +
    `</g>`
  );
}

function containerRow(x: number, y: number, label: string, c: { name: string; ready?: boolean; stateLabel?: string }): string {
  const completed = c.stateLabel === 'Completed';
  const ok = c.ready || completed;
  const pillColor = ok ? STATUS_OK : STATUS_ERROR;
  const pillLabel = c.stateLabel ?? (c.ready ? 'Running' : 'NotReady');
  const pillFill = completed ? '#c9c9c9' : pillColor;
  const pillText = completed ? '#333' : '#fff';
  return (
    `<text class="sch-pod-row" x="${x + 12}" y="${y}">${esc(clip(label, 16))}</text>` +
    `<rect x="${x + 130}" y="${y - 12}" width="80" height="16" rx="3" fill="${pillFill}" />` +
    `<text x="${x + 170}" y="${y}" text-anchor="middle" font-size="10" font-weight="700" fill="${pillText}">${esc(clip(pillLabel, 12))}</text>`
  );
}

function phaseHealth(phase: string | undefined): 'ok' | 'warn' | 'error' {
  if (phase === 'Running' || phase === 'Succeeded') return 'ok';
  if (phase === 'Pending') return 'warn';
  return 'error';
}
function STATUS_FILL(h: 'ok' | 'warn' | 'error'): string {
  return h === 'ok' ? STATUS_OK : h === 'warn' ? STATUS_WARN : STATUS_ERROR;
}

function dashedEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${STATUS_ERROR}" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#sch-arrow-dashed)" />`;
}
function solidEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="1.3" marker-end="url(#sch-arrow-solid)" />`;
}

function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
function esc(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
