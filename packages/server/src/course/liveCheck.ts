import { buildGraph, evaluateStep, type CheckContext, type PureCheck, type RawObject, type StepPolicy, type StepResult } from '@vpk/core';
import { captureCore } from '../capture/cliSource';
import { probeClusterFacts } from './env';

/**
 * The impure, server-side half of the check engine (redesign/training-course.md §7's "thin live wrapper").
 * Everything that actually DECIDES a result — the fingerprint comparison, the two-axis synthesis — lives in
 * @vpk/core/course as pure, unit-tested functions; this module's only job is to gather a fresh CheckContext
 * (capture + cluster-facts probe) and, for checks with a time-dependent outcome (a Deployment still rolling
 * out, `minikube start` still bringing nodes up), poll until it passes or a deadline elapses.
 */

/** Skips the (expensive, multi-kind) `captureCore` call entirely when every check in the step is a
 *  ClusterCheck — those only ever read `ctx.cluster`, never `ctx.graph`. This matters for real polling: the
 *  Lesson-Zero "wait for `minikube start` to bring nodes up" case (§9) wants a fast, tight poll loop against
 *  just `kubectl get nodes`, not a full-cluster capture dragged along every tick. */
function needsGraph(checks: PureCheck[]): boolean {
  return checks.some((c) => c.kind !== 'cluster');
}

async function buildLiveContext(
  checks: PureCheck[],
  cli: string[],
  answerKey: ((id: string) => RawObject[]) | undefined,
  signal?: AbortSignal,
): Promise<CheckContext> {
  const clusterPromise = probeClusterFacts(cli, signal);
  // captureCore deliberately THROWS on a genuine discovery failure (see its own doc comment — surfacing the
  // real reason matters for a one-shot "Capture from cluster"). But probeClusterFacts never throws, and this
  // wrapper's whole job is to always produce a StepResult — so a capture failure degrades to an empty graph
  // (any InventoryCheck naturally reads as conformance 'missing') rather than crashing the poll loop; the
  // unreachable-cluster signal itself still comes through cleanly via `cluster.contextReachable`.
  const capturePromise = needsGraph(checks) ? captureCore({ cli, scope: 'core', signal }).catch(() => ({ items: [] })) : Promise.resolve({ items: [] });
  const [cluster, captured] = await Promise.all([clusterPromise, capturePromise]);
  return { graph: buildGraph(captured.items), cluster, answerKey: answerKey ?? (() => []) };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

export interface RunStepLiveOptions {
  /** The kubectl-compatible CLI as argv — same contract as CaptureOptions.cli. */
  cli: string[];
  policy: StepPolicy;
  answerKey?: (id: string) => RawObject[];
  /** How long to keep polling for a pass before giving up and returning the last result as-is. 0 (default)
   *  means "evaluate once, don't poll" — the right choice for most checks; only a check whose target is
   *  known to take real wall-clock time to converge (a rollout, `minikube start` bringing nodes up) should
   *  set this. */
  timeoutMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
  /** Fired after every evaluation (including the first) — the `/course/check` route streams these so the UI
   *  can show "waiting for nodes… 1/2 Ready" instead of one opaque spinner while a long check converges. */
  onProgress?: (result: StepResult) => void;
}

const DEFAULT_POLL_MS = 2000;

/** Runs one lesson step's checks against the LIVE cluster, polling (if `timeoutMs` is set) until the step
 *  passes or the deadline elapses. Every evaluation re-captures — a check that's still failing this second
 *  might pass the next because the student (or a still-converging rollout) changed something in between. */
export async function runStepLive(checks: PureCheck[], opts: RunStepLiveOptions): Promise<StepResult> {
  const timeoutMs = opts.timeoutMs ?? 0;
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + timeoutMs;

  let result: StepResult | null = null;
  for (;;) {
    // Checked BEFORE starting a new evaluation, not just after — otherwise a sleep() that woke up early
    // because the signal was aborted would still kick off one more full capture cycle. A subprocess call
    // started with an ALREADY-aborted signal doesn't self-cancel (cliSource.ts's runCli registers its abort
    // listener without first checking `signal.aborted`, so a signal aborted before the call began never
    // fires that listener — a pre-existing gap, flagged separately, not fixed here), so skipping the call
    // entirely here is the only reliable way to make cancellation respond promptly.
    if (opts.signal?.aborted && result) return result;
    const ctx = await buildLiveContext(checks, opts.cli, opts.answerKey, opts.signal);
    result = evaluateStep(checks, ctx, opts.policy);
    opts.onProgress?.(result);
    if (result.status === 'pass' || opts.signal?.aborted || Date.now() >= deadline) return result;
    await sleep(pollMs, opts.signal);
  }
}
