import { iconPathForKind } from '@vpk/core';
import type { SchematicDto } from '../schematic';

type Container = SchematicDto['containers'][number];
type Volume = SchematicDto['volumes'][number];
type Service = SchematicDto['network']['services'][number];

// var(--vpk-status-*) — inlined into the live DOM (see index.css theming), so it re-themes across all 4 themes.
const STATUS_OK = 'var(--vpk-status-ok, #2e8b57)';
const STATUS_ERROR = 'var(--vpk-status-error, #c0392b)';
const STATUS_NEUTRAL = 'var(--vpk-status-unknown, #9a9a9a)';

/** Transient debug containers (spec.ephemeralContainers) get their own accent — deliberately distinct from the
 *  init (grey) and app (green/red) sections so it reads at a glance that they aren't part of the declared spec. */
const EPHEMERAL = '#8e44ad';
/** The active-selection accent (the picked container's radio + card border, the picked volume's chip border) —
 *  a blue distinct from every status/section color so "what's selected" never reads as a health state. */
const SELECT = '#2f6df6';

const MARGIN = 24;
const TITLE_H = 44;
const COL_GAP = 60;
const CONFIG_W = 172;
const SERVICE_W = 160;
const STORAGE_W = 196;
// Wider than the first cut (was 330) so a container's image/mounts lines have room without clipping — the Pod
// boundary and the volumes box both size to this.
const CARD_W = 430;
const POD_PAD = 18;
const SECTION_HEADER_H = 22;
const CARD_GAP = 12;
const SECTION_GAP = 10;
const ROW_H = 18;
const RADIO_CX_OFF = 18;
const SERVICE_ROW_H = 50;
const ICON_R = 18;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Opts {
  selectedContainer?: string | null;
  selectedVolume?: string | null;
}

/**
 * The Container schematic (companion to renderSchematicSvg): a single Pod opened into its three container
 * arrays — initContainers / containers / ephemeralContainers — each a detail card (image, ports, resources,
 * probes, mounts) inside the Pod boundary, over a shared `volumes` box. Interaction-driven, not static:
 *  - selecting a container (its radio) reveals ONLY that container's edges — config it consumes, its ports to
 *    the Service, and its mounts to volumes (red when a volume is shared with another container). With nothing
 *    selected there are no volume/config/port lines at all, keeping a busy Pod legible.
 *  - clicking a volume renders that volume's storage-implementation sub-diagram in the right column below the
 *    Network box: a Node + local storage for configMap/secret/emptyDir/hostPath, or the persistent chain
 *    (PVC -> PV -> StorageClass, or PVC -> PV -> VolumeAttachment -> CSIDriver) for a PVC-backed volume.
 * Ephemeral containers render distinctly and (per the K8s API, which forbids ports/resources/probes on them)
 * show only image + target + mounts.
 */
