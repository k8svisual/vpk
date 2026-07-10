import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { RawObject } from '@vpk/core';
import { pushLog } from './logBuffer';

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

/** Parses `raw` (already-JSON.parse'd) into a `{Kind: description}` map, accepting either a flat object
 *  (`{Kind: description, ...}` — the shape a standalone explains.json is expected to use) or a wrapper object
 *  carrying an `explains` field (the shape a snapshot file itself uses). Anything else, or a non-string
 *  value for a given key, is silently dropped rather than throwing — a partially-malformed file should still
 *  yield whatever entries in it ARE usable. */
function parseExplainsMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const source = obj.explains && typeof obj.explains === 'object' ? (obj.explains as Record<string, unknown>) : obj;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** The `explains` map a snapshot MAY carry (DESIGN §4.2/§5.2's `{manifest, items[], explains}` shape) — one
 *  `kubectl explain <kind>` description per captured Kind, keyed by Kind name. Capture doesn't populate this
 *  yet (see redesign/ROADMAP.md's "Known gaps" entry), so this is currently always `{}` for every real
 *  snapshot on disk — UNLESS an `explains.json` file sits alongside it in the same directory (a manually
 *  authored/dropped-in file, since nothing in this app writes one yet either), which is checked as a
 *  fallback so this starts working immediately for anyone who wants to supply their own explain text without
 *  waiting on capture to grow that feature. The snapshot's own inline `explains` field always wins when
 *  present — the sibling file is purely a fallback for snapshots that don't carry one. Legacy `{fnum: obj}`
 *  snapshots never have the inline field at all, so they always fall through to the sibling-file check too. */
export function loadSnapshotExplains(path: string): Record<string, string> {
  let fromSnapshot: Record<string, string> = {};
  try {
    fromSnapshot = parseExplainsMap(JSON.parse(readFileSync(path, 'utf8')));
  } catch (e) {
    // malformed/unreadable snapshot — fall through to the sibling-file check anyway, but this is worth a
    // trace: loadSnapshotFile (the actual resource loader) will likely also be failing on this same file.
    pushLog('warn', `Could not read explains from snapshot ${path}: ${String(e)}`);
  }
  if (Object.keys(fromSnapshot).length > 0) return fromSnapshot;

  const sidecarPath = join(dirname(path), 'explains.json');
  if (!existsSync(sidecarPath)) return {};
  try {
    return parseExplainsMap(JSON.parse(readFileSync(sidecarPath, 'utf8')));
  } catch (e) {
    pushLog('warn', `Malformed explains.json at ${sidecarPath}, ignoring it: ${String(e)}`);
    return {};
  }
}
