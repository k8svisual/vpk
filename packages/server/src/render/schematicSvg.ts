import { iconForKind } from '@vpk/core';
import type { SchematicDto } from '../schematic';

interface Ref {
  id: string;
  name: string;
}

const ICON_R = 20;
const GROUP_W = 210;
const GROUP_H = 112;
const COL_GAP = 60;
const ROW_GAP = 20;
const POD_W = 260;
const MARGIN = 24;
const CONTAINER_ROW_H = 20;
/** Horizontal step between owner-chain icons (generator badge + each owner) — wider than a plain 2×ICON_R
 *  gap so a clipped 16-character name label doesn't run into its neighbor's label at this font size. */
const OWNER_STEP = 82;

/** Namespace-scoped vs. cluster-scoped ("system level") split (reference mockups redesign/reference-images/
 *  schematic-*): everything this renderer already draws (Pod, its owner chain, Config/Network/Security/
 *  Storage groups) lives inside one dashed-bordered "Namespace level resources" box; the Node the Pod runs
 *  on — and any CustomResourceDefinition backing a custom-resource owner — is cluster-scoped, so it gets its
 *  own dashed-bordered "Cluster level resources" box alongside it instead of being drawn as if namespaced. */
const BANNER_H = 34;
const OUTER_PAD = 16;
const CLUSTER_GAP = 28;
const CLUSTER_STEP = 90;
const CLUSTER_MIN_W = 150;
const NS_BANNER_FILL = '#b3b0a8';
const CLUSTER_BANNER_FILL = '#5a5a5a';

/** Served statically by @vpk/web (ported from the legacy app's images/k8/*.svg) — resolves against whatever
 *  origin the browser loaded this inlined SVG from, so no absolute host is needed here. */
const ICON_BASE = '/icons/k8/';

const STATUS_OK = '#2e8b57';
const STATUS_WARN = '#d4a017';
const STATUS_ERROR = '#c0392b';
const STATUS_NEUTRAL = '#9a9a9a';
/** "Has Events" indicator fill — deliberately not in CATEGORY_STYLE/STATUS_* (Events aren't a functional
 *  group like Config/Network, and Warning-vs-Normal is a per-event distinction the badge doesn't make; it
 *  only signals "this Pod has Event history at all"). Matches the legacy app's small purple corner rectangle. */
const EVENTS_BADGE_FILL = '#8e44ad';