export function renderContainerSchematicSvg(s: SchematicDto, opts: Opts = {}): string {
  const selectedContainer = opts.selectedContainer ?? null;
  const selectedVolume = s.volumes.find((v) => v.name === opts.selectedVolume) ?? null;

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

  // How many containers mount each volume — the selected container's edge to a volume used by >1 container is
  // drawn with the red "shares" marker so sidecar sharing still reads even though only one container's edges show.
  const mountCount = new Map<string, number>();
  for (const sec of sections) for (const c of sec.items) for (const m of c.mounts) mountCount.set(m.volumeName, (mountCount.get(m.volumeName) ?? 0) + 1);
  const volByName = new Map(s.volumes.map((v) => [v.name, v]));

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
      body.push(containerCard(s.podId, c, i, rect, c.name === selectedContainer));
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
    const perRow = 5;
    const rows = Math.ceil(s.volumes.length / perRow);
    const volBoxH = 26 + rows * 52 + 12;
    volBox = { x: podInnerX, y: cursorY, w: CARD_W, h: volBoxH };
    body.push(dashedBox('#fbe3c2', '#c9974f', volBox, 'volumes'));
    const vw = (CARD_W - 24 - (perRow - 1) * 6) / perRow;
    s.volumes.forEach((v, idx) => {
      const col = idx % perRow;
      const row = Math.floor(idx / perRow);
      const vx = volBox!.x + 12 + col * (vw + 6);
      const vy = volBox!.y + 26 + row * 52;
      const vr: Rect = { x: vx, y: vy, w: vw, h: 42 };
      body.push(volumeChip(v, vr, v.name === selectedVolume?.name));
      volRectByName.set(v.name, vr);
    });
    cursorY += volBoxH;
  }

  const boundaryBottom = cursorY + POD_PAD;
  const podW = CARD_W + 2 * POD_PAD;
  const boundaryRect: Rect = { x: podX, y: boundaryTop, w: podW, h: boundaryBottom - boundaryTop };

  // ---- Configuration box (left) ----
  const sideBoxTop = boundaryTop + 30;
  let configBox: Rect | null = null;
  let configCmIcon: { x: number; y: number } | null = null;
  let configSecretIcon: { x: number; y: number } | null = null;
  if (hasConfig) {
    configBox = { x: MARGIN, y: sideBoxTop, w: CONFIG_W, h: 96 };
    body.push(dashedBox('#fdf6d3', '#c9b258', configBox, 'Configuration'));
    let ix = MARGIN + 34;
    const iconY = sideBoxTop + 56;
    if (s.config.configMaps.length > 0) {
      body.push(aggregateIcon(s.config.configMaps, 'ConfigMap', ix, iconY));
      configCmIcon = { x: ix, y: iconY };
      ix += 84;
    }
    if (s.config.secrets.length > 0) {
      body.push(aggregateIcon(s.config.secrets, 'Secret', ix, iconY));
      configSecretIcon = { x: ix, y: iconY };
    }
  }

  // ---- Network box (right, top): ONE icon per Service, stacked vertically (top → down) ----
  const rightX = podX + podW + COL_GAP;
  let serviceBox: Rect | null = null;
  const serviceIcons: { ref: Service; x: number; y: number }[] = [];
  if (hasService) {
    const boxH = 26 + s.network.services.length * SERVICE_ROW_H + 8;
    serviceBox = { x: rightX, y: sideBoxTop, w: SERVICE_W, h: boxH };
    body.push(dashedBox('#dbeefa', '#7aa9c9', serviceBox, 'Network'));
    const cx = rightX + SERVICE_W / 2;
    s.network.services.forEach((svc, i) => {
      const iy = sideBoxTop + 30 + i * SERVICE_ROW_H + 18;
      body.push(serviceIcon(svc, cx, iy));
      serviceIcons.push({ ref: svc, x: cx, y: iy });
    });
  }

  let storageBottom = 0;
  if (selectedVolume) {
    // Sits at the volumes box's own height (bottom of the Pod boundary) — the clicked volume lives there, so its
    // storage chain reads as an extension of it rather than floating up by the Network box. Never overlaps the
    // Network box above it.
    const storageTop = Math.max(volBox ? volBox.y : sideBoxTop, serviceBox ? serviceBox.y + serviceBox.h + 16 : 0);
    const rendered = storageDetail(s, selectedVolume, rightX, storageTop);
    body.push(rendered.svg);
    storageBottom = storageTop + rendered.h;
  }

  // ---- edges (all drawn as right-angle elbows, never diagonal) ----
  // Container selection and volume selection are independent: a selected container ALWAYS draws its own wiring
  // (ports → the matching Service icon(s), mounts → volume tiles), and clicking a volume ADDS its storage/config
  // line without clearing those. Picking a different container radio recomputes this from scratch for the new one.
  const edges: string[] = [];
  const sel = selectedContainer ? cards.find((c) => c.c.name === selectedContainer) : undefined;
  if (sel) {
    const { c, rect } = sel;
    // ports → only the Service icon(s) whose targetPort matches one of this container's declared ports.
    for (const si of serviceIcons) {
      if (!serviceMatchesContainer(si.ref, c)) continue;
      edges.push(edge(orthoHV(rect.x + rect.w, rect.y + rect.h / 2, si.x - ICON_R, si.y), 'solid'));
    }
    const meetY = volBox ? volBox.y - 6 : rect.y + rect.h + 12;
    for (const m of c.mounts) {
      const vr = volRectByName.get(m.volumeName);
      if (!vr) continue;
      const shared = (mountCount.get(m.volumeName) ?? 0) > 1;
      edges.push(edge(orthoVHV(rect.x + rect.w / 2, rect.y + rect.h, vr.x + vr.w / 2, vr.y, meetY), shared ? 'shares' : 'solid'));
    }
    if (c.kind === 'ephemeral' && c.targetContainerName) {
      const target = cardByName.get(c.targetContainerName);
      if (target) edges.push(edge(orthoVHV(rect.x + rect.w / 2, rect.y, target.x + target.w / 2, target.y + target.h, (rect.y + target.y + target.h) / 2), 'target'));
    }
  }
  // A clicked configMap/secret VOLUME draws a line from its tile OUT the left side of the volumes area, then up
  // to the matching k8s icon in the Configuration box (so it never runs up through the container cards).
  if (selectedVolume && configBox) {
    const vr = volRectByName.get(selectedVolume.name);
    const target = selectedVolume.type === 'configMap' ? configCmIcon : selectedVolume.type === 'secret' ? configSecretIcon : null;
    if (vr && target) edges.push(edge(orthoHVH(vr.x, vr.y + vr.h / 2, podX - 16, target.x, target.y), 'solid'));
  }

  const hasRightCol = hasService || !!selectedVolume;
  const rightColW = Math.max(hasService ? SERVICE_W : 0, selectedVolume ? STORAGE_W : 0);
  const canvasW = (hasRightCol ? rightX + rightColW : podX + podW) + MARGIN;
  const canvasH = Math.max(boundaryBottom, storageBottom, serviceBox ? serviceBox.y + serviceBox.h : 0) + MARGIN;

  // Small call-to-action just above the Pod boundary telling the user how to drive the diagram.
  const instruct = selectedContainer
    ? `<text class="cs-instruct" x="${podX}" y="${boundaryTop - 7}">Showing edges for “${esc(clip(selectedContainer, 28))}” — click its radio again to clear</text>`
    : `<text class="cs-instruct" x="${podX}" y="${boundaryTop - 7}">◉  Select a container below using its radio button to trace its config, ports and volume mounts</text>`;

  // Edges are appended AFTER the body so the selected container's mount/config/port lines draw ON TOP of the
  // intervening container cards — otherwise a line to a lower volume disappears behind the cards it crosses and
  // you can't tell which volumes are actually in use.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" font-family="system-ui, sans-serif">` +
    defs() +
    styleBlock() +
    legend(s.podName) +
    instruct +
    `<rect x="${boundaryRect.x}" y="${boundaryRect.y}" width="${boundaryRect.w}" height="${boundaryRect.h}" rx="6" fill="var(--vpk-surface, #f6f6f4)" stroke="var(--vpk-border, #888)" stroke-width="1.4" />` +
    body.join('') +
    edges.join('') +
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

