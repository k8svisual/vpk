import { spawn } from 'node:child_process';
import type { RawObject } from '@vpk/core';
import { redactSecret, redactConfigMap } from '../redact';

/**
 * Capture a snapshot by invoking the user's kubectl-compatible CLI (DESIGN §4.2). Uses `spawn` with
 * argv arrays — NO shell — so nothing (kind names, the configured command) can inject. Discovery-driven:
 * only kinds the cluster actually has are fetched.
 */
export interface CaptureOptions {
  /** The CLI as argv, e.g. ['kubectl'], ['oc'], or ['ssh', 'host', 'kubectl']. Default ['kubectl']. */
  cli?: string[];
  /** Keep each Secret's `.data`/`.stringData` payload in the captured snapshot. Default true — set false to
   *  permanently discard it at capture time (baked in as the "not available" message, not just hidden by a
   *  display setting). The Secret's own definition — kind, metadata, type — is ALWAYS captured either way;
   *  VpK never skips fetching a resource kind wholesale, so this only ever affects the data payload. */
  keepSecretData?: boolean;
  /** Same idea as `keepSecretData`, one kind over: keep each ConfigMap's `.data`/`.binaryData` payload.
   *  Default true. A ConfigMap isn't a Secret, but it routinely carries sensitive text anyway (embedded
   *  certs, connection strings), so "Capture from cluster" offers this as an independent choice. */
  keepConfigMapData?: boolean;
  /** Fired once per resource kind as it's fetched (plus a couple of coarse discovery-phase notices) — the
   *  server's `/capture` route streams these straight to the client so the "Capture from cluster" modal can
   *  show live per-kind status instead of one opaque spinner. Optional and side-effect-free to omit (the CLI
   *  entry point capture-cli.ts doesn't pass one). */
  onProgress?: (event: CaptureProgressEvent) => void;
  /** 'core' (default) captures only the curated CORE_NS/CORE_CLUSTER kind list. 'all' captures every kind the
   *  cluster reports as get-able via `kubectl api-resources -o wide` — matching the original (pre-rewrite) VpK
   *  app's behavior, at the cost of a much larger/slower capture on clusters with many CRDs. */
  scope?: 'core' | 'all';
  /** Aborting this cancels the capture — kills any in-flight `kubectl`/CLI subprocess (via `spawn`'s own
   *  `signal` option) and stops launching new ones. The server's `/capture` route wires this to the request
   *  socket closing (the "Capture from cluster" modal's Cancel button aborts its fetch), so a cancelled
   *  capture doesn't leave orphaned subprocesses running in the background after the client's given up on it. */
  signal?: AbortSignal;
}

export type CaptureProgressEvent =
  | { type: 'phase'; message: string }
  | { type: 'progress'; kind: string; namespaced: boolean; count: number }
  | { type: 'warning'; kind: string; namespaced: boolean; error: string };

export interface CaptureResult {
  items: RawObject[];
  manifest: { vpkSnapshot: number; captured: string; cluster: string; kinds: number };
}

/** Runs `fn` over `items` with at most `limit` in flight at once — 40+ individual `kubectl get <kind>` calls
 *  run one at a time would be needlessly slow, but firing all of them at once risks overwhelming the API
 *  server (or a rate-limited one) for no benefit; a small pool balances the two. Order of completion (and
 *  therefore of any onProgress calls driven by `fn`) is NOT the same as `items`' order. */
