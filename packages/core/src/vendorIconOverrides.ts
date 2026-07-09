import { VENDOR_ICONS, type VendorIconRule } from './vendorIcons';

/**
 * A user-editable change to the built-in VENDOR_ICONS table (Settings > Vendor Icons in the web app). Three
 * shapes, distinguished by whether `needle` matches a built-in row:
 *  - matches + `disabled: true` — removes that built-in row entirely (falls through to no vendor icon, or a
 *    shorter/less-specific needle if another one still matches).
 *  - matches + `icon` set — replaces just that row's icon (e.g. swapping in the user's own logo file) while
 *    keeping the same apiVersion-group match.
 *  - doesn't match any built-in needle — a wholly new vendor mapping the user added.
 * Persisted server-side (not localStorage) because the SAME data has to be visible to both the browser (React
 * icon lookups) and the server (schematicSvg.ts/networkSvg.ts/rbacSvg.ts's baked-in `<image href>` URLs) — a
 * client-only override, unlike the CSS-variable color overrides elsewhere in the app, could never reach
 * server-rendered SVG markup after the fact.
 */
export interface VendorIconOverride {
  needle: string;
  icon?: string;
  title?: string;
  disabled?: boolean;
}

let overrides: VendorIconOverride[] = [];
let cache: VendorIconRule[] | null = null;

/** Replaces the whole override set — called once at server startup (loaded from disk) and again whenever the
 *  Settings UI saves a change; the web client calls its own copy of this with the same server-fetched data so
 *  both sides resolve identical icons. */
export function setVendorIconOverrides(next: VendorIconOverride[]): void {
  overrides = next;
  cache = null;
}

export function getVendorIconOverrides(): VendorIconOverride[] {
  return overrides;
}

/** VENDOR_ICONS with overrides applied, re-sorted longest-needle-first (a user-added needle can be any
 *  length, so the base table's fixed ordering can't be assumed to still be correct). Cached until the next
 *  `setVendorIconOverrides` call — this runs on every resource icon lookup, including full-cluster SVG
 *  renders, so re-deriving it per call would scale with resource count for no reason. */
function mergedVendorIcons(): VendorIconRule[] {
  if (cache) return cache;
  const byNeedle = new Map<string, VendorIconRule>(VENDOR_ICONS.map((r) => [r.needle, r]));
  for (const o of overrides) {
    if (o.disabled) {
      byNeedle.delete(o.needle);
      continue;
    }
    const existing = byNeedle.get(o.needle);
    const icon = o.icon ?? existing?.icon;
    if (!icon) continue; // a brand-new needle with no icon yet isn't resolvable
    byNeedle.set(o.needle, { needle: o.needle, icon, title: o.title ?? existing?.title ?? o.needle });
  }
  cache = [...byNeedle.values()].sort((a, b) => b.needle.length - a.needle.length);
  return cache;
}

/** Same contract as the old pure `vendorIconFor` — matches `apiVersion`'s group against the merged (base +
 *  override) table. */
export function vendorIconFor(apiVersion: string | undefined): string | undefined {
  if (!apiVersion) return undefined;
  const slash = apiVersion.indexOf('/');
  const group = slash === -1 ? apiVersion : apiVersion.slice(0, slash);
  return mergedVendorIcons().find((r) => group.includes(r.needle))?.icon;
}
