import { pathValues } from './paths';
import type { CommandExpect } from './types';

/**
 * Pure evaluator for CommandResultCheck (types.ts) — given a command's raw stdout and an author's
 * `expect`, decides pass/fail. Kept separate from evaluate.ts's dispatch on purpose: this operates on a
 * command's stdout string, not a CheckContext/ResourceGraph, so it isn't a `Check` evaluator in that sense —
 * the server-side wrapper that actually runs the command (server/src/course, not this package) calls this
 * directly.
 */

function compareOne(actual: unknown, op: CommandExpect['op'], expected: unknown): boolean {
  switch (op) {
    case '==':
      return actual === expected;
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'matches':
      return typeof actual === 'string' && typeof expected === 'string' && new RegExp(expected).test(actual);
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
  }
}

export interface CommandResultEvaluation {
  passed: boolean;
  /** Every value `expect.path` resolved to (or the single whole parsed value, when no path is set) — surfaced
   *  so the caller can show the student what was actually seen, not just pass/fail. */
  values: unknown[];
}

/** Tries stdout as JSON first (most `kubectl/oc ... -o json` output is) — `expect.path` is resolved against
 *  that parsed form via paths.ts's pathValues, reusing the same dotted-path/`[*]`-wildcard convention checks
 *  already use elsewhere, rather than inventing a second path syntax. When stdout isn't JSON (or no `path` is
 *  given), the trimmed raw string is compared directly — the natural shape for `contains`/`matches` against
 *  plain-text output. */
export function evaluateCommandResult(stdout: string, expect: CommandExpect): CommandResultEvaluation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = stdout.trim();
  }
  const values = expect.path ? pathValues(parsed, expect.path) : [parsed];
  const passed = values.length > 0 && values.every((v) => compareOne(v, expect.op, expect.value));
  return { passed, values };
}