async function withConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length && !signal?.aborted) {
      const item = items[next++] as T;
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Core capture scope (§4.2b), as `get`-usable resource names. Availability is checked before fetching.
const CORE_NS = [
  'pods', 'replicasets', 'deployments', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs',
  'controllerrevisions', 'services', 'endpoints', 'endpointslices', 'ingresses', 'networkpolicies',
  'configmaps', 'secrets', 'serviceaccounts', 'horizontalpodautoscalers', 'poddisruptionbudgets',
  'resourcequotas', 'limitranges', 'persistentvolumeclaims', 'roles', 'rolebindings', 'events',
  'gateways', 'httproutes', 'volumesnapshots',
];
const CORE_CLUSTER = [
  'nodes', 'namespaces', 'persistentvolumes', 'storageclasses', 'csidrivers', 'csinodes',
  'volumeattachments', 'ingressclasses', 'clusterroles', 'clusterrolebindings',
  'customresourcedefinitions', 'apiservices', 'gatewayclasses', 'volumesnapshotclasses',
];
/** Individual `kubectl get <kind>` calls in flight at once (see withConcurrency's own doc comment). */
const FETCH_CONCURRENCY = 6;

export async function captureCore(opts: CaptureOptions = {}): Promise<CaptureResult> {
  const cli = opts.cli ?? ['kubectl'];
  const keepSecretData = opts.keepSecretData ?? true;
  const keepConfigMapData = opts.keepConfigMapData ?? true;
  const scope = opts.scope ?? 'core';
  const onProgress = opts.onProgress ?? (() => {});
  const signal = opts.signal;

  onProgress({ type: 'phase', message: 'Discovering available resource types…' });
  let resources: ApiResource[];
  let cluster: string;
  try {
    [resources, cluster] = await Promise.all([discoverResources(cli, signal), currentContext(cli, signal)]);
  } catch (e: unknown) {
    if (signal?.aborted) throw new Error('Capture cancelled');
    throw new Error(`Discovery failed (${cli.join(' ')} api-resources): ${e instanceof Error ? e.message : String(e)}`);
  }
  if (signal?.aborted) throw new Error('Capture cancelled');
  // A real cluster always reports at least a handful of built-in resource types — zero here almost always
  // means the CLI ran but isn't actually talking to a live cluster (not logged in, no current context, wrong
  // command entirely), NOT a genuinely empty cluster. Treated as a hard failure rather than silently "capturing"
  // 0 objects, for the same reason discoverResources above no longer swallows its own errors.
  if (resources.length === 0) {
    throw new Error(`${cli.join(' ')} api-resources reported no resource types — is it connected to a live cluster?`);
  }

  // Secrets are ALWAYS fetched — never excluded from the kind list itself. keepSecretData only controls
  // whether the payload survives `trim()` below, never whether the object is captured at all.
  const kinds = scope === 'all' ? resources : resources.filter((r) => CORE_NS.includes(r.name) || CORE_CLUSTER.includes(r.name));

  // Fetched one kind at a time (not the old single bulk `kubectl get k1,k2,...`) specifically so onProgress
  // can report real per-kind status as each one lands, not just one opaque "capturing…" the whole time. A
  // single kind's failure (a forbidden RBAC rule, a flaky API server, ...) is reported as a warning and
  // SKIPPED, not fatal to the whole capture — the old bulk-fetch approach effectively made every kind
  // all-or-nothing together, which is far more fragile than it needs to be against a real, imperfectly-
  // permissioned cluster; the point of per-kind fetching is exactly that one denied kind shouldn't cost you
  // everything else.
  const raw: RawObject[] = [];
  await withConcurrency(
    kinds,
    FETCH_CONCURRENCY,
    async (r) => {
      try {
        const objs = await getOneKind(cli, r.name, r.namespaced, signal);
        raw.push(...objs);
        onProgress({ type: 'progress', kind: r.name, namespaced: r.namespaced, count: objs.length });
      } catch (e: unknown) {
        if (signal?.aborted) return; // cancelled mid-fetch — not a real per-kind failure, don't report one
        onProgress({ type: 'warning', kind: r.name, namespaced: r.namespaced, error: String(e) });
      }
    },
    signal,
  );
  if (signal?.aborted) throw new Error('Capture cancelled');

  const items = raw.map((o) => trim(o, keepSecretData, keepConfigMapData));
  return {
    items,
    manifest: {
      vpkSnapshot: 2,
      captured: new Date().toISOString(),
      cluster,
      kinds: kinds.length,
    },
  };
}

function trim(obj: RawObject, keepSecretData: boolean, keepConfigMapData: boolean): RawObject {
  let out = obj;
  if (obj.metadata && obj.metadata.managedFields !== undefined) {
    const metadata = { ...obj.metadata };
    delete metadata.managedFields;
    out = { ...out, metadata };
  }
  if (!keepSecretData) out = redactSecret(out);
  if (!keepConfigMapData) out = redactConfigMap(out);
  return out;
}

export interface ApiResource {
  name: string;
  namespaced: boolean;
}

/** Discovers every resource kind the cluster reports (one `api-resources -o wide` call, not the old two
 *  `-o name` calls split by --namespaced), keeping only ones whose VERBS column actually lists `get` (some
 *  kinds — e.g. `bindings` — only support a subset of verbs) and deduping by resource name: a name can appear
 *  more than once under different API groups/versions (e.g. `events` in both `v1` and `events.k8s.io`), and
 *  only the FIRST occurrence is kept so it's fetched exactly once — matching the original (pre-rewrite) VpK
 *  app's discovery logic. Sorted by name last, so progress reports (and capture order) are deterministic. */
/** Deliberately does NOT swallow a failure here (an earlier version did, returning `[]` on any error) — that
 *  made a capture against a CLI that can run (`version --client` succeeds) but isn't actually connected to a
 *  live cluster (not logged in, no context, network unreachable, ...) look like a totally normal, successful,
 *  empty capture: "Capture complete — 0 objects", no warning, no error, nothing to explain why. Letting this
 *  throw means captureCore's caller sees the REAL reason (e.g. "the server doesn't have a resource type"/"not
 *  logged in") instead of a silent zero. */
async function discoverResources(cli: string[], signal?: AbortSignal): Promise<ApiResource[]> {
  const out = await runCli([...cli, 'api-resources', '-o', 'wide'], signal);
  return parseApiResourcesWide(out);
}

/** Parses `kubectl api-resources -o wide`'s column-aligned text table. Columns are located by their header
 *  label's character offset (VERBS/CATEGORIES are comma-joined with no internal spaces, but SHORTNAMES is
 *  frequently blank, so naive whitespace-splitting misaligns columns — slicing by header offset doesn't).
 *  The VERBS cell's own format varies by CLI vintage: modern kubectl prints a bare comma-joined list
 *  (`get,list,watch`), but older kubectl-compatible clients (confirmed against a real `oc` v4.1.0, ~2019 —
 *  still in active use against clusters that predate a kubectl upgrade) print a bracketed, space-separated
 *  list instead (`[get list watch]`) — stripping brackets and splitting on either comma or whitespace handles
 *  both without needing to special-case by CLI. */
export function parseApiResourcesWide(output: string): ApiResource[] {
  const lines = output.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0] as string;
  const shortStart = header.indexOf('SHORTNAMES');
  const namespacedStart = header.indexOf('NAMESPACED');
  const kindStart = header.indexOf('KIND');
  const verbsStart = header.indexOf('VERBS');
  const categoriesStart = header.indexOf('CATEGORIES');
  if (shortStart < 0 || namespacedStart < 0 || kindStart < 0 || verbsStart < 0) return [];

  const seen = new Set<string>();
  const resources: ApiResource[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as string;
    const name = line.slice(0, shortStart).trim();
    // Dedup by name FIRST, regardless of get-support — once a name is claimed by one API group, a later
    // group's same-named resource is skipped outright rather than being considered as a fallback.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const verbsEnd = categoriesStart > verbsStart ? categoriesStart : line.length;
    const verbs = line
      .slice(verbsStart, verbsEnd)
      .trim()
      .replace(/[[\]]/g, '')
      .split(/[,\s]+/)
      .filter(Boolean);
    if (!verbs.includes('get')) continue;
    const namespaced = line.slice(namespacedStart, kindStart).trim() === 'true';
    resources.push({ name, namespaced });
  }
  return resources.sort((a, b) => a.name.localeCompare(b.name));
}

