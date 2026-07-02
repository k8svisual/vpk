import type { SchematicDto } from '../schematic';

interface Ref {
  id: string;
  name: string;
}
interface GroupSpec {
  key: string;
  title: string;
  kind: string;
  items: Ref[];
}

const OWNER_W = 150;
const OWNER_H = 34;
const OWNER_GAP = 20;
const OWNER_TO_POD_GAP = 40;
const POD_W = 240;
const GROUP_W = 190;
const GROUP_GAP_X = 50;
const GROUP_GAP_Y = 16;
const MARGIN = 20;
const ROW_H = 16;
const AGG_THRESHOLD = 5;

const KIND_FILL: Record<string, string> = {
  Pod: '#17a2b8',
  Deployment: '#dab894',
  ReplicaSet: '#dc3545',
  StatefulSet: '#99f692',
  DaemonSet: '#77bad4',
  Job: '#b4547c',
  CronJob: '#b4547c',
  Service: '#afcbff',
  Secret: '#5b9877',
  ConfigMap: '#cc89d6',
  ServiceAccount: '#aff8d8',
  PersistentVolumeClaim: '#f0ad4e',
};
const STATUS_FILL: Record<string, string> = {
  ok: '#2e8b57',
  warn: '#d4a017',
  error: '#c0392b',
};

/**
 * Render a Pod schematic as SVG (DESIGN §6.9): owner chain (dashed red "Creates" edges) above the central Pod
 * card, adaptive Config/Network/Storage/Security group boxes (solid gray "References" edges) flanking it.
 * Only populated groups render. Matches the ownerRefSvg.ts server-SVG conventions: data-resource-id per
 * clickable node, var(--vpk-kind-*) themeable fills with hex fallback.
 */
export function renderSchematicSvg(s: SchematicDto): string {
  const leftGroups = [group('config-cm', 'Config: ConfigMaps', 'ConfigMap', s.config.configMaps), group('security', 'Security', 'ServiceAccount', s.security.serviceAccount ? [s.security.serviceAccount] : [])].filter((g) => g.items.length > 0);
  const rightGroups = [group('network', 'Network', 'Service', s.network.services), group('storage', 'Storage', 'PersistentVolumeClaim', s.storage.pvcs)].filter((g) => g.items.length > 0);
  const secretsGroup = group('config-secret', 'Config: Secrets', 'Secret', s.config.secrets);
  if (secretsGroup.items.length > 0) leftGroups.push(secretsGroup);

  const leftColW = leftGroups.length > 0 ? GROUP_W + GROUP_GAP_X : 0;
  const rightColW = rightGroups.length > 0 ? GROUP_W + GROUP_GAP_X : 0;

  const podX = MARGIN + leftColW;
  const podHeaderH = 38; // name line + phase/conditions line
  const containerRows = s.initContainers.length + s.containers.length;
  const podH = podHeaderH + containerRows * ROW_H + 14;

  const ownerRowH = s.ownerChain.length > 0 ? OWNER_H + OWNER_TO_POD_GAP : 0;
  const podY = MARGIN + ownerRowH;

  const groupHeights = (groups: GroupSpec[]) => groups.map((g) => groupHeight(g));
  const leftHeights = groupHeights(leftGroups);
  const rightHeights = groupHeights(rightGroups);
  const leftTotalH = sum(leftHeights) + Math.max(0, leftGroups.length - 1) * GROUP_GAP_Y;
  const rightTotalH = sum(rightHeights) + Math.max(0, rightGroups.length - 1) * GROUP_GAP_Y;

  const canvasW = leftColW + POD_W + rightColW + MARGIN * 2;
  const canvasH = podY + Math.max(podH, leftTotalH, rightTotalH) + MARGIN;

  const ownerBoxes: string[] = [];
  const ownerEdges: string[] = [];
  if (s.ownerChain.length > 0) {
    const totalW = s.ownerChain.length * OWNER_W + (s.ownerChain.length - 1) * OWNER_GAP;
    let x = podX + POD_W / 2 - totalW / 2;
    const y = MARGIN;
    let prevCenter: { x: number; y: number } | undefined;
    for (const o of s.ownerChain) {
      ownerBoxes.push(box(o.id, o.kind, o.name, x, y, OWNER_W, OWNER_H, fill(o.kind)));
      const center = { x: x + OWNER_W / 2, y: y + OWNER_H };
      if (prevCenter) ownerEdges.push(dashedEdge(prevCenter.x, prevCenter.y - OWNER_H, x + OWNER_W / 2, y));
      prevCenter = center;
      x += OWNER_W + OWNER_GAP;
    }
    if (prevCenter) ownerEdges.push(dashedEdge(prevCenter.x, prevCenter.y, podX + POD_W / 2, podY));
  }

  const podSvg = podCard(s, podX, podY, POD_W, podH);
  const podLeftMid = { x: podX, y: podY + podH / 2 };
  const podRightMid = { x: podX + POD_W, y: podY + podH / 2 };

  const leftSvg: string[] = [];
  const leftEdges: string[] = [];
  {
    let y = podY;
    leftGroups.forEach((g, i) => {
      const h = leftHeights[i] as number;
      const x = MARGIN;
      leftSvg.push(groupBox(g, x, y, GROUP_W, h));
      leftEdges.push(solidEdge(podLeftMid.x, podLeftMid.y, x + GROUP_W, y + h / 2));
      y += h + GROUP_GAP_Y;
    });
  }

  const rightSvg: string[] = [];
  const rightEdges: string[] = [];
  {
    let y = podY;
    const x = podX + POD_W + GROUP_GAP_X;
    rightGroups.forEach((g, i) => {
      const h = rightHeights[i] as number;
      rightSvg.push(groupBox(g, x, y, GROUP_W, h));
      rightEdges.push(solidEdge(podRightMid.x, podRightMid.y, x, y + h / 2));
      y += h + GROUP_GAP_Y;
    });
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" font-family="system-ui, sans-serif">` +
    `<style>` +
    `.sch-creates{stroke:var(--vpk-status-error,#c0392b);stroke-width:1.4;stroke-dasharray:5 4;fill:none}` +
    `.sch-refs{stroke:var(--vpk-edge,#9a9a9a);stroke-width:1.2;fill:none}` +
    `.sch-name{fill:#fff;font-size:11px}.sch-kind{fill:#ffffffcc;font-size:9px}` +
    `.sch-group-title{fill:#333;font-size:11px;font-weight:600}` +
    `.sch-item{fill:#222;font-size:11px;cursor:pointer}` +
    `.sch-pod-header{fill:#fff;font-size:13px;font-weight:600}` +
    `.sch-pod-sub{fill:#ffffffdd;font-size:10px}` +
    `.sch-pod-row{fill:#fff;font-size:10.5px}` +
    `</style>` +
    ownerEdges.join('') +
    leftEdges.join('') +
    rightEdges.join('') +
    ownerBoxes.join('') +
    leftSvg.join('') +
    rightSvg.join('') +
    podSvg +
    `</svg>`
  );
}

