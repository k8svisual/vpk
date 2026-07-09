import { readFileSync } from 'node:fs';
import type { RawObject } from '@vpk/core';

/** Read a snapshot file → raw objects. Handles the new `{manifest, items[]}` and legacy `{fnum: obj}` (DESIGN §5.2). */
export function loadSnapshotFile(path: string): RawObject[] {
  return toItems(JSON.parse(readFileSync(path, 'utf8')));
}

/** Extract raw objects from parsed snapshot JSON, handling both on-disk formats. */
export function toItems(data: unknown): RawObject[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.items)) return obj.items as RawObject[]; // new {manifest, items[]}
  return Object.values(obj).filter(isRawObject); // legacy {fnum: obj}
}

function isRawObject(v: unknown): v is RawObject {
  return typeof v === 'object' && v !== null && ('kind' in v || 'metadata' in v);
}

/** The `explains` map a snapshot MAY carry (DESIGN §4.2/§5.2's `{manifest, items[], explains}` shape) — one
 *  `kubectl explain <kind>` description per captured Kind, keyed by Kind name. Capture doesn't populate this
 *  yet (see redesign/ROADMAP.md's "Known gaps" entry), so this is currently always `{}` for every real
 *  snapshot on disk; reading it now means the Explain button (DefinitionModal) starts working with zero
 *  further changes the moment capture actually starts writing it. Legacy `{fnum: obj}` snapshots never have
 *  this field at all, so they always resolve to `{}` too — same as a new-format snapshot, no branching needed. */
export function loadSnapshotExplains(path: string): Record<string, string> {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as { explains?: unknown };
    if (!data.explains || typeof data.explains !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.explains as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