async function getOneKind(cli: string[], kind: string, namespaced: boolean, signal?: AbortSignal): Promise<RawObject[]> {
  const args = [...cli, 'get', kind, '-o', 'json', ...(namespaced ? ['-A'] : [])];
  const doc = JSON.parse(await runCli(args, signal)) as { items?: RawObject[] };
  return doc.items ?? [];
}

async function currentContext(cli: string[], signal?: AbortSignal): Promise<string> {
  try {
    return (await runCli([...cli, 'config', 'current-context'], signal)).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface ValidateResult {
  ok: boolean;
  /** False specifically means the binary itself couldn't be found (ENOENT) — distinct from "found but errored
   *  when run" (e.g. bad flags, no cluster access), which still counts `located: true`. */
  located: boolean;
  message: string;
}

/** "Can be located and run" check for the Capture modal's Validate button — deliberately NOT a full
 *  discovery/capture, just `<cli> version --client=true`: works without a live cluster connection (unlike
 *  e.g. `config current-context`, which some kubectl-compatible CLIs treat as needing one), and is universally
 *  supported across kubectl-compatible clients (kubectl, oc, ...) VpK already targets. */
export async function validateCli(cliArgv: string[]): Promise<ValidateResult> {
  if (cliArgv.length === 0 || !cliArgv[0]?.trim()) {
    return { ok: false, located: false, message: 'No command configured.' };
  }
  try {
    const out = await runCli([...cliArgv, 'version', '--client=true']);
    return { ok: true, located: true, message: out.trim().split('\n')[0] || 'Ran successfully.' };
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { ok: false, located: false, message: `Command not found: ${cliArgv[0]}` };
    }
    return { ok: false, located: true, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Run a CLI (argv array, no shell). Resolves stdout on exit 0, rejects with stderr otherwise. `signal`, if
 *  given and later aborted, kills the WHOLE process group the child leads (`detached: true` + `kill(-pid, …)`,
 *  not just Node's own `spawn({signal})`, which only kills the direct child) — the Cancel button's mechanism,
 *  see CaptureOptions.signal's own doc comment. The group-kill matters because `cli` isn't always a single
 *  compiled binary: a wrapper (`ssh host kubectl`, a custom shell shim) spawns its own grandchildren, which a
 *  plain kill on the direct child's PID would leave orphaned and still running after "Cancel" — confirmed live
 *  during testing (a `sleep`-based test double's own child outlived the SIGTERM until this was added). */
function runCli(argv: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    if (!cmd) {
      reject(new Error('empty command'));
      return;
    }
    const child = spawn(cmd, args, { detached: true });
    let out = '';
    let err = '';
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // already exited between the signal firing and this running — nothing left to kill
        }
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (aborted) {
        reject(new Error('Aborted'));
        return;
      }
      if (code === 0) resolve(out);
      else reject(new Error(err.trim() || `${cmd} exited ${code}`));
    });
  });
}
