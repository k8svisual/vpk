/**
 * Presence/value resolution over a dotted path with `[*]` array-wildcard support, e.g.
 * `.spec.template.spec.containers[*].image`. Field checks are presence-only (does the path exist and hold a
 * meaningful value) — never value equality, per the design's "compare = structural fingerprint, not a deep
 * spec diff" decision (redesign/training-course.md §"compare" clarification).
 */
import type { RawObject } from '../types';

type PathSegment = { key: string } | { wildcard: true };

function parsePath(path: string): PathSegment[] {
  const trimmed = path.startsWith('.') ? path.slice(1) : path;
  const raw = trimmed.split('.').filter(Boolean);
  const segments: PathSegment[] = [];
  for (const part of raw) {
    const m = /^([^[]*)(\[\*\])?$/.exec(part);
    const key = m?.[1] ?? part;
    const wildcard = m?.[2];
    if (key) segments.push({ key });
    if (wildcard) segments.push({ wildcard: true });
  }
  return segments;
}

function isWildcard(seg: PathSegment): seg is { wildcard: true } {
  return 'wildcard' in seg;
}

/** All leaf values a path resolves to. A `[*]` segment fans out over every array element; a missing
 *  intermediate segment yields no values (not an error — presence checks just see "not found"). */
function resolveValues(value: unknown, segments: PathSegment[]): unknown[] {
  if (segments.length === 0) return [value];
  const [head, ...rest] = segments;
  if (head === undefined) return [];
  if (isWildcard(head)) {
    if (!Array.isArray(value)) return [];
    // Each element MUST contribute at least one slot — an element that fails to resolve the rest of the
    // path is a gap (recorded as `undefined`), not something to silently vanish via flatMap. Without this,
    // one container missing `.image` among several would just disappear from the result instead of failing
    // the "every element has it" check below.
    return value.flatMap((item) => {
      const sub = resolveValues(item, rest);
      return sub.length > 0 ? sub : [undefined];
    });
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
  const next = (value as Record<string, unknown>)[head.key];
  if (!(head.key in (value as Record<string, unknown>))) return [];
  return resolveValues(next, rest);
}

function isMeaningfullyPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true; // numbers (incl. 0), booleans (incl. false) count as present
}

/** Does `path` exist and hold a meaningful value on `obj`? A `[*]` wildcard requires the array to be
 *  non-empty AND every element to satisfy the rest of the path — a container with no `image` is a real gap,
 *  not a pass because SOME sibling container has one. */
export function pathExists(obj: unknown, path: string): boolean {
  const segments = parsePath(path);
  const hasWildcard = segments.some(isWildcard);
  const values = resolveValues(obj, segments);
  if (values.length === 0) return false;
  if (!hasWildcard) return isMeaningfullyPresent(values[0]);
  return values.every(isMeaningfullyPresent);
}

/** Every value `path` resolves to (post-wildcard-fanout) — used by value assertions, which require the
 *  assertion to hold for ALL matched values (same all-elements convention as pathExists' wildcard). */
export function pathValues(obj: unknown, path: string): unknown[] {
  return resolveValues(obj, parsePath(path));
}

/**
 * Derives a required-paths checklist from an authored object's `.spec` by walking every leaf and turning
 * arrays into `[*]` wildcard segments — this is what lets a FieldsCheck's `expect` source `answerKey` work:
 * "whatever the teacher's fixture meaningfully sets under spec, the student's object must set too." Only
 * `.spec` is walked (never `.metadata`/`.status`) — status is runtime-computed and metadata carries
 * identity/labels that are a student's own choice, not a required-param concern.
 */
export function deriveRequiredPaths(obj: RawObject): string[] {
  const spec = obj.spec;
  if (spec === null || spec === undefined || typeof spec !== 'object') return [];
  const paths: string[] = [];
  walk(spec, '.spec', paths);
  return paths;
}

function walk(value: unknown, prefix: string, out: string[]): void {
  if (Array.isArray(value)) {
    if (value.length === 0) return; // empty array — nothing meaningful to require
    walk(value[0], `${prefix}[*]`, out); // treat as a homogeneous list, derive from the first element's shape
    return;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return; // empty object — nothing to require
    for (const [k, v] of entries) walk(v, `${prefix}.${k}`, out);
    return;
  }
  if (!isMeaningfullyPresent(value)) return; // skip empty-string/etc. leaves in the reference itself
  out.push(prefix);
}
