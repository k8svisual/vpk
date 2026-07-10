import type { Resource } from '../types';
import { deriveRequiredPaths, pathExists, pathValues } from './paths';
import { inventoryOf, inventoryOfObjects, resourcesInNamespace, selectResources } from './selectors';
import type {
  CheckContext,
  CheckResult,
  ClusterCheck,
  Expectation,
  FeedbackItem,
  Finding,
  FindingTier,
  FieldsCheck,
  FieldsEntry,
  InventoryCheck,
  PureCheck,
  StepPolicy,
  StepResult,
  Strictness,
  ValueCheck,
} from './types';

/**
 * Pure check-engine evaluators (redesign/training-course.md §7). Given an already-captured CheckContext,
 * these compute the CONFORMANCE axis (does the student's namespace match the reference at the active
 * strictness) fully. The FUNCTIONAL axis (does it actually run) is designed to reuse this repo's existing
 * status/health projections (podStatus.ts, the F1 Endpoints/EndpointSlice union, storage Bound/Complete
 * reads) plus, for probe/callback checks, live I/O this pure module can't do — that wiring is real,
 * additive work for the next slice, not shortcut here. Every CheckResult below reports `functional: 'n/a'`
 * honestly rather than faking a status this module doesn't yet compute; evaluateStep's synthesis is written
 * to fold 'n/a' in without penalizing it (see its own doc comment), and revises cleanly once functional
 * evaluators land — no reshaping needed, just check kinds that start reporting 'working'/'broken'/'partial'.
 */

const STRICTNESS_ORDER: Strictness[] = ['loose', 'standard', 'strict', 'pinned'];

const STRICTNESS_TIERS: Record<Strictness, FindingTier[]> = {
  loose: ['kinds'],
  standard: ['kinds', 'counts'],
  strict: ['kinds', 'counts', 'fields'],
  pinned: ['kinds', 'counts', 'fields', 'values'],
};

function gatingTiers(strictness: Strictness): Set<FindingTier> {
  return new Set(STRICTNESS_TIERS[strictness]);
}

/** The student's chosen strictness, clamped up to the lesson's floor — never allowed below it. */
export function clampToFloor(strictness: Strictness, floor: Strictness): Strictness {
  return STRICTNESS_ORDER.indexOf(strictness) >= STRICTNESS_ORDER.indexOf(floor) ? strictness : floor;
}

function selectorLabel(select: { kind: string; name?: string }): string {
  return select.name ? `${select.kind} "${select.name}"` : select.kind;
}

// ---------------------------------------------------------------------------------------------------------
// ClusterCheck
// ---------------------------------------------------------------------------------------------------------

/** Loose `major.minor[.patch]` comparison — good enough for "at least this k8s version," not a full semver
 *  implementation (pre-release/build-metadata suffixes are ignored). */
function versionAtLeast(actual: string | undefined, min: string): boolean {
  if (!actual) return false;
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split(/[.+-]/)
      .slice(0, 3)
      .map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(actual);
  const m = parse(min);
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av !== mv) return av > mv;
  }
  return true;
}

function evaluateClusterCheck(check: ClusterCheck, ctx: CheckContext): CheckResult {
  const { assert } = check;
  let ok: boolean;
  let message: string;
  if (assert === 'contextReachable') {
    ok = ctx.cluster.contextReachable;
    message = ok ? 'Cluster context is reachable.' : 'No reachable cluster context found.';
  } else if (assert === 'multiNode') {
    ok = ctx.cluster.capabilities.multiNode;
    message = ok
      ? 'The cluster supports multiple nodes.'
      : 'This provisioner only supports a single node (e.g. Docker Desktop) — this lesson needs a multi-node cluster.';
  } else if ('nodesReady' in assert) {
    ok = ctx.cluster.nodes.ready >= assert.nodesReady;
    message = `${ctx.cluster.nodes.ready}/${assert.nodesReady} nodes Ready.`;
  } else {
    ok = versionAtLeast(ctx.cluster.serverVersion, assert.serverVersionAtLeast);
    message = `Server version ${ctx.cluster.serverVersion ?? 'unknown'} (need >= ${assert.serverVersionAtLeast}).`;
  }
  const finding: Finding = { tier: 'kinds', status: ok ? 'ok' : 'mismatch', detail: { assert }, message };
  return {
    id: check.id,
    functional: ok ? 'working' : 'broken',
    // Always 'matched', pass or fail: a cluster fact has no reference to structurally diverge FROM — it's a
    // pure boolean, so `functional` alone carries the result. Critically, this must NOT be 'missing' on
    // failure: evaluateStep's `nothingRunning` synthesis treats 'missing' as "a required resource is
    // entirely absent," and an unreachable cluster context isn't that — it would otherwise hijack synthesis
    // into always reporting 'incomplete' instead of 'not-yet-working' whenever a ClusterCheck fails.
    conformance: 'matched',
    summary: message,
    findings: [finding],
    hint: ok ? undefined : check.hint,
  };
}

// ---------------------------------------------------------------------------------------------------------
// InventoryCheck
// ---------------------------------------------------------------------------------------------------------