/** The per-container select control — a radio dot (filled when this container is the current selection). Its own
 *  data-select-container is checked before the card's data-resource-id in the client handler, so clicking the
 *  dot selects (reveals edges) while clicking the card body still opens the editor. */
function radio(name: string, selected: boolean, cx: number, cy: number): string {
  return (
    `<g data-select-container="${esc(name)}" style="cursor:pointer">` +
    `<circle cx="${cx}" cy="${cy}" r="6.5" fill="#fff" stroke="${selected ? SELECT : '#999'}" stroke-width="${selected ? 2 : 1.3}" />` +
    (selected ? `<circle cx="${cx}" cy="${cy}" r="3" fill="${SELECT}" />` : '') +
    `</g>`
  );
}

function containerCard(podId: string, c: Container, index: number, r: Rect, selected: boolean): string {
  const arrayKey = c.kind === 'init' ? 'initContainers' : c.kind === 'ephemeral' ? 'ephemeralContainers' : 'containers';
  const focusPath = esc(JSON.stringify(['spec', arrayKey, index]));
  const ephemeral = c.kind === 'ephemeral';
  const nameX = r.x + 32;
  const parts: string[] = [];
  const stroke = selected ? SELECT : ephemeral ? EPHEMERAL : '#b9b9b9';
  const strokeW = selected ? 2 : 1;
  parts.push(
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="5" fill="${ephemeral ? '#faf4fd' : '#fff'}" stroke="${stroke}" stroke-width="${strokeW}"${ephemeral && !selected ? ' stroke-dasharray="4 3"' : ''} />`,
  );
  parts.push(`<rect x="${r.x}" y="${r.y}" width="6" height="${r.h}" fill="${barColor(c)}" />`);
  parts.push(radio(c.name, selected, r.x + RADIO_CX_OFF, r.y + 16));
  parts.push(`<text class="cs-name" x="${nameX}" y="${r.y + 20}">${esc(clip(c.name, 30))}</text>`);
  parts.push(statusPill(c, r.x + r.w - 114, r.y + 20));

  let ry = r.y + 38;
  if (c.image) {
    parts.push(`<text class="cs-row" x="${nameX}" y="${ry}">image: ${esc(clip(c.image, 58))}</text>`);
    ry += ROW_H;
  }
  if (c.kind === 'app' && c.ports.length > 0) {
    parts.push(`<text class="cs-row" x="${nameX}" y="${ry}">ports</text>`);
    let px = nameX + 42;
    for (const p of c.ports.slice(0, 5)) {
      const label = `${p.containerPort}/${p.protocol ?? 'TCP'}`;
      parts.push(chip(label, px, ry - 11, '#dbeefa', '#7aa9c9', '#245'));
      px += label.length * 6 + 18;
    }
    ry += ROW_H;
  }
  if (c.resources) {
    const cpu = c.resources.cpuRequest || c.resources.cpuLimit ? `cpu ${c.resources.cpuRequest ?? '—'} / ${c.resources.cpuLimit ?? '—'}` : '';
    const mem = c.resources.memRequest || c.resources.memLimit ? `mem ${c.resources.memRequest ?? '—'} / ${c.resources.memLimit ?? '—'}` : '';
    parts.push(`<text class="cs-row" x="${nameX}" y="${ry}">${esc([cpu, mem].filter(Boolean).join(' · '))}</text>`);
    ry += ROW_H;
  }
  if (c.kind === 'app' && (c.probes.liveness || c.probes.readiness || c.probes.startup)) {
    parts.push(`<text class="cs-row" x="${nameX}" y="${ry}">probes</text>`);
    let px = nameX + 46;
    for (const [on, label] of [[c.probes.liveness, 'live'], [c.probes.readiness, 'ready'], [c.probes.startup, 'startup']] as [boolean, string][]) {
      if (!on) continue;
      parts.push(chip(label, px, ry - 11, '#ddf3e4', '#5fb37e', '#255'));
      px += label.length * 6 + 20;
    }
    ry += ROW_H;
  }
  if (c.mounts.length > 0) {
    const names = c.mounts.map((m) => `${m.volumeName}${m.readOnly ? ' (ro)' : ''}`).join(', ');
    parts.push(`<text class="cs-row cs-muted" x="${nameX}" y="${ry}">mounts: ${esc(clip(names, 58))}</text>`);
    ry += ROW_H;
  }
  if (ephemeral && c.targetContainerName) {
    parts.push(`<text class="cs-row" x="${nameX}" y="${ry}" fill="${EPHEMERAL}" font-style="italic">target: ${esc(clip(c.targetContainerName, 24))} · no ports/probes/resources</text>`);
    ry += ROW_H;
  }

  // Card body opens the editor at this container's YAML (data-focus-path); the radio's data-select-container is
  // handled first by the client so the dot selects instead.
  return `<g data-resource-id="${esc(podId)}" data-focus-path="${focusPath}" data-names="${esc(JSON.stringify([c.name]))}" style="cursor:pointer">${parts.join('')}</g>`;
}

/** A volume tile — carries data-select-volume (clicking it renders its storage-implementation sub-diagram, and
 *  toggles it off on a second click). Every tile has the same border (orange, 1px); only the currently-selected
 *  tile is highlighted (accent, 2px) — which volumes the selected container mounts is shown by the edges, not
 *  by varying tile borders. */
function volumeChip(v: Volume, r: Rect, selected: boolean): string {
  const caption = v.backingRef?.kind === 'PersistentVolumeClaim' ? 'PVC' : v.type;
  const stroke = selected ? SELECT : '#c9974f';
  const strokeW = selected ? 2 : 1;
  return (
    `<g data-select-volume="${esc(v.name)}" data-names="${esc(JSON.stringify([v.name]))}" style="cursor:pointer">` +
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="5" fill="#fff" stroke="${stroke}" stroke-width="${strokeW}" />` +
    `<text x="${r.x + r.w / 2}" y="${r.y + 18}" text-anchor="middle" font-size="10" font-weight="700" fill="#333">${esc(clip(v.name, Math.floor(r.w / 7)))}</text>` +
    `<text x="${r.x + r.w / 2}" y="${r.y + 32}" text-anchor="middle" font-size="8.5" fill="#666">${esc(clip(caption, Math.floor(r.w / 6)))}</text>` +
    `</g>`
  );
}

