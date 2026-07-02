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
