import type { ClusterWheel, WheelPoint } from '@vpk/core';

/**
 * Render the Cluster Wheel as a flat, top-down 2D SVG — the same `projectClusterWheel` geometry the main 3D
 * view draws, seen from directly above. The Course view's embedded graphic panel uses this for its "Wheel" tab
 * (from the ISOLATED course graph — see server/src/course/graphic.ts), deliberately as an SVG rather than a
 * second Scene3D: Scene3D is a single-WebGL-context singleton that "must stay mounted" (App.tsx), so it can't
 * be mounted a second time for the course's isolated capture. A server-drawn SVG sidesteps that entirely and
 * matches how the Schematic tab already renders (renderSchematicSvg), so both coexist in one panel.
 *
 * The wheel disk lies in the x/z plane (Scene3D: `atan2(z, x)`), centered on the origin, with y the tier
 * elevation the 3D view extrudes — so this projection simply drops y and maps (x, z) to the SVG plane. It's a
 * faithful overview, not the full interactive scene: guide rings, connector lines, and one dot per resource
 * (colored exactly as the 3D view colors it), with the real name on hover via <title>.
 */

const SIZE = 620; // square canvas — the wheel is origin-centered, so world [-R, R] maps into [PAD, SIZE-PAD]
const PAD = 18;

export function renderWheelSvg(w: ClusterWheel): string {
  const cp = w.controlPlane;
  // Every control-plane item is a WheelInfoItem (extends WheelPoint) — flatten the layer's several arrays into
  // one list so bounds-fitting and the id→position map (for edges) both see the same points as everything else.
  const cpItems = [
    ...cp.kubelets,
    ...cp.kubeProxies,
    ...cp.components,
    cp.kubectl,
    ...cp.imageRegistries,
    ...cp.planes.flatMap((p) => p.items),
  ];
  const tiers = [
    w.network,
    w.endpoints,
    w.ingress,
    w.storage,
    w.persistentVolumes,
    w.storageClasses,
    w.volumeAttachments,
    w.csiDrivers,
  ];
  const tierItems = tiers.flatMap((t) => t.items);
  const all: WheelPoint[] = [
    ...w.nodes,
    ...w.pods,
    ...tierItems,
    ...w.csiNodeDrivers,
    ...w.localStorage,
    ...cpItems,
  ];

  // Size the viewport from the largest radius present (rings + every point) so guide rings stay circular and
  // the whole capture is centered, whether it's a two-Pod kind cluster or a busy one.
  let R = Math.max(w.outerRadius, w.csiRingRadius, cp.radius, 1);
  for (const p of all) R = Math.max(R, Math.abs(p.x), Math.abs(p.z));
  R *= 1.06;
  const scale = (SIZE - 2 * PAD) / (2 * R);
  const sx = (x: number): number => round(PAD + (x + R) * scale);
  const sy = (z: number): number => round(PAD + (z + R) * scale);

  const pos = new Map<string, { x: number; y: number }>();
  for (const p of all) pos.set(p.id, { x: sx(p.x), y: sy(p.z) });

  const parts: string[] = [];

  // ---- Guide rings (outer node ring, CSI ring, control-plane ring) ----
  const cxc = sx(0);
  const cyc = sy(0);
  const ring = (r: number): string =>
    `<circle cx="${cxc}" cy="${cyc}" r="${round(r * scale)}" fill="none" stroke="var(--vpk-fg-muted, #888)" stroke-opacity="0.25" stroke-dasharray="4 5" />`;
  parts.push(ring(w.outerRadius), ring(w.csiRingRadius), ring(cp.radius));

  // ---- Connector lines (drawn under the dots) ----
  const edge = (aId: string, bId: string): string => {
    const a = pos.get(aId);
    const b = pos.get(bId);
    if (!a || !b) return '';
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--vpk-fg-muted, #888)" stroke-opacity="0.28" stroke-width="0.8" />`;
  };
  for (const e of w.podToNetwork) parts.push(edge(e.podId, e.itemId));
  for (const e of w.podToStorage) parts.push(edge(e.podId, e.itemId));
  for (const arr of [
    w.serviceToEndpoints,
    w.serviceToIngress,
    w.storageToPv,
    w.pvToStorageClass,
    w.pvToVolumeAttachment,
    w.storageClassToCsiDriver,
    w.volumeAttachmentToCsiDriver,
  ]) {
    for (const e of arr) parts.push(edge(e.fromId, e.toId));
  }

  // ---- Dots: one per resource, colored exactly as the 3D view colors it ----
  const dot = (p: WheelPoint, r: number): string =>
    `<circle cx="${sx(p.x)}" cy="${sy(p.z)}" r="${r}" fill="${esc(p.color)}"><title>${esc(p.name)}</title></circle>`;

  for (const item of tierItems) parts.push(dot(item, 3.2));
  for (const d of w.csiNodeDrivers) parts.push(dot(d, 2.6));
  for (const s of w.localStorage) parts.push(dot(s, 2.6));
  for (const c of cpItems) parts.push(dot(c, 2.4));
  for (const pod of w.pods) parts.push(dot(pod, 2.4));

  // ---- Nodes on top: a rounded square filled by structural color, ringed by health color ----
  const showLabels = w.nodes.length <= 16;
  for (const n of w.nodes) {
    const x = sx(n.x);
    const y = sy(n.z);
    const half = 7;
    parts.push(
      `<g><title>${esc(n.name)} — ${esc(n.health)} (${n.podCount} pod${n.podCount === 1 ? '' : 's'})</title>` +
        `<rect x="${round(x - half)}" y="${round(y - half)}" width="${half * 2}" height="${half * 2}" rx="3" fill="${esc(n.color)}" stroke="${esc(n.healthColor)}" stroke-width="2" /></g>`,
    );
    if (showLabels)
      parts.push(
        `<text class="wh-node" x="${x}" y="${round(y + half + 11)}" text-anchor="middle">${esc(clip(n.name, 16))}</text>`,
      );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" font-family="system-ui, sans-serif">` +
    `<style>.wh-node{font-size:9px;fill:var(--vpk-fg, #333)}</style>` +
    parts.join('') +
    `</svg>`
  );
}

/** Two decimals is plenty for screen coordinates and keeps the payload (and test snapshots) tidy. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function esc(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
