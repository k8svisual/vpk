import type { RawObject, ResourceGraph } from '@vpk/core';

/**
 * Check-engine types (redesign/training-course.md §7). A "check" verifies one fact about a lesson step —
 * either against the cluster as a whole (ClusterCheck) or against resources in a namespace. Checks are split
 * into PureCheck (evaluable from an already-captured graph — this module) and LiveCheck (requires I/O:
 * running a probe, watching for a callback — evaluated by a server-side wrapper in a later phase). That split
 * mirrors the codebase's existing pure-projection / impure-capture boundary (DESIGN.md).
 */

/** Facts about the cluster that aren't part of the object graph — resolved once per check run by the (future)
 *  live wrapper's environment probe, then passed in here as plain data so evaluation stays pure. */
export interface ClusterFacts {
  contextReachable: boolean;
  contextName?: string;
  serverVersion?: string;
  nodes: { total: number; ready: number };
  provisioner?: 'minikube' | 'k3d' | 'microk8s' | 'docker-desktop' | 'external';
  /** docker-desktop's built-in Kubernetes is single-node only — this is what lets a multi-node lesson's
   *  ClusterCheck fail it with a useful message instead of the student discovering it lesson zero. */
  capabilities: { multiNode: boolean };
}

/** A point-in-time view checks evaluate against — reuses the same capture->graph pipeline the views consume,
 *  scoped to whatever namespace(s) the check run cares about. */
export interface CheckContext {
  graph: ResourceGraph;
  cluster: ClusterFacts;
  /** Resolves an authored answer-key manifest (parsed fixture YAML) by id — NOT the live, API-defaulted
   *  teacher objects. Field-presence checks read from this specifically to dodge API-injected defaults. */
  answerKey: (id: string) => RawObject[];
}

export type Strictness = 'loose' | 'standard' | 'strict' | 'pinned';

/** Where the "correct answer" comes from — one resolver per check kind turns any of these into a concrete
 *  expectation of type T. `compareNamespace` is live-vs-live (no authored manifest); for InventoryCheck that's
 *  fine (counts aren't affected by API-defaulted fields), for FieldsCheck it needs the (not-yet-built, see
 *  §7.4) canonicalizer and is deliberately unimplemented for now — see evaluate.ts. */
export type Expectation<T> =
  | { source: 'literal'; value: T }
  | { source: 'answerKey'; id: string }
  | { source: 'compareNamespace'; namespace: string };

export interface ResourceSelector {
  kind: string;
  name?: string;
  labels?: Record<string, string>;
}

export interface CheckBase {
  id: string;
  describe: string;
  hint?: string;
}

export interface ClusterCheck extends CheckBase {
  kind: 'cluster';
  assert: 'contextReachable' | { nodesReady: number } | 'multiNode' | { serverVersionAtLeast: string };
}

export interface InventoryCheck extends CheckBase {
  kind: 'inventory';
  namespace: string;
  expect: Expectation<Record<string, number>>; // { Deployment: 1, Service: 1, ... }
}

export interface FieldsEntry {
  select: ResourceSelector;
  paths: string[]; // presence-only, e.g. '.spec.template.spec.containers[*].image'
}

export interface FieldsCheck extends CheckBase {
  kind: 'fields';
  namespace: string;
  expect: Expectation<FieldsEntry[]>;
}

export interface ValueAssertion {
  select: ResourceSelector;
  path: string;
  op: '==' | '>=' | '<=' | 'matches';
  value: unknown;
}

export interface ValueCheck extends CheckBase {
  kind: 'value'; // opt-in — only gates at 'pinned' strictness
  namespace: string;
  assert: ValueAssertion[];
}

/** Evaluable purely from a CheckContext — no subprocess, no network, no polling. */
export type PureCheck = ClusterCheck | InventoryCheck | FieldsCheck | ValueCheck;

export interface CommandCheck extends CheckBase {
  kind: 'command'; // fluency drills — grades the STUDENT'S TYPED ARGV, not cluster state
  match: { verb: string; resource?: string; flags?: string[] };
}

