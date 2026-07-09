import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join, extname } from 'node:path';
import type { VendorIconOverride } from '@vpk/core';

/** Loads the persisted vendor-icon overrides (Settings > Vendor Icons) from `path`. Never throws — an absent
 *  or corrupt file degrades to no overrides (the built-in VENDOR_ICONS table alone) instead of crashing the
 *  server at startup, same convention as settings.ts's loadSettings. */
export function loadVendorIconOverrides(path: string): VendorIconOverride[] {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(raw) ? (raw as VendorIconOverride[]) : [];
  } catch {
    return [];
  }
}

export function saveVendorIconOverrides(path: string, overrides: VendorIconOverride[]): void {
  writeFileSync(path, JSON.stringify(overrides, null, 2));
}

const ALLOWED_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

/** Writes a user-uploaded icon file into `customIconsDir` (created if missing), returning the web-servable
 *  `/icons/custom/<name>` path. `filename` is trusted only for its extension and a display-friendly base name
 *  — `basename()` strips any directory component a crafted name might carry, and the extension is checked
 *  against an allowlist, before anything touches the filesystem. Collisions get a numeric suffix rather than
 *  overwriting a previous upload, since two different vendors could plausibly both be named e.g. "logo.svg". */
export function saveCustomIcon(customIconsDir: string, filename: string, dataBase64: string): string {
  const ext = extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported icon file type "${ext}" — allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`);
  }
  const safeBase = basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '-') || 'icon';
  if (!existsSync(customIconsDir)) mkdirSync(customIconsDir, { recursive: true });
  let name = `${safeBase}${ext}`;
  let n = 1;
  while (existsSync(join(customIconsDir, name))) {
    name = `${safeBase}-${++n}${ext}`;
  }
  writeFileSync(join(customIconsDir, name), Buffer.from(dataBase64, 'base64'));
  return `/icons/custom/${name}`;
}
