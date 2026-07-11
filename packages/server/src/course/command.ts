import { spawn } from 'node:child_process';

/**
 * Structured command runner (redesign/training-course.md §5) — this is the terminal's execution engine, and
 * it is deliberately NOT a shell or a PTY: it runs exactly one argv (tokenized from what the student typed,
 * never passed through `sh -c`), always as the lesson's configured kubectl-compatible CLI, and returns
 * structured `{stdout, stderr, exitCode}` rather than a stream of ANSI bytes. That's what lets a course
 * actually UNDERSTAND what the student ran well enough to grade it (a CommandCheck) — parsing intent out of a
 * PTY session is far harder than working with a clean argv the tokenizer already produced.
 *
 * A separate implementation from cliSource.ts's `runCli` on purpose: that function's contract is "resolve
 * stdout on exit 0, reject on anything else" — right for a one-shot capture, wrong here, where a NON-zero
 * exit (a typo'd kind, a forbidden RBAC rule) is completely normal input a lesson needs to see and possibly
 * grade on, not an exceptional failure to throw away.
 */

export interface CommandResult {
  argv: string[];
  stdout: string;
  stderr: string;
  /** null specifically means "aborted before/without exiting normally" — distinct from a real (possibly
   *  non-zero) exit code the process itself reported. */
  exitCode: number | null;
  durationMs: number;
}

const SHELL_OPERATOR_CHARS = new Set(['|', '>', '<', '&', ';', '`']);

/** Quote-aware whitespace tokenizer — handles `kubectl get pods -o jsonpath='{.items[0].metadata.name}'`
 *  correctly (a naive `.split(/\s+/)` would break on the space-free JSONPath, but would also happily split
 *  something like `-l app=foo bar` wrong if that ever needed quoting; quote-awareness matters either way).
 *  Deliberately REJECTS shell operators (pipes, redirects, backticks, `&&`/`;` chaining) rather than trying
 *  to support them — this runs one plain command, not a shell, and silently mis-tokenizing an operator
 *  character into a literal argument would be worse than a clear upfront error. */
export function tokenizeCommand(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inToken = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
      continue;
    }
    if (SHELL_OPERATOR_CHARS.has(ch) || (ch === '$' && line[i + 1] === '(')) {
      throw new Error(`Shell operators aren't supported here (found "${ch}") — this runs one plain command, not a shell.`);
    }
    current += ch;
    inToken = true;
  }
  if (quote) throw new Error('Unterminated quote.');
  if (inToken) tokens.push(current);
  return tokens;
}

export interface CommandPolicy {
  /** Verbs allowed for this lesson step, e.g. ['get', 'describe', 'logs']. Required, not defaulted to
   *  "anything" — an author has to explicitly opt a step into which verbs are safe, matching the design's
   *  "policy layer... blocked by default" stance (§5). */
  allow: string[];
}

export type PolicyDecision = { allowed: true } | { allowed: false; reason: string };

const MUTATING_VERBS = new Set(['apply', 'create', 'delete', 'edit', 'patch', 'replace', 'scale', 'label', 'annotate', 'set', 'rollout', 'expose', 'taint', 'drain', 'cordon', 'uncordon']);
const ALL_NAMESPACES_FLAGS = new Set(['--all-namespaces', '-A']);

/** Checks a tokenized command against the lesson's policy. Three gates, in order:
 *   1. It must literally start with the configured `cli` argv — never a different binary. This is the
 *      hard boundary that keeps the terminal from being a general shell: no `rm`, no `curl`, nothing but
 *      the one kubectl-compatible command the lesson is scoped to.
 *   2. Its verb must be in the lesson's `allow` list.
 *   3. Two destructive-global blocks that apply regardless of `allow` (§5: "blocked by default"): deleting a
 *      Node, and any mutating verb combined with -A/--all-namespaces. */
export function checkCommandPolicy(argv: string[], cli: string[], policy: CommandPolicy): PolicyDecision {
  if (argv.length === 0) return { allowed: false, reason: 'Empty command.' };
  if (!cli.every((part, i) => argv[i] === part)) {
    return { allowed: false, reason: `Only "${cli.join(' ')}" commands are allowed here.` };
  }
  const verb = argv[cli.length];
  if (!verb) return { allowed: false, reason: 'No command given.' };
  if (!policy.allow.includes(verb)) {
    return { allowed: false, reason: `"${verb}" isn't allowed in this step. Allowed: ${policy.allow.join(', ') || '(none)'}.` };
  }

  const rest = argv.slice(cli.length + 1);
  const targetsNode = rest.some((a) => a === 'node' || a === 'nodes' || a.startsWith('node/') || a.startsWith('nodes/'));
  if (verb === 'delete' && targetsNode) {
    return { allowed: false, reason: 'Deleting Nodes is never allowed from a lesson step.' };
  }
  if (MUTATING_VERBS.has(verb) && rest.some((a) => ALL_NAMESPACES_FLAGS.has(a))) {
    return { allowed: false, reason: `"${verb}" across all namespaces (-A/--all-namespaces) is blocked — scope it to your own namespace.` };
  }
  return { allowed: true };
}

/** Probes whether `cli` resolves to a real, spawnable binary — the "is oc even installed" half of the
 *  auto-validation command approval flow (training-course.md design discussion, item #4): before a task's
 *  command-check can be approved, the student needs to know whether the CLI it names is actually on this
 *  machine's PATH (or at whatever absolute path they're offered to enter instead). Spawns `cli` with no
 *  arguments and `stdio: 'ignore'` — kubectl/oc (and any kubectl-compatible CLI this app targets) print usage
 *  and exit immediately when given no args, so this never hangs waiting on stdin; the 3s timeout is a safety
 *  net for anything unusual, not the expected path. Node's 'spawn' event fires once the OS has actually
 *  started the process (so the binary genuinely exists and is executable); 'error' with code 'ENOENT' is the
 *  well-defined signal for "not found" — any OTHER error (e.g. EACCES) still means the binary is THERE, just
 *  broken in some other way, which counts as "found" for this probe's purpose (that's a different problem for
 *  the student to fix, not what this check is for). */
export function probeBinary(cli: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    let settled = false;
    const child = spawn(cli, [], { stdio: 'ignore' });
    const timer = setTimeout(() => finish(false), 3000);
    function finish(found: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        // already exited
      }
      resolve(found);
    }
    child.on('error', (err: NodeJS.ErrnoException) => finish(err.code !== 'ENOENT'));
    child.on('spawn', () => finish(true));
  });
}

/** Runs one argv (no shell). Unlike cliSource.ts's runCli, this ALWAYS resolves — a non-zero exit is a
 *  normal result to show the student, not a rejection — and checks `signal?.aborted` before spawning at all,
 *  so an already-aborted signal short-circuits cleanly instead of the subprocess running to completion with
 *  no way to be told to stop (see liveCheck.ts's own comment on this exact class of bug in runCli). */
export function runCourseCommand(argv: string[], signal?: AbortSignal): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = argv;
    if (!cmd) {
      reject(new Error('empty command'));
      return;
    }
    if (signal?.aborted) {
      resolve({ argv, stdout: '', stderr: '', exitCode: null, durationMs: 0 });
      return;
    }

    const startedAt = Date.now();
    const child = spawn(cmd, args, { detached: true });
    let stdout = '';
    let stderr = '';
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
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      resolve({ argv, stdout, stderr, exitCode: aborted ? null : code, durationMs: Date.now() - startedAt });
    });
  });
}
