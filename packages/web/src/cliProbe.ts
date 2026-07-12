/** Shared client for the probe primitives Settings' CLI-path/command testers (and CliPathFixer) all use — kept
 *  in one file so there's a single definition of "what counts as found/working" instead of several ad hoc
 *  fetches drifting apart. */

/** Per-row delay for the tester rows' auto-probe on mount. Each probe spawns a real server process, so a list
 *  of rows staggers them (row index × this) rather than firing every spawn the instant the tab renders. */
export const PROBE_STAGGER_MS = 120;

/** NEVER rejects — a network failure or a non-JSON error response (a 500 HTML page, a dev-server restart)
 *  resolves to `false` rather than throwing. The callers (CliPathFixer, VerbTester, BinaryTester) treat the
 *  boolean as their whole status; an unhandled rejection here would leave those testers stuck on "checking…"
 *  forever — freezing the only "point me at the missing binary" recovery UI at exactly the moment the server
 *  is unreachable. "Couldn't confirm it resolves" and "confirmed missing" collapse to the same false here on
 *  purpose; the user simply retries once the server is back. */
export async function probeCli(cli: string): Promise<boolean> {
  try {
    const res = await fetch('/course/probe-cli', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cli }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { found?: boolean };
    return json.found === true;
  } catch {
    return false;
  }
}

export interface CommandProbeResult {
  argv: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/** `ok` mirrors "exit 0" — for `--help`-style smoke tests that's the closest available proxy for "this is a
 *  real, working command" without actually doing anything. `result` carries the full stdout/stderr/exitCode
 *  whenever the server got far enough to produce one (even on a non-zero exit) so a caller can show the real
 *  output in a details view — `error` is reserved for requests that never produced a CommandProbeResult at all
 *  (blocked by policy, couldn't spawn, tokenizer rejected the line, network failure). */
export type CommandProbeOutcome = { ok: boolean; result: CommandProbeResult } | { ok: false; error: string };

async function runProbeCommand(body: { line: string; cli: string; allow: string[]; extraBinaries?: string[] }): Promise<CommandProbeOutcome> {
  let res: Response;
  try {
    res = await fetch('/course/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: 'Could not reach the VpK server.' };
  }
  // Guard the parse too, not just the fetch: a non-JSON error response (a 500 HTML page, a proxy error during
  // a dev-server restart) makes res.json() throw — left unguarded that rejected probeVerb/probeStandalone and
  // stuck their testers on "checking…" forever. Any unreadable/failed response collapses to a shown error.
  let json: CommandProbeResult | { error: string };
  try {
    json = (await res.json()) as CommandProbeResult | { error: string };
  } catch {
    return { ok: false, error: res.ok ? 'The server returned an unreadable response.' : `Request failed (HTTP ${res.status}).` };
  }
  if (!res.ok || 'error' in json) return { ok: false, error: 'error' in json ? json.error : `Request failed (HTTP ${res.status}).` };
  return { ok: json.exitCode === 0, result: json };
}

/** Tests whether `cli` recognizes `verb` as a real subcommand, by running `<cli> <verb> --help` through the
 *  same structured runner the terminal itself uses (server/src/course/command.ts's /course/command) — never a
 *  shell, and `--help` never mutates a cluster, so this is safe to run purely to validate a verb a student is
 *  about to add to their always-allowed list. Assumes `cli` itself is already known to resolve (callers should
 *  probeCli first) — a binary that isn't found fails here in a way indistinguishable from "unknown verb",
 *  which is why callers probe separately and offer CliPathFixer instead of this generic message. */
export function probeVerb(cli: string, verb: string): Promise<CommandProbeOutcome> {
  return runProbeCommand({ line: `${cli} ${verb} --help`, cli, allow: [verb] });
}

/** Same idea as probeVerb but for a whole STANDALONE binary (grep, jq, curl, ...) added to Settings' extra-
 *  binaries list — runs `<binary> --help` via /course/command's `extraBinaries` gate (command.ts's
 *  CommandPolicy), which trusts the whole binary rather than gating on a verb the way `cli` is. `cli` here is
 *  set to `binary` itself purely so the server's own error messages read sensibly if something upstream ever
 *  rejects the request; the actual permission comes from `extraBinaries`. */
export function probeStandalone(binary: string): Promise<CommandProbeOutcome> {
  return runProbeCommand({ line: `${binary} --help`, cli: binary, allow: [], extraBinaries: [binary] });
}
