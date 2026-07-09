import { iconForKind } from '@vpk/core';
import type { RbacBindingNode, RbacRoleNode, RbacRule, RbacSubjectView } from '@vpk/core';

/**
 * Render one subject's RBAC schematic as SVG, following schematicSvg.ts's visual grammar exactly: dashed
 * outer boxes with grey "Namespace Level" / dark "Cluster Level" banners, real k8s icons carrying
 * `data-resource-id` + `data-names` (click → editor, hover → tooltip), and solid black reference edges.
 * Reading order matches the RBAC model: Subject → its bindings → the role each binding resolves to →
 * the flattened "Effective permissions" table at the bottom. A ClusterRole referenced by a RoleBinding is
 * drawn in the Cluster box but receives its edge FROM the namespace box — the one-object-two-scopes nuance
 * this diagram exists to show. Rule rows carry `data-focus-path` (["rules", i]) into the owning role.
 */

const OUTER_PAD = 16;
const BANNER_H = 34;
const NS_BANNER_FILL = '#b3b0a8';
const CLUSTER_BANNER_FILL = '#5a5a5a';
const CLUSTER_GAP = 28;
const ICON_R = 20;
const ICON_BASE = '/icons/k8/';

const BOX_W = 340;
const BINDING_COL = 84; // box-local X of the binding icon column
const ROLE_COL = 250; // box-local X of the role icon column
const SPINE_X = 44; // box-local X of the subject→bindings trunk line
const ROWS_Y = 132; // first binding row's icon-center Y (box-local)
const ROW_STEP = 72;
const CARD_X = 24;
const CARD_Y = 18;
const CARD_W = 260;
const CARD_H = 64;
const MIN_BOX_H = 190;

/** Bindings drawn per column before collapsing to a "+N more" row — a system: subject can have dozens. */
const MAX_BINDINGS = 10;
/** Effective-permission rows drawn before collapsing to "+N more rules". */
const MAX_RULES = 25;

const RULE_ROW_H = 21;
const RULES_TITLE_H = 30;