const CATEGORY_STYLE: Record<string, { fill: string; stroke: string }> = {
  config: { fill: '#fdf6d3', stroke: '#c9b258' },
  owner: { fill: '#fbdcdc', stroke: '#c97a7a' },
  network: { fill: '#dbeefa', stroke: '#7aa9c9' },
  security: { fill: '#ddf3e4', stroke: '#5fb37e' },
  storage: { fill: '#fbe3c2', stroke: '#c9974f' },
  policies: { fill: '#ede3f7', stroke: '#a980c9' },
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
  const contentBasedPodH = podHeaderH + infoH + containerSectionH + 16;

  const hasConfig = s.config.configMaps.length > 0 || s.config.secrets.length > 0;
  const hasOwner = s.ownerChain.length > 0;
  const hasNetwork = s.network.services.length > 0;
  const hasSecurity = !!s.security.serviceAccount;
  const hasStorage = s.storage.pvcs.length > 0;
  const hasEvents = s.events.total > 0;

  // Namespace-wide governance resources that apply to this Pod — a single adaptive row at the very bottom
  // of the namespace box (below everything else), same aggregate-icon-per-kind pattern as every other group.
  const allPolicyGroups: { kind: string; items: Ref[] }[] = [
    { kind: 'NetworkPolicy', items: s.policies.networkPolicies },
    { kind: 'ResourceQuota', items: s.policies.resourceQuotas },
    { kind: 'LimitRange', items: s.policies.limitRanges },
    { kind: 'RoleBinding', items: s.policies.roleBindings },
  ];
  const policyGroups = allPolicyGroups.filter((g) => g.items.length > 0);
  const hasPolicies = policyGroups.length > 0;
  const policiesW = hasPolicies ? Math.max(GROUP_W, 40 + policyGroups.length * 90) : 0;
  const policiesH = hasPolicies ? GROUP_H : 0;

  const ownerW = hasOwner ? Math.max(GROUP_W, OWNER_STEP * (s.ownerChain.length + (s.generatorLabel ? 1 : 0)) + 40) : 0;
  // hasEvents reserves the same GROUP_W footprint as Owner/Network — the purple badge (drawn at MARGIN,MARGIN,
  // same corner) needs podX pushed right even when neither Owner nor Network is present, or it would sit
  // directly under the Pod card.
  const leftColW = Math.max(hasOwner ? ownerW : 0, hasNetwork ? GROUP_W : 0, hasEvents ? GROUP_W : 0);
  // Storage's own box now holds only the PVC icon — PV/StorageClass are cluster-scoped and render in the
  // Cluster box instead (see below), so this column no longer needs the wider 3-icon-chain width.
  const rightColW = Math.max(hasSecurity ? GROUP_W : 0, hasStorage ? GROUP_W : 0);

  const configW = hasConfig ? Math.max(GROUP_W, 90 * ((s.config.configMaps.length > 0 ? 1 : 0) + (s.config.secrets.length > 0 ? 1 : 0)) + 40) : 0;
  const configH = hasConfig ? GROUP_H : 0;

  const podX = MARGIN + (leftColW > 0 ? leftColW + COL_GAP : 0);
  // The events badge is the same GROUP_H-tall "top row" as Configuration (both start at y=MARGIN) — Owner/
  // Network (leftY, below) need to start below whichever of the two is present, same as Config alone used to.
  const podY = MARGIN + (hasConfig || hasEvents ? GROUP_H + ROW_GAP : 0);

  // Network's (and Storage's) own bottom edge, podY-relative — the Pod box is stretched to reach at least
  // this far down so their connector arrows land ON the box's edge, not pointing at empty space below it.
  const networkBottom = hasNetwork ? podY + (hasOwner ? GROUP_H + ROW_GAP : 0) + GROUP_H : 0;
  const storageBottom = hasStorage ? podY + (hasSecurity ? GROUP_H + ROW_GAP : 0) + GROUP_H : 0;
  const podH = Math.max(contentBasedPodH, networkBottom - podY, storageBottom - podY);

  const policiesX = podX + POD_W / 2 - policiesW / 2;
  const canvasW = Math.max(
    MARGIN + leftColW + (leftColW > 0 ? COL_GAP : 0) + POD_W + (rightColW > 0 ? COL_GAP : 0) + rightColW + MARGIN,
    hasPolicies ? policiesX + policiesW + MARGIN : 0,
  );
  const contentH = Math.max(
    podH,
    hasOwner && hasNetwork ? GROUP_H * 2 + ROW_GAP : hasOwner || hasNetwork ? GROUP_H : 0,
    hasSecurity && hasStorage ? GROUP_H * 2 + ROW_GAP : hasSecurity || hasStorage ? GROUP_H : 0,
  );
  // Policies row sits below whatever the tallest existing column is, still inside the same namespace box.
  const policiesY = hasPolicies ? podY + contentH + ROW_GAP : 0;
  const canvasH = (hasPolicies ? policiesY + policiesH : podY + contentH) + MARGIN;

  const parts: string[] = [];
  parts.push(eventsBadge(s));

  // ---- Configuration (above Pod) ----
  // Every group-to-Pod connector below is kept strictly horizontal or vertical (never diagonal) by sharing
  // the SAME coordinate on the axis that "points at" the Pod: Config's connectors share the icon's own X
  // (a straight vertical drop to the Pod's top edge); every side column's connectors share the icon's own Y
  // (a straight horizontal line into the Pod's left/right edge) — matching the reference mockups exactly,
  // rather than aiming at a fixed point on the Pod (which is what produced diagonals before).
  if (hasConfig) {
    const cx = podX + POD_W / 2 - configW / 2;
    const cy = MARGIN;
    parts.push(categoryBox('config', 'Configuration', cx, cy, configW, configH));
    const icons: string[] = [];
    let ix = cx + 30;
    if (s.config.configMaps.length > 0) {
      icons.push(aggregateIcon(s.config.configMaps, 'ConfigMap', ix, cy + 60));
      parts.push(solidEdge(ix, podY, ix, cy + configH - 14));
      ix += 90;
    }
    if (s.config.secrets.length > 0) {
      icons.push(aggregateIcon(s.config.secrets, 'Secret', ix, cy + 60));
      parts.push(solidEdge(ix, podY, ix, cy + configH - 14));
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
      parts.push(dashedEdge(x + 55, iconY, x + OWNER_STEP, iconY));
      x += OWNER_STEP;
    }
    for (let i = 0; i < s.ownerChain.length; i++) {
      const owner = s.ownerChain[i] as { id: string; kind: string; name: string; crdLetter?: string };
      parts.push(kindIcon(owner.id, owner.kind, owner.name, x, iconY));
      if (owner.crdLetter) parts.push(letterBadge(owner.crdLetter, x - ICON_R + 2, iconY - ICON_R + 2));
      const nextX = x + OWNER_STEP;
      if (i < s.ownerChain.length - 1) parts.push(dashedEdge(x + ICON_R, iconY, nextX - ICON_R, iconY));
      x = nextX;
    }
    parts.push(dashedEdge(x - OWNER_STEP + ICON_R, iconY, podX, iconY));
    leftY += GROUP_H + ROW_GAP;
  }
  if (hasNetwork) {
    parts.push(categoryBox('network', 'Network', MARGIN, leftY, GROUP_W, GROUP_H));
    const iconY = leftY + 56;
    parts.push(aggregateIcon(s.network.services, 'Service', MARGIN + 30, iconY));
    parts.push(solidEdge(MARGIN + 30 + ICON_R, iconY, podX, iconY));
  }

  // ---- Security + Storage (right column) ----
  const rightX = podX + POD_W + COL_GAP;
  let rightY = podY;
  if (hasSecurity) {
    parts.push(categoryBox('security', 'Security', rightX, rightY, GROUP_W, GROUP_H));
    const iconY = rightY + 56;
    const sa = s.security.serviceAccount as Ref;
    parts.push(kindIcon(sa.id, 'ServiceAccount', sa.name, rightX + 30, iconY));
    parts.push(solidEdge(podX + POD_W, iconY, rightX + 30 - ICON_R, iconY));
    // Drill into the per-subject RBAC schematic for this ServiceAccount — data-rbac-sa is the client's cue
    // (SchematicView routes it to the RBAC view instead of the editor, same delegation pattern as
    // data-resource-list). Not a data-resource-id click: the pill stands for the SA's bindings, not the SA.
    parts.push(
      `<g data-rbac-sa="${esc(sa.id)}" style="cursor:pointer">` +
        `<rect x="${rightX + 62}" y="${iconY - 10}" width="66" height="20" rx="10" fill="#fff" stroke="#5fb37e" />` +
        `<text x="${rightX + 95}" y="${iconY + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#2e7d4f">RBAC ▸</text>` +
        `</g>`,
    );
    rightY += GROUP_H + ROW_GAP;
  }
  // PVC is namespace-scoped so it stays in this box; its bound PV and PV's StorageClass are both
  // cluster-scoped (no namespace) and render in the Cluster box instead — see pvcLocalX/pvcLocalIconY below.
  // storageBoxLocalY is kept too, so the Cluster-side portion can reuse the exact same Y and the same
  // "storage" fill/stroke — one Storage group that visually continues across the two dashed boxes, not two
  // unrelated regions.
  let pvcLocalX = 0;
  let pvcLocalIconY = 0;
  let storageBoxLocalY = 0;
  if (hasStorage) {
    parts.push(categoryBox('storage', 'Storage', rightX, rightY, GROUP_W, GROUP_H));
    const iconY = rightY + 56;
    const x = rightX + 30;
    parts.push(aggregateIcon(s.storage.pvcs, 'PersistentVolumeClaim', x, iconY));
    parts.push(solidEdge(podX + POD_W, iconY, x - ICON_R, iconY));
    pvcLocalX = x;
    pvcLocalIconY = iconY;
    storageBoxLocalY = rightY;
  }

  // ---- Pod card ----
  parts.push(podCard(s, podX, podY, POD_W, podH));

  // ---- Policies (bottom row, spans below everything else — still inside the namespace box) ----
  if (hasPolicies) {
    parts.push(solidEdge(podX + POD_W / 2, podY + podH, podX + POD_W / 2, policiesY));
    parts.push(categoryBox('policies', 'Policies', policiesX, policiesY, policiesW, policiesH));
    let ix = policiesX + 30;
    const iconY = policiesY + 56;
    for (const { kind, items } of policyGroups) {
      parts.push(aggregateIcon(items, kind, ix, iconY));
      ix += 90;
    }
  }

  // ---- Namespace level resources / Cluster level resources (reference mockups' outer split) ----
  // Everything above is namespace-scoped and unchanged in its own internal (MARGIN-relative) coordinate
  // space — canvasW/canvasH already include that MARGIN as padding on every side, so it drops straight into
  // a dashed-bordered box with a grey banner without touching any of the math above. The Node the Pod runs
  // on, and any CRD backing a custom-resource owner, are cluster-scoped and get their own box beside it.
  const clusterItems: { letter?: string; id: string; kind: string; name: string }[] = [];
  if (s.node) clusterItems.push({ id: s.node.id, kind: 'Node', name: s.node.name });
  for (const crd of s.crds) clusterItems.push({ letter: crd.letter, id: crd.id, kind: 'CustomResourceDefinition', name: crd.name });
  // PV/StorageClass are a second row so their edge back to the namespace box's PVC icon can share its exact
  // Y coordinate (kept strictly horizontal, matching every other connector in this diagram) rather than
  // whatever fixed Y the Node/CRD row sits at.
  const hasClusterStorage = s.storage.pvs.length > 0;
  const hasVA = s.storage.volumeAttachments.length > 0;
  const storageRowItems = hasClusterStorage ? 1 + (s.storage.storageClasses.length > 0 ? 1 : 0) : 0;
  // Same width formula categoryBox itself uses (GROUP_W floor) — the colored Storage box must never overflow
  // past the Cluster box's own dashed border.
  const clusterStorageW = hasClusterStorage ? Math.max(GROUP_W, 40 + storageRowItems * CLUSTER_STEP) : 0;
  // VolumeAttachment is a THIRD sibling off PV (alongside StorageClass) — like the wheel's own VA/SC Y-band
  // split, it gets its own row below the PV/StorageClass row instead of chaining sideways past StorageClass,
  // so its "references PV" edge is a plain vertical drop straight under PV rather than a horizontal line that
  // would visually cut through the StorageClass icon sitting in between.
  const VA_ROW_GAP = 70;
  const clusterStorageH = hasVA ? GROUP_H + VA_ROW_GAP : GROUP_H;

  const nsBoxW = canvasW;
  const nsBoxH = canvasH;
  const nsBoxX = OUTER_PAD;
  const nsBoxY = OUTER_PAD + BANNER_H;
  const storageBoxAbsY = nsBoxY + storageBoxLocalY;

  const clusterBoxW = Math.max(CLUSTER_MIN_W, 40 + clusterItems.length * CLUSTER_STEP, clusterStorageW);
  const clusterBoxX = nsBoxX + nsBoxW + CLUSTER_GAP;
  const clusterBoxY = nsBoxY;
  const clusterBoxH = Math.max(nsBoxH, hasClusterStorage ? storageBoxAbsY - clusterBoxY + clusterStorageH + OUTER_PAD : 0);

  const clusterParts: string[] = [];
  let cix = clusterBoxX + 40;
  const ciy = clusterBoxY + 50;
  for (const item of clusterItems) {
    clusterParts.push(kindIcon(item.id, item.kind, item.name, cix, ciy));
    if (item.letter) clusterParts.push(letterBadge(item.letter, cix - ICON_R + 2, ciy - ICON_R + 2));
    cix += CLUSTER_STEP;
  }

  if (hasClusterStorage) {
    // The namespace box's own content (including the PVC icon) lives inside a translated <g> — convert its
    // local coordinates to this (untranslated) top-level space so the cross-box edge lands exactly on it.
    const pvcAbsX = nsBoxX + pvcLocalX;
    const pvcAbsY = nsBoxY + pvcLocalIconY;
    // Same fill/stroke as the namespace-side Storage box, at the exact same absolute Y (storageBoxLocalY is
    // the same rightY the namespace-side box used) — reads as one Storage group continuing across the gap
    // between the two dashed boxes, not a second, unrelated region.
    clusterParts.push(categoryBox('storage', 'Storage', clusterBoxX, storageBoxAbsY, clusterStorageW, clusterStorageH));
    const sx = clusterBoxX + 40;
    clusterParts.push(solidEdge(pvcAbsX + ICON_R, pvcAbsY, sx - ICON_R, pvcAbsY));
    clusterParts.push(aggregateIcon(s.storage.pvs, 'PersistentVolume', sx, pvcAbsY));
    if (s.storage.storageClasses.length > 0) {
      const scX = sx + 90;
      clusterParts.push(dashedEdge(scX - ICON_R, pvcAbsY, sx + ICON_R, pvcAbsY));
      clusterParts.push(aggregateIcon(s.storage.storageClasses, 'StorageClass', scX, pvcAbsY));
    }
    if (hasVA) {
      const vaRowY = pvcAbsY + VA_ROW_GAP;
      clusterParts.push(solidEdge(sx, vaRowY - ICON_R, sx, pvcAbsY + ICON_R));
      clusterParts.push(aggregateIcon(s.storage.volumeAttachments, 'VolumeAttachment', sx, vaRowY));
    }
  }

  const totalW = nsBoxX + nsBoxW + CLUSTER_GAP + clusterBoxW + OUTER_PAD;
  const totalH = OUTER_PAD + BANNER_H + Math.max(nsBoxH, clusterBoxH) + OUTER_PAD;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" font-family="system-ui, sans-serif">` +
    defs() +
    `<style>` +
    `.sch-title{font-size:11px;font-weight:600;fill:#444}` +
    `.sch-count{font-size:10px;fill:#333;font-weight:600}` +
    `.sch-pod-name{font-size:13px;font-weight:600;fill:#222;text-anchor:middle}` +
    `.sch-pod-label{font-size:10.5px;fill:#555}` +
    `.sch-pod-row{font-size:10.5px;fill:#333}` +
    `.sch-banner-title{font-size:14px;font-weight:700;fill:#fff}` +
    `</style>` +
    outerBox(nsBoxX, nsBoxY, nsBoxW, nsBoxH, NS_BANNER_FILL, 'Namespace Level', 'start', s.podName) +
    `<g transform="translate(${nsBoxX}, ${nsBoxY})">` + parts.join('') + `</g>` +
    outerBox(clusterBoxX, clusterBoxY, clusterBoxW, clusterBoxH, CLUSTER_BANNER_FILL, 'Cluster Level', 'middle') +
    clusterParts.join('') +
    `</svg>`
  );
}

