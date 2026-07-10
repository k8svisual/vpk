import type { RawObject } from '@vpk/core';

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/** Every distinct `{{placeholder}}` name in a template, in first-appearance order — the Demo Data screen
 *  builds one form field per name returned here, so this is the single source of truth for "what can be
 *  filled in" for a given Kind's template (works for any Kind, not just Node — the mechanism is generic). */
export function extractPlaceholders(template: RawObject): string[] {
  const seen = new Set<string>();
  for (const m of JSON.stringify(template).matchAll(PLACEHOLDER_RE)) seen.add(m[1] as string);
  return [...seen];
}

/** Fills a template's `{{placeholder}}` tokens via whole-JSON text substitution — deliberately not a
 *  path-based/object-walking replace, so a placeholder can stand anywhere in the shape, including as an
 *  object KEY (Node's `"node-role.kubernetes.io/{{role}}": ""` label relies on exactly this). `values` must
 *  cover every name `extractPlaceholders` finds; anything left over after substitution means a value was
 *  missing and is surfaced as a thrown error rather than silently shipping a literal `{{foo}}` into a
 *  "generated" resource.
 *
 *  Every `{{placeholder}}` occurrence sits inside a JSON string in the template (either a value's own quotes,
 *  or — for the object-key case above — the key's quotes), so each value is run through
 *  `JSON.stringify(value).slice(1, -1)` before splicing it in: this escapes `"`, `\`, and control characters
 *  the same way JSON.stringify would if the value had been assigned normally, so a value containing a quote
 *  or backslash (e.g. a user-typed Node name pattern) can't break the surrounding JSON structure or splice in
 *  an unintended extra field. */
export function fillTemplate(template: RawObject, values: Record<string, string>): RawObject {
  let text = JSON.stringify(template);
  for (const [key, value] of Object.entries(values)) {
    const escaped = JSON.stringify(value).slice(1, -1);
    text = text.split(`{{${key}}}`).join(escaped);
  }
  const leftover = [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1] as string);
  if (leftover.length > 0) {
    throw new Error(`Unfilled placeholder(s): ${[...new Set(leftover)].join(', ')}`);
  }
  return JSON.parse(text) as RawObject;
}

const PATTERN_TOKEN_RE = /\{([^{}]*)\}/g;

interface SequentialRangeToken {
  mode: 'sequential';
  start: number;
  from: number;
  step: number;
  /** Number of distinct values this token cycles through: floor((to - from) / step) + 1. */
  cardinality: number;
}

type ParsedRange = { mode: 'sequential'; from: number; step: number; cardinality: number } | { mode: 'random'; from: number; to: number };

function parseRangeToken(content: string): ParsedRange | undefined {
  const m = /^(-?\d+)-(-?\d+)(?:,(\d+|random))?$/i.exec(content);
  if (!m) return undefined;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (to < from) throw new Error(`Invalid range "{${content}}" — "to" must be >= "from"`);
  if (m[3] && /^random$/i.test(m[3])) return { mode: 'random', from, to };
  const step = m[3] ? Number(m[3]) : 1;
  if (step <= 0) throw new Error(`Invalid range "{${content}}" — step must be a positive integer`);
  return { mode: 'sequential', from, step, cardinality: Math.floor((to - from) / step) + 1 };
}

// Demo-only, made-up registry hosts — this is synthetic test data, not real infrastructure. `{image}` picks
// one uniformly at random per call so generated Pods spread realistically across "three image repositories"
// instead of every image living in the same place.
const DEMO_IMAGE_REPOS = ['demo-registry-a.example.com/apps', 'demo-registry-b.example.com/apps', 'demo-registry-c.example.com/apps'];
const DEMO_IMAGE_NAMES = ['web', 'api', 'worker', 'cache', 'queue', 'proxy', 'db', 'gateway', 'scheduler', 'auth'];
const DEMO_IMAGE_TAGS = ['latest', 'v1', 'v2', 'stable'];

function randomImageRef(): string {
  const repo = DEMO_IMAGE_REPOS[Math.floor(Math.random() * DEMO_IMAGE_REPOS.length)];
  const name = DEMO_IMAGE_NAMES[Math.floor(Math.random() * DEMO_IMAGE_NAMES.length)];
  const suffix = Math.random().toString(16).slice(2, 8);
  const tag = DEMO_IMAGE_TAGS[Math.floor(Math.random() * DEMO_IMAGE_TAGS.length)];
  return `${repo}/${name}-${suffix}:${tag}`;
}