/** The clicked volume's storage-implementation chain, drawn top-to-bottom in the right column. `local` volumes
 *  (configMap/secret/emptyDir/hostPath) resolve onto the Node the Pod runs on; PVC-backed volumes draw their
 *  persistent chain. Returns the box height so the caller can size the canvas around it. */
function storageDetail(s: SchematicDto, v: Volume, x: number, y: number): { svg: string; h: number } {
  const items: { kind: string; ref?: { id: string; name: string }; label: string; glyph?: 'localdisk' }[] = [];
  if (v.implementation === 'local') {
    if (v.backingRef) items.push({ kind: v.backingRef.kind, ref: v.backingRef, label: v.backingRef.name });
    if (s.node) items.push({ kind: 'Node', ref: s.node, label: s.node.name });
    items.push({ kind: '', glyph: 'localdisk', label: `${v.type} (local)` });
  } else {
    if (v.backingRef) items.push({ kind: 'PersistentVolumeClaim', ref: v.backingRef, label: v.backingRef.name });
    if (v.pv) items.push({ kind: 'PersistentVolume', ref: v.pv, label: v.pv.name });
    if (v.implementation === 'pvc-pv-va-csi') {
      if (v.volumeAttachment) items.push({ kind: 'VolumeAttachment', ref: v.volumeAttachment, label: v.volumeAttachment.name });
      if (v.csiDriver) items.push({ kind: 'CSIDriver', ref: v.csiDriver, label: v.csiDriver.name });
    } else if (v.storageClass) {
      items.push({ kind: 'StorageClass', ref: v.storageClass, label: v.storageClass.name });
    }
  }

  const ROW = 64;
  const box: Rect = { x, y, w: STORAGE_W, h: 30 + items.length * ROW + 6 };
  const parts: string[] = [dashedBox('#ede9e0', '#a99', box, `Storage · ${clip(v.name, 16)}`)];
  const cx = x + STORAGE_W / 2;
  items.forEach((it, i) => {
    const iy = y + 44 + i * ROW;
    if (i > 0) parts.push(`<line x1="${cx}" y1="${iy - ROW + 20}" x2="${cx}" y2="${iy - 20}" stroke="var(--vpk-fg,#555)" stroke-width="1.2" marker-end="url(#cs-solid)" />`);
    if (it.glyph === 'localdisk') {
      // A small disk/cylinder glyph for node-local storage (no K8s icon exists for "the node's own disk").
      parts.push(`<ellipse cx="${cx}" cy="${iy - 12}" rx="15" ry="5" fill="#e8e2d4" stroke="#a99" /><rect x="${cx - 15}" y="${iy - 12}" width="30" height="18" fill="#e8e2d4" stroke="#a99" /><ellipse cx="${cx}" cy="${iy + 6}" rx="15" ry="5" fill="#e8e2d4" stroke="#a99" />`);
    } else {
      const icon = `<image href="${iconPathForKind(it.kind)}" x="${cx - 17}" y="${iy - 17}" width="34" height="34" />`;
      const clickable = it.ref && !it.ref.id.includes('/');
      parts.push(clickable ? `<g data-resource-id="${esc(it.ref!.id)}" data-names="${esc(JSON.stringify([it.label]))}" style="cursor:pointer">${icon}</g>` : icon);
    }
    parts.push(`<text x="${cx}" y="${iy + 24}" text-anchor="middle" font-size="9" fill="#333">${esc(clip(it.label, 24))}</text>`);
  });
  return { svg: parts.join(''), h: box.h };
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

/** One Service icon (clickable to open its definition) with its name clipped below — the Network box stacks one
 *  of these per Service so a selected container can point a line at the specific one(s) that expose it. */
function serviceIcon(svc: Service, cx: number, cy: number): string {
  return (
    `<g data-resource-id="${esc(svc.id)}" data-names="${esc(JSON.stringify([svc.name]))}" style="cursor:pointer">` +
    iconImage('Service', cx, cy) +
    `<text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="8.5" fill="#555">${esc(clip(svc.name, 22))}</text>` +
    `</g>`
  );
}

/** Whether a Service routes to this container: any of the Service's targetPorts matches one of the container's
 *  declared ports — by number (numeric targetPort == containerPort) or by name (named targetPort == port name). */
function serviceMatchesContainer(svc: Service, c: Container): boolean {
  return svc.targetPorts.some((tp) =>
    typeof tp === 'number' ? c.ports.some((p) => p.containerPort === tp) : c.ports.some((p) => p.name === tp),
  );
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
    `.cs-instruct{font-size:11px;font-weight:600;fill:${SELECT}}` +
    `</style>`
  );
}