export function renderRbacSvg(v: RbacSubjectView): string {
  const rbShown = v.roleBindings.slice(0, MAX_BINDINGS);
  const crbShown = v.clusterRoleBindings.slice(0, MAX_BINDINGS);
  const rbOverflow = v.roleBindings.length - rbShown.length;
  const crbOverflow = v.clusterRoleBindings.length - crbShown.length;

  // Every ClusterRole gets a row in the cluster box: first the ones referenced by a shown CRB (sharing that
  // CRB's row so the edge is horizontal), then any referenced only via RoleBindings on rows of their own.
  const crRow = new Map<string, number>();
  crbShown.forEach((b, i) => {
    if (!crRow.has(b.roleKey)) crRow.set(b.roleKey, i);
  });
  let nextCrRow = crbShown.length + (crbOverflow > 0 ? 1 : 0);
  for (const b of rbShown) {
    if (b.roleKey.startsWith('ClusterRole|') && !crRow.has(b.roleKey)) crRow.set(b.roleKey, nextCrRow++);
  }

  const nsRows = rbShown.length + (rbOverflow > 0 ? 1 : 0);
  const clusterRows = Math.max(crbShown.length + (crbOverflow > 0 ? 1 : 0), nextCrRow);
  const boxH = Math.max(MIN_BOX_H, ROWS_Y + Math.max(nsRows, clusterRows, 1) * ROW_STEP);

  const nsBoxX = OUTER_PAD;
  const boxY = OUTER_PAD + BANNER_H;
  const clusterBoxX = nsBoxX + BOX_W + CLUSTER_GAP;
  const totalW = clusterBoxX + BOX_W + OUTER_PAD;

  const rulesShown = v.rules.slice(0, MAX_RULES);
  const rulesOverflow = v.rules.length - rulesShown.length;
  const rulesY = boxY + boxH + 26;
  const rulesH = RULES_TITLE_H + (rulesShown.length + (rulesOverflow > 0 ? 1 : 0)) * RULE_ROW_H + 10;
  const totalH = rulesY + rulesH + OUTER_PAD;

  const roleByKey = new Map<string, RbacRoleNode>();
  for (const r of [...v.roles, ...v.clusterRoles]) roleByKey.set(r.key, r);

  const ns: string[] = [];
  const cluster: string[] = [];
  const cross: string[] = [];

  // ---- Subject card (namespace box) ----
  const cardCenterY = CARD_Y + CARD_H / 2;
  ns.push(
    `<g${v.subject.id ? ` data-resource-id="${esc(v.subject.id)}"` : ''} data-names="${esc(JSON.stringify([v.subject.name]))}" style="cursor:${v.subject.id ? 'pointer' : 'default'}">` +
      `<rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="${CARD_H}" fill="var(--vpk-surface, #f2f2f0)" stroke="var(--vpk-border, #666)" stroke-width="1.4" />` +
      iconImage(v.subject.kind, CARD_X + 32, cardCenterY) +
      `<text class="rbac-card-kind" x="${CARD_X + 62}" y="${cardCenterY - 6}">${esc(v.subject.kind)}</text>` +
      `<text class="rbac-card-name" x="${CARD_X + 62}" y="${cardCenterY + 12}">${esc(clip(v.subject.name, 26))}</text>` +
      `</g>`,
  );

  // ---- RoleBindings column + their roles ----
  if (rbShown.length > 0) {
    ns.push(colHeader('RoleBindings', v.roleBindings.length, BINDING_COL, ROWS_Y - 44));
    ns.push(colHeader('Roles', 0, ROLE_COL, ROWS_Y - 44));
    const lastY = ROWS_Y + (rbShown.length - 1) * ROW_STEP;
    ns.push(spine(SPINE_X, CARD_Y + CARD_H, lastY));
    rbShown.forEach((b, i) => {
      const y = ROWS_Y + i * ROW_STEP;
      ns.push(`<line x1="${SPINE_X}" y1="${y}" x2="${BINDING_COL - ICON_R}" y2="${y}" stroke="var(--vpk-fg, #333)" stroke-width="1.3" />`);
      ns.push(bindingIcon(b, 'RoleBinding', BINDING_COL, y));
      const role = roleByKey.get(b.roleKey);
      if (!role) return;
      if (role.kind === 'Role') {
        ns.push(solidEdge(BINDING_COL + ICON_R, y, ROLE_COL - ICON_R, y));
        ns.push(roleIcon(role, ROLE_COL, y));
      } else {
        // RoleBinding → ClusterRole: the role lives in the Cluster box, but its grant stays namespace-scoped —
        // drawn as a cross-box edge (absolute coordinates, over both boxes).
        const row = crRow.get(b.roleKey) ?? 0;
        const targetY = boxY + ROWS_Y + row * ROW_STEP;
        cross.push(solidEdge(nsBoxX + BINDING_COL + ICON_R, boxY + y, clusterBoxX + ROLE_COL - ICON_R - 4, targetY));
      }
    });
    if (rbOverflow > 0) {
      ns.push(`<text class="rbac-more" x="${BINDING_COL}" y="${ROWS_Y + rbShown.length * ROW_STEP}" text-anchor="middle">+${rbOverflow} more</text>`);
    }
  } else {
    ns.push(`<text class="rbac-more" x="${CARD_X}" y="${ROWS_Y - 20}">No RoleBindings for this subject.</text>`);
  }

  // ---- ClusterRoleBindings column + ClusterRoles ----
  const hasClusterContent = crbShown.length > 0 || crRow.size > 0;
  if (hasClusterContent) {
    cluster.push(colHeader('ClusterRoleBindings', v.clusterRoleBindings.length, clusterBoxX + BINDING_COL, boxY + ROWS_Y - 44));
    cluster.push(colHeader('ClusterRoles', 0, clusterBoxX + ROLE_COL, boxY + ROWS_Y - 44));
    if (crbShown.length > 0) {
      // Trunk from the subject card across the box gap, then down the CRB column.
      const trunkY = boxY + cardCenterY;
      const spineAbsX = clusterBoxX + SPINE_X;
      const lastY = boxY + ROWS_Y + (crbShown.length - 1) * ROW_STEP;
      cluster.push(`<line x1="${nsBoxX + CARD_X + CARD_W}" y1="${trunkY}" x2="${spineAbsX}" y2="${trunkY}" stroke="var(--vpk-fg, #333)" stroke-width="1.3" />`);
      cluster.push(`<line x1="${spineAbsX}" y1="${trunkY}" x2="${spineAbsX}" y2="${lastY}" stroke="var(--vpk-fg, #333)" stroke-width="1.3" />`);
      crbShown.forEach((b, i) => {
        const y = boxY + ROWS_Y + i * ROW_STEP;
        cluster.push(`<line x1="${spineAbsX}" y1="${y}" x2="${clusterBoxX + BINDING_COL - ICON_R}" y2="${y}" stroke="var(--vpk-fg, #333)" stroke-width="1.3" />`);
        cluster.push(bindingIcon(b, 'ClusterRoleBinding', clusterBoxX + BINDING_COL, y));
        const role = roleByKey.get(b.roleKey);
        if (role && crRow.get(b.roleKey) === i) {
          cluster.push(solidEdge(clusterBoxX + BINDING_COL + ICON_R, y, clusterBoxX + ROLE_COL - ICON_R, y));
        }
      });
      if (crbOverflow > 0) {
        cluster.push(`<text class="rbac-more" x="${clusterBoxX + BINDING_COL}" y="${boxY + ROWS_Y + crbShown.length * ROW_STEP}" text-anchor="middle">+${crbOverflow} more</text>`);
      }
    }
    for (const [key, row] of crRow) {
      const role = roleByKey.get(key);
      if (role) cluster.push(roleIcon(role, clusterBoxX + ROLE_COL, boxY + ROWS_Y + row * ROW_STEP));
    }
  }

  // ---- Effective permissions table (full width, below both boxes) ----
  const rules: string[] = [];
  const tableW = totalW - 2 * OUTER_PAD;
  rules.push(`<rect x="${OUTER_PAD}" y="${rulesY}" width="${tableW}" height="${rulesH}" fill="none" stroke="var(--vpk-fg, #333)" stroke-width="1.2" stroke-dasharray="3 3" />`);
  rules.push(`<text class="rbac-rules-title" x="${OUTER_PAD + 12}" y="${rulesY + 20}">Effective permissions (${v.rules.length} rule${v.rules.length === 1 ? '' : 's'})</text>`);
  rulesShown.forEach((r, i) => {
    rules.push(ruleRow(r, OUTER_PAD + 12, rulesY + RULES_TITLE_H + i * RULE_ROW_H, tableW - 24));
  });
  if (rulesOverflow > 0) {
    rules.push(`<text class="rbac-more" x="${OUTER_PAD + 12}" y="${rulesY + RULES_TITLE_H + rulesShown.length * RULE_ROW_H + 12}">+${rulesOverflow} more rules</text>`);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" font-family="system-ui, sans-serif">` +
    `<defs><marker id="rbac-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--vpk-fg, #333)" /></marker></defs>` +
    `<style>` +
    `.rbac-banner-title{font-size:14px;font-weight:700;fill:#fff}` +
    `.rbac-card-kind{font-size:10.5px;fill:var(--vpk-fg-muted, #555)}` +
    `.rbac-card-name{font-size:12px;font-weight:600;fill:var(--vpk-fg, #222)}` +
    `.rbac-col{font-size:11px;font-weight:600;fill:var(--vpk-fg-muted, #444)}` +
    `.rbac-name{font-size:9.5px;fill:var(--vpk-fg, #333)}` +
    `.rbac-more{font-size:10.5px;fill:var(--vpk-fg-muted, #777);font-style:italic}` +
    `.rbac-rules-title{font-size:12px;font-weight:600;fill:var(--vpk-fg-muted, #444)}` +
    `.rbac-rule{font-size:10.5px;fill:var(--vpk-fg, #333)}` +
    `.rbac-pill{font-size:9px;font-weight:700}` +
    `</style>` +
    outerBox(nsBoxX, boxY, BOX_W, boxH, NS_BANNER_FILL, 'Namespace Level', v.subject.namespace) +
    outerBox(clusterBoxX, boxY, BOX_W, boxH, CLUSTER_BANNER_FILL, 'Cluster Level') +
    `<g transform="translate(${nsBoxX}, ${boxY})">` + ns.join('') + `</g>` +
    cluster.join('') +
    cross.join('') +
    rules.join('') +
    `</svg>`
  );
}