/**
 * Resolves a single user-entered pattern into one item's actual value, given its 1-based GLOBAL index among
 * every item of its Kind ever generated in this working set (not just within the current /demo/generate call
 * — continuing the count across calls is what keeps e.g. IPs and names unique when a user generates 500
 * Nodes in batches of 100 rather than all at once). Recognizes, inside `{...}`:
 *
 * - `{n}` — the index itself, decimal, unbounded (e.g. "demo-node-{n}").
 * - `{guid}` — a fresh random UUID v4, independent of index (for uid-like identity fields).
 * - `{image}` — a fresh random `repo/name:tag` image reference, one of three made-up demo registries chosen
 *   uniformly at random (for container image fields — this is demo data, not a real image name).
 * - `{namespace}` — round-robins through `namespaces` by index (namespaces[(index-1) % namespaces.length]),
 *   spreading generated items evenly across every currently-staged Namespace rather than everything landing
 *   in one. Requires a non-empty `namespaces` list; throws otherwise (nothing sensible to spread across).
 * - `{from-to}` / `{from-to,step}` — cycles SEQUENTIALLY through the range with wraparound (step defaults to
 *   1), e.g. "{50-200}" → 50, 51, ..., 200, 50, 51, ...; "{16-384,4}" → 16, 20, 24, ..., 384, 16, ...
 * - `{from-to,Random}` — a fresh uniformly-random integer in [from, to] each call (independent of index, NOT
 *   sequential), e.g. "{1-10,Random}".
 *
 * Multiple SEQUENTIAL range tokens in ONE pattern act as a mixed-radix "odometer", same idea as a car's
 * odometer or counting in a non-decimal base: the RIGHTMOST one is the fastest-changing (least significant)
 * digit; each time it completes a full cycle back to its start, the next token to its left advances by one
 * step (carries) — exactly how IP octets enumerate. E.g. "10.0.{0-255}.{0-255}" walks 10.0.0.0, 10.0.0.1, ...,
 * 10.0.0.255, 10.0.1.0, 10.0.1.1, ... across up to 256*256 = 65,536 unique addresses before it wraps. A
 * `{from-to,Random}` token never participates in this odometer — it has no notion of "position" to carry
 * from/into, so it's resolved independently, the same way `{guid}`/`{image}`/`{namespace}` are.
 */
export function resolvePattern(pattern: string, index: number, namespaces?: string[]): string {
  const matches = [...pattern.matchAll(PATTERN_TOKEN_RE)];
  const sequentialTokens: SequentialRangeToken[] = [];
  const randomRanges = new Map<number, { from: number; to: number }>();
  for (const m of matches) {
    const content = m[1] as string;
    if (content === 'n' || content === 'guid' || content === 'image' || content === 'namespace') continue;
    const parsed = parseRangeToken(content);
    if (!parsed) throw new Error(`Unrecognized pattern token "{${content}}" in "${pattern}"`);
    const start = m.index as number;
    if (parsed.mode === 'random') randomRanges.set(start, { from: parsed.from, to: parsed.to });
    else sequentialTokens.push({ mode: 'sequential', start, from: parsed.from, step: parsed.step, cardinality: parsed.cardinality });
  }

  // Rightmost (latest start position) is least significant — mirrors reading an IP/odometer left to right
  // as most-significant to least-significant. Only sequential tokens participate.
  const rightToLeft = [...sequentialTokens].sort((a, b) => b.start - a.start);
  let remaining = Math.max(0, index - 1);
  const valueByStart = new Map<number, number>();
  for (const t of rightToLeft) {
    const digit = remaining % t.cardinality;
    remaining = Math.floor(remaining / t.cardinality);
    valueByStart.set(t.start, t.from + digit * t.step);
  }

  let result = '';
  let cursor = 0;
  for (const m of matches) {
    const start = m.index as number;
    result += pattern.slice(cursor, start);
    const content = m[1] as string;
    if (content === 'n') result += String(index);
    else if (content === 'guid') result += crypto.randomUUID();
    else if (content === 'image') result += randomImageRef();
    else if (content === 'namespace') {
      if (!namespaces || namespaces.length === 0) {
        throw new Error('{namespace} requires at least one currently-staged Namespace — generate some first');
      }
      result += namespaces[Math.max(0, index - 1) % namespaces.length];
    } else if (randomRanges.has(start)) {
      const { from, to } = randomRanges.get(start) as { from: number; to: number };
      result += String(from + Math.floor(Math.random() * (to - from + 1)));
    } else result += String(valueByStart.get(start));
    cursor = start + m[0].length;
  }
  return result + pattern.slice(cursor);
}