function legend(podName: string): string {
  return (
    `<text class="cs-title" x="${MARGIN}" y="26">Pod: ${esc(clip(podName, 34))} · Container schematic</text>` +
    `<line x1="${MARGIN + 470}" y1="21" x2="${MARGIN + 498}" y2="21" stroke="var(--vpk-fg,#444)" stroke-width="1.4" marker-end="url(#cs-solid)" />` +
    `<text class="cs-legend" x="${MARGIN + 504}" y="25">mount / env</text>` +
    `<line x1="${MARGIN + 600}" y1="21" x2="${MARGIN + 628}" y2="21" stroke="${STATUS_ERROR}" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#cs-red)" />` +
    `<text class="cs-legend" x="${MARGIN + 634}" y="25">shares volume</text>` +
    `<line x1="${MARGIN + 744}" y1="21" x2="${MARGIN + 772}" y2="21" stroke="${EPHEMERAL}" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#cs-pur)" />` +
    `<text class="cs-legend" x="${MARGIN + 778}" y="25">debug targets</text>`
  );
}

/** All connectors are right-angle elbows (per feedback: 90° bends, never diagonal). Three routers cover the
 *  cases: HV for card→Network (out sideways, up, in), VHV for card→volume (down to a corridor above the
 *  volumes box, across, down into the tile), and Vup for a volume tile→Configuration icon (straight up, then
 *  across to the icon). */