/** A dashed-border box with a solid banner header above it (grey for Namespace, dark grey for Cluster) —
 *  the box itself starts BANNER_H below `y` (banner occupies OUTER_PAD..OUTER_PAD+BANNER_H at the top of the
 *  whole canvas, shared by both boxes so their borders line up). `rightLabel` (the Pod's own name, for the
 *  Namespace banner) sits right-justified with the same padding the title uses on the left, so it never
 *  crowds the banner's own edge. */
function outerBox(x: number, y: number, w: number, h: number, bannerFill: string, title: string, anchor: 'start' | 'middle', rightLabel?: string): string {
  const bannerY = y - BANNER_H;
  const textX = anchor === 'start' ? x + 14 : x + w / 2;
  const textY = bannerY + BANNER_H / 2 + 5;
  const rightText = rightLabel
    ? `<text class="sch-banner-title" x="${x + w - 14}" y="${textY}" text-anchor="end">${esc(rightLabel)}</text>`
    : '';
  return (
    `<rect x="${x}" y="${bannerY}" width="${w}" height="${BANNER_H}" fill="${bannerFill}" />` +
    `<text class="sch-banner-title" x="${textX}" y="${textY}" text-anchor="${anchor}">${esc(title)}</text>` +
    rightText +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#333" stroke-width="1.2" stroke-dasharray="3 3" />`
  );
}