function resolveInventoryExpectation(expect: Expectation<Record<string, number>>, ctx: CheckContext): Record<string, number> {
  if (expect.source === 'literal') return expect.value;
  if (expect.source === 'answerKey') return inventoryOfObjects(ctx.answerKey(expect.id));
  return inventoryOf(ctx.graph, expect.namespace); // compareNamespace: counts aren't affected by API defaulting
}

function evaluateInventoryCheck(check: InventoryCheck, ctx: CheckContext): CheckResult {
  const actual = inventoryOf(ctx.graph, check.namespace);
  const expected = resolveInventoryExpectation(check.expect, ctx);
  const findings: Finding[] = [];
  let anyKindMissing = false;
  let anyCountMismatch = false;

  const allKinds = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const kind of [...allKinds].sort()) {
    const exp = expected[kind] ?? 0;
    const act = actual[kind] ?? 0;
    if (exp === act) {
      findings.push({
        tier: exp > 0 ? 'counts' : 'kinds',
        status: 'ok',
        detail: { kind, expected: exp, actual: act },
        message: `${act} ${kind} (matches).`,
      });
      continue;
    }
    if (exp > 0 && act === 0) {
      anyKindMissing = true;
      anyCountMismatch = true;
      findings.push({
        tier: 'kinds',
        status: 'mismatch',
        detail: { kind, expected: exp, actual: act },
        message: `No ${kind} found (expected ${exp}).`,
      });
      continue;
    }
    anyCountMismatch = true;
    findings.push({
      tier: 'counts',
      status: 'mismatch',
      detail: { kind, expected: exp, actual: act },
      message: `${act} ${kind} found (expected ${exp}).`,
    });
  }

  const conformance: CheckResult['conformance'] = anyKindMissing ? 'missing' : anyCountMismatch ? 'divergent' : 'matched';
  return {
    id: check.id,
    functional: 'n/a',
    conformance,
    summary:
      conformance === 'matched'
        ? `${check.namespace}: inventory matches.`
        : `${check.namespace}: inventory ${conformance} from expected.`,
    findings,
    hint: conformance === 'matched' ? undefined : check.hint,
  };
}

// ---------------------------------------------------------------------------------------------------------
// FieldsCheck
// ---------------------------------------------------------------------------------------------------------

function resolveFieldsExpectation(expect: Expectation<FieldsEntry[]>, ctx: CheckContext): FieldsEntry[] {
  if (expect.source === 'literal') return expect.value;
  if (expect.source === 'answerKey') {
    return ctx
      .answerKey(expect.id)
      .filter((obj) => !!obj.kind)
      .map((obj) => ({
        select: { kind: obj.kind as string, name: obj.metadata?.name },
        paths: deriveRequiredPaths(obj),
      }));
  }
  // compareNamespace: live-vs-live field-presence needs the (not-yet-built) defaulting canonicalizer —
  // §7.4 flags this as an OPEN maintenance item. Deliberately unsupported for now rather than silently
  // wrong: derive-from-raw-live-object would flag countless API-injected defaults as "required".
  throw new Error(
    "FieldsCheck 'compareNamespace' needs the live-vs-live canonicalizer (design doc §7.4) — not yet implemented. Use 'literal' or 'answerKey'.",
  );
}

function evaluateFieldsCheck(check: FieldsCheck, ctx: CheckContext): CheckResult {
  const entries = resolveFieldsExpectation(check.expect, ctx);
  const findings: Finding[] = [];
  let anyResourceMissing = false;
  let anyFieldMissing = false;

  for (const entry of entries) {
    const matches = selectResources(ctx.graph, check.namespace, entry.select);
    if (matches.length === 0) {
      anyResourceMissing = true;
      findings.push({
        tier: 'kinds',
        status: 'mismatch',
        detail: { select: entry.select },
        message: `No ${selectorLabel(entry.select)} found to check required fields.`,
      });
      continue;
    }
    for (const res of matches) {
      for (const path of entry.paths) {
        const ok = pathExists(res.raw, path);
        if (!ok) anyFieldMissing = true;
        findings.push({
          tier: 'fields',
          status: ok ? 'ok' : 'mismatch',
          detail: { kind: res.kind, name: res.name, path },
          message: ok ? `${res.kind}/${res.name}: ${path} is set.` : `${res.kind}/${res.name}: ${path} is missing.`,
        });
      }
    }
  }

  const conformance: CheckResult['conformance'] = anyResourceMissing ? 'missing' : anyFieldMissing ? 'divergent' : 'matched';
  return {
    id: check.id,
    functional: 'n/a',
    conformance,
    summary:
      conformance === 'matched' ? `${check.namespace}: required fields present.` : `${check.namespace}: required fields ${conformance}.`,
    findings,
    hint: conformance === 'matched' ? undefined : check.hint,
  };
}

// ---------------------------------------------------------------------------------------------------------
// ValueCheck (pinned only)
// ---------------------------------------------------------------------------------------------------------

function compareOne(actual: unknown, op: ValueCheck['assert'][number]['op'], expected: unknown): boolean {
  switch (op) {
    case '==':
      return actual === expected;
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'matches':
      return typeof actual === 'string' && typeof expected === 'string' && new RegExp(expected).test(actual);
  }
}