function orthoHV(x1: number, y1: number, x2: number, y2: number): string {
  const xm = (x1 + x2) / 2;
  return `M${x1} ${y1} H${xm} V${y2} H${x2}`;
}
function orthoVHV(x1: number, y1: number, x2: number, y2: number, meetY: number): string {
  return `M${x1} ${y1} V${meetY} H${x2} V${y2}`;
}
/** Horizontal out to a corridor X, up/down, then horizontal to the target — used for a volume tile→Configuration
 *  icon line so it exits the LEFT side of the volumes area (via `cx`, just left of the Pod boundary) and rises
 *  up the gap to the icon, rather than cutting straight up through the container cards. */
function orthoHVH(x1: number, y1: number, cx: number, x2: number, y2: number): string {
  return `M${x1} ${y1} H${cx} V${y2} H${x2}`;
}

function edge(d: string, kind: 'solid' | 'shares' | 'target'): string {
  const [stroke, dash, marker] =
    kind === 'shares'
      ? [STATUS_ERROR, ' stroke-dasharray="5 4"', 'cs-red']
      : kind === 'target'
        ? [EPHEMERAL, ' stroke-dasharray="4 3"', 'cs-pur']
        : ['var(--vpk-fg, #444)', '', 'cs-solid'];
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.3"${dash} marker-end="url(#${marker})" />`;
}

function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
function esc(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