/** Small black circle + white letter, overlapping an icon's top-left corner — links a namespace-level
 *  custom-resource instance to its CustomResourceDefinition in the Cluster level resources box (same letter
 *  on both). Matches the reference mockups' "(a)" badge. */
function letterBadge(letter: string, cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="8" fill="#000" /><text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="10" fill="#fff">${esc(letter)}</text>`;
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
    `<g data-resource-id="${esc(id)}" data-names="${esc(JSON.stringify([name]))}" style="cursor:pointer">` +
    iconImage(kind, cx, cy) +
    `</g>`
  );
}

/** One icon representing every item of a kind, with a "(N)" count when there's more than one (matches the
 *  reference mockups' `cm (7)` / `secret (5)` pattern). Exactly one item is directly clickable (opens that
 *  item's definition, same as any other single icon); more than one instead carries a `data-resource-list` +
 *  `data-kind` payload (the client opens a "Resources" list modal from it). Every icon (single or multi)
 *  carries `data-names` — the client's own hover tooltip (SchematicView) reads it to show the real item
 *  name(s), since the small always-visible name label under each icon has been dropped. */
function aggregateIcon(items: Ref[], kind: string, cx: number, cy: number): string {
  const namesAttr = esc(JSON.stringify(items.map((i) => i.name)));
  if (items.length === 1) {
    return (
      `<g data-resource-id="${esc(items[0]!.id)}" data-names="${namesAttr}" style="cursor:pointer">` +
      iconImage(kind, cx, cy) +
      `</g>`
    );
  }
  const listPayload = JSON.stringify(items.map((i) => ({ id: i.id, name: i.name })));
  return (
    `<g data-resource-list="${esc(listPayload)}" data-kind="${esc(kind)}" data-names="${namesAttr}" style="cursor:pointer">` +
    iconImage(kind, cx, cy) +
    `<text class="sch-count" x="${cx + ICON_R + 4}" y="${cy + 4}">(${items.length})</text>` +
    `</g>`
  );
}

/** Purple "has Events" card in the namespace box's top-left corner — same footprint and top edge (y=MARGIN)
 *  as the Configuration box, sitting in the same top row, above the Generator OwnerRefs box (leftY starts
 *  below this row — see podY above) — shown only when this Pod has associated Event objects. Clicking it (via
 *  data-pod-events, SchematicView's own delegation) jumps to the Events view pre-filtered to this Pod, same
 *  pattern as the Security box's "RBAC ▸" pill (data-rbac-sa). */
function eventsBadge(s: SchematicDto): string {
  if (s.events.total === 0) return '';
  const x = MARGIN;
  const y = MARGIN;
  const w = GROUP_W;
  const h = GROUP_H;
  const payload = esc(JSON.stringify({ id: s.podId, namespace: s.namespace ?? '', podName: s.podName }));
  const warningNote = s.events.warnings > 0 ? ` (${s.events.warnings} Warning)` : '';
  const tooltip = esc(JSON.stringify([`${s.events.total} Event${s.events.total === 1 ? '' : 's'}${warningNote}`]));
  const warningLabel = s.events.warnings > 0 ? `<text x="${x + w / 2}" y="${y + h - 14}" text-anchor="middle" font-size="11" fill="#f3d9fa">${s.events.warnings} Warning</text>` : '';
  return (
    `<g data-pod-events="${payload}" data-names="${tooltip}" style="cursor:pointer">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${EVENTS_BADGE_FILL}" />` +
    `<text x="${x + 10}" y="${y + 16}" font-size="11" font-weight="600" fill="#fff">Events</text>` +
    `<text x="${x + w / 2}" y="${y + h / 2 + 10}" text-anchor="middle" font-size="28" font-weight="700" fill="#fff">${s.events.total}</text>` +
    warningLabel +
    `</g>`
  );
}