function evaluateValueCheck(check: ValueCheck, ctx: CheckContext): CheckResult {
  const findings: Finding[] = [];
  let anyResourceMissing = false;
  let anyValueMismatch = false;

  for (const a of check.assert) {
    const matches = selectResources(ctx.graph, check.namespace, a.select);
    if (matches.length === 0) {
      anyResourceMissing = true;
      findings.push({
        tier: 'values',
        status: 'mismatch',
        detail: { select: a.select, path: a.path },
        message: `No ${selectorLabel(a.select)} found to check ${a.path}.`,
      });
      continue;
    }
    for (const res of matches) {
      const values = pathValues(res.raw, a.path);
      const ok = values.length > 0 && values.every((v) => compareOne(v, a.op, a.value));
      if (!ok) anyValueMismatch = true;
      findings.push({
        tier: 'values',
        status: ok ? 'ok' : 'mismatch',
        detail: { kind: res.kind, name: res.name, path: a.path, op: a.op, expected: a.value, actual: values },
        message: ok
          ? `${res.kind}/${res.name}: ${a.path} ${a.op} ${JSON.stringify(a.value)}.`
          : `${res.kind}/${res.name}: ${a.path} is ${JSON.stringify(values)}, expected ${a.op} ${JSON.stringify(a.value)}.`,
      });
    }
  }

  const conformance: CheckResult['conformance'] = anyResourceMissing ? 'missing' : anyValueMismatch ? 'divergent' : 'matched';
  return {
    id: check.id,
    functional: 'n/a',
    conformance,
    summary: conformance === 'matched' ? `${check.namespace}: pinned values match.` : `${check.namespace}: pinned values ${conformance}.`,
    findings,
    hint: conformance === 'matched' ? undefined : check.hint,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Dispatch + step synthesis
// ---------------------------------------------------------------------------------------------------------

export function evaluateCheck(check: PureCheck, ctx: CheckContext): CheckResult {
  switch (check.kind) {
    case 'cluster':
      return evaluateClusterCheck(check, ctx);
    case 'inventory':
      return evaluateInventoryCheck(check, ctx);
    case 'fields':
      return evaluateFieldsCheck(check, ctx);
    case 'value':
      return evaluateValueCheck(check, ctx);
  }
}

function feedbackForResult(result: CheckResult, gating: Set<FindingTier>): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  for (const f of result.findings) {
    if (f.status !== 'mismatch') continue;
    items.push({ severity: gating.has(f.tier) ? 'difference' : 'tip', message: f.message });
  }
  return items;
}

const SEVERITY_ORDER: Record<FeedbackItem['severity'], number> = { blocker: 0, difference: 1, tip: 2 };

/**
 * Synthesizes a StepResult from evaluated checks. Gate (`status`) and grade (`level`) are decoupled by
 * design (§7.8): `passWhen: 'functional'` lets a working-but-divergent solution progress while still being
 * graded 'working-with-differences' with exactly what differed — progress isn't blocked on perfection, but
 * feedback is always delivered.
 *
 * 'n/a' functional results (everything this module currently produces — see module doc comment) are folded
 * into `allWorking` as neutral: a conformance-only check contributes no functional signal, so it shouldn't
 * by itself block "working". `nothingRunning` is approximated, until real functional evaluators exist, by
 * "some check's conformance is 'missing'" (a required resource is flat-out absent) — a reasonable proxy for
 * "the student hasn't done anything yet" that composes cleanly once status/probe/callback checks start
 * reporting real 'broken'/'partial' results (they'll simply make `anyBroken`/`anyPartial` true too).
 */
export function evaluateStep(checks: PureCheck[], ctx: CheckContext, policy: StepPolicy): StepResult {
  const strictness = clampToFloor(policy.strictness, policy.floor);
  const gating = gatingTiers(strictness);
  const results = checks.map((c) => evaluateCheck(c, ctx));

  const nothingRunning = results.some((r) => r.conformance === 'missing');
  const anyBroken = results.some((r) => r.functional === 'broken');
  const anyPartial = results.some((r) => r.functional === 'partial');
  const allWorking = results.every((r) => r.functional === 'working' || r.functional === 'n/a');
  const fullyConformant = results.every((r) => r.conformance === 'matched');

  let level: StepResult['level'];
  if (nothingRunning) level = 'incomplete';
  else if (anyBroken || anyPartial) level = 'not-yet-working';
  else if (allWorking && fullyConformant) level = 'matched';
  else level = 'working-with-differences';

  const status: StepResult['status'] =
    policy.passWhen === 'functional' ? (allWorking && !nothingRunning ? 'pass' : 'fail') : allWorking && fullyConformant && !nothingRunning ? 'pass' : 'fail';

  const feedback = results
    .flatMap((r) => feedbackForResult(r, gating))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return { status, level, checks: results, feedback };
}

// Re-exported for the future functional-evaluator slice and for tests that want to assert on raw namespace
// contents without going through a specific check kind.
export { resourcesInNamespace };
export type { Resource };