export interface ProbeCheck extends CheckBase {
  kind: 'probe'; // pull: observe the running workload via ClusterReach (§7.6)
  gateOnStatus?: boolean;
}

export interface CallbackCheck extends CheckBase {
  kind: 'callback'; // push + reverse-verify (§7.7)
  windowMs?: number;
}

/** Requires I/O to evaluate — a server-side live wrapper (not this module) runs these. */
export type LiveCheck = CommandCheck | ProbeCheck | CallbackCheck;

export type Check = PureCheck | LiveCheck;

/** Where a CommandResultCheck's expected value comes from and how it's compared — deliberately reusing
 *  ValueAssertion's op vocabulary (plus `contains`, needed for matching plain-text stdout that isn't JSON)
 *  rather than inventing a separate matching language for command output (training-course.md design
 *  discussion: authors should feel like this is "the same check format, one more source", not a parallel
 *  system). `path` is omitted for a whole-value comparison (e.g. exact stdout match); when set, it's resolved
 *  against stdout parsed as JSON via paths.ts's pathValues — see commandResult.ts. */
export interface CommandExpect {
  path?: string;
  op: '==' | '>=' | '<=' | 'matches' | 'contains';
  value: unknown;
}

/** An author-defined, SERVER-run validation command (training-course.md design discussion, item #4) —
 *  distinct from CommandCheck above, which grades the student's own typed argv. This runs on its own
 *  initiative (manually via a "Check now" click, or on a background poll while a task is armed), which is why
 *  it is NOT folded into `Check`/`LiveCheck`/evaluateCheck's dispatch: those all operate on an already-built
 *  CheckContext (a captured ResourceGraph), whereas this evaluates a command's raw stdout — a different input
 *  shape entirely. Lives alongside a `vpk-task` block's `check` field (see lesson.ts), not a bare `vpk-check`
 *  block. `cli` optionally overrides the lesson's own frontmatter `cli` (e.g. a check that must run kubectl
 *  even inside an oc-authored lesson). Execution is still gated by the lesson's `allow` verb list, same
 *  checkCommandPolicy boundary the student terminal uses — this is a second, separate grant on top of that
 *  (see commandApproval.ts in @vpk/web): the student must also have approved the server auto-running this
 *  specific verb before the client will ever call it. */
export interface CommandResultCheck {
  id: string;
  describe: string;
  cli?: string[];
  verb: string;
  args?: string[];
  expect: CommandExpect;
}

/** One tier of the structural fingerprint. Strictness (§7.3) decides which tiers GATE a pass; all tiers are
 *  always computed so the UI can show "you'd also need X at Strict" even when it isn't required yet. */
export type FindingTier = 'kinds' | 'counts' | 'fields' | 'values';

export interface Finding {
  tier: FindingTier;
  status: 'ok' | 'mismatch';
  detail: Record<string, unknown>; // machine-usable, e.g. { kind:'Deployment', expected:1, actual:0 }
  message: string; // student-facing
}

/** functional = does it actually run (deferred to a later phase — status/probe/callback evaluators aren't
 *  built yet, see evaluate.ts's module doc comment); this module always reports 'n/a'.
 *  conformance = does it match the reference at the active strictness. */
export interface CheckResult {
  id: string;
  functional: 'working' | 'partial' | 'broken' | 'n/a';
  functionalVia?: 'status' | 'probe' | 'callback';
  conformance: 'matched' | 'divergent' | 'missing';
  summary: string;
  findings: Finding[];
  hint?: string;
}

export type StepLevel = 'matched' | 'working-with-differences' | 'not-yet-working' | 'incomplete';

export interface FeedbackItem {
  severity: 'blocker' | 'difference' | 'tip';
  message: string;
  focus?: { resourceId?: string; view?: 'schematic' | 'network' | 'ownerref' | 'wheel' };
}

export interface StepResult {
  status: 'pass' | 'fail'; // progression gate
  level: StepLevel; // the student-facing grade — decoupled from `status` (§7.8)
  checks: CheckResult[];
  feedback: FeedbackItem[];
}

export interface StepPolicy {
  strictness: Strictness;
  passWhen: 'functional' | 'conformant';
  floor: Strictness;
}