function generatorBadge(label: string, cx: number, cy: number): string {
  const w = 70;
  return (
    `<g>` +
    `<rect x="${cx - w / 2}" y="${cy - 10}" width="${w}" height="20" fill="#fff" stroke="#999" />` +
    `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#333">${esc(clip(label, 10))}</text>` +
    `</g>`
  );
}

function podCard(s: SchematicDto, x: number, y: number, w: number, h: number): string {
  const iconY = y + 30;
  let rowY = y + 40 + 54 + 16;
  const rows: string[] = [];
  s.initContainers.forEach((c, i) => {
    rows.push(containerRow(s.podId, x, rowY, `InitContainer[${i}]`, c, ['spec', 'initContainers', i]));
    rowY += CONTAINER_ROW_H;
  });
  s.containers.forEach((c, i) => {
    rows.push(containerRow(s.podId, x, rowY, `Container[${i}]`, c, ['spec', 'containers', i]));
    rowY += CONTAINER_ROW_H;
  });

  const phaseColor = STATUS_FILL(phaseHealth(s.phase));
  // Starts well clear of the "Conditions" label (~65px wide at this font size) — previously started at
  // x+24, which sat directly on top of the label text itself.
  const dots = s.conditions
    .map((c, i) => `<circle cx="${x + 90 + i * 20}" cy="${y + 40 + 40}" r="7" fill="${c.status === 'True' ? STATUS_OK : STATUS_NEUTRAL}" />`)
    .join('');
  // Phase pill + Conditions dots both jump to the same status.conditions block — Phase is a single scalar
  // field elsewhere in .status, but the Conditions array is what actually explains WHY the pod is in that
  // phase, so that's the more useful thing to land on regardless of which of the two was clicked.
  const statusFocusPath = esc(JSON.stringify(['status', 'conditions']));

  return (
    `<g data-resource-id="${esc(s.podId)}" data-names="${esc(JSON.stringify([s.podName]))}" style="cursor:pointer">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f2f2f0" stroke="#666" stroke-width="1.4" />` +
    iconImage('Pod', x + w / 2, iconY) +
    `<line x1="${x}" y1="${y + 40 + 8}" x2="${x + w}" y2="${y + 40 + 8}" stroke="#ccc" />` +
    `<g data-resource-id="${esc(s.podId)}" data-focus-path="${statusFocusPath}" style="cursor:pointer">` +
    `<text class="sch-pod-label" x="${x + 12}" y="${y + 40 + 22}">Phase</text>` +
    `<rect x="${x + 60}" y="${y + 40 + 12}" width="70" height="16" rx="3" fill="${phaseColor}" />` +
    `<text x="${x + 95}" y="${y + 40 + 24}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${esc(s.phase ?? '')}</text>` +
    `<text class="sch-pod-label" x="${x + 12}" y="${y + 40 + 44}">Conditions</text>` +
    dots +
    `</g>` +
    `<line x1="${x}" y1="${y + 40 + 54 + 6}" x2="${x + w}" y2="${y + 40 + 54 + 6}" stroke="#ccc" />` +
    rows.join('') +
    `</g>`
  );
}

function containerRow(
  podId: string,
  x: number,
  y: number,
  label: string,
  c: { name: string; ready?: boolean; stateLabel?: string },
  focusPath: (string | number)[],
): string {
  const completed = c.stateLabel === 'Completed';
  const ok = c.ready || completed;
  const pillColor = ok ? STATUS_OK : STATUS_ERROR;
  const pillLabel = c.stateLabel ?? (c.ready ? 'Running' : 'NotReady');
  const pillFill = completed ? '#c9c9c9' : pillColor;
  const pillText = completed ? '#333' : '#fff';
  const focusPayload = esc(JSON.stringify(focusPath));
  return (
    `<g data-resource-id="${esc(podId)}" data-focus-path="${focusPayload}" style="cursor:pointer">` +
    `<text class="sch-pod-row" x="${x + 12}" y="${y}">${esc(clip(label, 16))}</text>` +
    `<rect x="${x + 130}" y="${y - 12}" width="80" height="16" rx="3" fill="${pillFill}" />` +
    `<text x="${x + 170}" y="${y}" text-anchor="middle" font-size="10" font-weight="700" fill="${pillText}">${esc(clip(pillLabel, 12))}</text>` +
    `</g>`
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