function group(key: string, title: string, kind: string, items: Ref[]): GroupSpec {
  return { key, title, kind, items };
}

function groupHeight(g: GroupSpec): number {
  const rowCount = g.items.length > AGG_THRESHOLD ? 1 : g.items.length;
  return 22 + rowCount * ROW_H + 8;
}

function groupBox(g: GroupSpec, x: number, y: number, w: number, h: number): string {
  const aggregated = g.items.length > AGG_THRESHOLD;
  const rows = aggregated
    ? [`<text class="sch-item" x="${x + 10}" y="${y + 22 + ROW_H - 4}">${esc(g.kind)} (${g.items.length})</text>`]
    : g.items.map(
        (item, i) =>
          `<text class="sch-item" data-resource-id="${esc(item.id)}" x="${x + 10}" y="${y + 22 + i * ROW_H + ROW_H - 4}">${esc(clip(item.name, 22))}</text>`,
      );
  return (
    `<g class="sch-group">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#fbfbfa" stroke="#d9d9d5" />` +
    `<text class="sch-group-title" x="${x + 10}" y="${y + 16}">${esc(g.title)}</text>` +
    rows.join('') +
    `</g>`
  );
}

function podCard(s: SchematicDto, x: number, y: number, w: number, h: number): string {
  const phaseColor = STATUS_FILL[phaseHealth(s.phase)] ?? '#6b6b6b';
  let rowY = y + 38 + 12;
  const rows: string[] = [];
  for (const c of s.initContainers) {
    rows.push(containerRow(x, rowY, c, true));
    rowY += ROW_H;
  }
  for (const c of s.containers) {
    rows.push(containerRow(x, rowY, c, false));
    rowY += ROW_H;
  }
  const conditionsLine = s.conditions
    .filter((c) => c.status === 'True')
    .map((c) => c.type)
    .join(' · ');

  return (
    `<g class="sch-pod" data-resource-id="${esc(s.podId)}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" style="fill:var(--vpk-kind-pod, ${fill('Pod')})" stroke="#00000033" stroke-width="1.6" />` +
    `<text class="sch-pod-header" x="${x + 10}" y="${y + 17}">${esc(clip(s.podName, 22))}</text>` +
    `<text class="sch-pod-sub" x="${x + 10}" y="${y + 32}" fill="${phaseColor}" font-weight="600">${esc(s.phase ?? '')}${conditionsLine ? `  ·  ${esc(clip(conditionsLine, 34))}` : ''}</text>` +
    rows.join('') +
    `</g>`
  );
}

function containerRow(
  x: number,
  y: number,
  c: { name: string; ready?: boolean; stateLabel?: string; restartCount?: number },
  isInit: boolean,
): string {
  const ok = c.ready || c.stateLabel === 'Completed';
  const dot = ok ? STATUS_FILL.ok : STATUS_FILL.error;
  const label = `${c.name}${isInit ? ' (init)' : ''} ${c.stateLabel ?? ''}${c.restartCount ? ` ↻${c.restartCount}` : ''}`;
  return (
    `<circle cx="${x + 14}" cy="${y - 4}" r="3" fill="${dot}" />` +
    `<text class="sch-pod-row" x="${x + 22}" y="${y}">${esc(clip(label, 30))}</text>`
  );
}

function phaseHealth(phase: string | undefined): 'ok' | 'warn' | 'error' {
  if (phase === 'Running' || phase === 'Succeeded') return 'ok';
  if (phase === 'Pending') return 'warn';
  return 'error';
}

function box(id: string, kind: string, name: string, x: number, y: number, w: number, h: number, fillColor: string): string {
  return (
    `<g class="sch-owner" data-resource-id="${esc(id)}" data-kind="${esc(kind)}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" style="fill:var(--vpk-kind-${cssKind(kind)}, ${fillColor})" stroke="#00000033" />` +
    `<text class="sch-name" x="${x + 8}" y="${y + 16}">${esc(clip(name, 20))}</text>` +
    `<text class="sch-kind" x="${x + 8}" y="${y + 28}">(${esc(kind)})</text>` +
    `</g>`
  );
}

function dashedEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="sch-creates" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
}
function solidEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<line class="sch-refs" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
}

function fill(kind: string): string {
  return KIND_FILL[kind] ?? '#6b6b6b';
}
function cssKind(kind: string): string {
  return kind.toLowerCase().replace(/[^a-z0-9]/g, '-');
}
function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
function esc(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