function outerBox(x: number, y: number, w: number, h: number, bannerFill: string, title: string, rightLabel?: string): string {
  const bannerY = y - BANNER_H;
  const textY = bannerY + BANNER_H / 2 + 5;
  const rightText = rightLabel
    ? `<text class="rbac-banner-title" x="${x + w - 14}" y="${textY}" text-anchor="end">${esc(clip(rightLabel, 22))}</text>`
    : '';
  return (
    `<rect x="${x}" y="${bannerY}" width="${w}" height="${BANNER_H}" fill="${bannerFill}" />` +
    `<text class="rbac-banner-title" x="${x + 14}" y="${textY}">${esc(title)}</text>` +
    rightText +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="var(--vpk-fg, #333)" stroke-width="1.2" stroke-dasharray="3 3" />`
  );
}

function colHeader(label: string, total: number, cx: number, y: number): string {
  const text = total > MAX_BINDINGS ? `${label} (${total})` : label;
  return `<text class="rbac-col" x="${cx}" y="${y}" text-anchor="middle">${esc(text)}</text>`;
}

function spine(x: number, fromY: number, toY: number): string {
  return `<line x1="${x}" y1="${fromY}" x2="${x}" y2="${toY}" stroke="var(--vpk-fg, #333)" stroke-width="1.3" />`;
}

function iconImage(kind: string, cx: number, cy: number): string {
  return `<image href="${ICON_BASE}${iconForKind(kind)}" x="${cx - ICON_R}" y="${cy - ICON_R}" width="${ICON_R * 2}" height="${ICON_R * 2}" />`;
}

function bindingIcon(b: RbacBindingNode, kind: string, cx: number, cy: number): string {
  return (
    `<g data-resource-id="${esc(b.id)}" data-names="${esc(JSON.stringify([b.name]))}" style="cursor:pointer">` +
    iconImage(kind, cx, cy) +
    `<text class="rbac-name" x="${cx}" y="${cy + ICON_R + 12}" text-anchor="middle">${esc(clip(b.name, 18))}</text>` +
    `</g>`
  );
}

function roleIcon(r: RbacRoleNode, cx: number, cy: number): string {
  const clickable = r.id ? ` data-resource-id="${esc(r.id)}"` : '';
  return (
    `<g${clickable} data-names="${esc(JSON.stringify([r.name]))}" style="cursor:${r.id ? 'pointer' : 'default'}"${r.id ? '' : ' opacity="0.5"'}>` +
    iconImage(r.kind, cx, cy) +
    `<text class="rbac-name" x="${cx}" y="${cy + ICON_R + 12}" text-anchor="middle">${esc(clip(r.name, 18))}</text>` +
    `</g>`
  );
}

/** One effective-permission row: scope pill (banner-matched fill) + `verbs  groups/resources` text. */
function ruleRow(r: RbacRule, x: number, y: number, w: number): string {
  const isNs = r.scope === 'namespace';
  const pillW = 82;
  const pillFill = isNs ? NS_BANNER_FILL : CLUSTER_BANNER_FILL;
  const pillTextFill = isNs ? '#333' : '#fff';
  const pillLabel = isNs ? clip(r.namespace ?? 'namespace', 13) : 'cluster-wide';
  // A rule targets either API resources OR non-resource URL paths (never both) — a bare `*/*` for the URL
  // kind would render identically to the all-resources rule, so URL rules get an explicit `url:` prefix.
  const isUrlRule = r.resources.length === 0 && r.nonResourceURLs.length > 0;
  const groups = (r.apiGroups.length ? r.apiGroups : ['*']).map((g) => (g === '' ? 'core' : g)).join(',');
  const names = r.resourceNames.length ? ` [${r.resourceNames.join(',')}]` : '';
  const target = isUrlRule ? `url:${r.nonResourceURLs.join(',')}` : `${groups}/${r.resources.join(',') || '*'}${names}`;
  const verbs = r.verbs.join(',') || '*';
  const maxChars = Math.floor((w - pillW - 16) / 5.6);
  const text = clip(`${verbs}  —  ${target}`, maxChars);
  const focus = r.roleId ? ` data-resource-id="${esc(r.roleId)}" data-focus-path="${esc(JSON.stringify(['rules', r.ruleIndex]))}"` : '';
  return (
    `<g${focus} style="cursor:${r.roleId ? 'pointer' : 'default'}">` +
    `<rect x="${x}" y="${y}" width="${pillW}" height="15" rx="3" fill="${pillFill}" />` +
    `<text class="rbac-pill" x="${x + pillW / 2}" y="${y + 11}" text-anchor="middle" fill="${pillTextFill}">${esc(pillLabel)}</text>` +
    `<text class="rbac-rule" x="${x + pillW + 10}" y="${y + 11.5}">${esc(text)}</text>` +
    `</g>`
  );
}

function solidEdge(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--vpk-fg, #333)" stroke-width="1.3" marker-end="url(#rbac-arrow)" />`;
}

function clip(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
function esc(str: string): string {
  return str.replace(/[<>&"]/g, (c) => ESC[c] ?? c);
}
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };
